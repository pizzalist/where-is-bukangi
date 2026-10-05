**English** | [한국어](DEPLOY.ko.md)

# Deployment Guide

## Summary

**Don't use the Mac mini as a web server.** Cloudflare Pages serves the frontend; the Mac mini serves the data (reports, photos, status board) from behind a Cloudflare Tunnel.
Reads are absorbed by Cloudflare's edge cache, so the only traffic that reaches the Mac mini is reporters plus a cache refresh roughly once every 10 seconds.

```
Readers (100k+)  → Cloudflare Pages   bukang.kr          Frontend. Free, unlimited
                 → Cloudflare cache   api.bukang.kr      caches /api/status (10s), /photos (1 day)
Reporters (few)  → Cloudflare Tunnel → Mac mini :8787    /api/submissions, admin API
```

**Pages alone is not enough.** The frontend gets a fixed address, but whenever the API address (the tunnel) changes, the frontend has to be rebuilt.
Giving the API a fixed address requires a domain (a named tunnel can only attach to your own domain). So the order is **domain → Pages → tunnel**.

## 1. Domain (the only paid item)

| Where | Cost | Notes |
|---|---|---|
| Cloudflare Registrar `.com` | about ₩15,000/year | Sold at cost. Since you already use Cloudflare, it connects automatically |
| Gabia / Whois (Korean registrars) `.kr` | about ₩22,000/year | After buying, just switch the nameservers to Cloudflare's (takes a few hours) |

Don't put "공식" ("official") or "부산항" ("Busan Port") in the name. Something like `bukang.kr` or `bukangi.com` is safe.

1. Sign up at https://dash.cloudflare.com (free)
2. Search for a `.com` under **Domain Registration → Register Domains** and buy it. Or buy a `.kr` at Gabia, add it via **Websites → Add a site**, and change Gabia's nameservers to the two that Cloudflare gives you
3. Once the domain shows **Active** in the dashboard, move on to the next step

## 2. Frontend: Cloudflare Pages

```bash
VITE_API_BASE=https://api.bukang.kr npm run build     # use your own domain
```

1. Dashboard → **Workers & Pages → Create → Pages → Upload assets**
2. Project name `bukang` → drag the whole `dist/` folder in → Deploy
3. You get `bukang.pages.dev`. **Custom domains → Set up a domain** → enter `bukang.kr` (DNS is automatic)
4. From the next deploy on, just upload `dist/` to the same project again. If you prefer the command line:
   ```bash
   npx wrangler pages deploy dist --project-name bukang
   ```

Free plan: unlimited bandwidth, unlimited requests, 500 builds per month. Even hundreds of thousands of visitors won't incur charges.

**Note:** The report API only accepts requests from a frontend served at the address set in `SITE_URL` (CORS). Set it to exactly the address people use (`https://bukang.kr`).
To also allow use via `bukang.pages.dev`, add `ALLOWED_ORIGINS=https://bukang.pages.dev`.
If the frontend can be opened from more than one address, register every one of them. From a missing address the status board still loads, but reports and the on-site buttons fail in Safari with `Load failed`
(2026-10-01 incident: `www.bukangi.com` was missing). Production uses `ALLOWED_ORIGINS=https://admin.bukangi.com,https://www.bukangi.com`,
and `worker.js` 301-redirects both www and `http://` to `https://bukangi.com` so there is only one address.
The same day we also found the Instagram in-app browser opening the link as `http://bukangi.com`; that origin is `http://`, so it was rejected the same way.
Turning on **Always Use HTTPS** in the Cloudflare dashboard (SSL/TLS → Edge Certificates) also covers paths that don't go through the Worker.
Rejected origins are logged by the server as `[CORS 거절] origin=...` ("CORS rejected").

## 3. Data: Mac mini + Cloudflare Tunnel

```bash
brew install cloudflared
cloudflared tunnel login                       # a browser opens; pick your domain
cloudflared tunnel create bukang               # prints the tunnel ID and credentials file path
cloudflared tunnel route dns bukang api.bukang.kr
cp ops/cloudflared-config.example.yml ~/.cloudflared/config.yml    # fill in the three CHANGE_ME spots
cloudflared tunnel --protocol http2 run bukang # http2 is needed if QUIC is blocked on your line
```

