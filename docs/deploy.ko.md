[English](deploy.md) | **한국어**

# 배포

bukangi.com이 돌아가는 방식입니다. 화면은 Cloudflare Workers에, API는 Cloudflare Tunnel 뒤의 맥미니 한 대에 있습니다. 돈이 드는 건 도메인뿐입니다.

```
bukangi.com, www.bukangi.com → Cloudflare Workers (정적 dist/ + worker.js)
api.bukangi.com              → Cloudflare Tunnel → 맥미니 127.0.0.1:8787
admin.bukangi.com            → Cloudflare Tunnel → 맥미니 (운영자 화면, 검수본)
```

## 1. 도메인

Cloudflare에서 도메인을 사고 DNS도 Cloudflare에 둡니다. 그래야 Workers 연결 도메인과 터널을 둘 다 붙일 수 있습니다.

## 2. API 서버 (맥미니)

```bash
npm ci
# ops/bukang.plist의 CHANGE_ME를 먼저 모두 채운다
cp ops/bukang.plist ~/Library/LaunchAgents/kr.bukangi.server.plist
launchctl load ~/Library/LaunchAgents/kr.bukangi.server.plist
curl -s localhost:8787/healthz
```

- `ADMIN_TOKEN`: `openssl rand -hex 24`로 만듭니다. 없으면 서버가 뜨지 않습니다.
- `PUBLIC_URL=https://api.도메인`, `SITE_URL=https://도메인`. 사람들이 사이트를 여는 주소는 전부 `ALLOWED_ORIGINS`에 넣습니다. 다른 주소에서 온 제보는 거절되고(CORS) 로그에 남습니다.
- `BUKANG_DATA`에 SQLite DB와 사진이 쌓입니다. `/tmp`는 쓰지 않습니다.
- AI 심사 (선택): `./ops/jev/setup.sh` 후 plist에 `SCREEN_ENGINE=jev`를 넣습니다. [screening.ko.md](screening.ko.md) 참고.
- 디스코드 알림 (선택): `./ops/set-webhook.sh <웹훅 주소>`가 웹훅 확인, plist 반영, 서버 재시작까지 합니다.
- 백업: `./ops/backup.sh <백업 위치>`, cron으로 주 1회.

## 3. Cloudflare Tunnel

```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create bukang
cp ops/cloudflared-config.example.yml ~/.cloudflared/config.yml   # <TUNNEL_ID>와 주소를 채운다
cloudflared tunnel route dns bukang api.도메인
cloudflared tunnel route dns bukang admin.도메인
cloudflared service install
```

- 설정 파일에 적은 경로만 밖에서 열리고, 나머지는 404입니다. 운영자 API는 api 주소로 절대 나가지 않습니다.
- admin 주소에는 Cloudflare Access(Zero Trust)를 한 겹 더 씌웁니다.
- 회선에서 QUIC(UDP 7844)이 막혀 있으면 `protocol: http2`를 그대로 둡니다.

## 4. 화면 (Cloudflare Workers)

`.env.production`을 만듭니다.

```
VITE_API_BASE=https://api.도메인
VITE_GA_ID=                         # 선택, 구글 애널리틱스
```

```bash
./ops/stage.sh        # dist/를 빌드하면 admin.도메인에서 검수본으로 보인다
./ops/deploy-web.sh   # 빌드 번호를 대조한 뒤, 검수한 그 빌드를 wrangler로 도메인에 올린다
```

- `wrangler.jsonc`에 `bukangi.com`, `www.bukangi.com`이 묶여 있습니다. 내 도메인으로 바꿉니다.
- `worker.js`는 `www`와 `http://`를 `https://도메인`으로 보내고, `/c/<카드>` 링크 미리보기를 API로 넘깁니다.
- 검수를 건너뛰려면 `npm run deploy`로 빌드와 배포를 한 번에 합니다.

## 5. 배포 후 확인

- `https://도메인`, `www`, `http://`가 모두 `https://도메인`으로 열리는지
- `curl https://api.도메인/healthz`가 응답하고, 터널 설정에 없는 경로는 404인지
- 폰으로 제보를 하나 올려 운영자 화면에서 공개까지 해 보기

보안 체크리스트와 부하 수치는 [operations.ko.md](operations.ko.md).
