# Claude Code Dashboard

Claude Code를 쓰다 보면 세션이 쌓이는데, 어떤 에이전트가 돌고 있는지, 토큰을 얼마나 썼는지 한눈에 보기 어렵습니다. 이 대시보드는 `~/.claude/` 디렉토리의 세션 로그를 읽어서 웹으로 보여줍니다.

![Tech Stack](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)

## 뭘 볼 수 있나

- 일별/시간별 활동 차트, 모델별 토큰 사용량
- 지금 돌고 있는 에이전트 목록과 CPU/MEM, 어떤 도구를 쓰고 있는지
- 에이전트별 Live Activity 타임라인 (5초마다 갱신, 새로고침해도 유지)
- 세션별 메시지 타임라인, 도구 호출 횟수, 수정한 파일 목록
- 프로젝트 필터, 텍스트 검색, 페이지네이션

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | Vite 6 + React 19 + TypeScript |
| 스타일링 | Tailwind CSS v4 |
| 차트 | Chart.js + react-chartjs-2 |
| 라우팅 | React Router v7 (HashRouter) |
| Backend | Python FastAPI + uvicorn |

## 시작하기

### 필요한 것

- Node.js 18+, pnpm
- Python 3.10+
- Claude Code가 설치되어 있어야 합니다 (`~/.claude/` 디렉토리)

### 설치

```bash
git clone https://github.com/KimSeoYeon23/claude-dashboard.git
cd claude-dashboard

# Backend
pip install fastapi uvicorn

# Frontend
cd frontend
pnpm install
```

### 개발 모드

터미널 두 개를 띄워서 각각 실행합니다.

```bash
# 터미널 1: Backend (포트 8420)
python3 server.py

# 터미널 2: Frontend (포트 5173, API는 8420으로 프록시)
cd frontend
pnpm dev
```

`http://localhost:5173`으로 접속하면 됩니다.

### 프로덕션 빌드

```bash
cd frontend
pnpm build          # ../static/에 출력

cd ..
python3 server.py   # http://localhost:8420
```

빌드하면 `static/`에 결과물이 들어가서, Python 서버 하나로 프론트/백엔드 모두 서빙됩니다.

## 페이지

| 경로 | 내용 |
|------|------|
| `/` | 메인 대시보드. 활성 에이전트, 통계, 차트, 최근 세션 |
| `/sessions` | 세션 목록. 프로젝트 필터, 검색, 페이지네이션 |
| `/session/:id` | 세션 상세. 메시지 타임라인, 도구 호출, 수정 파일 |
| `/agent/:pid` | 에이전트 상세. 실시간 활동 로그, 도구 사용 뱃지 |

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
        ├── index.css
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

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/stats` | 사용 통계 |
| GET | `/api/projects` | 프로젝트 목록 |
| GET | `/api/sessions` | 세션 목록 (필터, 검색, 페이지네이션) |
| GET | `/api/session/:id` | 세션 상세 |
| GET | `/api/agents` | 활성 에이전트 목록 |
| GET | `/api/agent/:pid` | 에이전트 상세 + 도구 사용 통계 |
| GET | `/api/users` | 유저 목록 |

`?user=username` 파라미터를 붙이면 다른 유저의 데이터도 조회할 수 있습니다.

## 라이선스

MIT
