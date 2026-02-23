"""Sync된 데이터를 분석하여 이상 상태를 탐지"""

import json
from datetime import datetime, timezone
from pathlib import Path


def analyze_history(history_file: Path, last_n: int = 5) -> list[dict]:
    """최근 세션 N개를 분석하여 이슈 목록 반환"""
    issues = []

    if not history_file.exists():
        return issues

    entries = []
    for line in history_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    recent = entries[-last_n:] if len(entries) >= last_n else entries

    for entry in recent:
        session_id = entry.get("sessionId", "unknown")
        display = entry.get("display", "")
        duration_ms = entry.get("durationMs", 0)
        num_turns = entry.get("numTurns", 0)
        exit_status = entry.get("exitStatus", "")

        # 1. Claude 에러: exitStatus가 error
        if exit_status == "error":
            issues.append({
                "type": "claude_error",
                "sessionId": session_id,
                "message": f"세션이 에러로 종료됨: {display}",
            })

        # 2. 무응답: 턴 수가 0이거나 매우 짧은 세션
        if num_turns == 0 and duration_ms > 0:
            issues.append({
                "type": "no_response",
                "sessionId": session_id,
                "message": f"Claude가 응답하지 않음 (0턴, {duration_ms}ms)",
            })

        # 3. 비정상 종료: display에 에러 키워드 포함
        error_keywords = ["error", "crash", "timeout", "SIGTERM", "killed"]
        display_lower = display.lower()
        if any(kw in display_lower for kw in error_keywords):
            # claude_error와 중복 방지
            if exit_status != "error":
                issues.append({
                    "type": "claude_error",
                    "sessionId": session_id,
                    "message": f"에러 감지: {display}",
                })

    return issues


def check_stale_sync(user_dir: Path, threshold_hours: int = 24) -> dict | None:
    """마지막 동기화 이후 일정 시간이 경과했는지 확인"""
    history_file = user_dir / "history.jsonl"
    stats_file = user_dir / "stats-cache.json"

    # 가장 최근 수정 시간
    latest_mtime = 0.0
    for f in [history_file, stats_file]:
        if f.exists():
            latest_mtime = max(latest_mtime, f.stat().st_mtime)

    if latest_mtime == 0.0:
        return None

    last_sync = datetime.fromtimestamp(latest_mtime, tz=timezone.utc)
    now = datetime.now(timezone.utc)
    hours_ago = (now - last_sync).total_seconds() / 3600

    if hours_ago >= threshold_hours:
        return {
            "type": "stale_sync",
            "message": f"마지막 동기화: {int(hours_ago)}시간 전",
            "lastSync": last_sync.isoformat(),
        }

    return None
