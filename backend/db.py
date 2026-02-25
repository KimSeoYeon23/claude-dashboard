import logging
import time
from contextlib import contextmanager

import pymysql
from pymysql.cursors import DictCursor

from .config import MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE

logger = logging.getLogger(__name__)


def init_db(max_retries: int = 30, delay: float = 2.0):
    """테이블 생성 (MySQL 컨테이너 기동 대기 포함)"""
    for attempt in range(1, max_retries + 1):
        try:
            with get_conn() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id         INT AUTO_INCREMENT PRIMARY KEY,
                        username   VARCHAR(255) UNIQUE NOT NULL,
                        token      VARCHAR(255) UNIQUE NOT NULL,
                        email      VARCHAR(255) DEFAULT '',
                        google_id  VARCHAR(255) DEFAULT '',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS notifications (
                        id         INT AUTO_INCREMENT PRIMARY KEY,
                        username   VARCHAR(255) NOT NULL,
                        type       VARCHAR(100) NOT NULL,
                        subject    VARCHAR(500) NOT NULL,
                        message    TEXT,
                        session_id VARCHAR(255),
                        emailed    TINYINT DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_notifications_username (username),
                        INDEX idx_notifications_created (created_at)
                    )
                """)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS session_summaries (
                        session_id VARCHAR(255) PRIMARY KEY,
                        username   VARCHAR(255) NOT NULL,
                        summary    TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
            logger.info("MySQL 테이블 초기화 완료")
            return
        except pymysql.err.OperationalError as e:
            logger.warning(f"MySQL 연결 대기 중... ({attempt}/{max_retries}): {e}")
            if attempt == max_retries:
                raise
            time.sleep(delay)


@contextmanager
def get_conn():
    """MySQL DictCursor 컨텍스트 매니저"""
    conn = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DATABASE,
        charset="utf8mb4",
        cursorclass=DictCursor,
    )
    cursor = conn.cursor()
    try:
        yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()
