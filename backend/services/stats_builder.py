"""history.jsonl 데이터로 stats를 계산하는 fallback 모듈"""

from collections import defaultdict
from datetime import datetime, timezone


def build_stats_from_history(entries: list[dict]) -> dict:
    if not entries:
        return _empty_stats()

    daily: dict[str, dict] = defaultdict(lambda: {"messageCount": 0, "sessionCount": 0, "toolCallCount": 0})
    hour_counts: dict[str, int] = defaultdict(int)
    session_ids: set[str] = set()
    first_ts = float("inf")

    for entry in entries:
        ts = entry.get("timestamp")
        if not ts:
            continue

        first_ts = min(first_ts, ts)
        dt = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
        date_str = dt.strftime("%Y-%m-%d")
        hour_str = str(dt.hour)

        daily[date_str]["messageCount"] += 1
        hour_counts[hour_str] += 1

        sid = entry.get("sessionId")
        if sid and sid not in session_ids:
            session_ids.add(sid)
            daily[date_str]["sessionCount"] += 1

    daily_activity = sorted(
        [{"date": d, **v} for d, v in daily.items()],
        key=lambda x: x["date"],
    )

    return {
        "totalSessions": len(session_ids),
        "totalMessages": len(entries),
        "firstSessionDate": datetime.fromtimestamp(first_ts / 1000, tz=timezone.utc).isoformat() if first_ts != float("inf") else "",
        "dailyActivity": daily_activity,
        "hourCounts": dict(hour_counts),
        "modelUsage": {},
    }


def _empty_stats() -> dict:
    return {
        "totalSessions": 0,
        "totalMessages": 0,
        "firstSessionDate": "",
        "dailyActivity": [],
        "hourCounts": {},
        "modelUsage": {},
    }
