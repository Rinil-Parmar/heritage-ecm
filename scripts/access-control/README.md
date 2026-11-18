# Automated Mayan role and group baseline

Scope: five roles, five groups, their associations, and a small global permission
allowlist from the project checklist. The owner requested that existing documents
be left alone. **No document types, documents, object ACLs, users, passwords,
group memberships of users, or superuser flags are changed.**

| Role | Group | Global permissions requested |
| --- | --- | --- |
| System Administrator | Preserve existing groups; System Administrators only if the role is absent | Preserve existing role untouched; if absent create an empty placeholder. Continue using the existing superuser. |
| Department Administrator | Department Administrators | Type/tag visibility, search tools, create documents/cabinets/tags |
| Research Professor | Research Professors | Type/tag visibility, search tools, create documents |
| Research Assistant | Research Assistants | Type/tag visibility, search tools, create documents |
| Research Viewer | Research Viewers | Type/tag visibility and search tools |

Type/tag visibility is global and can expose their labels. It is explicitly
requested by the checklist; remove those capabilities from roles.json if that
is inappropriate. Creation permission alone does not guarantee the whole upload
workflow works: source access and object permissions may also be required.

This is the role baseline, not a complete document-access policy. Professor
review permissions and assistant editing permissions need selected object ACLs
later. They are deliberately not granted globally to bypass that step.
The newly created System Administrator placeholder group does not confer
superuser powers. An existing System Administrator role is outside the script's
managed scope: its groups, permissions, and ACLs are reported/preserved, not
verified against an empty allowlist. Other roles retain the strict conflict checks.

### Approved Viewer correction (November 4, 2026)

The VM inventory showed all five roles already linked to groups without the
"ECM" prefix. roles.json now uses those actual names. The owner approved removal
of eight existing Research Viewer global grants to match the restricted
checklist: cabinet viewing, document file downloading, index instance viewing,
index definition viewing, document viewing, file viewing, version viewing, and
document metadata viewing. Their exact installed IDs are listed under
remove_permissions in roles.json. Document-type and tag visibility are retained;
the requested search-tools permission is resolved from the runtime catalog.

Removal applies only to the Research Viewer role's global permission links.
It does not delete permission records or touch other roles or object ACLs.
Ordinary viewers may lose document access until scoped ACLs are configured.
An unlisted extra permission still aborts the operation for review.

## How it works

- roles.json is the explicit policy. No fuzzy label matching or grant-all loops.
- configure_access.py reads the installed Mayan StoredPermission registry and
  resolves exact English labels to its real identifiers. An absent/ambiguous
  label or incompatible model API aborts without a partial configuration.
- plan is the default; inventory, plan, and verify use a read-only PostgreSQL
  transaction. apply validates the whole plan before writing transactionally.
- The script adds missing entries and removes only the explicitly approved
  Viewer grants that still exist. A second plan should show no changes.
- Existing matching research roles with unapproved extra global permissions, other groups, object
  ACLs, or conflicting group-role links cause a refusal instead of silently
  broadening access or deleting existing configuration. Resolve collisions by
  reviewing the actual configuration, not by deleting objects blindly.
- It uses Mayan's event-aware group/permission addition methods and identifies
  an active existing superuser as actor (default admin).
- Run one operator at a time; avoid concurrent role edits or deployments.

The current VM version has not been exercised by this script yet. Local tests
cover policy validation, exact matching, ambiguity, and permission deltas. The
first VM dry run verifies compatibility; a live apply and effective-permission
tests remain necessary. Upstream model source was inspected as a reference, not
assumed to be identical to the installed build.

## 1. Transfer the three files

In a VM SSH terminal:

```bash
mkdir -p ~/ECM_Archeology/access-control
```

On the laptop in Windows PowerShell:

```powershell
cd D:\Internship_Project_2\heritage-ecm\scripts\access-control
scp configure_access.py roles.json run-access.sh parmar7f@archeoecm.cs.uwindsor.ca:/home/parmar7f/ECM_Archeology/access-control/
```

