from pathlib import Path

from ..config import DATA_DIR


def discover_users():
    """시스템에서 .claude 디렉토리가 있는 유저 목록 반환"""
    users = []

    if DATA_DIR:
        # Docker 환경: DATA_DIR 아래 디렉토리 스캔
        if not DATA_DIR.exists():
            return users
        for d in DATA_DIR.iterdir():
            if d.is_dir():
                stats_exists = (d / "stats-cache.json").exists()
                history_exists = (d / "history.jsonl").exists()
                if stats_exists or history_exists:
                    users.append({
                        "username": d.name,
                        "hasStats": stats_exists,
                        "hasHistory": history_exists,
                    })
        return users

    # 로컬 환경: /Users/ 스캔
    users_dir = Path("/Users")
    if not users_dir.exists():
        return users
    for d in users_dir.iterdir():
        if d.is_dir() and (d / ".claude").is_dir():
            claude_dir = d / ".claude"
            stats_exists = (claude_dir / "stats-cache.json").exists()
            history_exists = (claude_dir / "history.jsonl").exists()
            if stats_exists or history_exists:
                users.append({
                    "username": d.name,
                    "hasStats": stats_exists,
                    "hasHistory": history_exists,
                })
    return users
