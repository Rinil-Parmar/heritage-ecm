import asyncio
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.auth import COOKIE_NAME, Credentials, obtain_token
from app.config import Settings
from app.main import app
from app.sessions import SessionStore

ORIGIN = {"Origin": "http://localhost:5173"}
LOGIN = "/api/v1/auth/login"
SESSION = "/api/v1/auth/session"
LOGOUT = "/api/v1/auth/logout"
CREDENTIALS = {"username": "researcher", "password": "test-only-password"}


@pytest.fixture
def client():
    app.state.sessions = SessionStore()
    app.state.settings = Settings(_env_file=None)
    with TestClient(app) as client:
        yield client


def test_login_session_rotation_and_logout(client):
    with patch("app.auth.obtain_token", AsyncMock(return_value="upstream-secret")):
        first = client.post(LOGIN, json=CREDENTIALS, headers=ORIGIN)
        old_cookie = client.cookies.get(COOKIE_NAME)
        second = client.post(LOGIN, json=CREDENTIALS, headers=ORIGIN)
    assert first.status_code == second.status_code == 200
    assert "upstream-secret" not in second.text + second.headers["set-cookie"]
    assert old_cookie != client.cookies.get(COOKIE_NAME)
    assert app.state.sessions.get(old_cookie) is None
    cookie = second.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=strict" in cookie and "Path=/api/v1" in cookie
    assert second.headers["cache-control"] == "no-store"
    assert client.get(SESSION).json()["username"] == "researcher"
    assert client.post(LOGOUT, headers=ORIGIN).status_code == 403
    csrf = second.json()["csrf_token"]
    assert client.post(LOGOUT, headers={**ORIGIN, "X-CSRF-Token": csrf}).status_code == 204
    assert client.get(SESSION).status_code == 401


@pytest.mark.parametrize("origin", [None, "https://evil.example", "http://localhost:5173.evil.example", "null"])
def test_login_rejects_untrusted_origin(client, origin):
    with patch("app.auth.obtain_token", AsyncMock()) as upstream:
        response = client.post(LOGIN, json=CREDENTIALS, headers={"Origin": origin} if origin else {})
    assert response.status_code == 403
    upstream.assert_not_called()


def test_failed_credentials_validation_and_throttle(client):
    response = client.post(LOGIN, json={**CREDENTIALS, "password": {"secret": "must-not-echo"}}, headers=ORIGIN)
    assert response.status_code == 422
    assert "must-not-echo" not in response.text
    with patch("app.auth.obtain_token", AsyncMock(side_effect=HTTPException(401, "Invalid credentials"))) as upstream:
        for _ in range(10):
            assert client.post(LOGIN, json=CREDENTIALS, headers=ORIGIN).status_code == 401
        assert client.post(LOGIN, json=CREDENTIALS, headers=ORIGIN).status_code == 429
        assert upstream.await_count == 10
    assert not client.cookies.get(COOKIE_NAME)


def test_expired_session_is_rejected(client):
    with patch("app.auth.obtain_token", AsyncMock(return_value="secret")):
        client.post(LOGIN, json=CREDENTIALS, headers=ORIGIN)
    session = app.state.sessions.get(client.cookies.get(COOKIE_NAME))
    session.expires = 0
    assert client.get(SESSION).status_code == 401
    assert not app.state.sessions.sessions


@pytest.mark.parametrize("status,body,expected", [
    (200, {"token": "secret"}, None),
    (200, {"key": "secret"}, None),
    (200, {"unexpected": "secret"}, 502),
    (400, {"password": "secret"}, 401),
    (302, {}, 503), (503, {}, 503), (429, {}, 429),
])
def test_upstream_protocol(status, body, expected):
    def respond(request):
        assert request.url.path == "/api/v4/auth/token/obtain/"
        assert request.method == "POST"
        return httpx.Response(status, json=body)

    client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    with patch("app.auth.httpx.AsyncClient", return_value=client):
        if expected:
            with pytest.raises(HTTPException) as error:
                asyncio.run(obtain_token(Credentials(**CREDENTIALS), Settings(_env_file=None)))
            assert error.value.status_code == expected
            assert "secret" not in error.value.detail
        else:
            assert asyncio.run(obtain_token(Credentials(**CREDENTIALS), Settings(_env_file=None))) == "secret"


def test_upstream_network_failure():
    def respond(request):
        raise httpx.ConnectTimeout("private details", request=request)

    client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    with patch("app.auth.httpx.AsyncClient", return_value=client):
        with pytest.raises(HTTPException) as error:
            asyncio.run(obtain_token(Credentials(**CREDENTIALS), Settings(_env_file=None)))
    assert error.value.status_code == 503
    assert "private details" not in error.value.detail
