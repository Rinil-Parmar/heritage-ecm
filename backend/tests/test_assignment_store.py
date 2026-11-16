from app.database import (
    add_notification, assignment_map, assignments_for_user, delete_assignment, mark_notification,
    notification_rows, save_assignment, unread_count,
)


def test_assignment_and_notification_lifecycle(tmp_path):
    path = str(tmp_path / "application.db")
    assignment = save_assignment(
        path, workflow_id=7, document_id=4, assignee="professor",
        actor="admin", priority="high", due_at="2027-01-15",
    )
    assert assignment["assignee_username"] == "professor"
    assert assignment_map(path, [7])[7]["priority"] == "high"
    assert assignments_for_user(path, "PROFESSOR")[0]["document_id"] == 4

    add_notification(
        path, username="professor", kind="assignment", title="Assigned",
        body="Review record", document_id=4, dedupe_key="assignment:7:professor",
    )
    # Repeated event keys do not create duplicate notifications.
    add_notification(
        path, username="professor", kind="assignment", title="Assigned",
        body="Review record", document_id=4, dedupe_key="assignment:7:professor",
    )
    rows = notification_rows(path, "professor")
    assert len(rows) == 1
    assert unread_count(path, "professor") == 1
    assert mark_notification(path, "professor", rows[0]["id"])
    assert unread_count(path, "professor") == 0
    assert delete_assignment(path, 7) == 1
