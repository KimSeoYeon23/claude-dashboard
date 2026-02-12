# Claude Code Dashboard

Claude Code의 세션 기록, 활성 에이전트, 사용 통계를 시각화하는 대시보드 웹 애플리케이션.

![Tech Stack](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)

## 주요 기능

- **대시보드** — 일별/시간별 활동 차트, 모델별 토큰 사용량, 최근 세션 테이블
- **활성 에이전트 모니터링** — 실시간 상태 (5초 폴링), CPU/MEM, Live Activity 타임라인
- **세션 분석** — 메시지 타임라인, 도구 호출 통계, 수정 파일 목록, 서브에이전트
- **세션 검색** — 프로젝트 필터, 텍스트 검색 (debounce), 페이지네이션

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | Vite 6 + React 19 + TypeScript |
| 스타일링 | Tailwind CSS v4 |
| 차트 | Chart.js + react-chartjs-2 |
| 라우팅 | React Router v7 (HashRouter) |
| Backend | Python FastAPI + uvicorn |

## 시작하기

### 요구사항

- Node.js 18+
- pnpm
- Python 3.10+
- Claude Code가 설치되어 있어야 합니다 (`~/.claude/` 디렉토리 필요)

### 설치

```bash
git clone https://github.com/KimSeoYeon23/claude-dashboard.git
cd claude-dashboard

# Backend 의존성
pip install fastapi uvicorn

# Frontend 의존성
cd frontend
pnpm install
```

### 개발 모드

프론트엔드와 백엔드를 각각 실행합니다.

```bash
# 터미널 1: Backend (포트 8420)
python3 server.py

# 터미널 2: Frontend (포트 5173, API → 8420 프록시)
cd frontend
pnpm dev
```

`http://localhost:5173` 에서 접속합니다.

### 프로덕션 빌드

```bash
cd frontend
pnpm build          # → ../static/ 에 빌드 출력

cd ..
python3 server.py   # http://localhost:8420 에서 서빙
```

## 페이지 구성

| 경로 | 설명 |
|------|------|
| `/` | 대시보드 — 활성 에이전트, 통계 카드, 차트, 최근 세션 |
| `/sessions` | 세션 목록 — 프로젝트 필터, 검색, 페이지네이션 |
| `/session/:id` | 세션 상세 — 메시지 타임라인, 도구 호출, 수정 파일 |
| `/agent/:pid` | 에이전트 상세 — 실시간 활동, 도구 사용 뱃지, CPU/MEM |

## 프로젝트 구조

```
claude-dashboard/
├── server.py                 # FastAPI 백엔드
├── static/                   # 빌드 출력 (gitignore)
└── frontend/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api.ts            # API 타입 + fetch 래퍼
        ├── index.css          # Tailwind 테마
        ├── utils/
        │   └── formatters.ts
        ├── components/
        │   ├── Nav.tsx
        │   ├── StatCard.tsx
        │   ├── Loading.tsx
        │   └── ErrorMessage.tsx
        └── pages/
            ├── Dashboard.tsx
            ├── Sessions.tsx
            ├── SessionDetail.tsx
            └── AgentDetail.tsx
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/stats` | 사용 통계 |
| GET | `/api/projects` | 프로젝트 목록 |
| GET | `/api/sessions` | 세션 목록 (필터/검색/페이지네이션) |
| GET | `/api/session/:id` | 세션 상세 |
| GET | `/api/agents` | 활성 에이전트 목록 |
| GET | `/api/agent/:pid` | 에이전트 상세 (도구 사용 통계 포함) |
| GET | `/api/users` | 유저 목록 |

모든 엔드포인트는 `?user=username` 쿼리 파라미터로 다른 유저 데이터 조회를 지원합니다.

## 라이선스

MIT
