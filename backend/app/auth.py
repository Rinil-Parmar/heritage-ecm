import secrets

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, SecretStr

from app.config import Settings
from app.sessions import SessionStore

COOKIE_NAME = "archeoecm_session"
COOKIE_PATH = "/api/v1"
router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


class Credentials(BaseModel):
    username: str = Field(min_length=1, max_length=150)
    password: SecretStr = Field(min_length=1, max_length=1024)


class SessionView(BaseModel):
    username: str
    csrf_token: str


def settings_for(request: Request) -> Settings:
    return request.app.state.settings


def store_for(request: Request) -> SessionStore:
    return request.app.state.sessions


def trusted_origin(request: Request, settings: Settings = Depends(settings_for)):
    # Includes login CSRF. Do not infer trust from forwarded headers or arbitrary Host.
    if request.headers.get("origin") not in settings.trusted_origins:
        raise HTTPException(403, "Request origin is not allowed.")


async def obtain_token(credentials: Credentials, settings: Settings) -> str:
    # Separate clients prevent upstream cookies from crossing between users.
    async with httpx.AsyncClient(timeout=settings.request_timeout, follow_redirects=False) as client:
        try:
            response = await client.post(
                str(settings.mayan_api_url).rstrip("/") + "/auth/token/obtain/",
                headers={"Accept": "application/json"},
                json={"username": credentials.username, "password": credentials.password.get_secret_value()},
            )
        except httpx.HTTPError:
            raise HTTPException(503, "Sign-in service is unavailable. Please try again.") from None
    if response.status_code in (400, 401, 403):
        raise HTTPException(401, "Username or password is incorrect.")
    if response.status_code == 429:
        raise HTTPException(429, "Too many sign-in attempts. Please wait and try again.")
    if response.status_code != 200:
        raise HTTPException(503, "Sign-in service is unavailable. Please try again.")
    try:
        data = response.json()
        token = data.get("token") or data.get("key")
        if not isinstance(token, str) or not token.strip():
            raise ValueError
    except (ValueError, AttributeError):
        raise HTTPException(502, "Sign-in service returned an unexpected response.") from None
    return token


@router.post("/login", response_model=SessionView, dependencies=[Depends(trusted_origin)])
async def login(credentials: Credentials, request: Request, response: Response):
    store = store_for(request)
    settings = settings_for(request)
    # Development limit by connection address; production needs a shared limiter.
    if not store.allow_login(request.client.host if request.client else "unknown"):
        raise HTTPException(429, "Too many sign-in attempts. Wait one minute and try again.")
    token = await obtain_token(credentials, settings)
    try:
        session_id, session = store.create(credentials.username, token, settings.session_seconds)
    except RuntimeError:
        raise HTTPException(503, "Sign-in is temporarily unavailable.") from None
    store.delete(request.cookies.get(COOKIE_NAME))
    response.set_cookie(
        COOKIE_NAME, session_id, max_age=settings.session_seconds, path=COOKIE_PATH,
        httponly=True, secure=settings.cookie_secure, samesite="strict",
    )
    return SessionView(username=session.username, csrf_token=session.csrf)


@router.get("/session", response_model=SessionView)
async def current_session(request: Request):
    session = store_for(request).get(request.cookies.get(COOKIE_NAME))
    if not session:
        raise HTTPException(401, "Please sign in.")
    return SessionView(username=session.username, csrf_token=session.csrf)


@router.post("/logout", status_code=204, dependencies=[Depends(trusted_origin)])
async def logout(request: Request, response: Response):
    store = store_for(request)
    session_id = request.cookies.get(COOKIE_NAME)
    session = store.get(session_id)
    supplied_csrf = request.headers.get("x-csrf-token", "")
    if session and (not supplied_csrf.isascii() or not secrets.compare_digest(supplied_csrf, session.csrf)):
        raise HTTPException(403, "Invalid request token. Refresh the page and try again.")
    store.delete(session_id)
    response.delete_cookie(COOKIE_NAME, path=COOKIE_PATH, httponly=True,
                           secure=settings_for(request).cookie_secure, samesite="strict")
