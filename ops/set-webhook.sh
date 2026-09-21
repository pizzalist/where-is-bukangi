#!/bin/zsh
# 디스코드 웹훅 등록. URL 하나만 넘기면 확인 → plist 반영 → 서버 재시작까지 한다.
#   ./ops/set-webhook.sh https://discord.com/api/webhooks/...
set -e
URL="$1"
PLIST="$HOME/Library/LaunchAgents/kr.bukangi.server.plist"
[[ "$URL" == https://discord.com/api/webhooks/* || "$URL" == https://discordapp.com/api/webhooks/* ]] || {
  echo "FAIL: 디스코드 웹훅 주소가 아니다: $URL"; exit 1; }

# 1) 진짜 살아있는 웹훅인지 확인 (채널 이름을 돌려준다)
INFO=$(curl -s -m 15 "$URL")
NAME=$(echo "$INFO" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{try{const j=JSON.parse(s);if(!j.id)throw 0;console.log(j.name||'(이름없음)')}catch{console.error('FAIL: 웹훅이 응답하지 않는다 →',s.slice(0,200));process.exit(1)}})")
echo "웹훅 확인: $NAME"

# 2) plist에 넣고 (plutil로 안전하게) 재시작
plutil -replace EnvironmentVariables.DISCORD_WEBHOOK -string "$URL" "$PLIST"
chmod 600 "$PLIST"
launchctl bootout "gui/$(id -u)/kr.bukangi.server" 2>/dev/null || true
sleep 2
launchctl bootstrap "gui/$(id -u)" "$PLIST"
sleep 3
echo "서버 재시작 완료: $(curl -s -m 10 http://127.0.0.1:8787/healthz)"

# 3) 테스트 메시지
curl -s -m 15 -H 'content-type: application/json' \
  -d '{"content":"부캉이 알림 연결 완료. AI가 못 가른 제보만 여기로 옵니다."}' "$URL" >/dev/null
echo "테스트 메시지 보냄. 디스코드 채널을 확인하세요."
