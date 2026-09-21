#!/bin/zsh
# 운영 실행. launchd 등록 전 손으로 띄울 때 쓴다.
set -e
cd "$(dirname "$0")/.."
export PORT=8787 HOST=127.0.0.1
export BUKANG_DATA="$HOME/bukang"          # /tmp 금지. 재부팅하면 지워진다
export SERVE_STATIC=1                       # admin.bukangi.com이 운영자 화면을 낸다. 공개 경로는 터널이 제한
export PUBLIC_URL=https://api.bukangi.com   # 사진 절대주소·디스코드 서명 링크
export SITE_URL=https://bukangi.com         # 제보를 받을 화면 주소 (CORS)
export SCREEN_ENGINE=claude
export SCREEN_INTERVAL=20000
: "${ADMIN_TOKEN:?ADMIN_TOKEN 환경변수가 필요합니다}"
exec node server/index.js
