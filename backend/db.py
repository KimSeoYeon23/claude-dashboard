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
                        session_id VARCHAR(255) NOT NULL,
                        username   VARCHAR(255) NOT NULL,
                        summary    TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (session_id, username)
                    )
                """)
                cursor.execute("""
                    ALTER TABLE session_summaries
                    DROP PRIMARY KEY,
                    ADD PRIMARY KEY (session_id, username)
                """)
                # users 테이블에 설정 컬럼 추가 (이미 있으면 무시)
                for col_sql in [
                    "ALTER TABLE users ADD COLUMN reset_weekday  TINYINT DEFAULT -1",
                    "ALTER TABLE users ADD COLUMN reset_hour     TINYINT DEFAULT 14",
                    "ALTER TABLE users ADD COLUMN reset_tz_offset TINYINT DEFAULT 9",
                    "ALTER TABLE users ADD COLUMN plan           VARCHAR(20) DEFAULT ''",
                ]:
                    try:
                        cursor.execute(col_sql)
                    except pymysql.err.OperationalError as col_err:
                        if "Duplicate column name" not in str(col_err):
                            raise
            logger.info("MySQL 테이블 초기화 완료")
            return
        except pymysql.err.OperationalError as e:
            logger.warning(f"MySQL 연결 대기 중... ({attempt}/{max_retries}): {e}")
            if attempt == max_retries:
                raise
            time.sleep(delay)
        except pymysql.err.ProgrammingError as e:
            # 이미 원하는 PK 구조인 경우 ALTER가 실패할 수 있다.
            if "Multiple primary key defined" in str(e):
                logger.info("session_summaries PK already migrated")
                return
            raise


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
