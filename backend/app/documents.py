"""Read-only document access using each session's upstream permissions."""

from datetime import datetime
from urllib.parse import quote

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, ValidationError

from app.auth import COOKIE_NAME, settings_for, store_for

router = APIRouter(prefix="/api/v1/documents", tags=["Documents"])


class DocumentType(BaseModel):
    id: int
    label: str


class DocumentSummary(BaseModel):
    id: int
    label: str
    description: str = ""
    datetime_created: datetime
    document_type: DocumentType | None = None
    language: str = ""


class UpstreamPage(BaseModel):
    count: int = Field(ge=0)
    next: str | None
    previous: str | None
    results: list[DocumentSummary]


class DocumentPage(BaseModel):
    count: int
    page: int
    next_page: int | None
    previous_page: int | None
    results: list[DocumentSummary]


class DocumentFile(BaseModel):
    id: int
    filename: str = ""
    mimetype: str = ""
    size: int | None = None
    timestamp: datetime | None = None


class DocumentDetail(DocumentSummary):
    uuid: str = ""
    file_latest: DocumentFile | None = None


def upstream_access(request: Request):
    session = store_for(request).get(request.cookies.get(COOKIE_NAME))
    if not session:
        raise HTTPException(401, "Please sign in.")
    return settings_for(request), {"Authorization": f"Token {session.token}"}


def check_upstream(request: Request, status: int):
    if status == 401:
        store_for(request).delete(request.cookies.get(COOKIE_NAME))
        raise HTTPException(401, "Your session has ended. Please sign in again.")
    if status == 403:
        raise HTTPException(403, "Your account does not have permission for this record or file.")
    if status == 404:
        raise HTTPException(404, "This record or file is unavailable.")
    if status == 429:
        raise HTTPException(429, "The document service is busy. Please try again shortly.")
    if status != 200:
        raise HTTPException(503, "The document service is unavailable. Please try again.")


async def read_detail(request: Request, document_id: int) -> DocumentDetail:
    settings, headers = upstream_access(request)
    async with httpx.AsyncClient(timeout=settings.request_timeout, follow_redirects=False) as client:
        try:
            response = await client.get(
                str(settings.mayan_api_url).rstrip("/") + f"/documents/{document_id}/",
                headers={**headers, "Accept": "application/json"},
            )
        except httpx.HTTPError:
            raise HTTPException(503, "The document service is unavailable.") from None
    check_upstream(request, response.status_code)
    try:
        return DocumentDetail.model_validate(response.json())
    except ValueError:
        raise HTTPException(502, "The document service returned an unexpected response.") from None


@router.get("/{document_id}", response_model=DocumentDetail)
async def document_detail(request: Request, document_id: int):
    if document_id < 1:
        raise HTTPException(404, "Record not found.")
    return await read_detail(request, document_id)


@router.get("/{document_id}/file")
async def document_file(request: Request, document_id: int, preview: bool = False):
    if document_id < 1:
        raise HTTPException(404, "Record not found.")
    # Resolve the latest file on the authorized record, not an arbitrary file URL.
    document = await read_detail(request, document_id)
    file = document.file_latest
    if file is None:
        raise HTTPException(404, "This record does not have a file yet.")
    safe_preview_types = {"application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"}
    mime = file.mimetype.lower().split(";")[0].strip()
    if preview and mime not in safe_preview_types:
        raise HTTPException(415, "Preview is not available for this file type. Download the original instead.")
    preview_limit = 20 * 1024 * 1024
    if preview and (file.size is None or file.size > preview_limit):
        raise HTTPException(413, "This file is too large for inline preview. Download the original instead.")
    settings, headers = upstream_access(request)
    client = httpx.AsyncClient(timeout=settings.request_timeout, follow_redirects=False)
    response = None
    try:
        response = await client.send(client.build_request(
            "GET", str(settings.mayan_api_url).rstrip("/") +
            f"/documents/{document_id}/files/{file.id}/download/",
            headers={**headers, "Accept-Encoding": "identity"},
        ), stream=True)
        # The download endpoint independently enforces file download permission.
        check_upstream(request, response.status_code)
        if preview:
            actual_mime = response.headers.get("content-type", "").split(";")[0].strip().lower()
            if actual_mime not in (mime, "application/octet-stream"):
                raise HTTPException(415, "The file format cannot be previewed safely.")
    except Exception as exc:
        if response is not None:
            await response.aclose()
        await client.aclose()
        if isinstance(exc, httpx.HTTPError):
            raise HTTPException(503, "The file service is unavailable.") from None
        raise

    async def chunks():
        transferred = 0
        try:
            async for chunk in response.aiter_bytes():
                transferred += len(chunk)
                if preview and transferred > preview_limit:
                    raise RuntimeError("Preview size limit exceeded")
                yield chunk
        finally:
            await response.aclose()
            await client.aclose()

    filename = file.filename.replace("\\", "/").split("/")[-1] or f"document-{document_id}"
    disposition = "inline" if preview else "attachment"
    return StreamingResponse(chunks(), media_type=mime if preview else "application/octet-stream", headers={
        "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(filename, safe='')}",
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'; frame-ancestors 'self'",
    })


@router.get("", response_model=DocumentPage)
async def list_documents(request: Request, page: int = Query(default=1, ge=1, le=100000)):
    store = store_for(request)
    session_id = request.cookies.get(COOKIE_NAME)
    session = store.get(session_id)
    if not session:
        raise HTTPException(401, "Please sign in.")
    settings = settings_for(request)
    # Use a fixed path and bounded page number, never a URL supplied by the browser.
    async with httpx.AsyncClient(timeout=settings.request_timeout, follow_redirects=False) as client:
        try:
            response = await client.get(
                str(settings.mayan_api_url).rstrip("/") + "/documents/",
                params={"page": page},
                headers={"Accept": "application/json", "Authorization": f"Token {session.token}"},
            )
        except httpx.HTTPError:
            raise HTTPException(503, "The document service is unavailable. Please try again.") from None
    if response.status_code == 401:
        store.delete(session_id)
        raise HTTPException(401, "Your session has ended. Please sign in again.")
    if response.status_code == 403:
        raise HTTPException(403, "Your account cannot access this document list.")
    if response.status_code == 404:
        raise HTTPException(404, "This document page is no longer available.")
    if response.status_code == 429:
        raise HTTPException(429, "The document service is busy. Please try again shortly.")
    if response.status_code != 200:
        raise HTTPException(503, "The document service is unavailable. Please try again.")
    try:
        data = UpstreamPage.model_validate(response.json())
    except (ValueError, ValidationError):
        raise HTTPException(502, "The document service returned an unexpected response.") from None
    # Do not expose upstream URLs or follow their hosts. Pagination remains local.
    return DocumentPage(
        count=data.count, page=page,
        next_page=page + 1 if data.next else None,
        previous_page=page - 1 if data.previous and page > 1 else None,
        results=data.results,
    )
