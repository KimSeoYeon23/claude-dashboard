import logging

import requests

from ..config import SLACK_WEBHOOK_URL
from ..db import get_conn

logger = logging.getLogger(__name__)

# 알림 유형별 템플릿
TEMPLATES: dict[str, dict] = {
    "claude_error": {
        "subject": "Claude 에러 발생",
        "body": "Claude Code 세션에서 에러가 발생했습니다.\n\n세션: {sessionId}\n내용: {message}",
    },
    "no_response": {
        "subject": "Claude 무응답",
        "body": "Claude Code가 응답하지 않았습니다.\n\n세션: {sessionId}\n내용: {message}",
    },
    "sync_error": {
        "subject": "Sync 실패",
        "body": "데이터 동기화 중 오류가 발생했습니다.\n\n{message}",
    },
    "server_error": {
        "subject": "서버 오류 발생",
        "body": "대시보드 서버에서 오류가 발생했습니다.\n\n{message}",
    },
    "stale_sync": {
        "subject": "동기화 중단 감지",
        "body": "데이터 동기화가 오랫동안 이루어지지 않았습니다.\n\n{message}",
    },
    "frontend_error": {
        "subject": "프론트엔드 에러",
        "body": "프론트엔드에서 에러가 발생했습니다.\n\n{message}",
    },
}


def get_notifications(username: str, limit: int = 50) -> list[dict]:
    """유저의 알림 이력 조회"""
    with get_conn() as conn:
        conn.execute(
            """SELECT type, subject, message, session_id, emailed, created_at
               FROM notifications
               WHERE username = %s
               ORDER BY created_at DESC
               LIMIT %s""",
            (username, limit),
        )
        rows = conn.fetchall()
    return [dict(row) for row in rows]


def _send_slack(subject: str, body: str) -> bool:
    """Slack Webhook으로 알림 발송"""
    if not SLACK_WEBHOOK_URL:
        return False

    text = f"*[Claude Dashboard] {subject}*\n{body}"
    res = requests.post(SLACK_WEBHOOK_URL, json={"text": text})
    res.raise_for_status()
    return True


def notify_user(username: str, ntype: str, context: dict):
    """유저에게 알림 발송 + DB 저장"""
    template = TEMPLATES.get(ntype)
    if not template:
        logger.warning(f"Unknown notification type: {ntype}")
        return

    subject = template["subject"]
    body = template["body"].format(**context)
    emailed = False

    try:
        emailed = _send_slack(subject, body)
    except Exception as e:
        logger.error(f"Failed to send Slack notification for {username}: {e}")

    # DB 저장
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO notifications (username, type, subject, message, session_id, emailed)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (username, ntype, subject, context.get("message", ""),
             context.get("sessionId"), int(emailed)),
        )
