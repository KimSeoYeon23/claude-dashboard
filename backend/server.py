#!/usr/bin/env python3
"""Claude Code Session Dashboard — FastAPI Backend (Multi-user)"""

import os
import sys
from pathlib import Path

# backend 패키지 임포트를 위해 프로젝트 루트를 sys.path에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import uvicorn
from backend.app import app
from backend.config import PORT


def main():
    print(f"🚀 Claude Code Dashboard running at http://localhost:{PORT}")
    print(f"   Press Ctrl+C to stop")
    host = os.environ.get("HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=PORT, log_level="info")


if __name__ == "__main__":
    main()
