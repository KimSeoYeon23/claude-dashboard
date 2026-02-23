import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .config import DATA_DIR

DB_PATH = (DATA_DIR / "dashboard.db") if DATA_DIR else Path(__file__).parent.parent / "dashboard.db"


def init_db():
    """테이블 생성 (없으면)"""
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                username  TEXT UNIQUE NOT NULL,
                token     TEXT UNIQUE NOT NULL,
                email     TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                username   TEXT NOT NULL,
                type       TEXT NOT NULL,
                subject    TEXT NOT NULL,
                message    TEXT DEFAULT '',
                session_id TEXT,
                emailed    INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_notifications_username
                ON notifications(username);
            CREATE INDEX IF NOT EXISTS idx_notifications_created
                ON notifications(created_at DESC);
        """)


@contextmanager
def get_conn():
    """SQLite 커넥션 컨텍스트 매니저"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
