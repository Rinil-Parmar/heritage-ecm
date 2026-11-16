from app.workflows import queue_item


def test_queue_item_preserves_assignment_and_transformed_actor():
    assignment = {"workflow_instance_id": 7, "assignee_username": "rinilparmar"}
    result = queue_item(
        {
            "id": 5, "label": "Field report", "datetime_created": "2026-11-15T12:00:00Z",
            "document_type": {"id": 2, "label": "Excavation report"},
        },
        {
            "id": 7,
            "current_state": {"id": 3, "label": "Under Review", "completion": 50, "final": False},
            "last_log_entry": {
                "datetime": "2026-11-15T13:00:00Z", "actor": "admin",
                "transition": {
                    "id": 4, "label": "Start Review",
                    "origin_state": None, "destination_state": None,
                },
            },
        },
        assignment,
    )
    assert result["assignment"] == assignment
    assert result["last_action"]["actor"] == "admin"
    assert result["state"]["label"] == "Under Review"
