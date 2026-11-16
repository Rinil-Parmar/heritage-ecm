"""Document review workflow facade backed by Mayan's permission-aware API."""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, PositiveInt, field_validator

from app.auth import COOKIE_NAME, settings_for, store_for, trusted_origin
from app.administration import current_identity
from app.database import (
    add_notification, assignment_map, assignments_for_user, delete_assignment,
    save_assignment,
)
from app.documents import check_upstream, read_detail
from app.uploads import all_rows, call, require_write

router = APIRouter(prefix="/api/v1/records", tags=["Document review"])
queue_router = APIRouter(prefix="/api/v1/reviews", tags=["Review queue"])
REVIEW_WORKFLOW = "research_document_review"
REVIEW_MANAGER_GROUPS = {"System Administrators", "Department Administrators"}


class TransitionInput(BaseModel):
    transition_id: PositiveInt
    comment: str = Field(default="", max_length=2000)


class AssignmentInput(BaseModel):
    document_id: PositiveInt
    assignee_username: str = Field(min_length=1, max_length=150, pattern=r"^[\w.@+-]+$")
    priority: Literal["normal", "high", "urgent"] = "normal"
    due_date: date | None = None

    @field_validator("due_date")
    @classmethod
    def due_date_is_not_past(cls, value):
        if value and value < date.today():
            raise ValueError("due date cannot be in the past")
        return value


async def review_manager(request: Request):
    identity = await current_identity(request)
    if not identity["groups"] & REVIEW_MANAGER_GROUPS:
        raise HTTPException(403, "Review assignment is restricted to review managers.")
    return identity


async def eligible_assignees(request: Request):
    # Responsibility may be assigned before group access is finalized. Assignment
    # never grants document or transition access; Mayan remains authoritative.
    users = []
    for user in await all_rows(request, "/users/"):
        username = str(user.get("username") or "")
        if not username or not user.get("is_active", True):
            continue
        full_name = str(user.get("full_name") or "").strip()
        if not full_name:
            full_name = " ".join(str(user.get(key) or "").strip() for key in ("first_name", "last_name")).strip()
        users.append({"id": int(user["id"]), "username": username, "label": full_name or username})
    return sorted(users, key=lambda row: (row["label"].casefold(), row["username"].casefold()))


def state_value(value):
    if not isinstance(value, dict):
        return None
    try:
        return {
            "id": int(value["id"]),
            "label": str(value["label"]),
            "completion": max(0, min(100, int(value.get("completion") or 0))),
            "final": bool(value.get("final")),
        }
    except (KeyError, TypeError, ValueError):
        return None


def transition_value(value):
    if not isinstance(value, dict):
        return None
    origin = state_value(value.get("origin_state"))
    destination = state_value(value.get("destination_state"))
    try:
        return {
            "id": int(value["id"]),
            "label": str(value["label"]),
            "origin_state": origin,
            "destination_state": destination,
        }
    except (KeyError, TypeError, ValueError):
        return None


def instance_value(value, transitions):
    template = value.get("workflow_template") if isinstance(value, dict) else None
    if not isinstance(template, dict):
        raise ValueError
    last = value.get("last_log_entry")
    last_value = None
    if isinstance(last, dict):
        user = last.get("user")
        transition = transition_value(last.get("transition"))
        last_value = {
            "datetime": last.get("datetime"),
            "comment": str(last.get("comment") or ""),
            "actor": (
                str(user.get("username") or user.get("label") or "System")
                if isinstance(user, dict) else "System"
            ),
            "transition": transition,
        }
    return {
        "id": int(value["id"]),
        "label": str(template.get("label") or "Document review"),
        "internal_name": str(template.get("internal_name") or ""),
        "current_state": state_value(value.get("current_state")),
        "last_log_entry": last_value,
        "transitions": [item for row in transitions if (item := transition_value(row))],
    }


async def workflow_instances(request: Request, document_id: int):
    rows = await all_rows(
        request, f"/documents/{document_id}/workflow_instances/",
        "Your account cannot view this document's review workflow.",
    )
    results = []
    for row in rows:
        try:
            instance_id = int(row["id"])
            transition_rows = await all_rows(
                request,
                f"/documents/{document_id}/workflow_instances/{instance_id}/log_entries/transitions/",
            )
            results.append(instance_value(row, transition_rows))
        except (KeyError, TypeError, ValueError):
            raise HTTPException(502, "The review service returned an unexpected response.") from None
    return results


