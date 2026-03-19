import os
import tarfile
import tempfile
import traceback
from io import BytesIO
from pathlib import Path
import shutil

from fastapi import APIRouter, Form, Header, HTTPException, UploadFile, File

from ..config import DATA_DIR
from ..services.auth import resolve_token
from ..services.notifier import notify_user
from ..services.analyzer import analyze_history

router = APIRouter()


def replace_projects_from_archive(projects_dir: Path, content: bytes):
    if not content:
        shutil.rmtree(projects_dir, ignore_errors=True)
        return

    buf = BytesIO(content)
    with tarfile.open(fileobj=buf, mode="r:gz") as tar:
        resolved_base = projects_dir.resolve()
        for member in tar.getmembers():
            if member.name.startswith("/"):
                raise HTTPException(status_code=400, detail="Invalid tar member path")
            # 심볼릭 링크·하드 링크 차단
            if member.issym() or member.islnk():
                raise HTTPException(status_code=400, detail="Tar links not allowed")
            member_path = (projects_dir / member.name).resolve()
            if not str(member_path).startswith(str(resolved_base)):
                raise HTTPException(status_code=400, detail="Invalid tar member path")

        shutil.rmtree(projects_dir, ignore_errors=True)
        projects_dir.mkdir(parents=True, exist_ok=True)
        tar.extractall(path=str(projects_dir), filter="data")


@router.post("/api/sync")
async def api_sync(
    stats: UploadFile = File(None),
    history: UploadFile = File(None),
    projects: UploadFile = File(None),
    authorization: str = Header(...),
    status: str = Form(None),
    error_message: str = Form(None),
    projects_mode: str = Form(None),
):
    if not DATA_DIR:
        raise HTTPException(status_code=500, detail="DATA_DIR not configured")

    # Bearer 토큰 파싱
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization[7:]

    username = resolve_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")

    if not stats and not history and not projects and not status and not projects_mode:
        raise HTTPException(status_code=400, detail="No files provided")

    user_dir = DATA_DIR / username
    user_dir.mkdir(parents=True, exist_ok=True)

    # 파일 저장
    try:
        if stats:
            content = await stats.read()
            tmp_fd, tmp_path = tempfile.mkstemp(dir=str(user_dir))
            try:
                os.write(tmp_fd, content)
                os.close(tmp_fd)
                os.replace(tmp_path, str(user_dir / "stats-cache.json"))
            except Exception:
                os.close(tmp_fd) if not os.get_inheritable(tmp_fd) else None
                os.unlink(tmp_path) if os.path.exists(tmp_path) else None
                raise

        if history:
            content = await history.read()
            tmp_fd, tmp_path = tempfile.mkstemp(dir=str(user_dir))
            try:
                os.write(tmp_fd, content)
                os.close(tmp_fd)
                os.replace(tmp_path, str(user_dir / "history.jsonl"))
            except Exception:
                os.close(tmp_fd) if not os.get_inheritable(tmp_fd) else None
                os.unlink(tmp_path) if os.path.exists(tmp_path) else None
                raise

        if projects_mode == "replace":
            content = await projects.read() if projects else b""
            replace_projects_from_archive(user_dir / "projects", content)
        elif projects:
            content = await projects.read()
            if content:
                replace_projects_from_archive(user_dir / "projects", content)
    except HTTPException:
        raise
    except Exception as e:
        notify_user(username, "sync_error", {
            "message": f"파일 저장 실패\n\n{traceback.format_exc()}",
        })
        raise HTTPException(status_code=500, detail=str(e))

    # 클라이언트가 직접 보고한 에러
    if status == "error" and error_message:
        notify_user(username, "claude_error", {
            "sessionId": "N/A",
            "message": error_message,
        })

    # history 분석: 최근 세션에서 이슈 탐지
    history_file = user_dir / "history.jsonl"
    if history_file.exists():
        issues = analyze_history(history_file, last_n=3)
        for issue in issues:
            notify_user(username, issue["type"], issue)

    return {"ok": True, "username": username}
