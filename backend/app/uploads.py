"""Document capture and recoverable metadata writes for Mayan 4.x."""
import secrets
import time
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, PositiveInt
from starlette.datastructures import UploadFile

from app.auth import COOKIE_NAME, store_for, trusted_origin
from app.documents import check_upstream, read_detail, upstream_access

router = APIRouter(prefix="/api/v1", tags=["Upload and metadata"])
MAX_FILE = 50 * 1024 * 1024
# Development-only retry ledger, same process lifetime as our sessions.
operations: dict[tuple[str, str], dict] = {}


def require_write(request: Request):
    upstream_access(request)
    session = store_for(request).get(request.cookies.get(COOKIE_NAME))
    supplied = request.headers.get("x-csrf-token", "")
    if not supplied.isascii() or not secrets.compare_digest(supplied, session.csrf):
        raise HTTPException(403, "Refresh the page before saving again.")


async def call(request: Request, method: str, path: str, **kwargs):
    settings, headers = upstream_access(request)
    async with httpx.AsyncClient(timeout=120, follow_redirects=False) as client:
        try:
            return await client.request(method, str(settings.mayan_api_url).rstrip("/") + path,
                                        headers={**headers, "Accept": "application/json"}, **kwargs)
        except httpx.HTTPError:
            raise HTTPException(503, "The service did not confirm the request. Check the document list before uploading again.") from None


async def all_rows(request: Request, path: str):
    rows = []
    for page in range(1, 101):
        response = await call(request, "GET", path, params={"page": page})
        check_upstream(request, response.status_code)
        try:
            data = response.json()
            batch = data["results"]
            if not isinstance(batch, list):
                raise ValueError
            rows.extend(batch)
            if not data.get("next"):
                return rows
        except (ValueError, KeyError, TypeError):
            raise HTTPException(502, "The service returned an unexpected response.") from None
    raise HTTPException(502, "Too many configuration entries. Contact your administrator.")


@router.get("/upload/types")
async def upload_types(request: Request):
    rows = await all_rows(request, "/document_types/")
    return {"results": [{"id": row["id"], "label": row["label"]} for row in rows], "max_file_bytes": MAX_FILE}


async def fields_for(request: Request, type_id: int):
    if type_id < 1:
        raise HTTPException(422, "Choose a document type.")
    rows = await all_rows(request, f"/document_types/{type_id}/metadata_types/")
    return [{"id": row["metadata_type"]["id"], "label": row["metadata_type"]["label"],
             "required": bool(row["required"]),
             "constrained": bool(row["metadata_type"].get("validation") or row["metadata_type"].get("lookup"))}
            for row in rows]


@router.get("/upload/types/{type_id}/fields")
async def upload_fields(request: Request, type_id: int):
    return {"results": await fields_for(request, type_id)}


class OrganizationSelection(BaseModel):
    tag_ids: list[PositiveInt] = Field(default_factory=list, max_length=50)
    cabinet_ids: list[PositiveInt] = Field(default_factory=list, max_length=50)


@router.get("/upload/tags")
async def upload_tags(request: Request):
    rows = await all_rows(request, "/tags/")
    return {"results": [{"id": row["id"], "label": row["label"]} for row in rows]}


@router.get("/upload/cabinets")
async def upload_cabinets(request: Request):
    rows = await all_rows(request, "/cabinets/")
    # Use the permission-filtered result rows, not recursively embedded children.
    return {"results": [{"id": row["id"], "label": row["label"],
                         "full_path": row.get("full_path") or row["label"]} for row in rows]}


async def validate_organization(request: Request, selection: OrganizationSelection):
    for kind, selected in (("tags", selection.tag_ids), ("cabinets", selection.cabinet_ids)):
        if selected:
            rows = await all_rows(request, f"/{kind}/")
            available = {row["id"] for row in rows}
            if set(selected) - available:
                raise HTTPException(422, f"Some selected {kind} are no longer available. Reload the choices before uploading.")


