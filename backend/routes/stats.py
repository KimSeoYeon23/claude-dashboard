from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..services.paths import resolve_paths
from ..services.cache import cached
from ..services.loaders import load_stats, load_history
from ..services.stats_builder import build_stats_from_history
from ..services.users import discover_users

router = APIRouter()


@router.get("/api/users")
def api_users():
    users = discover_users()
    return {"users": users}


@router.get("/api/stats")
def api_stats(user: Optional[str] = Query(None)):
    paths = resolve_paths(user)
    data = cached(f"stats:{user or 'me'}", paths["stats_file"], load_stats)
    if data is not None:
        return data

    # fallback: history.jsonl에서 stats 계산
    history = cached(f"history:{user or 'me'}", paths["history_file"], load_history)
    if history is None:
        raise HTTPException(status_code=404, detail="No data found")
    return build_stats_from_history(history)
