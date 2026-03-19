import secrets
from typing import Optional

import pymysql
from fastapi import HTTPException
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from ..config import AUTH_TOKENS, USER_EMAILS, GOOGLE_CLIENT_ID, DATA_DIR
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


def resolve_api_user(requested_user: Optional[str], authorization: Optional[str]) -> Optional[str]:
    """읽기 API에서 사용할 사용자 해석.

    - Bearer 토큰이 있으면 해당 유저를 신뢰한다.
    - requested_user가 있으면 토큰 유저와 반드시 일치해야 한다.
    - DATA_DIR 환경(멀티유저 동기화 서버)에서는 익명 조회를 허용하지 않는다.
    - 로컬 단일 유저 모드에서는 익명 조회를 허용한다.
    """
    authenticated_user: Optional[str] = None

    if authorization:
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")
        token = authorization[7:]
        authenticated_user = resolve_token(token)
        if not authenticated_user:
            raise HTTPException(status_code=401, detail="Invalid token")

    if requested_user:
        if not authenticated_user:
            raise HTTPException(status_code=401, detail="Authorization required")
        if requested_user != authenticated_user:
            raise HTTPException(status_code=403, detail="Forbidden")
        return authenticated_user

    if authenticated_user:
        return authenticated_user

    if DATA_DIR or requested_user:
        raise HTTPException(status_code=401, detail="Authorization required")

    return None


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


def get_user_settings(username: str) -> dict:
    """유저 설정 조회 (plan, reset 시간)"""
    with get_conn() as conn:
        conn.execute(
            "SELECT plan, reset_weekday, reset_hour, reset_tz_offset FROM users WHERE username = %s",
            (username,),
        )
        row = conn.fetchone()
    if not row:
        return {}
    return {
        "plan": row["plan"] or "",
        "reset_weekday": row["reset_weekday"] if row["reset_weekday"] is not None else -1,
        "reset_hour": row["reset_hour"] if row["reset_hour"] is not None else 14,
        "reset_tz_offset": row["reset_tz_offset"] if row["reset_tz_offset"] is not None else 9,
    }


def update_user_settings(username: str, plan: str | None, reset_weekday: int | None, reset_hour: int | None, reset_tz_offset: int | None) -> dict:
    """유저 설정 저장"""
    fields, values = [], []
    if plan is not None:
        fields.append("plan = %s"); values.append(plan)
    if reset_weekday is not None:
        fields.append("reset_weekday = %s"); values.append(reset_weekday)
    if reset_hour is not None:
        fields.append("reset_hour = %s"); values.append(reset_hour)
    if reset_tz_offset is not None:
        fields.append("reset_tz_offset = %s"); values.append(reset_tz_offset)
    if not fields:
        return {"ok": True}
    values.append(username)
    with get_conn() as conn:
        conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE username = %s", values)
    return {"ok": True}


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
    _ = idinfo.get("name", "")

    preferred = email.split("@")[0] if email else None

    with get_conn() as conn:
        # 1) google_id로 기존 유저 조회
        conn.execute(
            "SELECT username, token FROM users WHERE google_id = %s", (google_id,)
        )
        row = conn.fetchone()
        if row:
            username = _maybe_rename(conn, row["username"], preferred)
            return {"ok": True, "username": username, "token": row["token"]}

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
                username = _maybe_rename(conn, row["username"], preferred)
                return {"ok": True, "username": username, "token": row["token"]}

        # 3) 새 유저 생성
        base_username = preferred or f"user_{google_id[:8]}"
        username = base_username
        suffix = 1
        conn.execute("SELECT id FROM users WHERE username = %s", (username,))
        while conn.fetchone():
            username = f"{base_username}_{suffix}"
            suffix += 1
            conn.execute("SELECT id FROM users WHERE username = %s", (username,))

        app_token = secrets.token_urlsafe(32)
        try:
            conn.execute(
                "INSERT INTO users (username, token, email, google_id) VALUES (%s, %s, %s, %s)",
                (username, app_token, email, google_id),
            )
        except pymysql.err.IntegrityError:
            # 경쟁 조건으로 중복 INSERT 시 기존 유저 반환
            conn.execute(
                "SELECT username, token FROM users WHERE google_id = %s OR email = %s",
                (google_id, email),
            )
            existing = conn.fetchone()
            if existing:
                return {"ok": True, "username": existing["username"], "token": existing["token"]}
            raise

    return {"ok": True, "username": username, "token": app_token}


def _maybe_rename(conn, old: str, preferred: str | None) -> str:
    """username이 preferred와 다르면 DB + DATA_DIR 디렉토리를 함께 변경"""
    if not preferred or old == preferred:
        return old

    # 중복 체크 — 다른 유저가 이미 사용 중이면 변경하지 않음
    conn.execute("SELECT id FROM users WHERE username = %s", (preferred,))
    if conn.fetchone():
        return old

    # 파일시스템 rename 먼저 시도 → 성공 시에만 DB 커밋
    renamed = False
    if DATA_DIR:
        old_dir = DATA_DIR / old
        new_dir = DATA_DIR / preferred
        if old_dir.exists() and not new_dir.exists():
            old_dir.rename(new_dir)
            renamed = True

    try:
        conn.execute(
            "UPDATE users SET username = %s WHERE username = %s", (preferred, old)
        )
    except Exception:
        # DB 업데이트 실패 시 파일시스템 롤백
        if renamed and DATA_DIR:
            (DATA_DIR / preferred).rename(DATA_DIR / old)
        raise

    return preferred