async def save_organization(request: Request, document_id: int, selection: OrganizationSelection):
    errors = []
    for kind, selected in (("tags", selection.tag_ids), ("cabinets", selection.cabinet_ids)):
        if not selected:
            continue
        try:
            existing = {row["id"] for row in await all_rows(request, f"/documents/{document_id}/{kind}/")}
        except HTTPException:
            errors.append(f"Could not check existing {kind}. Retry assignments after checking your access.")
            continue
        for item_id in dict.fromkeys(selected):
            if item_id in existing:
                continue
            path = (f"/documents/{document_id}/tags/attach/" if kind == "tags"
                    else f"/cabinets/{item_id}/documents/add/")
            payload = {"tag": item_id} if kind == "tags" else {"document": document_id}
            try:
                response = await call(request, "POST", path, json=payload)
                if response.status_code not in (200, 201, 202, 204):
                    if response.status_code == 401:
                        check_upstream(request, response.status_code)
                    errors.append(f"{kind.title()} #{item_id} could not be assigned. Check assignment permissions and retry.")
            except HTTPException:
                errors.append(f"{kind.title()} #{item_id} assignment could not be confirmed. Retry to check and complete it.")
    return errors


@router.get("/records/{document_id}/organization/{kind}")
async def record_organization(request: Request, document_id: int, kind: str):
    if kind not in ("tags", "cabinets") or document_id < 1:
        raise HTTPException(404, "Not found.")
    rows = await all_rows(request, f"/documents/{document_id}/{kind}/")
    return {"results": [{"id": row["id"], "label": row["label"],
                         "full_path": row.get("full_path") or row["label"]} for row in rows]}


class CaptureData(OrganizationSelection):
    document_type_id: int = Field(gt=0)
    label: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=10000)
    metadata: dict[str, str] = Field(default_factory=dict, max_length=100)


async def validate_values(request: Request, type_id: int, values: dict[str, str]):
    fields = await fields_for(request, type_id)
    allowed = {str(field["id"]) for field in fields}
    if set(values) - allowed or any(len(value) > 10000 for value in values.values()):
        raise HTTPException(422, "Metadata does not match the selected document type.")
    missing = [field["label"] for field in fields if field["required"] and not values.get(str(field["id"]), "").strip()]
    if missing:
        raise HTTPException(422, "Complete required metadata: " + ", ".join(missing))
    return fields


@router.get("/records/{document_id}/metadata")
async def read_metadata(request: Request, document_id: int):
    if document_id < 1:
        raise HTTPException(404, "Record not found.")
    rows = await all_rows(request, f"/documents/{document_id}/metadata/")
    return {"results": [{"id": row["metadata_type"]["id"], "label": row["metadata_type"]["label"],
                         "value": row["value"]} for row in rows]}


async def save_values(request: Request, document_id: int, values: dict[str, str], fields: list):
    # Reading existing entries also catches defaults created automatically by Mayan.
    existing = await all_rows(request, f"/documents/{document_id}/metadata/")
    entries = {str(row["metadata_type"]["id"]): row for row in existing}
    errors = []
    labels = {str(field["id"]): field["label"] for field in fields}
    for key, value in values.items():
        if not value.strip():
            continue
        previous = entries.get(key)
        if previous and previous["value"] == value:
            continue
        path = f"/documents/{document_id}/metadata/"
        if previous:
            response = await call(request, "PATCH", path + f"{previous['id']}/", json={"value": value})
        else:
            response = await call(request, "POST", path, json={"metadata_type_id": int(key), "value": value})
        if response.status_code not in (200, 201):
            if response.status_code == 400:
                errors.append(f"{labels[key]}: value was rejected by the configured metadata rules.")
            elif response.status_code == 403:
                errors.append(f"{labels[key]}: your account cannot save this metadata.")
            else:
                check_upstream(request, response.status_code)
    return errors


class MetadataValues(OrganizationSelection):
    metadata: dict[str, str] = Field(max_length=100)


@router.put("/records/{document_id}/metadata", dependencies=[Depends(trusted_origin), Depends(require_write)])
async def retry_metadata(request: Request, document_id: int, body: MetadataValues):
    record = await read_detail(request, document_id)
    if not record.document_type:
        raise HTTPException(422, "This record has no document type.")
    fields = await validate_values(request, record.document_type.id, body.metadata)
    errors = await save_values(request, document_id, body.metadata, fields)
    return {"document_id": document_id, "metadata_saved": not errors, "errors": errors}