async def review_template(request: Request):
    templates = await all_rows(request, "/workflow_templates/")
    return next(
        (row for row in templates if row.get("internal_name") == REVIEW_WORKFLOW),
        None,
    )


def session_username(request: Request) -> str:
    session = store_for(request).get(request.cookies.get(COOKIE_NAME))
    if not session:
        raise HTTPException(401, "Please sign in.")
    return session.username


def queue_item(document: dict, instance: dict, assignment: dict | None = None):
    state = state_value(instance.get("current_state"))
    if state is None:
        raise ValueError
    document_type = document.get("document_type")
    last = instance.get("last_log_entry")
    last_action = None
    if isinstance(last, dict):
        transition = transition_value(last.get("transition"))
        user = last.get("user")
        last_action = {
            "label": transition["label"] if transition else "Workflow started",
            "datetime": last.get("datetime"),
            "actor": (
                str(user.get("username") or user.get("label") or "System")
                if isinstance(user, dict) else str(last.get("actor") or "System")
            ),
        }
    return {
        "id": int(document["id"]),
        "label": str(document.get("label") or f"Document {document['id']}"),
        "datetime_created": document.get("datetime_created"),
        "document_type": (
            {"id": int(document_type["id"]), "label": str(document_type["label"])}
            if isinstance(document_type, dict) else None
        ),
        "state": state,
        "workflow_instance_id": int(instance["id"]),
        "last_action": last_action,
        "assignment": assignment,
    }


async def assigned_queue(request: Request, username: str):
    assignments = assignments_for_user(settings_for(request).database_path, username)
    results, blocked = [], []
    for assignment in assignments:
        document_id = int(assignment["document_id"])
        try:
            document = (await read_detail(request, document_id)).model_dump(mode="json")
            instances = await workflow_instances(request, document_id)
            instance = next(
                (row for row in instances if row["id"] == int(assignment["workflow_instance_id"])),
                None,
            )
            if instance is None:
                blocked.append({
                    "document_id": document_id, "label": document.get("label") or f"Document {document_id}",
                    "reason": "The assigned review workflow is no longer available.", "assignment": assignment,
                })
                continue
            if (instance.get("current_state") or {}).get("final"):
                continue
            results.append(queue_item(document, instance, assignment))
        except HTTPException as exc:
            if exc.status_code in (403, 404):
                reason = (
                    "Document access is missing. Ask an administrator to grant the Research Professor role Reviewer access."
                    if exc.status_code == 404 else
                    "Workflow access is missing. Ask an administrator to grant the Research Professor role Reviewer access."
                )
                blocked.append({
                    "document_id": document_id, "label": f"Document {document_id}",
                    "reason": reason, "assignment": assignment,
                })
                continue
            raise
    return {
        "workflow": {"id": 0, "label": "Research Document Review"},
        "results": results, "blocked": blocked,
    }


async def template_supports_document(request: Request, template: dict, document):
    if document.document_type is None:
        return False
    document_types = await all_rows(
        request, f"/workflow_templates/{int(template['id'])}/document_types/"
    )
    return document.document_type.id in {int(row["id"]) for row in document_types}


@router.get("/{document_id}/workflows")
async def read_workflows(request: Request, document_id: int):
    if document_id < 1:
        raise HTTPException(404, "Record not found.")
    document = await read_detail(request, document_id)
    try:
        results = await workflow_instances(request, document_id)
        template = await review_template(request) if not results else None
        configured = bool(results) or bool(
            template and await template_supports_document(request, template, document)
        )
        return {"configured": configured, "results": results}
    except HTTPException as exc:
        if exc.status_code == 403:
            raise HTTPException(403, "Your account cannot view this document's review workflow.") from None
        raise


