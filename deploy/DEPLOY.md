# Oracle Cloud 프리 티어 배포 가이드

## 1단계: Oracle Cloud 계정 생성

1. https://cloud.oracle.com 접속
2. "Start for Free" 클릭하여 가입
3. 신용카드 등록 필요 (프리 티어는 과금되지 않음)

## 2단계: ARM 인스턴스 생성

Oracle Cloud Console → Compute → Instances → Create Instance

| 항목 | 설정 |
|------|------|
| Name | `claude-dashboard` |
| Image | **Ubuntu 22.04** (Canonical) |
| Shape | **VM.Standard.A1.Flex** (ARM) |
| OCPU | 2 (최대 4까지 무료) |
| Memory | 12 GB (최대 24GB까지 무료) |
| Boot volume | 50 GB (무료) |

### SSH 키 설정

"Generate a key pair"를 선택하면 private key를 다운로드할 수 있다.
또는 기존 SSH public key를 붙여넣기.

### 네트워크 설정

생성 후 VCN → Subnet → Security List에서 Ingress Rule 추가:

| Source CIDR | Protocol | Dest Port |
|-------------|----------|-----------|
| `0.0.0.0/0` | TCP | 80 |
| `0.0.0.0/0` | TCP | 443 |

> **중요**: Oracle Cloud는 **클라우드 방화벽(Security List)** + **OS 방화벽(iptables)** 둘 다 열어야 한다.

### 인스턴스 생성 팁

ARM 인스턴스는 자리가 없어서 "Out of capacity" 에러가 날 수 있다.
반복 시도하거나 리전을 바꿔보면 된다 (서울, 도쿄, 오사카 등).

## 3단계: 서버 접속 및 초기 세팅

```bash
# SSH 접속
ssh -i ~/path/to/private-key ubuntu@<인스턴스-공인-IP>

# 자동 세팅 스크립트 실행
curl -fsSL https://raw.githubusercontent.com/KimSeoYeon23/claude-dashboard/main/deploy/setup-server.sh | bash

# Docker 그룹 적용을 위해 재접속
exit
ssh -i ~/path/to/private-key ubuntu@<인스턴스-공인-IP>
```

## 4단계: DuckDNS 무료 도메인 설정

1. https://www.duckdns.org 접속 (GitHub/Google 로그인)
2. 원하는 서브도메인 입력 (예: `my-claude-dash`)
3. 인스턴스의 공인 IP를 등록
4. `my-claude-dash.duckdns.org` → 인스턴스 IP로 연결됨

## 5단계: 환경변수 및 도메인 설정

```bash
cd ~/claude-dashboard

# .env 설정
cp .env.example .env
vi .env
```

`.env`에 최소한 다음 항목을 설정:

```env
SYNC_TOKENS=내유저명:내토큰:내이메일
GOOGLE_CLIENT_ID=구글-클라이언트-ID
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
ANTHROPIC_API_KEY=sk-ant-...
MYSQL_ROOT_PASSWORD=강력한비밀번호
MYSQL_DATABASE=claude_dashboard
MYSQL_USER=dashboard
MYSQL_PASSWORD=강력한비밀번호
```

Caddyfile에서 도메인 수정:

```bash
vi Caddyfile
```

```
my-claude-dash.duckdns.org {
    reverse_proxy dashboard:8420
}
```

## 6단계: 배포

```bash
docker compose -f docker-compose.prod.yml up -d
```

첫 실행 시 Docker 이미지 빌드 + MySQL 초기화에 2~3분 소요.
Caddy가 자동으로 Let's Encrypt 인증서를 발급한다.

### 확인

```bash
# 컨테이너 상태 확인
docker compose -f docker-compose.prod.yml ps

# 로그 확인
docker compose -f docker-compose.prod.yml logs -f

# 접속 테스트
curl -I https://my-claude-dash.duckdns.org
```

## 7단계: Hook 설정 업데이트

로컬 머신의 `~/.claude/settings.json`에서 서버 URL을 변경:

```json
{
  "hooks": {
    "stop": [{
      "command": "curl -s -X POST https://my-claude-dash.duckdns.org/api/sync -H 'Authorization: Bearer 내토큰' -F stats=@$HOME/.claude/stats-cache.json -F history=@$HOME/.claude/history.jsonl"
    }]
  }
}
```

## 업데이트 방법

```bash
cd ~/claude-dashboard
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## 비용

| 항목 | 비용 |
|------|------|
| Oracle Cloud ARM 인스턴스 | 무료 (Always Free) |
| DuckDNS 도메인 | 무료 |
| Let's Encrypt 인증서 | 무료 |
| **합계** | **$0/월** |

## 트러블슈팅

### "Out of capacity" 에러
ARM 인스턴스 자리가 없는 것. 다른 리전을 시도하거나, 시간대를 바꿔서 재시도.

### Caddy 인증서 발급 실패
- Security List에 80, 443 포트가 열려있는지 확인
- OS iptables에서도 열려있는지 확인 (`sudo iptables -L`)
- DuckDNS에 올바른 IP가 등록되어 있는지 확인

### MySQL 접속 오류
```bash
docker compose -f docker-compose.prod.yml logs mysql
```
`.env`의 `MYSQL_ROOT_PASSWORD`가 설정되어 있는지 확인.

### Docker 빌드 실패 (ARM)
`docker-compose.prod.yml`의 MySQL 이미지가 `mysql:8.0-oracle`(ARM 지원)인지 확인.
