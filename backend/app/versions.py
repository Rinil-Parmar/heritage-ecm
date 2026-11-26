"""Permission-aware document version history and replacement-file uploads."""

import secrets
import time
from datetime import datetime
from urllib.parse import parse_qs, urlparse
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field
from starlette.datastructures import UploadFile
from starlette.responses import StreamingResponse

from app.auth import COOKIE_NAME, store_for
from app.documents import check_upstream, upstream_access
from app.uploads import MAX_FILE, call, require_write

router = APIRouter(prefix="/api/v1/documents", tags=["Document versions"])
version_operations: dict[tuple[str, int, str], dict] = {}


class DocumentVersion(BaseModel):
    id: int
    active: bool = False
    comment: str = ""
    timestamp: datetime


class VersionList(BaseModel):
    results: list[DocumentVersion]


class PreviewPage(BaseModel):
    id: int
    page_number: int
    image_hash: str = ""


class PreviewPageList(BaseModel):
    version_id: int
    count: int
    results: list[PreviewPage]


async def all_versions(request: Request, document_id: int) -> list[dict]:
    rows: list[dict] = []
    for page in range(1, 101):
        response = await call(
            request, "GET", f"/documents/{document_id}/versions/",
            params={"page": page}
        )
        check_upstream(request, response.status_code)
        try:
            body = response.json()
            batch = body["results"]
            if not isinstance(batch, list):
                raise ValueError
            rows.extend(batch)
            if not body.get("next"):
                return rows
        except (ValueError, KeyError, TypeError):
            raise HTTPException(502, "The version service returned an unexpected response.") from None
    raise HTTPException(502, "This record has too many versions to display. Contact your administrator.")


@router.get("/{document_id}/versions", response_model=VersionList)
async def list_versions(request: Request, document_id: int):
    if document_id < 1:
        raise HTTPException(404, "Record not found.")
    rows = await all_versions(request, document_id)
    try:
        versions = [DocumentVersion.model_validate(row) for row in rows]
    except ValueError:
        raise HTTPException(502, "The version service returned an unexpected response.") from None
    versions.sort(key=lambda item: item.timestamp, reverse=True)
    return VersionList(results=versions)


