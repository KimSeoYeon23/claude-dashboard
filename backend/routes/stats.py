from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..services.paths import resolve_paths
from ..services.cache import cached
from ..services.loaders import load_stats
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
    if data is None:
        return {
            "totalSessions": 0,
            "totalMessages": 0,
            "firstSessionDate": "",
            "dailyActivity": [],
            "hourCounts": {},
            "modelUsage": {},
        }
    return data
