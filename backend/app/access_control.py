"""Small, role-based ACL manager using Mayan's public REST API."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, PositiveInt

from app.administration import current_identity
from app.auth import trusted_origin
from app.documents import check_upstream
from app.uploads import all_rows, call, require_write

router = APIRouter(prefix="/api/v1/access-control", tags=["Access control"])
MANAGER_GROUPS = {"System Administrators", "Department Administrators"}
MANAGED_ROLE_GROUPS = {
    "Department Administrator": "Department Administrators",
    "Research Professor": "Research Professors",
    "Research Assistant": "Research Assistants",
    "Research Viewer": "Research Viewers",
}
SCOPE_MODELS = {
    "document": ("documents", "document"),
    "cabinet": ("cabinets", "cabinet"),
}
REVIEW_WORKFLOW_INTERNAL_NAME = "research_document_review"
BUNDLES = {
    "document": {
        "none": {
            "label": "No document access",
            "description": "Remove the document access managed by ArcheoVault for this audience.",
            "permissions": set(),
        },
        "read_only": {
            "label": "View document",
            "description": "Open, preview, and download the document, including its metadata, tags, activity, comments, and review status.",
            "permissions": {
                "View documents", "View document files", "View document versions",
                "Download document files", "View metadata from a document", "View tags",
                "View cabinets", "View comments", "View the events of an object",
                "View workflow templates",
            },
        },
        "contributor": {
            "label": "Edit document",
            "description": "View the document and update its files, metadata, tags, cabinets, comments, and review submission.",
            "permissions": {
                "View documents", "View document files", "View document versions",
                "Download document files", "View metadata from a document", "View tags",
                "View cabinets", "View comments", "View the events of an object",
                "View workflow templates",
                "Edit document properties", "Create new document files",
                "Create document versions", "Add metadata to a document",
                "Edit a document's metadata", "Remove metadata from a document",
                "Attach tags to documents", "Remove tags from documents",
                "Create new comments", "Execute workflow tools",
            },
        },
        "reviewer": {
            "label": "Review document",
            "description": "View the complete document and perform the review decisions available to this audience.",
            "permissions": {
                "View documents", "View document files", "View document versions",
                "Download document files", "View metadata from a document", "View tags",
                "View cabinets", "View comments", "View the events of an object",
                "View workflow templates", "Transition workflow instances",
            },
        },
    },
    "cabinet": {
        "none": {
            "label": "No cabinet access",
            "description": "Remove the cabinet access managed by ArcheoVault for this audience.",
            "permissions": set(),
        },
        "browse": {
            "label": "See cabinet",
            "description": "See this cabinet in navigation. Documents inside remain protected and require their own document access.",
            "permissions": {"View cabinets"},
        },
        "organize": {
            "label": "Manage cabinet",
            "description": "See and edit this cabinet and organize its document membership. This does not unlock the documents inside.",
            "permissions": {
                "View cabinets", "Add documents to cabinets",
                "Remove documents from cabinets", "Edit cabinets",
            },
        },
    },
}
BUNDLES["document"]["edit_and_review"] = {
    "label": "Edit and review document",
    "description": "Maintain the document and perform its available review decisions.",
    "permissions": (
        BUNDLES["document"]["contributor"]["permissions"]
        | BUNDLES["document"]["reviewer"]["permissions"]
    ),
}


async def access_manager(request: Request):
    identity = await current_identity(request)
    if not identity["groups"] & MANAGER_GROUPS:
        raise HTTPException(403, "Access management is restricted to authorized administrators.")
    return identity


def object_path(app_label: str, model: str, object_id: int, suffix: str = ""):
    return f"/objects/{app_label}/{model}/{object_id}/acls/{suffix}"


def scope_path(scope: str, object_id: int, suffix: str = ""):
    try:
        app_label, model = SCOPE_MODELS[scope]
    except KeyError:
        raise HTTPException(422, "Choose a supported access scope.") from None
    return object_path(app_label, model, object_id, suffix)


async def class_permissions(request: Request, scope: str):
    app_label, model = SCOPE_MODELS[scope]
    rows = await all_rows(request, f"/objects/{app_label}/{model}/permissions/")
    result = []
    for row in rows:
        try:
            result.append({"pk": str(row["pk"]), "label": str(row["label"]), "namespace": str(row.get("namespace") or "")})
        except (KeyError, TypeError, ValueError):
            continue
    if not result:
        raise HTTPException(502, "Mayan returned no usable ACL permissions for this object type.")
    return result


async def object_acl_rows(request: Request, app_label: str, model: str, object_id: int):
    rows = await all_rows(request, object_path(app_label, model, object_id))
    result = []
    for row in rows:
        acl_id = int(row["id"])
        permissions = await all_rows(
            request, object_path(app_label, model, object_id, f"{acl_id}/permissions/")
        )
        role = row.get("role") or {}
        result.append({
            "id": acl_id,
            "role": {"id": int(role["id"]), "label": str(role["label"])},
            "permissions": [{"pk": str(item["pk"]), "label": str(item["label"]), "namespace": str(item.get("namespace") or "")} for item in permissions],
        })
    return result


async def acl_rows(request: Request, scope: str, object_id: int):
    app_label, model = SCOPE_MODELS[scope]
    return await object_acl_rows(request, app_label, model, object_id)


async def ensure_workflow_role_visibility(
    request: Request, role_id: int, *, allow_transition: bool = False
):
    """Grant the role the required permissions on the shared review template.

    Mayan checks workflow visibility twice: on the document and on the Workflow
    object inherited by each workflow instance. The document bundle handles the
    first check; this companion ACL handles the second without granting global
    document access.
    """
    templates = await all_rows(request, "/workflow_templates/")
    template = next(
        (
            row for row in templates
            if row.get("internal_name") == REVIEW_WORKFLOW_INTERNAL_NAME
        ),
        None,
    )
    if template is None:
        raise HTTPException(422, "The configured research review workflow is unavailable.")
    try:
        workflow_id = int(template["id"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(502, "Mayan returned an invalid review workflow.") from None

    app_label, model = "document_states", "workflow"
    permission_rows = await all_rows(
        request, f"/objects/{app_label}/{model}/permissions/"
    )
    permissions_by_label = {
        str(row.get("label")): str(row["pk"])
        for row in permission_rows if row.get("pk") is not None
    }
    required_labels = {"View workflow templates"}
    if allow_transition:
        required_labels.add("Transition workflow instances")
    missing = required_labels - set(permissions_by_label)
    if missing:
        raise HTTPException(
            502, f"Mayan did not expose required workflow permissions: {', '.join(sorted(missing))}."
        )
    required_permissions = {permissions_by_label[label] for label in required_labels}

    acls = await object_acl_rows(request, app_label, model, workflow_id)
    acl = next((row for row in acls if row["role"]["id"] == role_id), None)
    if acl is None:
        response = await call(
            request, "POST", object_path(app_label, model, workflow_id),
            json={"role_id": role_id},
        )
        if response.status_code != 201:
            check_upstream(request, response.status_code)
        acl_id = int(response.json()["id"])
        current = set()
    else:
        acl_id = acl["id"]
        current = {item["pk"] for item in acl["permissions"]}

    for permission in sorted(required_permissions - current):
        response = await call(
            request, "POST",
            object_path(app_label, model, workflow_id, f"{acl_id}/permissions/add/"),
            json={"permission": permission},
        )
        if response.status_code not in (200, 201, 204):
            check_upstream(request, response.status_code)

    verified = await object_acl_rows(request, app_label, model, workflow_id)
    updated = next((row for row in verified if row["role"]["id"] == role_id), None)
    verified_permissions = {item["pk"] for item in (updated or {}).get("permissions", [])}
    if updated is None or not required_permissions.issubset(verified_permissions):
        raise HTTPException(502, "Mayan did not confirm the required workflow access for this role.")


async def ensure_reviewer_access(request: Request, document_id: int, role_id: int):
    """Add reviewer permissions without removing the role's existing access."""
    permissions = await class_permissions(request, "document")
    by_label = {row["label"]: row["pk"] for row in permissions}
    labels = BUNDLES["document"]["reviewer"]["permissions"]
    target = {by_label[label] for label in labels if label in by_label}
    if not target:
        raise HTTPException(422, "Mayan exposes no reviewer permissions for documents.")

    await ensure_workflow_role_visibility(request, role_id, allow_transition=True)
    acls = await acl_rows(request, "document", document_id)
    acl = next((row for row in acls if row["role"]["id"] == role_id), None)
    if acl is None:
        created = await call(
            request, "POST", scope_path("document", document_id), json={"role_id": role_id}
        )
        if created.status_code != 201:
            check_upstream(request, created.status_code)
        acl_id = int(created.json()["id"])
        current = set()
    else:
        acl_id = acl["id"]
        current = {item["pk"] for item in acl["permissions"]}

    for permission in sorted(target - current):
        response = await call(
            request, "POST",
            scope_path("document", document_id, f"{acl_id}/permissions/add/"),
            json={"permission": permission},
        )
        if response.status_code not in (200, 201, 204):
            check_upstream(request, response.status_code)

    verified = await acl_rows(request, "document", document_id)
    updated = next((row for row in verified if row["role"]["id"] == role_id), None)
    if updated is None or not target.issubset({item["pk"] for item in updated["permissions"]}):
        raise HTTPException(502, "Mayan did not confirm reviewer access for this role.")
    return updated


