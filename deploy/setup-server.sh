#!/bin/bash
# Oracle Cloud ARM 인스턴스 초기 세팅 스크립트
# 사용법: ssh로 접속 후 이 스크립트 실행
#   curl -fsSL https://raw.githubusercontent.com/KimSeoYeon23/claude-dashboard/main/deploy/setup-server.sh | bash

set -euo pipefail

echo "=== 1/4: 시스템 업데이트 ==="
sudo apt-get update && sudo apt-get upgrade -y

echo "=== 2/4: Docker 설치 ==="
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER"
    echo "Docker 설치 완료. 그룹 적용을 위해 재로그인이 필요합니다."
fi

echo "=== 3/4: 방화벽 설정 (iptables) ==="
# Oracle Cloud는 OS 방화벽도 열어야 함
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null

echo "=== 4/4: 프로젝트 클론 ==="
if [ ! -d "$HOME/claude-dashboard" ]; then
    git clone https://github.com/KimSeoYeon23/claude-dashboard.git "$HOME/claude-dashboard"
fi

echo ""
echo "========================================="
echo "  서버 세팅 완료!"
echo "========================================="
echo ""
echo "다음 단계:"
echo "  1. 재로그인 (Docker 그룹 적용)"
echo "  2. cd ~/claude-dashboard"
echo "  3. cp .env.example .env && vi .env"
echo "  4. Caddyfile에서 도메인 수정"
echo "  5. docker compose -f docker-compose.prod.yml up -d"
echo ""
