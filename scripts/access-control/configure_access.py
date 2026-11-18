"""Run inside Mayan's Django shell. Default is a read-only plan.

No document ACLs or user membership changes. Runtime labels must resolve exactly.
"""

import inspect
import json
import os
from pathlib import Path


# Explicit global capabilities from the project checklist. No wildcard grants.
READ = {"View document types", "Execute search tools", "View tags"}
CONTRIBUTE = READ | {"Create documents"}
ALLOWED = {
    "System Administrator": set(),
    "Department Administrator": CONTRIBUTE | {"Create cabinets", "Create new tags"},
    "Research Professor": CONTRIBUTE,
    "Research Assistant": CONTRIBUTE,
    "Research Viewer": READ,
}
# Only these documented spelling variations are considered equivalent.
ALIASES = {"Create new tags": {"Create new tags", "Create tags"}}
# Exact existing Viewer grants approved for removal by the owner on 2026-11-04.
APPROVED_REMOVALS = {
    "Research Viewer": {
        "cabinets.cabinet_view",
        "document_downloads.document_file_download",
        "document_indexing.document_index_instance_view",
        "document_indexing.document_index_view",
        "documents.document_view",
        "documents.document_file_view",
        "documents.document_version_view",
        "metadata.metadata_document_view",
    }
}


def validate_policy(policy):
    if set(policy) != {"roles"} or not isinstance(policy["roles"], list):
        raise ValueError("Expected a policy containing a roles list only.")
    names, groups = set(), set()
    for entry in policy["roles"]:
        if not {"name", "group", "permissions"} <= set(entry) or set(entry) - {"name", "group", "permissions", "remove_permissions"}:
            raise ValueError("Each role needs name, group, permissions, and optionally remove_permissions.")
        name, group, permissions = entry["name"], entry["group"], entry["permissions"]
        if name not in ALLOWED or name in names:
            raise ValueError(f"Unknown or duplicate role: {name}")
        if not isinstance(group, str) or not group.strip() or group in groups:
            raise ValueError("Groups must have unique, non-empty names.")
        if not isinstance(permissions, list) or any(not isinstance(p, str) for p in permissions):
            raise ValueError("permissions must be a list of explicit labels.")
        if len(permissions) != len(set(permissions)) or not set(permissions) <= ALLOWED[name]:
            raise ValueError(f"Duplicate or unapproved global permission for {name}")
        removals = entry.get("remove_permissions", [])
        if not isinstance(removals, list) or any(not isinstance(p, str) for p in removals):
            raise ValueError("remove_permissions must be a list of explicit IDs.")
        if len(removals) != len(set(removals)) or not set(removals) <= APPROVED_REMOVALS.get(name, set()):
            raise ValueError(f"Unapproved or duplicate permission removal for {name}")
        names.add(name)
        groups.add(group)
    if names != set(ALLOWED):
        raise ValueError("Policy must declare all five roles.")
    return policy["roles"]


def resolve_permissions(labels, catalog):
    """Resolve only exact English labels, never substrings or fuzzy matches."""
    result = []
    for label in labels:
        candidates = [item for item in catalog if item["label"] in ALIASES.get(label, {label})]
        if len(candidates) != 1:
            raise ValueError(
                f"Permission {label!r} has {len(candidates)} runtime matches; "
                "nothing changed. Run inventory and review the installed permission catalog."
            )
        result.append(candidates[0])
    return result


def permission_changes(desired, existing, approved_removals=()):
    if set(desired) & set(approved_removals):
        raise ValueError("A permission cannot be both desired and approved for removal.")
    extra = set(existing) - set(desired)
    unapproved = extra - set(approved_removals)
    if unapproved:
        raise ValueError(f"Existing role has unapproved global permissions: {sorted(unapproved)}")
    return sorted(set(desired) - set(existing)), sorted(extra & set(approved_removals))


def permission_delta(desired, existing):
    return permission_changes(desired, existing)[0]


def role_method(role, name, queryset, actor, *, execute=False):
    """Validate the installed signature before calling; never retry a write."""
    method = getattr(role, name)
    signature = inspect.signature(method)
    kwargs = {"queryset": queryset}
    # Installed Mayan mixins use `user or self.user` for the event actor.
    # Role instances loaded by this script do not have a request-bound user.
    if "user" in signature.parameters:
        kwargs["user"] = actor
    if "_event_actor" in signature.parameters:
        kwargs["_event_actor"] = actor
    signature.bind(**kwargs)
    if execute:
        # Retain instance attribution for model hooks as well as explicit args.
        role._event_actor = actor
        return method(**kwargs)


