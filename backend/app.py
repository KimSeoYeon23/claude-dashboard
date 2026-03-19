import logging
import re
import traceback

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from .config import STATIC_DIR, CORS_ORIGINS
from .db import init_db
from .routes import stats, sessions, projects, agents, sync, register, notifications, summarize, report, usage
from .services.notifier import notify_user

logger = logging.getLogger(__name__)

app = FastAPI(title="Claude Code Dashboard")

init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stats.router)
app.include_router(sessions.router)
app.include_router(projects.router)
app.include_router(agents.router)
app.include_router(sync.router)
app.include_router(register.router)
app.include_router(notifications.router)
app.include_router(summarize.router)
app.include_router(report.router)
app.include_router(usage.router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """처리되지 않은 예외 발생 시 해당 유저에게 이메일 알림"""
    tb = traceback.format_exc()
    masked_tb = re.sub(r'Bearer\s+\S+', 'Bearer [REDACTED]', tb)
    masked_tb = re.sub(r'(?i)(password|token|secret|key)\s*[=:]\s*\S+', r'\1=[REDACTED]', masked_tb)
    logger.error(f"Unhandled error: {request.url.path}\n{masked_tb}")

    # Authorization 헤더에서 유저 식별
    username = None
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        from .services.auth import resolve_token
        username = resolve_token(auth[7:])

    if username:
        notify_user(username, "server_error", {
            "message": f"요청: {request.method} {request.url.path}\n\n{masked_tb}",
        })

    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
