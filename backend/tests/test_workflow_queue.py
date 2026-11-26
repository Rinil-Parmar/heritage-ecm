from app.workflows import queue_item, transition_allowed, transition_notifications


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


def test_correction_notifies_steward_and_assigning_manager_not_acting_reviewer():
    notices = transition_notifications(
        document_id=5, transition_label="Request Correction",
        state_label="Needs Correction", actor="professor",
        assignment={"assigned_by": "admin", "assignee_username": "professor"},
        steward_username="assistant",
    )
    assert [notice["username"] for notice in notices] == ["assistant", "admin"]
    assert all(notice["title"] == "Corrections requested" for notice in notices)


def test_resubmission_notifies_reviewer_and_approval_notifies_manager():
    assignment = {"assigned_by": "admin", "assignee_username": "professor"}
    resubmitted = transition_notifications(
        document_id=5, transition_label="Resubmit for Review",
        state_label="Under Review", actor="admin", assignment=assignment,
    )
    approved = transition_notifications(
        document_id=5, transition_label="Approve Document",
        state_label="Approved", actor="professor", assignment=assignment,
    )
    assert [row["username"] for row in resubmitted] == ["professor"]
    assert resubmitted[0]["title"] == "Corrections resubmitted"
    assert [row["username"] for row in approved] == ["admin"]
    assert approved[0]["title"] == "Review approved"


def test_review_transition_policy_separates_assistant_and_professor_actions():
    assert transition_allowed({"Research Assistants"}, "Resubmit for Review")
    assert not transition_allowed({"Research Assistants"}, "Approve Document")
    assert transition_allowed({"Research Professors"}, "Approve Document")
    assert transition_allowed({"Research Professors"}, "Request Correction")
    assert not transition_allowed({"Research Professors"}, "Resubmit for Review")
    assert transition_allowed({"Department Administrators"}, "Approve Document")
    assert transition_allowed({"System Administrators"}, "Resubmit for Review")
