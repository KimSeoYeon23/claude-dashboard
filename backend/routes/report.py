from typing import Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel

from ..services.auth import resolve_token
from ..services.notifier import notify_user

router = APIRouter()


class ErrorReport(BaseModel):
    type: str
    message: str
    url: str | None = None
    stack: str | None = None


@router.post("/api/report-error")
async def report_error(
    body: ErrorReport,
    authorization: Optional[str] = Header(None),
):
    username: Optional[str] = None

    # Bearer 토큰 우선 — 서버가 발급한 토큰으로만 유저 식별
    if authorization and authorization.startswith("Bearer "):
        username = resolve_token(authorization[7:])

    if not username:
        return {"ok": True}

    context = {"message": f"[{body.type}] {body.message}"}
    if body.url:
        context["message"] += f"\nURL: {body.url}"
    if body.stack:
        context["message"] += f"\nStack: {body.stack[:500]}"

    notify_user(username, "frontend_error", context)
    return {"ok": True}
