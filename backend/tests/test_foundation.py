import asyncio
import sqlite3
from unittest.mock import patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app.mayan import probe_api


def test_health_does_not_require_upstream():
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "archeovault-backend"}


@pytest.mark.parametrize("upstream_status, expected_status", [(200, 200), (503, 503)])
def test_readiness_checks_database_and_mayan(upstream_status, expected_status):
    def respond(_request):
        return httpx.Response(upstream_status, json={"api": "mayan"})

    upstream = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    with (
        patch("app.main.httpx.AsyncClient", return_value=upstream),
        patch("app.main.connection", side_effect=lambda _path: sqlite3.connect(":memory:")),
        TestClient(app) as client,
    ):
        response = client.get("/api/v1/health/ready")
    assert response.status_code == expected_status
    assert response.json()["components"]["database"] == "ok"
    assert response.json()["components"]["mayan"] == (
        "ok" if upstream_status == 200 else "unavailable"
    )


@pytest.mark.parametrize("kind", ["json", "html", "redirect", "unavailable"])
def test_probe_rejects_false_success(kind):
    def respond(request):
        assert request.headers["accept"] == "application/json"
        if kind == "json":
            return httpx.Response(200, json={"documents": "/api/v4/documents/"})
        if kind == "html":
            return httpx.Response(200, text="Login", headers={"content-type": "text/html"})
        if kind == "redirect":
            return httpx.Response(302, headers={"location": "/login/"})
        return httpx.Response(503)

    client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    with patch("app.mayan.httpx.AsyncClient", return_value=client):
        if kind == "json":
            asyncio.run(probe_api(Settings(_env_file=None)))
        else:
            with pytest.raises((httpx.HTTPStatusError, ValueError)):
                asyncio.run(probe_api(Settings(_env_file=None)))
