from pathlib import Path
from typing import Optional

from ..config import DATA_DIR


def claude_dir(user: Optional[str] = None) -> Path:
    """유저별 .claude 디렉토리 경로 반환"""
    if DATA_DIR:
        # Docker 환경: 동기화된 데이터 디렉토리
        if user:
            return DATA_DIR / user
        return DATA_DIR
    # 로컬 환경: 기존 방식
    if user:
        return Path(f"/Users/{user}/.claude")
    return Path.home() / ".claude"


def resolve_paths(user: Optional[str] = None):
    """유저별 주요 경로들 반환"""
    base = claude_dir(user)
    return {
        "claude_dir": base,
        "stats_file": base / "stats-cache.json",
        "history_file": base / "history.jsonl",
        "projects_dir": base / "projects",
    }
