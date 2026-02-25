import os
from pathlib import Path
from dotenv import load_dotenv

# 기존 환경변수를 덮어쓰지 않음 (Docker 환경에서는 compose가 주입, 로컬에서는 .env에서 보충)
load_dotenv(Path(__file__).parent.parent / ".env", override=False)

PORT = 8420
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
