from datetime import datetime, timezone, timedelta
from typing import Optional

from ..config import LIMIT_5H, LIMIT_7D, get_user_plan, get_user_reset, _PLAN_LIMITS
from ..services.auth import get_user_settings


def _parse_ts(ts) -> Optional[datetime]:
    """타임스탬프를 datetime으로 변환"""
    if isinstance(ts, str):
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None
    elif isinstance(ts, (int, float)):
        return datetime.fromtimestamp(ts / 1000 if ts > 1e12 else ts, tz=timezone.utc)
    return None


def _parse_entries(entries: list) -> list[dict]:
    """엔트리에서 (timestamp, tokens) 리스트 추출 — 엔트리 단위"""
    result = []
    for entry in entries:
        ts = entry.get("timestamp")
        dt = _parse_ts(ts)
        if not dt:
            continue

        msg = entry.get("message", {})
        usage = msg.get("usage", {})
        # Claude 실제 한도 계산 방식: output + cache_creation (비용이 드는 토큰만)
        # cache_read는 재사용이므로 한도 계산에서 제외
        output_tokens = usage.get("output_tokens", 0)
        cache_creation = usage.get("cache_creation_input_tokens", 0)
        tokens = output_tokens + cache_creation

        if tokens > 0:
            result.append({"dt": dt, "tokens": tokens})

    return result


def _window_stats(parsed: list[dict], now: datetime, window: timedelta) -> tuple[int, Optional[datetime], int]:
    """윈도우 내 토큰 합산, 가장 오래된 엔트리의 탈출 시점, remaining_seconds 반환"""
    cutoff = now - window
    total = 0
    oldest: Optional[datetime] = None

    for p in parsed:
        if p["dt"] >= cutoff:
            total += p["tokens"]
            if oldest is None or p["dt"] < oldest:
                oldest = p["dt"]

    reset_at = oldest + window if oldest else None
    remaining = max(0, int((reset_at - now).total_seconds())) if reset_at and reset_at > now else 0

    return total, reset_at, remaining


def _get_limits(username: str | None) -> tuple[int, int]:
    """유저의 플랜에 맞는 5h/7d 한도 반환. DB → env → 전역 LIMIT_* 순으로 폴백"""
    plan = None
    if username:
        try:
            db_settings = get_user_settings(username)
            plan = db_settings.get("plan") or None
        except Exception:
            pass
    if not plan:
        plan = get_user_plan(username)
    if plan in _PLAN_LIMITS:
        return _PLAN_LIMITS[plan]["5h"], _PLAN_LIMITS[plan]["7d"]
    return LIMIT_5H, LIMIT_7D


def _get_reset_config(username: str | None) -> dict | None:
    """유저의 7d 리셋 설정. DB → env 순으로 폴백"""
    if username:
        try:
            db_settings = get_user_settings(username)
            wday = db_settings.get("reset_weekday", -1)
            if wday is not None and wday >= 0:
                return {
                    "weekday": wday,
                    "hour": db_settings.get("reset_hour", 14),
                    "tz_offset": db_settings.get("reset_tz_offset", 9),
                }
        except Exception:
            pass
    return get_user_reset(username)


def _next_fixed_reset(now: datetime, weekday: int, hour: int, tz_offset: int) -> datetime:
    """다음 고정 리셋 시각 계산 (weekday: 0=월~6=일, hour: 현지시간)"""
    local_now = now + timedelta(hours=tz_offset)
    days_ahead = (weekday - local_now.weekday()) % 7
    candidate = local_now.replace(hour=hour, minute=0, second=0, microsecond=0) + timedelta(days=days_ahead)
    if candidate <= local_now:
        candidate += timedelta(weeks=1)
    return candidate - timedelta(hours=tz_offset)  # UTC로 변환


def calculate_gauge(entries: list, username: str | None = None) -> dict:
    """5시간/7일 사용률 게이지 계산"""
    now = datetime.now(timezone.utc)
    parsed = _parse_entries(entries)
    limit_5h, limit_7d = _get_limits(username)

    used_5h, reset_5h, rem_5h = _window_stats(parsed, now, timedelta(hours=5))
    used_7d, rolling_reset_7d, _ = _window_stats(parsed, now, timedelta(days=7))

    # 7d 리셋: DB → env 설정 기반 고정 시각 우선, 없으면 rolling
    reset_cfg = _get_reset_config(username)
    if reset_cfg:
        reset_7d = _next_fixed_reset(now, reset_cfg["weekday"], reset_cfg["hour"], reset_cfg["tz_offset"])
        rem_7d = max(0, int((reset_7d - now).total_seconds()))
    else:
        reset_7d = rolling_reset_7d
        rem_7d = max(0, int((reset_7d - now).total_seconds())) if reset_7d and reset_7d > now else 0

    pct_5h = min((used_5h / limit_5h) * 100, 100) if limit_5h > 0 else 0
    pct_7d = min((used_7d / limit_7d) * 100, 100) if limit_7d > 0 else 0

    return {
        "window_5h": {
            "used_tokens": used_5h,
            "limit_tokens": limit_5h,
            "percentage": round(pct_5h, 1),
            "reset_at": reset_5h.isoformat() if reset_5h else None,
            "remaining_seconds": rem_5h,
        },
        "window_7d": {
            "used_tokens": used_7d,
            "limit_tokens": limit_7d,
            "percentage": round(pct_7d, 1),
            "reset_at": reset_7d.isoformat() if reset_7d else None,
            "remaining_seconds": rem_7d,
        },
    }