@router.post(
    "/{document_id}/workflows/launch",
    dependencies=[Depends(trusted_origin), Depends(require_write)],
)
async def launch_workflow(request: Request, document_id: int):
    if document_id < 1:
        raise HTTPException(404, "Record not found.")
    document = await read_detail(request, document_id)
    existing = await workflow_instances(request, document_id)
    if existing:
        raise HTTPException(409, "A review workflow is already attached. Refresh the record.")
    template = await review_template(request)
    if template is None:
        raise HTTPException(404, "The configured research review workflow is unavailable.")
    if not await template_supports_document(request, template, document):
        raise HTTPException(422, "This review workflow is not configured for the document type.")

    try:
        response = await call(
            request,
            "POST",
            f"/documents/{document_id}/workflow_instances/launch/",
            json={"workflow_template_id": int(template["id"])},
        )
    except HTTPException as exc:
        if exc.status_code == 503:
            raise HTTPException(
                503,
                "Workflow launch could not be confirmed. Refresh the review before trying again.",
            ) from None
        raise
    if response.status_code == 403:
        raise HTTPException(403, "Your account cannot start document review workflows.")
    if response.status_code == 400:
        raise HTTPException(409, "The review could not be started. It may already be active; refresh the record.")
    if response.status_code not in (200, 201, 202, 204):
        check_upstream(request, response.status_code)

    refreshed = await workflow_instances(request, document_id)
    if not refreshed:
        return {"started": True, "workflow": None}
    return {"started": True, "workflow": refreshed[0]}


@router.post(
    "/{document_id}/workflows/{workflow_instance_id}/transitions",
    dependencies=[Depends(trusted_origin), Depends(require_write)],
)
async def execute_transition(
    request: Request,
    document_id: int,
    workflow_instance_id: int,
    body: TransitionInput,
):
    if document_id < 1 or workflow_instance_id < 1:
        raise HTTPException(404, "Review workflow not found.")
    await read_detail(request, document_id)
    instances = await workflow_instances(request, document_id)
    instance = next((row for row in instances if row["id"] == workflow_instance_id), None)
    if instance is None:
        raise HTTPException(404, "Review workflow not found for this document.")
    transition = next(
        (row for row in instance["transitions"] if row["id"] == body.transition_id), None
    )
    if transition is None:
        raise HTTPException(409, "This review action is no longer available. Refresh the workflow.")
    comment = body.comment.strip()
    destination = transition.get("destination_state") or {}
    if "correction" in str(destination.get("label") or "").casefold() and not comment:
        raise HTTPException(422, "Explain what must be corrected before sending the record back.")

    try:
        response = await call(
            request,
            "POST",
            f"/documents/{document_id}/workflow_instances/{workflow_instance_id}/log_entries/",
            json={"transition_id": body.transition_id, "comment": comment},
        )
    except HTTPException as exc:
        if exc.status_code == 503:
            raise HTTPException(
                503,
                "The review action could not be confirmed. Refresh the workflow before trying again.",
            ) from None
        raise
    if response.status_code == 403:
        raise HTTPException(403, "Your account cannot perform this review action.")
    if response.status_code in (400, 404):
        raise HTTPException(409, "This review action is no longer available. Refresh the workflow.")
    if response.status_code != 201:
        check_upstream(request, response.status_code)

    refreshed = await workflow_instances(request, document_id)
    updated = next((row for row in refreshed if row["id"] == workflow_instance_id), None)
    if updated is None:
        raise HTTPException(502, "The review changed but its new state could not be loaded. Refresh the record.")
    assignments = assignment_map(settings_for(request).database_path, [workflow_instance_id])
    assignment = assignments.get(workflow_instance_id)
    if assignment and updated.get("current_state"):
        state = updated["current_state"]
        add_notification(
            settings_for(request).database_path,
            username=assignment["assignee_username"], kind="workflow",
            title=f"Review moved to {state['label']}",
            body=f"Document #{document_id} changed review state. Open it to see the latest action.",
            document_id=document_id,
            dedupe_key=f"workflow:{workflow_instance_id}:state:{state['id']}:{updated.get('last_log_entry', {}).get('datetime') if updated.get('last_log_entry') else ''}",
        )
    return updated


@queue_router.get("/assignment-access")
async def assignment_access(request: Request):
    try:
        await review_manager(request)
        return {"allowed": True}
    except HTTPException as exc:
        if exc.status_code == 403:
            return {"allowed": False}
        raise


@queue_router.get("/assignees", dependencies=[Depends(review_manager)])
async def assignees(request: Request):
    return {"results": await eligible_assignees(request)}