def run():
    # Import only when executed inside Mayan, allowing local policy tests.
    from django.apps import apps
    from django.contrib.auth import get_user_model
    from django.db import transaction
    from django.utils.translation import override

    mode = os.environ.get("ECM_ACCESS_MODE", "plan")
    if mode not in {"inventory", "plan", "apply", "verify"}:
        raise ValueError("ECM_ACCESS_MODE must be inventory, plan, apply, or verify.")
    Role = apps.get_model("permissions", "Role")
    Permission = apps.get_model("permissions", "StoredPermission")
    Group = apps.get_model("auth", "Group")
    ACL = apps.get_model("acls", "AccessControlList")

    with override("en"), transaction.atomic():
        # Explicitly reject writes in inspection modes, including accidental ones
        # from model helpers. This deployment uses PostgreSQL.
        if mode != "apply":
            from django.db import connection
            if connection.vendor != "postgresql":
                raise ValueError("Read-only inspection currently requires PostgreSQL.")
            with connection.cursor() as cursor:
                cursor.execute("SET TRANSACTION READ ONLY")

        catalog, stale = [], []
        for item in Permission.objects.all().order_by("namespace", "name"):
            identifier = f"{item.namespace}.{item.name}"
            try:
                label = str(item.volatile_permission.label)
            except KeyError:
                stale.append(identifier)
                continue
            catalog.append({"id": identifier, "pk": item.pk, "label": label})

        if mode == "inventory":
            print(json.dumps({"permissions": catalog, "stale_permissions": stale,
                              "roles": list(Role.objects.values_list("label", flat=True)),
                              "groups": list(Group.objects.values_list("name", flat=True))}, indent=2))
            return

        policy_path = Path(os.environ.get("ECM_ACCESS_POLICY", str(Path(__file__).with_name("roles.json"))))
        entries = validate_policy(json.loads(policy_path.read_text(encoding="utf-8-sig")))
        actor = get_user_model().objects.get(username=os.environ.get("ECM_ACCESS_ACTOR", "admin"))
        if not actor.is_active or not actor.is_superuser:
            raise ValueError("Actor must be an existing active superuser; no accounts will be promoted.")
        if mode == "apply" and os.environ.get("ECM_ACCESS_BACKUP_CONFIRMED") != "yes":
            raise ValueError("Take and verify a PostgreSQL backup before setting ECM_ACCESS_BACKUP_CONFIRMED=yes.")

        plans, preserved = [], []
        for entry in entries:
            role = Role.objects.filter(label=entry["name"]).first()
            # The department baseline must not manage the installed platform
            # administrator role, its groups, permissions, or existing ACLs.
            if entry["name"] == "System Administrator" and role is not None:
                preserved.append({
                    "role": entry["name"],
                    "groups": list(role.groups.values_list("name", flat=True)),
                    "reason": "Existing platform administrator role is outside managed scope; left unchanged.",
                })
                continue
            resolved = resolve_permissions(entry["permissions"], catalog)
            group = Group.objects.filter(name=entry["group"]).first()
            existing_objects = [] if role is None else list(role.permissions.all())
            existing = [f"{p.namespace}.{p.name}" for p in existing_objects]
            missing, removals = permission_changes(
                [p["id"] for p in resolved], existing, entry.get("remove_permissions", [])
            )
            removal_pks = [p.pk for p in existing_objects if f"{p.namespace}.{p.name}" in removals]
            if role is not None:
                if role.groups.exclude(name=entry["group"]).exists():
                    raise ValueError(f"{entry['name']} has other groups; review before changing this existing role.")
                if ACL.objects.filter(role=role).exists():
                    raise ValueError(f"{entry['name']} already has object ACLs; review separately, nothing changed.")
            if group is not None and Role.objects.filter(groups=group).exclude(label=entry["name"]).exists():
                raise ValueError(f"{entry['group']} belongs to other roles; review this naming collision first.")
            # Verify the installed model supports the event-aware methods used.
            probe = role if role is not None else Role(label=entry["name"])
            role_method(probe, "permissions_add", Permission.objects.none(), actor)
            role_method(probe, "groups_add", Group.objects.none(), actor)
            if removals:
                role_method(probe, "permissions_remove", Permission.objects.none(), actor)
            linked = bool(role is not None and group is not None and role.groups.filter(pk=group.pk).exists())
            plans.append({"role": entry["name"], "group": entry["group"],
                          "create_role": role is None, "create_group": group is None,
                          "link_group": not linked, "add_permissions": missing,
                          "remove_permissions": removals, "remove_permission_pks": removal_pks,
                          "resolved_permissions": resolved,
                          "existing_group_member_count": 0 if group is None else group.user_set.count()})

        # All roles and permissions validated before the first write.
        changes = any(p["create_role"] or p["create_group"] or p["link_group"] or p["add_permissions"] or p["remove_permissions"] for p in plans)
        print(json.dumps({"mode": mode, "changes_needed": changes, "plan": plans,
                          "preserved": preserved,
                          "scope": "Global role baseline only; no users or document ACLs changed."}, indent=2))
        if mode == "verify":
            if changes:
                raise ValueError("Verification failed: expected baseline is incomplete.")
            print("Managed baseline verified; preserved administrator role excluded. This is not an effective user-access or document-permission test.")
        elif mode == "apply":
            for plan in plans:
                role = Role.objects.filter(label=plan["role"]).first()
                if role is None:
                    role = Role(label=plan["role"])
                    role._event_actor = actor
                    role.save()
                group, _ = Group.objects.get_or_create(name=plan["group"])
                if plan["link_group"]:
                    role_method(role, "groups_add", Group.objects.filter(pk=group.pk), actor, execute=True)
                missing_pks = [p["pk"] for p in plan["resolved_permissions"] if p["id"] in plan["add_permissions"]]
                if missing_pks:
                    role_method(role, "permissions_add", Permission.objects.filter(pk__in=missing_pks), actor, execute=True)
                if plan["remove_permission_pks"]:
                    role_method(
                        role, "permissions_remove",
                        Permission.objects.filter(pk__in=plan["remove_permission_pks"]),
                        actor, execute=True,
                    )
            print("Baseline applied transactionally. Run verify, then plan again; no additions should remain.")
        else:
            print("DRY RUN ONLY: nothing changed. Existing System Administrator is preserved; if absent, only an empty organizational role is planned.")


if __name__ == "__main__":
    run()
