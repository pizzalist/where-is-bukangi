#!/bin/zsh
# 검수본 올리기. 빌드만 하면 admin.bukangi.com이 그 결과를 바로 보여준다 (맥미니가 dist/를 서빙).
# 실서비스(bukangi.com)는 건드리지 않는다.
set -e
cd "$(dirname "$0")/.."
API=$(grep '^VITE_API_BASE=' .env.production | cut -d= -f2-)
[ -n "$API" ] || { echo "FAIL: .env.production에 VITE_API_BASE가 없다"; exit 1; }
npm run build
HOST=${API#https://}
grep -q "$HOST" dist/assets/app-*.js || { echo "FAIL: 빌드 결과에 $HOST 가 없다"; exit 1; }
BUILD=$(node -e "console.log(require('./dist/version.json').build)")
echo "$BUILD" > .staged-build
echo ""
echo "  검수본 올라감: $BUILD"
echo "  확인:  https://admin.bukangi.com/"
echo "  실배포: ./ops/deploy-web.sh   (검수 끝난 뒤에만)"
