import secrets

from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from ..config import AUTH_TOKENS, USER_EMAILS, GOOGLE_CLIENT_ID
from ..db import get_conn


def resolve_token(token: str) -> str | None:
    """토큰으로 유저명 조회 (환경변수 + DB)"""
    username = AUTH_TOKENS.get(token)
    if username:
        return username

    with get_conn() as conn:
        conn.execute("SELECT username FROM users WHERE token = %s", (token,))
        row = conn.fetchone()
    return row["username"] if row else None


def resolve_email(username: str) -> str | None:
    """유저명으로 이메일 조회"""
    email = USER_EMAILS.get(username)
    if email:
        return email

    with get_conn() as conn:
        conn.execute("SELECT email FROM users WHERE username = %s", (username,))
        row = conn.fetchone()
    return row["email"] if row and row["email"] else None


def register_user(username: str, email: str = "") -> dict:
    """신규 유저 등록, 토큰 발급"""
    # 환경변수에 이미 있는지 확인
    if username in AUTH_TOKENS.values():
        return {"error": "이미 등록된 유저입니다", "username": username}

    with get_conn() as conn:
        conn.execute("SELECT id FROM users WHERE username = %s", (username,))
        existing = conn.fetchone()
        if existing:
            return {"error": "이미 등록된 유저입니다", "username": username}

        token = secrets.token_urlsafe(32)
        conn.execute(
            "INSERT INTO users (username, token, email) VALUES (%s, %s, %s)",
            (username, token, email),
        )

    return {"ok": True, "username": username, "token": token}


def get_user_info(token: str) -> dict | None:
    """토큰으로 유저 정보 조회"""
    username = resolve_token(token)
    if not username:
        return None
    return {"username": username, "email": resolve_email(username) or ""}


def google_login(token_str: str) -> dict:
    """Google ID token으로 로그인/회원가입"""
    if not GOOGLE_CLIENT_ID:
        return {"error": "Google OAuth가 설정되지 않았습니다"}

    try:
        idinfo = google_id_token.verify_oauth2_token(
            token_str,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError:
        return {"error": "유효하지 않은 Google 토큰입니다"}

    google_id = idinfo["sub"]
    email = idinfo.get("email", "")
    name = idinfo.get("name", "")

    with get_conn() as conn:
        # 1) google_id로 기존 유저 조회
        conn.execute(
            "SELECT username, token FROM users WHERE google_id = %s", (google_id,)
        )
        row = conn.fetchone()
        if row:
            return {"ok": True, "username": row["username"], "token": row["token"]}

        # 2) email로 기존 유저 조회 → google_id 연결
        if email:
            conn.execute(
                "SELECT username, token FROM users WHERE email = %s", (email,)
            )
            row = conn.fetchone()
            if row:
                conn.execute(
                    "UPDATE users SET google_id = %s WHERE username = %s",
                    (google_id, row["username"]),
                )
                return {"ok": True, "username": row["username"], "token": row["token"]}

        # 3) 새 유저 생성
        base_username = email.split("@")[0] if email else (name or f"user_{google_id[:8]}")
        username = base_username
        suffix = 1
        conn.execute("SELECT id FROM users WHERE username = %s", (username,))
        while conn.fetchone():
            username = f"{base_username}_{suffix}"
            suffix += 1
            conn.execute("SELECT id FROM users WHERE username = %s", (username,))

        app_token = secrets.token_urlsafe(32)
        conn.execute(
            "INSERT INTO users (username, token, email, google_id) VALUES (%s, %s, %s, %s)",
            (username, app_token, email, google_id),
        )

    return {"ok": True, "username": username, "token": app_token}
