import secrets

from ..config import AUTH_TOKENS, USER_EMAILS
from ..db import get_conn


def resolve_token(token: str) -> str | None:
    """토큰으로 유저명 조회 (환경변수 + DB)"""
    username = AUTH_TOKENS.get(token)
    if username:
        return username

    with get_conn() as conn:
        row = conn.execute("SELECT username FROM users WHERE token = ?", (token,)).fetchone()
    return row["username"] if row else None


def resolve_email(username: str) -> str | None:
    """유저명으로 이메일 조회"""
    email = USER_EMAILS.get(username)
    if email:
        return email

    with get_conn() as conn:
        row = conn.execute("SELECT email FROM users WHERE username = ?", (username,)).fetchone()
    return row["email"] if row and row["email"] else None


def register_user(username: str, email: str = "") -> dict:
    """신규 유저 등록, 토큰 발급"""
    # 환경변수에 이미 있는지 확인
    if username in AUTH_TOKENS.values():
        return {"error": "이미 등록된 유저입니다", "username": username}

    with get_conn() as conn:
        existing = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if existing:
            return {"error": "이미 등록된 유저입니다", "username": username}

        token = secrets.token_urlsafe(32)
        conn.execute(
            "INSERT INTO users (username, token, email) VALUES (?, ?, ?)",
            (username, token, email),
        )

    return {"ok": True, "username": username, "token": token}


def get_user_info(token: str) -> dict | None:
    """토큰으로 유저 정보 조회"""
    username = resolve_token(token)
    if not username:
        return None
    return {"username": username, "email": resolve_email(username) or ""}
