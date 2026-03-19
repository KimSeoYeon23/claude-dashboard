import json
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, Header, Query

from ..services.paths import resolve_paths
from ..services.auth import resolve_api_user
from ..services.usage_calculator import (
    calculate_gauge,
    calculate_predict,
    calculate_plan_recommend,
)

router = APIRouter()


def _collect_session_entries(projects_dir: Path) -> list[dict]:
    """프로젝트 세션 JSONL 파일들에서 usage가 있는 엔트리를 수집"""
    entries = []
    if not projects_dir.exists():
        return entries

    for jsonl in projects_dir.rglob("*.jsonl"):
        if "subagents" in str(jsonl):
            continue
        try:
            with open(jsonl, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    msg = entry.get("message", {})
                    usage = msg.get("usage", {})
                    if usage.get("input_tokens") or usage.get("output_tokens"):
                        entries.append(entry)
        except Exception:
            continue

    return entries


def _load_usage_entries(user: Optional[str], authorization: Optional[str]) -> tuple[list[dict], Optional[str]]:
    resolved_user = resolve_api_user(user, authorization)
    paths = resolve_paths(resolved_user)
    entries = _collect_session_entries(paths["projects_dir"])
    return entries or [], resolved_user


@router.get("/api/usage/gauge")
def api_usage_gauge(
    user: Optional[str] = Query(None),
    authorization: str | None = Header(None),
):
    entries, resolved_user = _load_usage_entries(user, authorization)
    return calculate_gauge(entries, username=resolved_user)


@router.get("/api/usage/predict")
def api_usage_predict(
    user: Optional[str] = Query(None),
    authorization: str | None = Header(None),
):
    entries, resolved_user = _load_usage_entries(user, authorization)
    return calculate_predict(entries, username=resolved_user)


@router.get("/api/usage/plan-recommend")
def api_usage_plan_recommend(
    user: Optional[str] = Query(None),
    authorization: str | None = Header(None),
):
    entries, resolved_user = _load_usage_entries(user, authorization)
    return calculate_plan_recommend(entries, username=resolved_user)
