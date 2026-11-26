from contextlib import asynccontextmanager
import json
import logging
import sqlite3
import time
from uuid import uuid4

import httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.auth import router
from app.config import Settings
from app.sessions import SessionStore
from app.documents import router as documents_router
from app.uploads import router as uploads_router
from app.versions import router as versions_router
from app.administration import router as administration_router
from app.activity import router as activity_router
from app.capabilities import router as capabilities_router
from app.workflows import queue_router as review_queue_router, router as workflows_router
from app.smart_search import router as smart_search_router
from app.notifications import router as notifications_router
from app.access_control import router as access_control_router
from app.relationships import router as relationships_router
from app.database import connection


class HealthResponse(BaseModel):
    status: str
    service: str


class ReadinessResponse(BaseModel):
    status: str
    service: str
    components: dict[str, str]


settings = Settings()
logger = logging.getLogger("archeovault.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.upstream_http = httpx.AsyncClient(
        timeout=settings.request_timeout, follow_redirects=False,
        limits=httpx.Limits(max_connections=40, max_keepalive_connections=20),
    )
    try:
        yield
    finally:
        await app.state.upstream_http.aclose()


app = FastAPI(title="ArcheoVault API", version="0.1.0", lifespan=lifespan)
app.state.settings = settings
app.state.sessions = SessionStore()
app.include_router(router)
app.include_router(documents_router)
app.include_router(uploads_router)
app.include_router(versions_router)
app.include_router(administration_router)
app.include_router(activity_router)
app.include_router(capabilities_router)
app.include_router(workflows_router)
app.include_router(review_queue_router)
app.include_router(smart_search_router)
app.include_router(notifications_router)
app.include_router(access_control_router)
app.include_router(relationships_router)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    # Default validation details can include submitted credentials.
    return JSONResponse(status_code=422, content={"detail": "Check the required fields and try again."})


@app.middleware("http")
async def private_responses(request, call_next):
    request_id = request.headers.get("x-request-id", "").strip()
    if not request_id or len(request_id) > 100 or not request_id.isascii():
        request_id = uuid4().hex
    request.state.request_id = request_id
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(json.dumps({
            "event": "request_failed", "request_id": request_id,
            "method": request.method, "path": request.url.path,
        }))
        raise
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Request-ID"] = request_id
    response.headers["Server-Timing"] = (
        f'app;dur={(time.perf_counter() - started) * 1000:.2f}'
    )
    logger.info(json.dumps({
        "event": "request_complete", "request_id": request_id,
        "method": request.method, "path": request.url.path,
        "status": response.status_code,
        "duration_ms": round((time.perf_counter() - started) * 1000, 2),
    }))
    return response


@app.get("/api/v1/health", response_model=HealthResponse, tags=["Operations"])
async def health() -> HealthResponse:
    """Process liveness only; does not assert upstream or login availability."""
    return HealthResponse(status="ok", service="archeovault-backend")


@app.get("/api/v1/health/ready", response_model=ReadinessResponse, tags=["Operations"])
async def readiness(request: Request):
    """Deployment readiness: application database and Mayan API are reachable."""
    components: dict[str, str] = {}
    try:
        db = connection(settings.database_path)
        try:
            db.execute("SELECT 1").fetchone()
        finally:
            db.close()
        components["database"] = "ok"
    except (OSError, sqlite3.Error):
        components["database"] = "unavailable"

    try:
        response = await request.app.state.upstream_http.get(
            str(settings.mayan_api_url), headers={"Accept": "application/json"},
            timeout=settings.request_timeout,
        )
        content_type = response.headers.get("content-type", "")
        components["mayan"] = (
            "ok" if response.status_code == 200 and "application/json" in content_type
            else "unavailable"
        )
    except httpx.HTTPError:
        components["mayan"] = "unavailable"

    ready = all(value == "ok" for value in components.values())
    body = ReadinessResponse(
        status="ready" if ready else "not_ready",
        service="archeovault-backend", components=components,
    )
    if not ready:
        return JSONResponse(status_code=503, content=body.model_dump())
    return body