@queue_router.put(
    "/assignments/{workflow_instance_id}",
    dependencies=[Depends(trusted_origin), Depends(require_write), Depends(review_manager)],
)
async def assign_review(request: Request, workflow_instance_id: int, body: AssignmentInput):
    if workflow_instance_id < 1:
        raise HTTPException(404, "Review workflow not found.")
    instances = await workflow_instances(request, body.document_id)
    instance = next((row for row in instances if row["id"] == workflow_instance_id), None)
    if instance is None or (instance.get("current_state") or {}).get("final"):
        raise HTTPException(409, "Only an active review workflow can be assigned.")
    available = {row["username"] for row in await eligible_assignees(request)}
    if body.assignee_username not in available:
        raise HTTPException(422, "Choose an active user account visible to your administrator account.")
    actor = await review_manager(request)
    previous = assignment_map(settings_for(request).database_path, [workflow_instance_id]).get(workflow_instance_id)
    assignment = save_assignment(
        settings_for(request).database_path,
        workflow_id=workflow_instance_id, document_id=body.document_id,
        assignee=body.assignee_username, actor=actor["username"],
        priority=body.priority, due_at=body.due_date.isoformat() if body.due_date else None,
    )
    add_notification(
        settings_for(request).database_path,
        username=body.assignee_username, kind="assignment",
        title="Review assigned to you",
        body=f"Document #{body.document_id} requires your attention.", document_id=body.document_id,
        dedupe_key=f"assignment:{workflow_instance_id}:{body.assignee_username}:{assignment['updated_at']}",
    )
    if previous and previous["assignee_username"] != body.assignee_username:
        add_notification(
            settings_for(request).database_path,
            username=previous["assignee_username"], kind="assignment",
            title="Review reassigned",
            body=f"Document #{body.document_id} is no longer assigned to you.", document_id=body.document_id,
            dedupe_key=f"reassigned:{workflow_instance_id}:{previous['assignee_username']}:{assignment['updated_at']}",
        )
    return assignment


@queue_router.delete(
    "/assignments/{workflow_instance_id}",
    dependencies=[Depends(trusted_origin), Depends(require_write), Depends(review_manager)],
)
async def unassign_review(request: Request, workflow_instance_id: int):
    if workflow_instance_id < 1:
        raise HTTPException(404, "Review assignment not found.")
    path = settings_for(request).database_path
    previous = assignment_map(path, [workflow_instance_id]).get(workflow_instance_id)
    removed = bool(delete_assignment(path, workflow_instance_id))
    if removed and previous:
        add_notification(
            path, username=previous["assignee_username"], kind="assignment",
            title="Review unassigned",
            body=f"Document #{previous['document_id']} is no longer assigned to you.",
            document_id=previous["document_id"],
            dedupe_key=f"unassigned:{workflow_instance_id}:{previous['updated_at']}",
        )
    return {"removed": removed}


@queue_router.get("/queue")
async def review_queue(request: Request):
    username = session_username(request)
    try:
        identity = await current_identity(request)
        is_manager = bool(identity["groups"] & REVIEW_MANAGER_GROUPS)
    except HTTPException as exc:
        if exc.status_code == 401:
            raise
        is_manager = False
    if not is_manager:
        return await assigned_queue(request, username)

    template = await review_template(request)
    if template is None:
        return {"workflow": None, "results": [], "blocked": []}
    template_id = int(template["id"])
    documents = await all_rows(request, f"/workflow_templates/{template_id}/documents/")
    results = []
    for document in documents:
        try:
            document_id = int(document["id"])
            instances = await all_rows(
                request, f"/documents/{document_id}/workflow_instances/"
            )
            instance = next(
                (
                    row for row in instances
                    if isinstance(row.get("workflow_template"), dict)
                    and row["workflow_template"].get("internal_name") == REVIEW_WORKFLOW
                ),
                None,
            )
            if instance is None:
                continue
            if (instance.get("current_state") or {}).get("final"):
                continue
            results.append(queue_item(document, instance))
        except (KeyError, TypeError, ValueError):
            raise HTTPException(502, "The review queue returned an unexpected response.") from None
    assignments = assignment_map(
        settings_for(request).database_path,
        [row["workflow_instance_id"] for row in results],
    )
    for row in results:
        row["assignment"] = assignments.get(row["workflow_instance_id"])
    priority_order = {"urgent": 0, "high": 1, "normal": 2}
    results.sort(key=lambda row: (
        0 if row["state"]["label"].casefold() == "needs correction" else 1,
        priority_order.get((row.get("assignment") or {}).get("priority"), 3),
        str((row.get("assignment") or {}).get("due_at") or "9999-12-31"),
        str(row.get("datetime_created") or ""),
    ))
    return {
        "workflow": {"id": template_id, "label": str(template.get("label") or "Document review")},
        "results": results, "blocked": [],
    }