@router.get("/access")
async def manager_access(request: Request):
    try:
        await access_manager(request)
        return {"allowed": True}
    except HTTPException as exc:
        if exc.status_code == 403:
            return {"allowed": False}
        raise


@router.get("/options", dependencies=[Depends(access_manager)])
async def access_options(request: Request, scope: Literal["document", "cabinet"] = Query()):
    roles = await all_rows(request, "/roles/")
    permissions = await class_permissions(request, scope)
    available = {row["label"]: row["pk"] for row in permissions}
    bundles = []
    for key, bundle in BUNDLES[scope].items():
        bundles.append({
            "key": key, "label": bundle["label"],
            "description": bundle["description"],
            "permission_pks": sorted(available[label] for label in bundle["permissions"] if label in available),
            "missing_labels": sorted(bundle["permissions"] - set(available)),
        })
    role_values = []
    for row in roles:
        try:
            role_id = int(row["id"])
            role_label = str(row["label"])
        except (KeyError, TypeError, ValueError):
            continue
        expected_group = MANAGED_ROLE_GROUPS.get(role_label)
        if expected_group is None:
            continue
        linked_groups = []
        members = []
        mapping_error = ""
        try:
            group_rows = await all_rows(request, f"/roles/{role_id}/groups/")
            linked_groups = [
                {"id": int(group["id"]), "name": str(group["name"])}
                for group in group_rows
                if isinstance(group, dict) and group.get("id") is not None and group.get("name")
            ]
            for group in linked_groups:
                user_rows = await all_rows(request, f"/groups/{group['id']}/users/")
                members.extend(
                    str(user["username"]) for user in user_rows
                    if isinstance(user, dict) and user.get("username")
                )
        except HTTPException as exc:
            if exc.status_code == 401:
                raise
            mapping_error = "Group membership could not be inspected with this account."
        role_values.append({
            "id": role_id,
            "label": role_label,
            "expected_group": expected_group,
            "linked_groups": linked_groups,
            "members": sorted(set(members), key=str.casefold),
            "mapping_ready": any(group["name"] == expected_group for group in linked_groups),
            "mapping_error": mapping_error,
        })
    if not role_values:
        expected = ", ".join(MANAGED_ROLE_GROUPS)
        raise HTTPException(
            502,
            f"No managed research roles are available. Expected one of: {expected}. Verify the Mayan roles and refresh."
        )
    return {
        "roles": role_values,
        "bundles": bundles,
    }


