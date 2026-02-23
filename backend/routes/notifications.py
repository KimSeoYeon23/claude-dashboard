from typing import Optional

from fastapi import APIRouter, Query

from ..services.notifier import get_notifications

router = APIRouter()


@router.get("/api/notifications")
def api_notifications(
    user: str = Query(...),
    limit: int = Query(50),
):
    limit = min(limit, 100)
    items = get_notifications(user, limit)
    return {"notifications": items, "total": len(items)}
