from app.database import add_access_audit, access_audit_rows


def test_access_audit_is_scoped_and_newest_first(tmp_path):
    database = str(tmp_path / "archeovault.db")
    add_access_audit(
        database, actor="admin", scope="document", object_id=5,
        role_id=3, role_label="Research Professor", bundle="reviewer",
        permission_count=9,
    )
    add_access_audit(
        database, actor="admin", scope="document", object_id=5,
        role_id=4, role_label="Research Viewer", bundle="read_only",
        permission_count=7,
    )
    add_access_audit(
        database, actor="admin", scope="cabinet", object_id=5,
        role_id=4, role_label="Research Viewer", bundle="browse",
        permission_count=1,
    )

    rows = access_audit_rows(database, "document", 5)
    assert [row["role_label"] for row in rows] == [
        "Research Viewer", "Research Professor",
    ]
    assert rows[0]["bundle"] == "read_only"
    assert rows[0]["permission_count"] == 7