@router.get("/acls", dependencies=[Depends(access_manager)])
async def read_acls(request: Request, scope: Literal["document", "cabinet"], object_id: int = Query(ge=1)):
    try:
        return {"results": await acl_rows(request, scope, object_id)}
    except HTTPException as exc:
        if exc.status_code == 403:
            raise HTTPException(403, "Your account cannot view ACLs for this object.") from None
        raise


class ACLUpdate(BaseModel):
    scope: Literal["document", "cabinet"]
    object_id: PositiveInt
    role_id: PositiveInt
    bundle: str = Field(min_length=1, max_length=50)
    original_permission_pks: list[str] = Field(default_factory=list, max_length=200)


@router.put("/acls", dependencies=[Depends(trusted_origin), Depends(require_write), Depends(access_manager)])
async def update_acl(request: Request, body: ACLUpdate):
    bundle = BUNDLES[body.scope].get(body.bundle)
    if bundle is None:
        raise HTTPException(422, "Choose a supported permission bundle.")
    roles = await all_rows(request, "/roles/")
    managed_role_ids = {
        int(row["id"]) for row in roles
        if row.get("label") in MANAGED_ROLE_GROUPS
    }
    if body.role_id not in managed_role_ids:
        raise HTTPException(422, "Choose an available role.")
    permissions = await class_permissions(request, body.scope)
    by_label = {row["label"]: row["pk"] for row in permissions}
    target = {by_label[label] for label in bundle["permissions"] if label in by_label}
    if not target and body.bundle != "none":
        raise HTTPException(422, "The selected bundle has no permissions available for this object type.")

    acls = await acl_rows(request, body.scope, body.object_id)
    acl = next((row for row in acls if row["role"]["id"] == body.role_id), None)
    current = {item["pk"] for item in (acl or {}).get("permissions", [])}
    if current != set(body.original_permission_pks):
        raise HTTPException(409, "Access changed since this page loaded. Reload before applying changes.")
    if acl is None and body.bundle == "none":
        raise HTTPException(409, "This role does not have direct managed access on the selected object.")

    # Workflow instances inherit permissions from the shared Workflow object.
    # Establish that narrow companion ACL before changing the document. If the
    # document update later fails, this alone exposes no document records.
    if body.scope == "document" and "View workflow templates" in bundle["permissions"]:
        await ensure_workflow_role_visibility(
            request, body.role_id,
            allow_transition="Transition workflow instances" in bundle["permissions"],
        )
    if acl is None:
        created = await call(request, "POST", scope_path(body.scope, body.object_id), json={"role_id": body.role_id})
        if created.status_code != 201:
            check_upstream(request, created.status_code)
        acl_id = int(created.json()["id"])
    else:
        acl_id = acl["id"]

    # Only permissions covered by our bundles are changed; unrelated custom ACL
    # permissions are preserved.
    managed_labels = set().union(*(entry["permissions"] for entry in BUNDLES[body.scope].values()))
    managed = {by_label[label] for label in managed_labels if label in by_label}
    for permission in sorted(target - current):
        response = await call(request, "POST", scope_path(body.scope, body.object_id, f"{acl_id}/permissions/add/"), json={"permission": permission})
        if response.status_code not in (200, 201, 204):
            check_upstream(request, response.status_code)
    for permission in sorted((current & managed) - target):
        response = await call(request, "POST", scope_path(body.scope, body.object_id, f"{acl_id}/permissions/remove/"), json={"permission": permission})
        if response.status_code not in (200, 201, 204):
            check_upstream(request, response.status_code)

    verified = await acl_rows(request, body.scope, body.object_id)
    updated = next((row for row in verified if row["role"]["id"] == body.role_id), None)
    updated_permissions = {item["pk"] for item in (updated or {}).get("permissions", [])}
    if updated is None or not target.issubset(updated_permissions) or ((current & managed) - target) & updated_permissions:
        raise HTTPException(502, "Mayan did not confirm the requested access. Reload and review the ACL.")
    return updated