@router.get("/{document_id}/preview-pages", response_model=PreviewPageList)
async def list_preview_pages(request: Request, document_id: int):
    """Return Mayan-rendered pages for the active document version.

    Page images work for PDFs, Office files, TIFFs, and other formats supported
    by Mayan's converter without downloading the entire original to the browser.
    """
    if document_id < 1:
        raise HTTPException(404, "Record not found.")
    versions = await all_versions(request, document_id)
    active = next((row for row in versions if row.get("active")), None)
    if active is None:
        raise HTTPException(409, "This record does not have an active version to preview.")
    try:
        version_id = int(active["id"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(502, "The version service returned an invalid active version.") from None
    rows: list[dict] = []
    for page in range(1, 501):
        response = await call(
            request, "GET", f"/documents/{document_id}/versions/{version_id}/pages/",
            params={"page": page},
        )
        check_upstream(request, response.status_code)
        try:
            body = response.json()
            batch = body["results"]
            if not isinstance(batch, list):
                raise ValueError
            rows.extend(batch)
            if not body.get("next"):
                break
        except (ValueError, KeyError, TypeError):
            raise HTTPException(502, "The preview service returned an unexpected response.") from None
    else:
        raise HTTPException(422, "This document has more than 500 pages. Download the original to review it.")
    try:
        pages = []
        for index, row in enumerate(rows):
            image_url = str(row.get("image_url") or "")
            image_hash = parse_qs(urlparse(image_url).query).get("_hash", [""])[0]
            if image_hash and (len(image_hash) > 128 or not image_hash.isalnum()):
                image_hash = ""
            pages.append(PreviewPage(
                id=int(row["id"]),
                page_number=int(row.get("page_number") or index + 1),
                image_hash=image_hash,
            ))
    except (KeyError, TypeError, ValueError):
        raise HTTPException(502, "The preview service returned invalid page information.") from None
    pages.sort(key=lambda item: item.page_number)
    return PreviewPageList(version_id=version_id, count=len(pages), results=pages)


@router.get("/{document_id}/preview-pages/{version_id}/{page_id}")
async def preview_page_image(
    request: Request, document_id: int, version_id: int, page_id: int,
    width: int = Query(default=1400, ge=600, le=2400),
    image_hash: str = Query(default="", alias="_hash", max_length=128, pattern=r"^[A-Za-z0-9]*$"),
):
    if min(document_id, version_id, page_id) < 1:
        raise HTTPException(404, "Preview page not found.")
    # Mayan's image API signs the full transformation argument set. Preserve
    # the empty arguments emitted by its serializer instead of omitting them.
    upstream_params = {"width": width, "height": "", "zoom": "", "rotation": ""}
    if image_hash:
        upstream_params["_hash"] = image_hash
    response = await call(
        request, "GET",
        f"/documents/{document_id}/versions/{version_id}/pages/{page_id}/image/",
        params=upstream_params, headers={"Accept": "image/*"}, timeout=45,
    )
    if response.status_code in (403, 404):
        raise HTTPException(response.status_code, "This preview page is unavailable to your account.")
    if response.status_code >= 500:
        raise HTTPException(
            503,
            "Mayan is still rendering this page or its document conversion failed. ArcheoVault will retry briefly; if it persists, verify the Mayan converter workers.",
        )
    check_upstream(request, response.status_code)
    content_type = response.headers.get("content-type", "image/png").split(";")[0]
    if not content_type.startswith("image/"):
        raise HTTPException(502, "The preview service did not return an image.")
    return StreamingResponse(
        iter([response.content]), media_type=content_type,
        headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"},
    )


@router.post("/{document_id}/versions", status_code=202)
async def upload_replacement_version(request: Request, document_id: int):
    if document_id < 1:
        raise HTTPException(404, "Record not found.")
    require_write(request)
    try:
        key = str(UUID(request.headers.get("idempotency-key", "")))
    except ValueError:
        raise HTTPException(422, "A version-upload request identifier is required.") from None

    now = time.monotonic()
    for old_key in list(version_operations):
        if version_operations[old_key]["expires"] < now:
            del version_operations[old_key]
    operation_key = (request.cookies[COOKIE_NAME], document_id, key)
    if operation_key in version_operations:
        prior = version_operations[operation_key]
        if prior.get("result"):
            return prior["result"]
        raise HTTPException(409, "This version upload is in progress or its outcome is uncertain. Refresh the version history before trying again.")
    if len(version_operations) >= 1000:
        raise HTTPException(503, "The version service is busy. Try again later.")

    length = request.headers.get("content-length", "")
    if not length.isdigit() or int(length) > MAX_FILE + 1024 * 1024:
        raise HTTPException(413, "Choose one file up to 50 MB.")
    async with request.form(max_files=1, max_fields=2, max_part_size=1024 * 1024) as form:
        file = form.get("file")
        comment = str(form.get("comment", "")).strip()
        if not isinstance(file, UploadFile) or file.size is None or not 0 < file.size <= MAX_FILE:
            raise HTTPException(422, "Choose a non-empty file up to 50 MB.")
        if not 3 <= len(comment) <= 255:
            raise HTTPException(422, "Enter a change summary between 3 and 255 characters.")

        # Reserve immediately before the non-repeatable upstream create call.
        if operation_key in version_operations:
            raise HTTPException(409, "This version upload has already been submitted.")
        version_operations[operation_key] = {"expires": now + 3600}
        filename = (file.filename or "document").replace("\\", "/").split("/")[-1]
        response = await call(
            request, "POST", f"/documents/{document_id}/files/",
            data={"action_name": "replace", "comment": comment, "filename": filename},
            files={"file_new": (filename, file.file, file.content_type or "application/octet-stream")}
        )
        if response.status_code in (400, 403, 404):
            del version_operations[operation_key]
            if response.status_code == 403:
                raise HTTPException(403, "Your account cannot upload a new file for this record.")
            if response.status_code == 404:
                raise HTTPException(404, "This record is no longer available.")
            raise HTTPException(422, "The replacement file was rejected. Check the file and change summary.")
        if response.status_code != 202:
            check_upstream(request, response.status_code)

        result = {
            "accepted": True,
            "message": "The replacement file was accepted and is being processed. The previous version remains in history."
        }
        version_operations[operation_key]["result"] = result
        return result
