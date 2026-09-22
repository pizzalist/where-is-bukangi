#!/bin/zsh
# 실서비스 배포. 다시 빌드하지 않고, 검수한 그 결과물(dist/)을 그대로 올린다.
# 검수본과 다른 걸 올리는 사고를 막으려고 빌드 번호를 대조한다.
set -e
cd "$(dirname "$0")/.."
[ -f .staged-build ] || { echo "FAIL: 먼저 ./ops/stage.sh 로 검수본을 올리고 확인하세요"; exit 1; }
STAGED=$(cat .staged-build)
NOW=$(node -e "console.log(require('./dist/version.json').build)")
[ "$STAGED" = "$NOW" ] || { echo "FAIL: 검수본($STAGED)과 현재 빌드($NOW)가 다릅니다. stage.sh를 다시 돌리세요"; exit 1; }
API=$(grep '^VITE_API_BASE=' .env.production | cut -d= -f2-)
HOST=${API#https://}
grep -q "$HOST" dist/assets/app-*.js || { echo "FAIL: 빌드 결과에 $HOST 가 없다"; exit 1; }
echo "검수본 $STAGED 를 실서비스에 올립니다"
rm -rf .wrangler/deploy          # pages 명령이 남기는 리다이렉트 설정. 있으면 deploy가 실패한다
npx --yes wrangler@latest deploy
echo "  실서비스: https://bukangi.com/"
