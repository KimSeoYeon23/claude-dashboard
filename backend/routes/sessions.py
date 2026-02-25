from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..services.paths import resolve_paths
from ..services.cache import cached
from ..services.loaders import load_history, find_session_file
from ..services.parsers import parse_session_detail

router = APIRouter()


def _dedup_sessions(entries: list[dict]) -> list[dict]:
    """sessionId 기준으로 중복 합치기: 첫 display + 최신 timestamp"""
    seen: dict[str, dict] = {}
    no_id = []
    for e in entries:
        sid = e.get("sessionId")
        if not sid:
            no_id.append(e)
            continue
        if sid in seen:
            # 더 최신 timestamp면 업데이트
            if e.get("timestamp", 0) > seen[sid].get("timestamp", 0):
                seen[sid]["timestamp"] = e["timestamp"]
        else:
            seen[sid] = {**e}
    return list(seen.values()) + no_id


@router.get("/api/sessions")
def api_sessions(
    user: Optional[str] = Query(None),
    project: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1),
    limit: int = Query(30),
):
    paths = resolve_paths(user)
    history = cached(f"history:{user or 'me'}", paths["history_file"], load_history)
    if history is None:
        raise HTTPException(status_code=404, detail="history.jsonl not found")

    limit = min(limit, 100)
    deduped = _dedup_sessions(history)
    filtered = sorted(deduped, key=lambda e: e.get("timestamp", 0), reverse=True)

    if project:
        # project 디렉토리명(-로 구분)을 원래 경로(/로 구분)로 변환하여 매칭
        project_as_path = project.lstrip("-").replace("-", "/")
        filtered = [
            e for e in filtered
            if project in e.get("project", "")
            or project_as_path in e.get("project", "")
        ]

    if search:
        search_lower = search.lower()
        filtered = [
            e for e in filtered
            if search_lower in e.get("display", "").lower()
            or search_lower in e.get("sessionId", "").lower()
        ]

    total = len(filtered)
    start = (page - 1) * limit
    page_items = filtered[start: start + limit]

    return {
        "sessions": page_items,
        "total": total,
        "page": page,
        "limit": limit,
        "totalPages": (total + limit - 1) // limit if total > 0 else 0,
    }


@router.get("/api/session/{session_id}")
def api_session_detail(session_id: str, user: Optional[str] = Query(None)):
    paths = resolve_paths(user)
    fp = find_session_file(session_id, paths["projects_dir"])
    if fp is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    cache_key = f"session:{user or 'me'}:{session_id}"
    detail = cached(cache_key, fp, parse_session_detail)
    if detail is None:
        raise HTTPException(status_code=500, detail="Failed to parse session")
    return detail
