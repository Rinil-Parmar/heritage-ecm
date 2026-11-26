"""Small persistent application store; Mayan remains the records authority."""

from datetime import datetime, timezone
from pathlib import Path
import sqlite3
from typing import Any, Callable


SCHEMA = """
CREATE TABLE IF NOT EXISTS review_assignments (
    workflow_instance_id INTEGER PRIMARY KEY,
    document_id INTEGER NOT NULL,
    assignee_username TEXT NOT NULL,
    assigned_by TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('normal', 'high', 'urgent')),
    due_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_review_assignment_user ON review_assignments(assignee_username);
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    document_id INTEGER,
    created_at TEXT NOT NULL,
    read_at TEXT,
    dedupe_key TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_notification_user ON notifications(username, read_at, created_at DESC);
CREATE TABLE IF NOT EXISTS document_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_document_id INTEGER NOT NULL,
    target_document_id INTEGER NOT NULL,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
        'same_site', 'depicts', 'supports', 'cites', 'supersedes', 'related'
    )),
    note TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CHECK (source_document_id <> target_document_id),
    UNIQUE (source_document_id, target_document_id, relationship_type)
);
CREATE INDEX IF NOT EXISTS idx_relationship_source ON document_relationships(source_document_id);
CREATE INDEX IF NOT EXISTS idx_relationship_target ON document_relationships(target_document_id);
CREATE TABLE IF NOT EXISTS access_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('document', 'cabinet')),
    object_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    role_label TEXT NOT NULL,
    bundle TEXT NOT NULL,
    permission_count INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_access_audit_object
    ON access_audit(scope, object_id, created_at DESC);
CREATE TABLE IF NOT EXISTS document_stewards (
    document_id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def connection(path: str) -> sqlite3.Connection:
    file = Path(path)
    file.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(file, timeout=5)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA busy_timeout=5000")
    db.executescript(SCHEMA)
    return db


def run(path: str, operation: Callable[[sqlite3.Connection], Any]):
    # Operations are deliberately tiny and indexed; the API currently runs one worker.
    db = connection(path)
    try:
        result = operation(db)
        db.commit()
        return result
    finally:
        db.close()


def assignment_map(path: str, workflow_ids: list[int]) -> dict[int, dict]:
    if not workflow_ids:
        return {}
    def query(db):
        placeholders = ",".join("?" for _ in workflow_ids)
        rows = db.execute(f"SELECT * FROM review_assignments WHERE workflow_instance_id IN ({placeholders})", workflow_ids).fetchall()
        return {int(row["workflow_instance_id"]): dict(row) for row in rows}
    return run(path, query)


def assignments_for_user(path: str, username: str) -> list[dict]:
    """Return a user's work without requiring access to Mayan's global queue."""
    def query(db):
        return [dict(row) for row in db.execute(
            """SELECT * FROM review_assignments
               WHERE assignee_username = ? COLLATE NOCASE
               ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
                        COALESCE(due_at, '9999-12-31'), updated_at DESC""",
            (username,),
        ).fetchall()]
    return run(path, query)


def save_assignment(path: str, *, workflow_id: int, document_id: int, assignee: str,
                          actor: str, priority: str, due_at: str | None) -> dict:
    timestamp = now_iso()
    def save(db):
        existing = db.execute("SELECT created_at FROM review_assignments WHERE workflow_instance_id=?", (workflow_id,)).fetchone()
        created = existing["created_at"] if existing else timestamp
        db.execute("""INSERT INTO review_assignments
            (workflow_instance_id, document_id, assignee_username, assigned_by, priority, due_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(workflow_instance_id) DO UPDATE SET document_id=excluded.document_id,
              assignee_username=excluded.assignee_username, assigned_by=excluded.assigned_by,
              priority=excluded.priority, due_at=excluded.due_at, updated_at=excluded.updated_at""",
            (workflow_id, document_id, assignee, actor, priority, due_at, created, timestamp))
        return dict(db.execute("SELECT * FROM review_assignments WHERE workflow_instance_id=?", (workflow_id,)).fetchone())
    return run(path, save)


def delete_assignment(path: str, workflow_id: int):
    return run(path, lambda db: db.execute("DELETE FROM review_assignments WHERE workflow_instance_id=?", (workflow_id,)).rowcount)


def add_notification(path: str, *, username: str, kind: str, title: str, body: str,
                           document_id: int | None, dedupe_key: str | None = None):
    def add(db):
        db.execute("""INSERT OR IGNORE INTO notifications
            (username, kind, title, body, document_id, created_at, dedupe_key)
            VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (username, kind, title, body, document_id, now_iso(), dedupe_key))
    run(path, add)


