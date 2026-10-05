**English** | [한국어](OPS.ko.md)

# Operations Guide (Production)

## 0. Pre-deploy checklist

| Task | Why |
|---|---|
| Change `ADMIN_TOKEN` to a random value of 32+ characters | There is no default, so the server won't start without it. Short values trigger a warning |
| Run with `SERVE_STATIC=0` | Cloudflare Pages serves static files. The Mac mini serves only the API |
| Check `HOST=127.0.0.1` | Listen on loopback only, with the tunnel in front. Never open ports on the router |
| Put Cloudflare Access on the operator domain | One more layer of protection even if the token leaks |
| Turn on the Mac mini firewall | System Settings → Network → Firewall |
| Turn off Remote Login (SSH), or allow key authentication only | The #1 intrusion path |
| Turn off automatic login and turn on screen lock | Against physical access |
| Turn on FileVault | Against disk theft |

```bash
# Generate a token
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

---

## 1. Security: keeping the Mac mini from being breached

### Already in the code

| Item | Implementation | Test result |
|---|---|---|
| Operator access without a token | `Authorization: Bearer` required | 401 |
| Token timing attacks | `crypto.timingSafeEqual` + length check first | Pass |
| Path traversal (`../`, URL encoding, double encoding) | `express.static` + uniform 404 | All 404 |
| DB file exposure | Only the photo directory is served | Not exposed |
| Spoofed extensions (text disguised as webp) | Magic byte check | Rejected |
| SQL injection | Prepared statements everywhere | 404 (query not executed) |
| Capture time in the future or past | ±1 hour / 30 day range check | Rejected |
| Unknown zone codes | Whitelist | Rejected |
| Oversized photos | 3MB cap + 5MB JSON cap | 413 |
| Response headers | nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy | 3/3 |
| Server info disclosure | `X-Powered-By` removed | Hidden |
| Slowloris | `headersTimeout` 20s, `requestTimeout` 30s | Applied |
| Rate limits | Reports: 3/min and 10/hour per IP; operator: 60 per 15 min | 429 |
| Upload concurrency | 8 concurrent + queue of 200, 503 beyond that | Applied |

### What you need to do

**1) Restrict paths with tunnel ingress rules.** See `ops/cloudflared-config.example.yml`.
Paths not listed in that file are invisible from outside. This rules out accidentally exposing
other ports on the Mac mini (SSH 22, AirPlay 7000, etc.).

**2) Put Cloudflare Access on the operator page.**
Zero Trust → Access → Applications → add `admin.<domain>` → policy: "only when the email is mine".
Then even someone who knows the token can't get in without a Google login. The free plan covers up to 50 users.

**3) Lock down the Mac mini itself.**
```bash
# Firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
# Turn off Remote Login (allow public keys only if you need it)
sudo systemsetup -setremotelogin off
# Automatic updates
sudo softwareupdate --schedule on
```

**4) Never put the token in code.** Pass it only as an environment variable in `ops/bukang.plist`.

---

## 2. Load: from ten thousand to tens of thousands of people

### Why the architecture holds

```
100,000 readers   → Cloudflare edge responds (10-second cache)
                   → 6 origin requests per minute
