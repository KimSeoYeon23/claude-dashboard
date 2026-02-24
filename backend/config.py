import os
from pathlib import Path

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

# SMTP 설정
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER)

# MySQL 설정
MYSQL_HOST = os.environ.get("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.environ.get("MYSQL_PORT", "3306"))
MYSQL_USER = os.environ.get("MYSQL_USER", "dashboard")
MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "dashboard")
MYSQL_DATABASE = os.environ.get("MYSQL_DATABASE", "claude_dashboard")