- No router ports are opened. The server's IP is not exposed
- The ingress in `config.yml` exposes only `/api/status|hall|submissions`, `/photos/`, and `/r/` (Discord links). Everything else returns 404
- The admin API goes on a separate `admin.bukang.kr`. Allow only your own email under **Zero Trust → Access** to put one more door in front of the token
- To keep it running: `cloudflared service install` (registers with launchd)

Server-side environment variables (fill them into `ops/bukang.plist`):

```
ADMIN_TOKEN=<random, 32+ characters>
SERVE_STATIC=0                      # Pages handles the frontend
BUKANG_DATA=/Users/<me>/bukang        # not /tmp; it is wiped on reboot
PUBLIC_URL=https://api.bukang.kr    # absolute photo URLs and Discord links
SITE_URL=https://bukang.kr          # frontend address allowed to submit reports (CORS)
SCREEN_ENGINE=claude
DISCORD_WEBHOOK=...                 # optional
```

### Caching is the key
`/api/status` has `s-maxage=10`, so even if 100,000 people arrive in a minute, the Mac mini sees 6 requests. Photos are cached at the edge too.
In the Cloudflare dashboard → **Caching → Cache Rules**, set `api.bukang.kr/photos/*` to "Eligible for cache, Edge TTL 1 day" so each photo leaves the Mac mini only once.

### If the Mac mini goes down
The frontend on Pages stays up. If `/api/status` doesn't respond, a "서버에 연결할 수 없어요" ("Can't connect to the server") banner appears and only reporting is blocked.
Cards are issued by the server, so no cards go out while it is down.

### Residential line caveat
ISP terms of service include clauses restricting running servers. Since all reads go through Cloudflare and only reporters reach the Mac mini,
this is unlikely to be a problem in practice, but be aware of it. The bottleneck is the line's upstream bandwidth (at 500 Mbps, about 500 photos per second).

## 4. Photo storage: kept permanently on the Mac mini's local disk (zero cost)

Photos are kept permanently on the **Mac mini's local disk**. No cloud storage is used.
Photos are served via `api.<domain>/photos/*` and cached by Cloudflare. Lists use 480px thumbnails (about 20 KB); the original (2048px, about 70 KB) is served only on the card page.

### Compression: WebP 2048px (measured)

Before uploading, the app crops to 4:3, scales the long side to 2048px, and encodes as WebP at quality 0.90.
Actual sizes measured for the same photo in each format:

| Format (2048×1536) | Size |
|---|---|
| PNG lossless | 1,311 KB |
| JPEG q0.86 | 130 KB |
| **WebP q0.90** | **about 70 KB** |
| WebP q0.86 | 53 KB |

At the same quality, WebP is about 40% of JPEG's size. 2048px is 6x the card display size (340px),
so quality holds up even if the photo is later zoomed in or reused elsewhere.
Nearly every browser can encode WebP, including Safari on iOS 14 and later,
and the app automatically falls back to JPEG when it can't.

### Capacity estimate (permanent storage)

Assuming a generous 100 KB per photo:

| Reports per day | Per day | Per month | Per year |
|---|---|---|---|
| 1,000 photos | 100 MB | 3 GB | 36 GB |
| 10,000 photos | 1 GB | 30 GB | 365 GB |
| 50,000 photos | 5 GB | 150 GB | 1.8 TB |

A Bukangi event lasts a few days to a few weeks. Even 10,000 photos a day for a month is 30 GB,
which the Mac mini's internal disk handles easily. For a long-term archive, just attach an external SSD.
There is a limit of 3 photos per day, so one person can't upload hundreds.

### Storage layout
```
~/bukang/photos/2026/09/21/<id>.webp     original archived copy
~/bukang/bukang.db                        SQLite (metadata: time, zone, tier, approval status)
```
File names contain no personally identifying information. Metadata and files are linked only by id.

### Backups
Since storage is now permanent, backups are needed. Use Time Machine or an external disk, once a week.
Cloud backup would bring back costs, so it's better to archive everything in one go after the event ends.

### Privacy assessment (based on permanent storage)

This service carries relatively low privacy risk, because:

