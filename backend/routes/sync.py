import tarfile
import traceback
from io import BytesIO

from fastapi import APIRouter, Form, Header, HTTPException, UploadFile, File

from ..config import DATA_DIR
from ..services.auth import resolve_token
from ..services.notifier import notify_user
from ..services.analyzer import analyze_history

router = APIRouter()


@router.post("/api/sync")
async def api_sync(
    stats: UploadFile = File(None),
    history: UploadFile = File(None),
    projects: UploadFile = File(None),
    authorization: str = Header(...),
    status: str = Form(None),
    error_message: str = Form(None),
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

    if not stats and not history and not projects and not status:
        raise HTTPException(status_code=400, detail="No files provided")

    user_dir = DATA_DIR / username
    user_dir.mkdir(parents=True, exist_ok=True)

    # 파일 저장
    try:
        if stats:
            content = await stats.read()
            (user_dir / "stats-cache.json").write_bytes(content)

        if history:
            content = await history.read()
            (user_dir / "history.jsonl").write_bytes(content)

        if projects:
            content = await projects.read()
            buf = BytesIO(content)
            with tarfile.open(fileobj=buf, mode="r:gz") as tar:
                # 안전 체크: 경로 탈출 방지
                for member in tar.getmembers():
                    if member.name.startswith("/") or ".." in member.name:
                        raise HTTPException(status_code=400, detail="Invalid tar member path")
                tar.extractall(path=str(user_dir / "projects"))
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