async def finish_capture(request: Request, document_id: int, values: dict[str, str], fields: list,
                         selection: OrganizationSelection):
    result = {"document_id": document_id, "metadata_saved": False, "organization_saved": False, "errors": []}
    try:
        metadata_errors = await save_values(request, document_id, values, fields) if any(v.strip() for v in values.values()) else []
        result["metadata_saved"] = not metadata_errors
        result["errors"].extend(metadata_errors)
    except HTTPException:
        result["errors"].append("Metadata could not be confirmed. Retry on this record without uploading the file again.")
    organization_errors = await save_organization(request, document_id, selection)
    result["organization_saved"] = not organization_errors
    result["errors"].extend(organization_errors)
    return result


@router.put("/records/{document_id}/complete-upload", dependencies=[Depends(trusted_origin), Depends(require_write)])
async def complete_upload(request: Request, document_id: int, body: MetadataValues):
    record = await read_detail(request, document_id)
    if not record.document_type:
        raise HTTPException(422, "This record has no document type.")
    fields = await validate_values(request, record.document_type.id, body.metadata)
    return await finish_capture(request, document_id, body.metadata, fields, body)


@router.post("/upload", dependencies=[Depends(trusted_origin), Depends(require_write)])
async def upload(request: Request):
    try:
        key = str(UUID(request.headers.get("idempotency-key", "")))
    except ValueError:
        raise HTTPException(422, "An upload request identifier is required.") from None
    now = time.monotonic()
    for old_key in list(operations):
        if operations[old_key]["expires"] < now:
            del operations[old_key]
    operation_key = (request.cookies[COOKIE_NAME], key)
    if operation_key in operations:
        prior = operations[operation_key]
        if prior.get("result"):
            return prior["result"]
        raise HTTPException(409, "This upload is in progress or its outcome is uncertain. Check the document list before creating another.")
    if len(operations) >= 1000:
        raise HTTPException(503, "Upload service is busy. Try again later.")
    length = request.headers.get("content-length", "")
    if not length.isdigit() or int(length) > MAX_FILE + 1024 * 1024:
        raise HTTPException(413, "Choose one file up to 50 MB.")
    async with request.form(max_files=1, max_fields=2, max_part_size=1024 * 1024) as form:
        file = form.get("file")
        if not isinstance(file, UploadFile) or file.size is None or not 0 < file.size <= MAX_FILE:
            raise HTTPException(422, "Choose a non-empty file up to 50 MB.")
        try:
            body = CaptureData.model_validate_json(str(form.get("details", "")))
        except ValueError:
            raise HTTPException(422, "Check the document title, type, and metadata.") from None
        if not body.label.strip():
            raise HTTPException(422, "Enter a document title.")
        fields = await validate_values(request, body.document_type_id, body.metadata)
        await validate_organization(request, body)
        # Reserve after preflight. Once sent upstream, never automatically re-upload.
        if operation_key in operations:
            raise HTTPException(409, "This upload has already been submitted. Check the document list.")
        operations[operation_key] = {"expires": now + 3600}
        filename = (file.filename or "document").replace("\\", "/").split("/")[-1]
        response = await call(request, "POST", "/documents/upload/",
                              data={"document_type_id": str(body.document_type_id), "label": body.label,
                                    "description": body.description},
                              files={"file": (filename, file.file, file.content_type or "application/octet-stream")})
        if response.status_code in (400, 403, 404):
            del operations[operation_key]
            raise HTTPException(response.status_code, "Upload rejected. Check the document fields and your create-document permission for this type.")
        if response.status_code not in (200, 201, 202):
            check_upstream(request, response.status_code)
        try:
            document_id = response.json()["id"]
            if not isinstance(document_id, int) or document_id < 1:
                raise ValueError
        except (ValueError, KeyError, TypeError):
            raise HTTPException(502, "Upload outcome is uncertain. Check the document list before trying again.") from None
        result = {"document_id": document_id, "metadata_saved": False, "organization_saved": False,
                  "errors": ["Record created. Additional fields and assignments are not yet confirmed."]}
        operations[operation_key]["result"] = result
        result.update(await finish_capture(request, document_id, body.metadata, fields, body))
        return result
