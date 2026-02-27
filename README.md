# Claude Code Dashboard

Claude Code를 쓰다 보면 세션이 쌓이는데, 어떤 에이전트가 돌고 있는지, 토큰은 얼마나 쓰고 있는지 파악하기 어렵습니다. 각자 머신에서 `stop` hook으로 데이터를 서버에 보내면, 본인의 사용 현황을 웹 대시보드에서 확인할 수 있습니다.

![Tech Stack](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL_8-4479A1?logo=mysql&logoColor=white)

## 뭘 볼 수 있나

- 일별/시간별 활동 차트, 모델별 토큰 사용량
- 돌고 있는 에이전트 목록 (CPU/MEM, 사용 중인 도구)
- 에이전트 Live Activity 타임라인 — 5초마다 갱신, 새로고침해도 유지
- 세션별 메시지 타임라인, 도구 호출 횟수, 수정한 파일
- 세션 AI 요약 — Anthropic API로 자동 생성, DB에 캐싱
- 메시지별 한줄 요약 + 펼치기/접기
- 프로젝트 필터, 검색, 페이지네이션 (세션 중복 자동 제거)
- Claude 에러/무응답/장애 시 Slack 알림
- 프론트엔드 에러 자동 리포팅 (API 실패, 렌더링 크래시 → Slack 알림)
- Toast 알림 시스템 (우상단, 자동 닫힘)
- Error Boundary (렌더링 크래시 시 fallback UI + 자동 리포팅)

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | Vite 6 + React 19 + TypeScript |
| 스타일링 | Tailwind CSS v4 (OLED + Glassmorphism) |
| HTTP 클라이언트 | axios |
| 차트 | Chart.js + react-chartjs-2 |
| 라우팅 | React Router v7 (HashRouter) |
| Backend | Python FastAPI + uvicorn |
| DB | MySQL 8.0 |
| 인증 | Google OAuth + Bearer 토큰 |
| 배포 | Docker + Caddy (HTTPS 자동) |

## 시작하기

### Docker (권장)

```bash
git clone https://github.com/KimSeoYeon23/claude-dashboard.git
cd claude-dashboard

# .env 파일에 시크릿 설정 후
cp .env.example .env
vi .env

docker compose up -d
```

`http://localhost:8420`으로 접속합니다.

### 로컬 개발 (Docker Compose)

```bash
docker compose -f docker-compose.dev.yml up -d
```

`http://localhost:5173`으로 접속합니다. 코드 변경 시 HMR로 자동 반영됩니다.

### 로컬 개발 (직접 실행)

```bash
pip install -r requirements.txt
cd frontend && pnpm install
```

터미널 두 개를 띄워서 각각 실행합니다.

```bash
# 터미널 1 — 백엔드 :8420
python3 backend/server.py

# 터미널 2 — 프론트엔드 :5173 (API는 8420으로 프록시)
cd frontend && pnpm dev
```

`http://localhost:5173`으로 접속합니다.

### 프로덕션 빌드

```bash
cd frontend && pnpm build   # ../static/에 출력
cd ..
python3 backend/server.py   # http://localhost:8420
```

### 서버 배포

```bash
# Caddyfile에서 도메인 수정 후
docker compose -f docker-compose.prod.yml up -d
```

Caddy가 Let's Encrypt 인증서를 자동 발급합니다.

## 유저 설정

### 로그인

사이트에 접속해서 Google 계정으로 로그인하면 토큰이 자동 발급됩니다. username은 Google 이메일의 `@` 앞부분이 사용됩니다.

### /stats 실행 (권장)

Claude Code 터미널에서 `/stats`를 한 번 실행하면 `stats-cache.json`이 생성됩니다. 이 파일에는 모델별 토큰 사용량, 비용 분석 등 상세 통계가 포함됩니다. 실행하지 않아도 대시보드는 `history.jsonl`에서 기본 통계를 계산하지만, 전체 통계를 보려면 실행을 권장합니다.

### Hook 설정

#### macOS / Linux

