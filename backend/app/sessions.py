"""Bounded, single-process development sessions. Never persist upstream tokens."""

from dataclasses import dataclass, field
import secrets
import time


@dataclass
class Session:
    username: str
    token: str = field(repr=False)
    csrf: str = field(repr=False)
    expires: float


class SessionStore:
    def __init__(self):
        self.sessions: dict[str, Session] = {}
        self.attempts: dict[str, list[float]] = {}

    def prune(self):
        now = time.monotonic()
        self.sessions = {k: v for k, v in self.sessions.items() if v.expires > now}
        self.attempts = {k: [t for t in v if now - t < 60] for k, v in self.attempts.items()}
        self.attempts = {k: v for k, v in self.attempts.items() if v}

    def allow_login(self, key: str) -> bool:
        self.prune()
        if key not in self.attempts and len(self.attempts) >= 1000:
            return False
        attempts = self.attempts.setdefault(key, [])
        if len(attempts) >= 10:
            return False
        attempts.append(time.monotonic())
        return True

    def create(self, username: str, token: str, ttl: int) -> tuple[str, Session]:
        self.prune()
        if len(self.sessions) >= 1000:
            raise RuntimeError("Session capacity reached")
        session_id = secrets.token_urlsafe(32)
        session = Session(username, token, secrets.token_urlsafe(32), time.monotonic() + ttl)
        self.sessions[session_id] = session
        return session_id, session

    def get(self, session_id: str | None) -> Session | None:
        self.prune()
        return self.sessions.get(session_id or "")

    def delete(self, session_id: str | None):
        self.sessions.pop(session_id or "", None)