def calculate_predict(entries: list, username: str | None = None) -> dict:
    """현재 속도 기반 사용량 예측"""
    now = datetime.now(timezone.utc)
    parsed = _parse_entries(entries)
    limit_5h, limit_7d = _get_limits(username)

    # 최근 1시간 토큰 속도
    one_hour_ago = now - timedelta(hours=1)
    rate_per_hour = sum(p["tokens"] for p in parsed if p["dt"] >= one_hour_ago)

    used_5h, _, rem_5h = _window_stats(parsed, now, timedelta(hours=5))
    used_7d, _, rem_7d = _window_stats(parsed, now, timedelta(days=7))

    # 리셋 시점까지 예상 추가량
    add_5h = rate_per_hour * (rem_5h / 3600) if rem_5h > 0 else 0
    add_7d = rate_per_hour * (rem_7d / 3600) if rem_7d > 0 else 0

    pred_pct_5h = min(((used_5h + add_5h) / limit_5h) * 100, 100) if limit_5h > 0 else 0
    pred_pct_7d = min(((used_7d + add_7d) / limit_7d) * 100, 100) if limit_7d > 0 else 0

    # 한도 도달 예상 시간
    estimated_5h = None
    estimated_7d = None
    if rate_per_hour > 0:
        rem_tokens_5h = limit_5h - used_5h
        if rem_tokens_5h > 0:
            estimated_5h = (now + timedelta(hours=rem_tokens_5h / rate_per_hour)).isoformat()
        rem_tokens_7d = limit_7d - used_7d
        if rem_tokens_7d > 0:
            estimated_7d = (now + timedelta(hours=rem_tokens_7d / rate_per_hour)).isoformat()

    return {
        "current_rate_per_hour": rate_per_hour,
        "predicted_5h_at_reset": round(pred_pct_5h, 1),
        "predicted_7d_at_reset": round(pred_pct_7d, 1),
        "will_hit_limit_5h": pred_pct_5h >= 100,
        "will_hit_limit_7d": pred_pct_7d >= 100,
        "estimated_limit_time_5h": estimated_5h,
        "estimated_limit_time_7d": estimated_7d,
    }


# 플랜 정보 (daily_tokens 단위: output + cache_creation)
PLANS = [
    {"name": "Pro", "monthly": 20, "daily_tokens": 8_000_000},
    {"name": "Max 5x", "monthly": 100, "daily_tokens": 40_000_000},
    {"name": "Max 20x", "monthly": 200, "daily_tokens": 163_000_000},
]


def calculate_plan_recommend(entries: list, username: str | None = None) -> dict:
    """사용 패턴 기반 플랜 추천"""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=14)
    parsed = _parse_entries(entries)
    limit_5h, _ = _get_limits(username)

    # 일별 토큰 집계 (최근 14일)
    daily: dict[str, int] = {}
    for p in parsed:
        if p["dt"] < cutoff:
            continue
        day_key = p["dt"].strftime("%Y-%m-%d")
        daily[day_key] = daily.get(day_key, 0) + p["tokens"]

    if not daily:
        return {
            "current_plan": get_user_plan(username) or "Unknown",
            "avg_daily_tokens": 0,
            "peak_daily_tokens": 0,
            "recommendation": None,
            "usage_pattern": "none",
        }

    values = list(daily.values())
    avg_daily = sum(values) / len(values)
    peak_daily = max(values)

    if avg_daily < 5_000_000:
        pattern = "light"
    elif avg_daily < 20_000_000:
        pattern = "moderate"
    elif avg_daily < 60_000_000:
        pattern = "heavy"
    else:
        pattern = "power"

    # DB → env → 한도 역산 순으로 현재 플랜 결정
    plan_from_db = None
    if username:
        try:
            db_settings = get_user_settings(username)
            plan_from_db = db_settings.get("plan") or None
        except Exception:
            pass

    plan_from_config = plan_from_db or get_user_plan(username)
    if plan_from_config in _PLAN_LIMITS:
        current_plan = plan_from_config
    else:
        # 한도로 역산: 정확히 일치하는 플랜 우선, 아니면 범위로
        current_plan = next(
            (name for name, limits in _PLAN_LIMITS.items() if limits["5h"] == limit_5h),
            "Pro" if limit_5h <= 5_000_000 else "Max 5x" if limit_5h <= 25_000_000 else "Max 20x",
        )

    recommended = None
    for plan in PLANS:
        if peak_daily <= plan["daily_tokens"]:
            if plan["name"] != current_plan:
                current_monthly = next((p["monthly"] for p in PLANS if p["name"] == current_plan), 0)
                savings = current_monthly - plan["monthly"]
                if savings > 0:
                    recommended = {
                        "plan": plan["name"],
                        "reason": f"최근 14일 피크 사용량({peak_daily:,.0f} tokens)이 {plan['name']} 한도 내에 있습니다",
                        "monthly_savings": savings,
                    }
            break

    if not recommended and peak_daily > 0:
        current_daily = next((p["daily_tokens"] for p in PLANS if p["name"] == current_plan), 0)
        if peak_daily > current_daily:
            for plan in PLANS:
                if peak_daily <= plan["daily_tokens"] and plan["name"] != current_plan:
                    current_monthly = next((p["monthly"] for p in PLANS if p["name"] == current_plan), 0)
                    recommended = {
                        "plan": plan["name"],
                        "reason": f"피크 사용량이 현재 플랜 한도를 초과합니다. {plan['name']}으로 업그레이드를 권장합니다",
                        "monthly_savings": current_monthly - plan["monthly"],
                    }
                    break

    return {
        "current_plan": current_plan,
        "avg_daily_tokens": round(avg_daily),
        "peak_daily_tokens": peak_daily,
        "recommendation": recommended,
        "usage_pattern": pattern,
    }
