**English** | [한국어](deploy.ko.md)

# Deployment

How bukangi.com runs: the frontend on Cloudflare Workers, the API on a single Mac mini behind a Cloudflare Tunnel. The only paid item is the domain.

```
bukangi.com, www.bukangi.com → Cloudflare Workers (static dist/ + worker.js)
api.bukangi.com              → Cloudflare Tunnel → Mac mini 127.0.0.1:8787
admin.bukangi.com            → Cloudflare Tunnel → Mac mini (admin page and staging build)
```

## 1. Domain

Buy the domain on Cloudflare and keep its DNS there, so both the Workers custom domain and the tunnel can attach to it.

## 2. API server (Mac mini)

```bash
npm ci
# fill in every CHANGE_ME in ops/bukang.plist first
cp ops/bukang.plist ~/Library/LaunchAgents/kr.bukangi.server.plist
launchctl load ~/Library/LaunchAgents/kr.bukangi.server.plist
curl -s localhost:8787/healthz
```

- `ADMIN_TOKEN`: generate with `openssl rand -hex 24`. The server will not start without it.
- `PUBLIC_URL=https://api.<domain>`, `SITE_URL=https://<domain>`. Put every address people open the site from in `ALLOWED_ORIGINS`. Reports from any other origin are rejected (CORS) and logged.
- `BUKANG_DATA` holds the SQLite DB and photos. Never put it under `/tmp`.
- AI screening (optional): `./ops/jev/setup.sh`, then add `SCREEN_ENGINE=jev` to the plist. See [screening.md](screening.md).
- Discord alerts (optional): `./ops/set-webhook.sh <webhook URL>` checks the webhook, writes it to the plist, and restarts the server.
- Backups: `./ops/backup.sh <destination>`, weekly with cron.

## 3. Cloudflare Tunnel

```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create bukang
cp ops/cloudflared-config.example.yml ~/.cloudflared/config.yml   # fill in <TUNNEL_ID> and your hostnames
cloudflared tunnel route dns bukang api.<domain>
cloudflared tunnel route dns bukang admin.<domain>
cloudflared service install
```

- Only the paths listed in the config are reachable from outside; everything else returns 404. The admin API is never exposed on the api host.
- Put Cloudflare Access (Zero Trust) in front of the admin host.
- If QUIC (UDP 7844) is blocked on your network, keep `protocol: http2`.

## 4. Frontend (Cloudflare Workers)

Create `.env.production`:

```
VITE_API_BASE=https://api.<domain>
VITE_GA_ID=                         # optional, Google Analytics
```

```bash
./ops/stage.sh        # builds dist/; admin.<domain> serves it for review
./ops/deploy-web.sh   # uploads that same build to <domain> with wrangler, after checking the build number
```

- `wrangler.jsonc` binds `bukangi.com` and `www.bukangi.com`. Change them to your domain.
- `worker.js` redirects `www` and `http://` to `https://<domain>` and forwards `/c/<card>` link previews to the API.
- To skip staging, `npm run deploy` builds and deploys in one step.

## 5. After deploying

- `https://<domain>`, `www`, and `http://` all land on `https://<domain>`.
- `curl https://api.<domain>/healthz` responds; any path not in the tunnel config returns 404.
- Submit a test report from your phone and approve it on the admin page.

Security checklist and load numbers: [operations.md](operations.md).
