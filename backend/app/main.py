from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
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


class HealthResponse(BaseModel):
    status: str
    service: str


settings = Settings()


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
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/api/v1/health", response_model=HealthResponse, tags=["Operations"])
def health() -> HealthResponse:
    """Process liveness only; does not assert upstream or login availability."""
    return HealthResponse(status="ok", service="archeoecm-backend")
