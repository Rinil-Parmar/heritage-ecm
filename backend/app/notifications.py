"""User notification center for application-owned workflow events."""

from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth import COOKIE_NAME, settings_for, store_for, trusted_origin
from app.database import mark_all_notifications, mark_notification, notification_rows, unread_count
from app.uploads import require_write

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


def current_username(request: Request) -> str:
    session = store_for(request).get(request.cookies.get(COOKIE_NAME))
    if not session:
        raise HTTPException(401, "Please sign in.")
    return session.username


@router.get("")
async def notifications(request: Request):
    username = current_username(request)
    path = settings_for(request).database_path
    return {"unread": unread_count(path, username), "results": notification_rows(path, username)}


@router.post("/{notification_id}/read", dependencies=[Depends(trusted_origin), Depends(require_write)])
async def read_notification(request: Request, notification_id: int):
    if notification_id < 1:
        raise HTTPException(404, "Notification not found.")
    changed = mark_notification(settings_for(request).database_path, current_username(request), notification_id)
    return {"updated": changed}


@router.post("/read-all", dependencies=[Depends(trusted_origin), Depends(require_write)])
async def read_all(request: Request):
    count = mark_all_notifications(settings_for(request).database_path, current_username(request))
    return {"updated": count}
