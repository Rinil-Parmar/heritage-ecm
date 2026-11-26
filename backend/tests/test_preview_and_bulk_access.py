from types import SimpleNamespace

from fastapi import HTTPException

import app.access_control as access_control
import app.versions as versions


class JsonResponse:
    status_code = 200

    def __init__(self, body):
        self.body = body

    def json(self):
        return self.body


def test_preview_uses_active_version_and_orders_pages(monkeypatch):
    async def fake_versions(_request, document_id):
        assert document_id == 9
        return [{"id": 4, "active": False}, {"id": 7, "active": True}]

    async def fake_call(_request, method, path, **kwargs):
        assert method == "GET"
        assert path == "/documents/9/versions/7/pages/"
        return JsonResponse({
            "results": [
                {"id": 22, "page_number": 2, "image_url": "https://mayan/api/v4/page/22/image/?_hash=abc123"},
                {"id": 21, "page_number": 1, "image_url": "https://mayan/api/v4/page/21/image/?_hash=def456"},
            ],
            "next": None,
        })

    monkeypatch.setattr(versions, "all_versions", fake_versions)
    monkeypatch.setattr(versions, "call", fake_call)
    coroutine = versions.list_preview_pages(object(), 9)
    try:
        coroutine.send(None)
    except StopIteration as stop:
        result = stop.value
    assert result.version_id == 7
    assert [page.id for page in result.results] == [21, 22]
    assert [page.image_hash for page in result.results] == ["def456", "abc123"]


def test_preview_requires_active_version(monkeypatch):
    async def fake_versions(_request, _document_id):
        return [{"id": 4, "active": False}]

    monkeypatch.setattr(versions, "all_versions", fake_versions)
    try:
        versions.list_preview_pages(object(), 9).send(None)
    except HTTPException as exc:
        assert exc.status_code == 409
    else:
        raise AssertionError("Expected an active-version error")


def test_bulk_access_reports_partial_failure(monkeypatch):
    async def fake_acl_rows(_request, _scope, _object_id):
        return []

    async def fake_update(_request, body, _identity):
        if body.object_id == 2:
            raise HTTPException(403, "blocked")
        return {"id": body.object_id, "role": {"id": body.role_id}, "permissions": []}

    monkeypatch.setattr(access_control, "acl_rows", fake_acl_rows)
    monkeypatch.setattr(access_control, "update_acl", fake_update)
    request = SimpleNamespace(state=SimpleNamespace())
    body = access_control.ACLBulkUpdate(object_ids=[1, 2], role_id=8, bundle="read_only")
    coroutine = access_control.bulk_update_acl(request, body, {"username": "admin"})
    try:
        coroutine.send(None)
    except StopIteration as stop:
        result = stop.value
    assert result["requested"] == 2
    assert result["applied"] == 1
    assert result["failed"] == 1
    assert result["failures"][0]["object_id"] == 2
