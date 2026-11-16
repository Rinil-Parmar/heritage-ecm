from app.access_control import BUNDLES, MANAGED_ROLE_GROUPS, scope_path
from app.access_control import ACLUpdate


def test_api_permission_identifiers_remain_strings():
    body = ACLUpdate(scope='document', object_id=5, role_id=2,
                     bundle='read_only', original_permission_pks=['documents.document_view'])
    assert body.original_permission_pks == ['documents.document_view']


def test_supported_acl_paths_and_bundle_boundaries():
    assert scope_path("document", 7) == "/objects/documents/document/7/acls/"
    assert scope_path("cabinet", 9, "2/permissions/") == "/objects/cabinets/cabinet/9/acls/2/permissions/"
    assert "View documents" in BUNDLES["document"]["read_only"]["permissions"]
    assert "Edit document properties" not in BUNDLES["document"]["read_only"]["permissions"]
    assert "Edit document properties" in BUNDLES["document"]["contributor"]["permissions"]
    assert "View workflow templates" in BUNDLES["document"]["reviewer"]["permissions"]
    assert "Transition workflow instances" in BUNDLES["document"]["reviewer"]["permissions"]
    assert "Delete cabinets" not in BUNDLES["cabinet"]["organize"]["permissions"]
    assert BUNDLES["document"]["none"]["permissions"] == set()
    assert BUNDLES["document"]["read_only"]["description"]
    assert MANAGED_ROLE_GROUPS["Research Professor"] == "Research Professors"
