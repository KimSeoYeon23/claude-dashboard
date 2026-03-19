# AGENTS.md

AI 코딩 에이전트(Codex, Claude Code 등)가 이 프로젝트를 작업할 때 따라야 할 규칙.

## 빠른 컨텍스트

- 이 프로젝트는 Claude Code 세션 데이터를 수집·시각화하는 **단일 사용자 대시보드**다.
- 백엔드는 Python FastAPI, 프론트엔드는 Vite + React 19 + TypeScript + Tailwind CSS v4.
- 토큰 집계 방식이 중요하다: `output_tokens + cache_creation_input_tokens`만 사용. `input_tokens`나 `cache_read_input_tokens`는 포함하지 않는다.

## 필수 규칙

### 1. 토큰 집계 방식 변경 금지

`backend/services/usage_calculator.py`의 토큰 계산 로직을 바꾸지 말 것.

```python
# 올바른 방식 — 절대 변경 금지
tokens = usage.get("output_tokens", 0) + usage.get("cache_creation_input_tokens", 0)

# 잘못된 방식
tokens = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
```

이유: Claude 실제 rate limit은 output + cache_creation 기준으로 측정된다.

### 2. DB 스키마 변경 방법

`db.py`의 `init_db()`에 `ALTER TABLE ... ADD COLUMN` 형태로 추가한다. 이미 존재하면 `OperationalError`를 무시한다.

```python
try:
    cursor.execute("ALTER TABLE users ADD COLUMN new_col INT DEFAULT 0")
except pymysql.err.OperationalError as e:
    if "Duplicate column name" not in str(e):
        raise
```

`DROP TABLE` 또는 `CREATE TABLE IF NOT EXISTS`로 기존 테이블을 재생성하지 말 것. 데이터가 날아간다.

### 3. 백엔드 재시작 규칙

- 코드 변경: `uvicorn --reload`가 자동 감지 — 재시작 불필요
- `.env` 변경: `docker compose -f docker-compose.dev.yml restart backend` 필요
- 재시작 없이 env 변경이 반영됐다고 가정하지 말 것

### 4. 플랜별 한도 — 임의로 수정 금지

`config.py`의 `_PLAN_LIMITS` 값은 실측 기반으로 보정한 값이다.

```python
_PLAN_LIMITS = {
    "Pro":     {"5h":   5_000_000, "7d":   57_000_000},
    "Max 5x":  {"5h":  25_000_000, "7d":  285_000_000},
    "Max 20x": {"5h": 100_000_000, "7d": 1_140_000_000},
}
```

공식 Anthropic 발표 수치와 다를 수 있으나 실제 Claude UI 표시와 맞춘 값이다. 임의로 바꾸지 말 것.

### 5. 인증 범위 유지

- 모든 `/api/*` 엔드포인트는 Bearer 토큰 인증을 유지할 것
- 인증 로직은 `backend/services/auth.py`에 집중되어 있다
- 새 라우터 추가 시 `Depends(get_current_user)` 패턴을 사용할 것

### 6. Tailwind CSS v4 주의사항

이 프로젝트는 Tailwind v4를 사용한다. v3과 다른 점:

- 커스텀 색상은 `tailwind.config.js`가 아니라 `frontend/src/index.css`의 `@theme { }` 블록에서 정의
- `text-text-primary`, `text-accent`, `bg-accent/10` 같은 커스텀 토큰 사용 가능
- `@utility` 블록으로 커스텀 유틸리티 클래스 정의 (`glass-card`, `glass-nav` 등)

### 7. 커밋 메시지

`feat:` / `fix:` / `refactor:` 접두사를 사용할 것.

```
feat: 세션 검색 필터 추가
fix: 7d 리셋 시간 계산 오류 수정
refactor: 토큰 집계 로직 분리
```

## 주요 파일 위치

| 역할 | 파일 |
|------|------|
| 토큰 집계 | `backend/services/usage_calculator.py` |
| 플랜/리셋 설정 | `backend/config.py` |
| DB 초기화 | `backend/db.py` |
| 인증 | `backend/services/auth.py` |
| 사용자 설정 API | `backend/routes/register.py` (`/api/me/settings`) |
| 사용량 API | `backend/routes/usage.py` |
| 게이지 컴포넌트 | `frontend/src/components/UsageGauge.tsx` |
| 설정 모달 | `frontend/src/components/UsageSettings.tsx` |
| 전역 스타일 | `frontend/src/index.css` |

## 하지 말 것

- `.env` 파일을 커밋하지 말 것 (`.gitignore`에 포함)
- `cache_read_input_tokens`를 토큰 집계에 포함하지 말 것
- 기존 테이블을 DROP 후 재생성하는 마이그레이션 작성 금지
- Bearer 인증 없이 사용자 데이터를 노출하는 엔드포인트 추가 금지
- 플랜 한도 값을 검증 없이 임의로 수정하지 말 것