`~/.claude/settings.json`에 추가합니다.

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST https://서버주소/api/sync -H 'Authorization: Bearer 내토큰' -F stats=@\"$HOME/.claude/stats-cache.json\" -F history=@\"$HOME/.claude/history.jsonl\""
          }
        ]
      }
    ]
  }
}
```

#### Windows (PowerShell)

1. `%USERPROFILE%\.claude\sync.ps1` 파일을 생성합니다:

```powershell
$statsPath = "$env:USERPROFILE\.claude\stats-cache.json"
$historyPath = "$env:USERPROFILE\.claude\history.jsonl"
$curlArgs = @('-s', '-X', 'POST', 'https://서버주소/api/sync',
    '-H', 'Authorization: Bearer 내토큰')
if (Test-Path $statsPath) { $curlArgs += '-F', "stats=@$statsPath" }
if (Test-Path $historyPath) { $curlArgs += '-F', "history=@$historyPath" }
& curl.exe @curlArgs
```

> `$args`는 PowerShell 예약 변수이므로 반드시 `$curlArgs` 등 다른 이름을 사용해야 합니다. 또한 `curl`이 아닌 `curl.exe`를 사용해야 합니다 (PowerShell의 `curl`은 `Invoke-WebRequest`의 별칭).

2. `%USERPROFILE%\.claude\settings.json`에 추가합니다:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File \"%USERPROFILE%\\.claude\\sync.ps1\""
          }
        ]
      }
    ]
  }
}
```

이후 세션이 끝날 때마다 데이터가 자동으로 동기화됩니다.

## 페이지

| 경로 | 설명 | 인증 |
|------|------|------|
| `/` | 프로젝트 소개, 시작하기 안내 | X |
| `/login` | Google OAuth 로그인 | X |
| `/setup` | Hook 가이드 | O |
| `/dashboard` | 통계, 차트, 최근 세션 | 비로그인 시 데모 데이터 |
| `/sessions` | 세션 목록 (필터, 검색) | O |
| `/session/:id` | 세션 상세 (타임라인, 도구, 파일) | O |
| `/agent/:pid` | 에이전트 실시간 로그 | O |

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/users` | 유저 목록 |
| GET | `/api/stats?user=` | 사용 통계 |
| GET | `/api/projects?user=` | 프로젝트 목록 |
| GET | `/api/sessions` | 세션 목록 (필터, 검색, 페이지네이션) |
| GET | `/api/session/:id` | 세션 상세 |
| GET | `/api/agents` | 활성 에이전트 |
| GET | `/api/agent/:pid` | 에이전트 상세 + 도구 통계 |
| POST | `/api/sync` | 데이터 동기화 (Bearer, multipart) |
| POST | `/api/auth/google` | Google OAuth 로그인 |
| GET | `/api/auth/google/client-id` | Google Client ID 조회 |
| POST | `/api/register` | 유저 등록 |
| GET | `/api/me` | 내 정보 (Bearer) |
| GET | `/api/session/:id/summary` | 세션 AI 요약 (캐시) |
| GET | `/api/session/:id/summary/stream` | 세션 AI 요약 (SSE 스트리밍 생성) |
| POST | `/api/report-error?user=` | 프론트엔드 에러 리포팅 |
| GET | `/api/notifications?user=` | 알림 이력 |

## 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `DATA_DIR` | 동기화 데이터 경로 | 미설정 시 로컬 모드 |
| `HOST` | 바인딩 주소 | `127.0.0.1` |
| `SYNC_TOKENS` | 유저 등록 (`user:token:email,...`) | - |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL | - |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | - |
| `ANTHROPIC_API_KEY` | AI 요약용 Anthropic API 키 | - |
| `MYSQL_HOST` | MySQL 호스트 | `127.0.0.1` |
| `MYSQL_PORT` | MySQL 포트 | `3306` |
| `MYSQL_USER` | MySQL 유저 | - |
| `MYSQL_PASSWORD` | MySQL 비밀번호 | - |
| `MYSQL_DATABASE` | MySQL 데이터베이스 | - |

## 라이선스

MIT
