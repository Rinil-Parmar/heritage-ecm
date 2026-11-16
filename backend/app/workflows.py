"""Document review workflow facade backed by Mayan's permission-aware API."""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, PositiveInt

from app.auth import trusted_origin
from app.documents import check_upstream, read_detail
from app.uploads import all_rows, call, require_write

router = APIRouter(prefix="/api/v1/records", tags=["Document review"])
queue_router = APIRouter(prefix="/api/v1/reviews", tags=["Review queue"])
REVIEW_WORKFLOW = "research_document_review"


class TransitionInput(BaseModel):
    transition_id: PositiveInt
    comment: str = Field(default="", max_length=2000)


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
    rows = await all_rows(request, f"/documents/{document_id}/workflow_instances/")
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
    return updated


@queue_router.get("/queue")
async def review_queue(request: Request):
    template = await review_template(request)
    if template is None:
        return {"workflow": None, "results": []}
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
            state = state_value(instance.get("current_state"))
            if state is None:
                raise ValueError
            if state["final"]:
                continue
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
                        if isinstance(user, dict) else "System"
                    ),
                }
            results.append(
                {
                    "id": document_id,
                    "label": str(document.get("label") or f"Document {document_id}"),
                    "datetime_created": document.get("datetime_created"),
                    "document_type": (
                        {
                            "id": int(document_type["id"]),
                            "label": str(document_type["label"]),
                        }
                        if isinstance(document_type, dict) else None
                    ),
                    "state": state,
                    "last_action": last_action,
                }
            )
        except (KeyError, TypeError, ValueError):
            raise HTTPException(502, "The review queue returned an unexpected response.") from None
    results.sort(
        key=lambda row: (
            0 if row["state"]["label"].casefold() == "needs correction" else 1,
            str(row.get("datetime_created") or ""),
        )
    )
    return {
        "workflow": {"id": template_id, "label": str(template.get("label") or "Document review")},
        "results": results,
    }