Writers (reports) → tunnel → Mac mini
```

`/api/status` sets `s-maxage=10`. By default Cloudflare does not cache extensionless URLs, so this only takes effect after you add a Cache Rule for `/api/status` (not set up in production yet).
**With that rule, whether there are 100,000 readers or 1,000,000, the Mac mini receives the same number of status requests.** Photos are cached at the edge either way.

### Measurements (local, no network latency)

| Route | Throughput | p50 | p95 | p99 | Failures |
|---|---|---|---|---|---|
| `GET /api/status` (500 concurrent, 20,000 requests) | 23,502 rps | 16ms | 39ms | 86ms | 0 |
| `GET /api/hall` (200 concurrent) | 32,258 rps | 6ms | 9ms | 10ms | 0 |
| `GET /photos/*` (200 concurrent) | 5,277 rps | 23ms | 85ms | 90ms | 0 |
| `POST /api/submissions` 70KB (100 concurrent, 1,000 requests) | 4,405 rps | 21ms | 27ms | 33ms | 0 |

Verified that all 1,000 uploads ended up in the DB and on disk (302 rows / 309 files / 23MB).

### The real bottleneck is the uplink, not the server

Even at 4,400 rps locally, the actual limit is the server's internet connection.

| Concurrent uploads | Bandwidth needed (at 70KB) | On a 500Mbps line |
|---|---|---|
| 10/s | 5.6 Mbps | Plenty of headroom |
| 100/s | 56 Mbps | Plenty of headroom |
| 500/s | 280 Mbps | Tight |
| 1,000/s | 560 Mbps | Over the limit |

Even the peak right after a sighting is unlikely to exceed a few hundred per second. The 3-photos-per-day limit
and the 3-per-minute-per-IP limit together keep any one person from flooding uploads.

### What happens when it overflows

- More than 8 concurrent uploads → queue (up to 200)
- Queue full too → 503 + "지금 사람이 몰려요. 잠시 뒤 다시 시도해주세요" ("Lots of people right now. Please try again in a moment")
- **Reads are unaffected.** Cloudflare is handling them, so the status board stays up
- Even if the Mac mini dies completely, the last `status` keeps being served from cache, and the 2-hour decay automatically turns it into "미확인" (unconfirmed)

### If you need more capacity

1. Raise `UPLOAD_CONCURRENCY` to 16–32 (fine on an SSD)
2. Set photo quality to 0.86 (70KB → 53KB, 25% smaller)
3. If that's still not enough, move only the photos to Cloudflare R2 (costs money)

---

## 3. Data flow (verified end to end)

```
Reporter: crop photo → WebP 2048px (~70KB) → POST /api/submissions
          → server issues grade and serial number → ~/bukang/photos/YYYY/MM/DD/*.webp + SQLite (pending)
          → app shows the card

Operator: /#/admin → token login → GET /api/admin/queue
          → check the zone, then [Approve] or [Reject]
          → POST /api/admin/:id/approve → status='approved' + cache invalidated immediately

Public:   GET /api/status  → shown in today's log with a photo thumbnail
          GET /api/hall    → shown in the Hall of Fame, ordered by grade
```

The operator can also enter "못 봄" (not seen) from the field via **현장 관측 입력** (on-site observation entry) in `/#/admin`.

---

## 4. Running

```bash
# Local verification
npm run build && npm run seed && ADMIN_TOKEN=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))") npm run server

# Load test
TOK=<token> npm run load

# Browser flow test
npm run e2e
```

### Always-on (launchd)
Fill in `CHANGE_ME` in `ops/bukang.plist`, then:
```bash
cp ops/bukang.plist ~/Library/LaunchAgents/kr.bukang.server.plist
launchctl load ~/Library/LaunchAgents/kr.bukang.server.plist
curl -s localhost:8787/healthz
```

### Backups
```bash
./ops/backup.sh /Volumes/Backup/bukang     # weekly cron
```

---

## 5. Deployment steps

1. Buy a domain → connect it to Cloudflare DNS
2. `npm run build` → upload `dist/` to Cloudflare Pages → check the app URL
3. Install cloudflared on the Mac mini, create a named tunnel, apply `ops/cloudflared-config.example.yml`
4. Connect `api.<domain>` to the tunnel, and have Pages proxy `/api/*` and `/photos/*` to it
5. Apply Cloudflare Access to `admin.<domain>`
6. Generate `ADMIN_TOKEN`, put it in the plist, and register with launchd
7. Check with `curl https://api.<domain>/healthz`
8. Submit a first report yourself and take it all the way through to approval on the operator page

---

## 6. Reviewing via Discord

Only reports the AI couldn't decide (unsure or failed) come to Discord, with a thumbnail, the AI's opinion, and approve/reject links.
Link → confirmation screen → one button press and you're done. For setup and safeguards, see "Discord notifications" in `SCREENING.md`.

```
DISCORD_WEBHOOK=...   PUBLIC_URL=https://api.<domain>   SITE_URL=https://<domain>
```

Passes and rejections are handled silently and can be reviewed at any time on the operator page (`/#/admin`).

---

## 7. Not built yet

- **Automatic notice collection.** There's no crawler that pulls in emergency alerts, Coast Guard, or district office notices.
  For now, enter them manually with `node server/notices.js` (2 by default) or `/api/admin/notice`.
  Building one first requires an emergency alert OpenAPI key (data.go.kr) and a Naver News Search API client ID
- **Hall of Fame pagination.** Shows only up to 60 photos
- **Multiple operators.** Everyone shares a single token
- **Discord buttons.** Links for now. Buttons you can press right inside the message need a bot account, so this was postponed
