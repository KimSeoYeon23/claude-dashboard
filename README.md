# Claude Code Dashboard

Claude Code를 계속 쓰다 보니 세션은 쌓이는데, 정작 내가 뭘 했는지는 금방 흐려졌습니다. 어떤 에이전트가 돌고 있었는지, 토큰을 얼마나 썼는지, 특정 세션에서 어떤 파일을 건드렸는지 다시 보려면 여기저기 뒤져야 했습니다.

그래서 이 대시보드를 만들었습니다. 로컬 `stop` hook으로 세션 데이터를 자동으로 모으고, 서버에서 정리해서 활성 에이전트, 세션 흐름, 토큰 사용량, 수정 파일, 오류 신호를 한 화면에서 보게 했습니다. 단순히 숫자만 보여주는 화면보다는, 작업 흐름을 다시 따라가고 필요할 때 바로 꺼내볼 수 있는 개인용 도구에 가깝습니다.

![Tech Stack](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL_8-4479A1?logo=mysql&logoColor=white)

## 뭘 볼 수 있나

- 날짜별, 시간대별 활동량과 모델별 토큰 사용량
- 지금 돌고 있는 에이전트 목록과 CPU/MEM 사용량
- 최근 에이전트 활동 타임라인
- 세션별 메시지 흐름, 도구 호출 횟수, 수정한 파일
- 세션 내용을 빠르게 훑어볼 수 있는 AI 요약
- 메시지별 한줄 요약과 펼치기/접기
- 프로젝트 필터, 검색, 페이지네이션
- Claude 에러나 무응답 상황을 잡아주는 Slack 알림
- API 실패나 렌더링 크래시를 남기는 프론트엔드 에러 리포팅
- 간단한 Toast 알림과 Error Boundary

내가 보고 싶었던 건 단순한 사용량 숫자만은 아니었습니다. 어느 세션에서 무슨 작업을 했는지, 어떤 도구를 많이 썼는지, 에러가 어디서 터졌는지까지 한 번에 따라가고 싶었습니다. 그래서 수집, 파싱, 시각화, 알림을 따로 나누지 않고 한 흐름으로 묶는 쪽으로 만들었습니다.

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

## 구현하면서 신경 쓴 점

- Claude Code 로그를 그대로 보여주기보다, 세션 단위로 다시 읽기 쉽게 정리하는 데 집중했습니다.
- 동기화가 꼬이거나 오래된 데이터가 남지 않도록 hook 기반 sync 흐름과 서버 쪽 replace 동작을 따로 다뤘습니다.
- 개인용 도구로 시작했지만, 인증과 사용자 스코프는 나중에 문제가 되지 않도록 초반부터 분리해뒀습니다.

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
| GET | `/api/stats` | 사용 통계 (Bearer 인증) |
| GET | `/api/projects` | 프로젝트 목록 (Bearer 인증) |
| GET | `/api/sessions` | 세션 목록 (필터, 검색, 페이지네이션) |
| GET | `/api/session/:id` | 세션 상세 (Bearer 인증) |
| GET | `/api/agents` | 활성 에이전트 (Bearer 인증) |
| GET | `/api/agent/:pid` | 에이전트 상세 + 도구 통계 (Bearer 인증) |
| POST | `/api/sync` | 데이터 동기화 (Bearer, multipart) |
| POST | `/api/auth/google` | Google OAuth 로그인 |
| GET | `/api/auth/google/client-id` | Google Client ID 조회 |
| POST | `/api/register` | 유저 등록 |
| GET | `/api/me` | 내 정보 (Bearer) |
| GET | `/api/session/:id/summary` | 세션 AI 요약 (캐시, Bearer 인증) |
| GET | `/api/session/:id/summary/stream` | 세션 AI 요약 (SSE 스트리밍 생성, Bearer 인증) |
| POST | `/api/report-error` | 프론트엔드 에러 리포팅 |
| GET | `/api/notifications` | 알림 이력 (Bearer 인증) |

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
