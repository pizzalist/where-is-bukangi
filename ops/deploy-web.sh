#!/bin/zsh
# 화면 배포. 빌드 결과에 API 주소가 박혔는지 확인한 뒤에만 올린다.
set -e
cd "$(dirname "$0")/.."
API=$(grep '^VITE_API_BASE=' .env.production | cut -d= -f2-)
[ -n "$API" ] || { echo "FAIL: .env.production에 VITE_API_BASE가 없다"; exit 1; }
npm run build
HOST=${API#https://}
grep -q "$HOST" dist/assets/app-*.js || { echo "FAIL: 빌드 결과에 $HOST 가 없다. 배포 중단"; exit 1; }
echo "확인: $HOST 가 번들에 박힘"
npx --yes wrangler@latest deploy