No Python installation on the VM host is needed: the script uses Mayan's Python
inside the running app container. No containers need to be stopped or restarted.
Do not use sudo docker; production uses the deployment account's rootless daemon.
The wrapper streams files into a private temporary container directory and
removes them afterward. It avoids docker cp, which can fail with an invalid
Lchown argument when the university account's UID/GID cannot be mapped by
rootless Docker. No host ownership or Docker mapping changes are needed.

## 2. Run the dry run on the VM

```bash
cd ~/ECM_Archeology/access-control
bash run-access.sh plan
```

If the active superuser has another username:

```bash
ECM_ACCESS_ACTOR=your_superuser_username bash run-access.sh plan
```

Review all five entries and any existing group member counts. The output lists
resolved permission IDs and proposed additions. If a requested permission cannot
be resolved, export the actual catalog and review it before changing the policy:

```bash
umask 077
bash run-access.sh inventory > access-inventory.txt
```

This catalog includes role/group names and permission labels, not passwords,
user lists, or documents. Treat organizational names as private when sharing.
Do not skip a missing permission silently or replace it with a broader grant.

## 3. Back up before applying

Use the department's PostgreSQL backup procedure and verify recoverability.
For a local custom-format snapshot of this existing Compose PostgreSQL service:

```bash
cd ~/ECM_Archeology/deployment/mayan
umask 077
mkdir -p ~/ecm-backups
backup_file="$HOME/ecm-backups/before-roles-$(date +%Y%m%d-%H%M%S).dump"
docker --context rootless compose -p archeoecm -f docker-compose.yml exec -T postgresql \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_file"
# Continue only if pg_dump exited successfully.
docker --context rootless compose -p archeoecm -f docker-compose.yml exec -T postgresql \
  pg_restore --list < "$backup_file" > "$backup_file.contents"
test -s "$backup_file.contents"
```

Listing confirms the archive can be read; it is not a full restore test. Verify
a restore in an isolated database before claiming recovery is tested. Keep the
snapshot out of GitHub and use separate approved storage for durable backups.
Do not restore over the live database merely to test a backup.

## 4. Apply once, then verify

After reviewing the plan and confirming the backup:

```bash
cd ~/ECM_Archeology/access-control
ECM_ACCESS_BACKUP_CONFIRMED=yes bash run-access.sh apply
bash run-access.sh verify
bash run-access.sh plan
```

Use the same ECM_ACCESS_ACTOR override for these commands if needed. verify
checks the requested baseline, not effective access for every user. The final
plan should show changes_needed=false. Only the approved Viewer removals are
revoked; other conflicting grants are refused. If an exception occurs, its
database changes roll back, but an operator should still inspect the failure
before rerunning. External event delivery is not guaranteed to roll back.

## 5. Users and document access come later

After successful verification, use Mayan's group membership interface to assign
intended users to the corresponding groups. Existing superusers (including a
professor account created with createsuperuser) bypass normal restrictions;
use non-superuser, non-staff test accounts to test roles. Inspect all their other
groups and roles because permissions accumulate.

The Viewer must fail upload/edit/delete tests. Assistant and Professor must not
manage users, roles, or settings. No research account should gain document access
from this baseline alone unless it already has access through another route.
Object-scoped access to approved documents, metadata, cabinets, tags, indexes,
and workflows is a separate next step once that scope is defined.

## Local tests

```powershell
python -m unittest discover -s scripts/access-control -p "test_*.py" -v
```

References: [Mayan permission model](https://docs.mayan-edms.com/chapters/releases/2.0.html),
[4.12 ACL changes](https://docs.mayan-edms.com/chapters/releases/4.12.html),
[upstream role model reference](https://github.com/mayan-edms/Mayan-EDMS/blob/master/mayan/apps/permissions/models.py).
