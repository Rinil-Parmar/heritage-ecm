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


class HealthResponse(BaseModel):
    status: str
    service: str


app = FastAPI(title="ArcheoECM API", version="0.1.0")
app.state.settings = Settings()
app.state.sessions = SessionStore()
app.include_router(router)
app.include_router(documents_router)
app.include_router(uploads_router)
app.include_router(versions_router)


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