- **The subject is a shark, not a person.** The main source of image-rights (right of publicity) risk is absent
- **No names or contact details are collected.** It collects nothing that counts as personal information under the law
- **People are not the main subject of the photos.** Only shark photos are published
- **There are no accounts.** Even the service doesn't know who uploaded what

So there is no automatic face blurring and no channel for deletion requests. Instead, just these two rules are followed.

**1) Show a notice on the upload screen.** (Implemented: a collapsible "사진은 어떻게 쓰이나요?" ("How are photos used?") box)
- The capture time and zone are posted to the timeline
- Photos are published after operator review
- Photos and records are kept indefinitely
- No names or contact details are collected
- Photos unrelated to Bukangi are rejected

**2) At the approval step, reject photos where a person is the main subject.**
With crowds of 30,000 on site, people can end up in the background. Bystanders in the background in a public place
rarely lead to image-rights disputes, but the operator filters out photos where a face is the main subject.
The admin page already has a reject button.

**One remaining risk.** Saying only "kept indefinitely" could later draw a demand to specify a retention period.
If the project grows, it would be safer to set a period such as "3 years from collection." At the current scale, that's overkill.

## 5. Order of steps (1–2 hours total)

1. Buy a domain and get it Active on Cloudflare (10 min + waiting for nameserver propagation)
2. `VITE_API_BASE=https://api.<domain> npm run build` → upload to Pages → connect the custom domain (20 min)
3. Install cloudflared on the Mac mini, create the tunnel, connect `api.<domain>`, apply the config (30 min)
4. Fill in `ops/bukang.plist` and register it with launchd. Verify with `curl https://api.<domain>/healthz` (20 min)
5. Insert the two notices with `node server/notices.js`
6. Upload a photo from a phone and get a card → publish it via the Discord notification or the admin page → check that it appears on the status board
7. (Optional) Cloudflare Access on `admin.<domain>`, the photo cache rule, the Discord webhook

The address at the bottom of the card is filled in automatically from the address the visitor used, so `VITE_SITE_HOST` doesn't need to be set.

## 6. Don'ts

- Exposing the Mac mini directly to the internet (port forwarding)
- Keeping data in `/tmp` (it disappears on reboot)
- Serving the frontend from the Mac mini (`SERVE_STATIC=1` is for local development)
- Sending traffic to the Vercel or Netlify free plans (they have bandwidth limits; when you blow past them you get billed or blocked)
- Publicly promoting a free tunnel address (localhost.run, trycloudflare). When the address changes, every shared card link dies

## 7. Running the server locally

```bash
npm run build          # build the frontend
npm run seed           # insert mock data (9 reports, 2 observations, 2 notices)
npm run server         # http://localhost:8787
```

Data lives in `~/bukang` (change it with the `BUKANG_DATA` environment variable). Photos are in `~/bukang/photos/<year>/<month>/<day>/`.

### API

| Method | Path | Description |
|---|---|---|
| GET | `/api/status` | Status board (timeline, notices, last sighting). 15-second cache |
| GET | `/api/hall` | Hall of Fame (approved cards, by tier) |
| GET | `/photos/...` | Public photos |
| POST | `/api/submissions` | Submit a report. **The server decides the tier and serial number** |
| GET | `/api/submissions/:id` | Look up a card |
| GET | `/api/admin/queue` | Approval queue (Bearer token) |
| POST | `/api/admin/:id/approve\|reject` | Approve / reject |
| POST | `/api/admin/observation` | Record an on-site observation (`seen`/`miss`) |
| POST | `/api/admin/notice` | Add a notice (`crit: true` pins it to the top as an access-restriction notice) |

The admin token is the `ADMIN_TOKEN` environment variable. Without it, the server won't start.

### Why the server decides the tier
If the client decided the tier, anyone could mint unlimited gold cards with developer tools.
The same goes for serial numbers. So the server rolls them and returns only the result.
If the server is unavailable, no card is issued and an error is shown.

### Abuse prevention
- 10 requests per hour per IP (in memory)
- 3 MB cap per photo (the app sends about 70 KB)
- 3 photos per day per client (stored in localStorage, so it can be bypassed. With no accounts, IP-based limiting is the best the server can do)
