import app.access_control as access_control
from app.access_control import BUNDLES, MANAGED_ROLE_GROUPS, object_path, scope_path
from app.access_control import ACLUpdate


def test_api_permission_identifiers_remain_strings():
    body = ACLUpdate(scope='document', object_id=5, role_id=2,
                     bundle='read_only', original_permission_pks=['documents.document_view'])
    assert body.original_permission_pks == ['documents.document_view']


def test_supported_acl_paths_and_bundle_boundaries():
    assert scope_path("document", 7) == "/objects/documents/document/7/acls/"
    assert scope_path("cabinet", 9, "2/permissions/") == "/objects/cabinets/cabinet/9/acls/2/permissions/"
    assert object_path("document_states", "workflow", 1) == "/objects/document_states/workflow/1/acls/"
    assert "View documents" in BUNDLES["document"]["read_only"]["permissions"]
    assert "Edit document properties" not in BUNDLES["document"]["read_only"]["permissions"]
    assert "Edit document properties" in BUNDLES["document"]["contributor"]["permissions"]
    assert "View workflow templates" in BUNDLES["document"]["reviewer"]["permissions"]
    assert "Transition workflow instances" in BUNDLES["document"]["reviewer"]["permissions"]
    for bundle in ("read_only", "contributor", "reviewer"):
        permissions = BUNDLES["document"][bundle]["permissions"]
        assert "View cabinets" in permissions
        assert "View comments" in permissions
        assert "View the events of an object" in permissions
    assert "Create new comments" in BUNDLES["document"]["contributor"]["permissions"]
    assert "Execute workflow tools" in BUNDLES["document"]["contributor"]["permissions"]
    assert "Delete cabinets" not in BUNDLES["cabinet"]["organize"]["permissions"]
    assert BUNDLES["document"]["none"]["permissions"] == set()
    assert BUNDLES["document"]["read_only"]["description"]
    assert MANAGED_ROLE_GROUPS["Research Professor"] == "Research Professors"


def test_reviewer_access_bridges_shared_workflow_acl(monkeypatch):
    acl_reads = 0
    writes = []

    async def fake_all_rows(_request, path):
        if path == "/workflow_templates/":
            return [{"id": 1, "internal_name": "research_document_review"}]
        if path == "/objects/document_states/workflow/permissions/":
            return [{"pk": "document_states.workflow_view", "label": "View workflow templates"}]
        raise AssertionError(path)

    async def fake_acl_rows(_request, app_label, model, object_id):
        nonlocal acl_reads
        assert (app_label, model, object_id) == ("document_states", "workflow", 1)
        acl_reads += 1
        if acl_reads == 1:
            return []
        return [{
            "id": 7,
            "role": {"id": 12, "label": "Research Professor"},
            "permissions": [{"pk": "document_states.workflow_view"}],
        }]

    class Response:
        status_code = 201

        @staticmethod
        def json():
            return {"id": 7}

    async def fake_call(_request, method, path, **kwargs):
        writes.append((method, path, kwargs.get("json")))
        return Response()

    monkeypatch.setattr(access_control, "all_rows", fake_all_rows)
    monkeypatch.setattr(access_control, "object_acl_rows", fake_acl_rows)
    monkeypatch.setattr(access_control, "call", fake_call)

    coroutine = access_control.ensure_workflow_role_visibility(object(), 12)
    try:
        coroutine.send(None)
    except StopIteration:
        pass
    else:
        raise AssertionError("The fully mocked permission bridge unexpectedly suspended.")

    assert writes == [
        ("POST", "/objects/document_states/workflow/1/acls/", {"role_id": 12}),
        (
            "POST",
            "/objects/document_states/workflow/1/acls/7/permissions/add/",
            {"permission": "document_states.workflow_view"},
        ),
    ]
