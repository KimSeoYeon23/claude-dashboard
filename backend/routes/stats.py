from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query

from ..services.paths import resolve_paths
from ..services.cache import cached
from ..services.loaders import load_stats, load_history
from ..services.stats_builder import build_stats_from_history
from ..services.users import discover_users
from ..services.auth import resolve_api_user

router = APIRouter()


@router.get("/api/users")
def api_users(authorization: str | None = Header(None)):
    user = resolve_api_user(None, authorization)
    users = discover_users()
    if user:
        users = [u for u in users if u["username"] == user]
    return {"users": users}


@router.get("/api/stats")
def api_stats(
    user: Optional[str] = Query(None),
    authorization: str | None = Header(None),
):
    resolved_user = resolve_api_user(user, authorization)
    paths = resolve_paths(resolved_user)
    cache_user = resolved_user or "me"
    data = cached(f"stats:{cache_user}", paths["stats_file"], load_stats)
    if data is not None:
        return data

    # fallback: history.jsonl에서 stats 계산
    history = cached(f"history:{cache_user}", paths["history_file"], load_history)
    if history is None:
        raise HTTPException(status_code=404, detail="No data found")
    return build_stats_from_history(history)
