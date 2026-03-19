import os
from pathlib import Path
from dotenv import load_dotenv

# 기존 환경변수를 덮어쓰지 않음 (Docker 환경에서는 compose가 주입, 로컬에서는 .env에서 보충)
load_dotenv(Path(__file__).parent.parent / ".env", override=False)

PORT = int(os.environ.get("PORT", "8420"))
STATIC_DIR = Path(__file__).parent.parent / "static"

# Docker 환경: 동기화 데이터 저장 경로
DATA_DIR: Path | None = Path(os.environ["DATA_DIR"]) if os.environ.get("DATA_DIR") else None

# 유저별 인증 토큰 (SYNC_TOKENS=user1:token1:email1,user2:token2:email2)
AUTH_TOKENS: dict[str, str] = {}
USER_EMAILS: dict[str, str] = {}
_raw = os.environ.get("SYNC_TOKENS", "")
for pair in _raw.split(","):
    pair = pair.strip()
    if ":" in pair:
        parts = pair.split(":")
        username, token = parts[0], parts[1]
        AUTH_TOKENS[token] = username
        if len(parts) >= 3:
            USER_EMAILS[username] = parts[2]

# CORS 허용 출처
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:8420").split(",")]

# Google OAuth
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

# Slack Webhook (에러/장애 알림)
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")

# MySQL 설정
MYSQL_HOST = os.environ.get("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.environ.get("MYSQL_PORT", "3306"))
MYSQL_USER = os.environ.get("MYSQL_USER", "dashboard")
MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "dashboard")
MYSQL_DATABASE = os.environ.get("MYSQL_DATABASE", "claude_dashboard")

# Anthropic API
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# 기본 플랜 (Pro / Max 5x / Max 20x) — 유저별 플랜이 없는 경우 폴백
CURRENT_PLAN = os.environ.get("CURRENT_PLAN", "")

# 유저별 플랜 (USER_PLANS=user1:Max 5x,user2:Pro)
USER_PLANS: dict[str, str] = {}
_plan_raw = os.environ.get("USER_PLANS", "")
for _pair in _plan_raw.split(","):
    _pair = _pair.strip()
    if ":" in _pair:
        _uname, _plan = _pair.split(":", 1)
        USER_PLANS[_uname.strip()] = _plan.strip()


def get_user_plan(username: str | None) -> str:
    """유저명으로 플랜 조회. USER_PLANS → CURRENT_PLAN → 빈 문자열 순으로 폴백"""
    if username and username in USER_PLANS:
        return USER_PLANS[username]
    return CURRENT_PLAN


# 7d 고정 리셋 시간 (유저별 설정)
# 형식: USER_RESETS=user1:4:14:09,user2:0:10:09
#   4=금요일(0=월), 14=오후2시, 09=UTC+9(KST)
# 기본값: RESET_WEEKDAY, RESET_HOUR, RESET_TZ_OFFSET
RESET_WEEKDAY = int(os.environ.get("RESET_WEEKDAY", "-1"))   # -1이면 rolling 계산
RESET_HOUR = int(os.environ.get("RESET_HOUR", "14"))         # 현지 시각 기준
RESET_TZ_OFFSET = int(os.environ.get("RESET_TZ_OFFSET", "9"))  # KST=9

USER_RESETS: dict[str, dict] = {}
_reset_raw = os.environ.get("USER_RESETS", "")
for _pair in _reset_raw.split(","):
    _pair = _pair.strip()
    parts = _pair.split(":")
    if len(parts) == 4:
        _uname, _wday, _hour, _tz = parts
        USER_RESETS[_uname.strip()] = {
            "weekday": int(_wday),
            "hour": int(_hour),
            "tz_offset": int(_tz),
        }


def get_user_reset(username: str | None) -> dict | None:
    """유저별 7d 리셋 설정 반환. 없으면 전역 RESET_WEEKDAY 사용"""
    if username and username in USER_RESETS:
        return USER_RESETS[username]
    if RESET_WEEKDAY >= 0:
        return {"weekday": RESET_WEEKDAY, "hour": RESET_HOUR, "tz_offset": RESET_TZ_OFFSET}
    return None

# 플랜별 한도 (집계 단위: output_tokens + cache_creation_input_tokens)
# Max 5x 실측: 5h≈25M, 7d≈287M 기준으로 보정
_PLAN_LIMITS = {
    "Pro":     {"5h":  5_000_000, "7d":  57_000_000},
    "Max 5x":  {"5h": 25_000_000, "7d": 285_000_000},
    "Max 20x": {"5h": 100_000_000, "7d": 1_140_000_000},
}

def _default_limit(key: str, fallback: int) -> int:
    """CURRENT_PLAN 설정 시 플랜 한도에서 가져오고, 없으면 LIMIT_* 환경변수, 그것도 없으면 fallback"""
    if CURRENT_PLAN in _PLAN_LIMITS:
        return _PLAN_LIMITS[CURRENT_PLAN][key]
    return fallback

LIMIT_5H = int(os.environ.get("LIMIT_5H", str(_default_limit("5h", 25_000_000))))
LIMIT_7D = int(os.environ.get("LIMIT_7D", str(_default_limit("7d", 285_000_000))))