def notification_rows(path: str, username: str, limit: int = 50) -> list[dict]:
    def query(db):
        return [dict(row) for row in db.execute(
            "SELECT id, kind, title, body, document_id, created_at, read_at FROM notifications WHERE username=? ORDER BY created_at DESC LIMIT ?",
            (username, limit)).fetchall()]
    return run(path, query)


def unread_count(path: str, username: str) -> int:
    return run(path, lambda db: int(db.execute(
        "SELECT COUNT(*) FROM notifications WHERE username=? AND read_at IS NULL", (username,)).fetchone()[0]))


def mark_notification(path: str, username: str, notification_id: int) -> bool:
    def mark(db):
        return db.execute("UPDATE notifications SET read_at=? WHERE id=? AND username=? AND read_at IS NULL",
                          (now_iso(), notification_id, username)).rowcount == 1
    return run(path, mark)


def mark_all_notifications(path: str, username: str) -> int:
    return run(path, lambda db: db.execute(
        "UPDATE notifications SET read_at=? WHERE username=? AND read_at IS NULL", (now_iso(), username)).rowcount)


def relationship_rows(path: str, document_id: int) -> list[dict]:
    def query(db):
        return [dict(row) for row in db.execute(
            """SELECT * FROM document_relationships
               WHERE source_document_id=? OR target_document_id=?
               ORDER BY created_at DESC, id DESC""",
            (document_id, document_id),
        ).fetchall()]
    return run(path, query)


def relationship_row(path: str, relationship_id: int) -> dict | None:
    def query(db):
        row = db.execute("SELECT * FROM document_relationships WHERE id=?", (relationship_id,)).fetchone()
        return dict(row) if row else None
    return run(path, query)


def save_relationship(path: str, *, source_id: int, target_id: int, relationship_type: str,
                      note: str, actor: str) -> dict:
    # Symmetric links have one canonical orientation, preventing A→B and B→A duplicates.
    if relationship_type in {"same_site", "related"} and source_id > target_id:
        source_id, target_id = target_id, source_id
    def save(db):
        db.execute(
            """INSERT INTO document_relationships
               (source_document_id, target_document_id, relationship_type, note, created_by, created_at)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(source_document_id, target_document_id, relationship_type)
               DO UPDATE SET note=excluded.note""",
            (source_id, target_id, relationship_type, note, actor, now_iso()),
        )
        return dict(db.execute(
            """SELECT * FROM document_relationships
               WHERE source_document_id=? AND target_document_id=? AND relationship_type=?""",
            (source_id, target_id, relationship_type),
        ).fetchone())
    return run(path, save)


def delete_relationship(path: str, relationship_id: int) -> bool:
    return run(path, lambda db: db.execute(
        "DELETE FROM document_relationships WHERE id=?", (relationship_id,),
    ).rowcount == 1)


def add_access_audit(path: str, *, actor: str, scope: str, object_id: int,
                     role_id: int, role_label: str, bundle: str,
                     permission_count: int) -> dict:
    def add(db):
        cursor = db.execute(
            """INSERT INTO access_audit
               (actor, scope, object_id, role_id, role_label, bundle,
                permission_count, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (actor, scope, object_id, role_id, role_label, bundle,
             permission_count, now_iso()),
        )
        return dict(db.execute(
            "SELECT * FROM access_audit WHERE id=?", (cursor.lastrowid,),
        ).fetchone())
    return run(path, add)


def access_audit_rows(path: str, scope: str, object_id: int,
                      limit: int = 25) -> list[dict]:
    def query(db):
        return [dict(row) for row in db.execute(
            """SELECT * FROM access_audit
               WHERE scope=? AND object_id=?
               ORDER BY created_at DESC, id DESC LIMIT ?""",
            (scope, object_id, limit),
        ).fetchall()]
    return run(path, query)


def save_document_steward(path: str, document_id: int, username: str) -> None:
    def save(db):
        db.execute(
            """INSERT INTO document_stewards(document_id, username, created_at)
               VALUES (?, ?, ?)
               ON CONFLICT(document_id) DO NOTHING""",
            (document_id, username, now_iso()),
        )
    run(path, save)


def document_steward(path: str, document_id: int) -> str | None:
    def query(db):
        row = db.execute(
            "SELECT username FROM document_stewards WHERE document_id=?",
            (document_id,),
        ).fetchone()
        return str(row["username"]) if row else None
    return run(path, query)
