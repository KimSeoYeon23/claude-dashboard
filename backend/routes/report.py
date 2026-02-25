from fastapi import APIRouter, Request
from pydantic import BaseModel

from ..services.notifier import notify_user

router = APIRouter()


class ErrorReport(BaseModel):
    type: str
    message: str
    url: str | None = None
    stack: str | None = None


@router.post("/api/report-error")
async def report_error(body: ErrorReport, request: Request):
    username = request.query_params.get("user")
    if not username:
        match = request.cookies.get("username")
        if match:
            username = match

    if username:
        context = {
            "message": f"[{body.type}] {body.message}"
        }
        if body.url:
            context["message"] += f"\nURL: {body.url}"
        if body.stack:
            context["message"] += f"\nStack: {body.stack[:500]}"

        notify_user(username, "frontend_error", context)

    return {"ok": True}
