from typing import Optional

from fastapi import APIRouter, Header, Query

from ..services.notifier import get_notifications
from ..services.auth import resolve_api_user

router = APIRouter()


@router.get("/api/notifications")
def api_notifications(
    user: str = Query(...),
    limit: int = Query(50),
    authorization: str | None = Header(None),
):
    user = resolve_api_user(user, authorization) or user
    limit = min(limit, 100)
    items = get_notifications(user, limit)
    return {"notifications": items, "total": len(items)}
