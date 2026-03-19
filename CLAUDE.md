# CLAUDE.md

## 프로젝트 개요

Claude Code의 세션 데이터를 수집·시각화하는 개인용 대시보드.
Stop 훅으로 로컬 `.claude/` 데이터를 서버에 동기화하고, 사용량·세션 히스토리·에이전트 상태를 한 화면에서 확인한다.

## 스택

| 계층 | 기술 |
|------|------|
| Frontend | Vite 6 + React 19 + TypeScript + Tailwind CSS v4 |
| Backend | Python 3.12 + FastAPI + uvicorn |
| DB | MySQL 8.0 (pymysql) |
| 인증 | Google OAuth 2.0 + Bearer 토큰 |
| 배포 | Docker Compose + Caddy |

## 디렉토리 구조

```
claude-dashboard/
├── backend/
│   ├── app.py                  # FastAPI 앱 생성·라우터 등록
│   ├── config.py               # 환경변수 파싱, 플랜/리셋 설정
│   ├── db.py                   # MySQL 연결, 테이블 초기화
│   ├── routes/
│   │   ├── usage.py            # /api/usage/* (게이지, 예측, 플랜 추천)
│   │   ├── register.py         # /api/me, /api/me/settings, /api/auth/*
│   │   ├── sync.py             # /api/sync (Stop 훅 수신)
│   │   ├── sessions.py         # /api/sessions, /api/session/:id
│   │   ├── agents.py           # /api/agents, /api/agent/:pid
│   │   └── stats.py            # /api/stats
│   └── services/
│       ├── usage_calculator.py # 토큰 집계·게이지·플랜 추천 로직
│       ├── auth.py             # 토큰 검증, 유저 설정 CRUD
│       ├── paths.py            # 유저별 .claude 경로 해석
│       └── parsers.py          # JSONL 파싱
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── UsageGauge.tsx      # 5h/7d 게이지 링
│       │   ├── UsagePrediction.tsx # 리셋 시점 예측
│       │   ├── PlanRecommend.tsx   # 플랜 추천
│       │   └── UsageSettings.tsx   # 유저 플랜·리셋 설정 모달
│       └── pages/
│           ├── Dashboard.tsx
│           ├── Sessions.tsx
│           └── Landing.tsx
└── docker-compose.dev.yml      # 로컬 개발용
```

## 핵심 로직

### 토큰 집계 방식
Claude 실제 한도와 맞추기 위해 `output_tokens + cache_creation_input_tokens`만 집계한다. `cache_read_input_tokens`는 재사용 비용이므로 제외.

### 플랜별 한도 (5h / 7d)
| 플랜 | 5h | 7d |
|------|----|----|
| Pro | 5M | 57M |
| Max 5x | 25M | 285M |
| Max 20x | 100M | 1,140M |

Max 5x 실측(5h≈37%, 7d≈14% 기준)으로 보정한 값.

### 7d 리셋 시간
- DB `users.reset_weekday >= 0`: 고정 요일/시각 사용
- 미설정 시: env `RESET_WEEKDAY` → rolling (oldest entry + 7d) 순으로 폴백

### 데이터 흐름
```
Claude Code 세션 종료
  → Stop 훅 → curl /api/sync
  → 서버가 projects/*.jsonl을 DATA_DIR에 저장
  → /api/usage/gauge 호출 시 JSONL에서 실시간 집계
```

## 개발 규칙

- 백엔드 수정 시 `uvicorn --reload`가 자동 감지하므로 재시작 불필요 (env 변경 제외)
- env 변경은 `docker compose -f docker-compose.dev.yml restart backend` 필요
- DB 스키마 변경은 `db.py`의 `init_db()`에 `ALTER TABLE ... ADD COLUMN` 형태로 추가 (이미 있으면 `OperationalError` 무시)
- 커밋 메시지: `feat:` / `fix:` / `refactor:` 접두사 사용
- `.env`는 커밋하지 않음 (`.gitignore`에 포함)
