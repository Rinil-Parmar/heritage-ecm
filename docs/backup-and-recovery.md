# ArcheoVault backup and recovery

ArcheoVault has two persistence layers and both are required for a complete
recovery:

1. Mayan EDMS stores document files, metadata, users, ACLs and workflow state.
2. The `archeoecm-application_archeoecm-data` Docker volume stores review
   assignments, notifications, record relationships and ArcheoVault access
   history in SQLite.

Backups must remain outside the Git repository and should be copied to approved
off-VM storage. Do not run `docker compose down -v` in production.

## Application database backup

The API is safe to keep running while SQLite creates a consistent online
backup. On the university VM:

```bash
backup_dir="$HOME/ecm-backups/archeovault"
mkdir -p "$backup_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
docker run --rm \
  -v archeoecm-application_archeoecm-data:/source:ro \
  -v "$backup_dir:/backup" \
  python:3.13-slim \
  python -c "import sqlite3; source=sqlite3.connect('file:/source/archeoecm.db?mode=ro', uri=True); target=sqlite3.connect('/backup/archeovault-$stamp.db'); source.backup(target); target.close(); source.close()"
test -s "$backup_dir/archeovault-$stamp.db"
sha256sum "$backup_dir/archeovault-$stamp.db" > "$backup_dir/archeovault-$stamp.db.sha256"
```

Validate a copied backup without modifying production:

```bash
python3 -c "import sqlite3,sys; db=sqlite3.connect(sys.argv[1]); print(db.execute('PRAGMA integrity_check').fetchone()[0]); db.close()" \
  "$backup_dir/archeovault-$stamp.db"
```

The result must be `ok`.

## Application database restore drill

Perform this first in an isolated test volume. Do not overwrite the production
volume merely to test restoration.

1. Verify the checksum and `PRAGMA integrity_check`.
2. Stop only the ArcheoVault API and web Compose project.
3. Copy the verified database into a newly created test volume.
4. Start a test deployment using that volume.
5. Verify `/api/v1/health/ready`, review assignments, notifications,
   relationships and access history.
6. Record the backup name, restoration time and verification result.

For a real restoration, retain the damaged volume until recovery is accepted.
Restore the matching Mayan backup first, then the ArcheoVault database, because
application rows reference Mayan document and workflow IDs.

## Mayan backup

Use the university's approved PostgreSQL and document-volume backup process.
At minimum, verify that the PostgreSQL archive can be listed, document storage
is included, encryption keys and environment configuration are recoverable, and
a complete restore has succeeded in an isolated environment. A successful
`pg_dump` command alone is not proof that the platform can be recovered.

## Required schedule

- Daily: application SQLite and Mayan database backup.
- After access/workflow configuration changes: additional backup.
- Weekly: checksum validation and off-VM copy verification.
- Quarterly: isolated full restore drill with documented recovery time.
