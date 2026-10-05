**English** | [한국어](README.ko.md)

# Is Bukangi Here Now? (부캉이 지금 있나, bukangi.com)

In September 2026, a shark nicknamed "Bukangi" (부캉이) showed up at Bukhang Waterfront Park in Busan North Port, and crowds followed. Sightings were everywhere, but nothing answered the real question: **"If I go now, will I see it?"**
This repository is the citizen-reported status board built overnight to answer that question. When someone on site uploads a photo of the shark or taps "I see it / I don't," the last-seen time updates immediately.

- Service: https://bukangi.com
- Development: first commit 2026-09-21, launched the next day (9/22), and continuously revised since, guided by the operating logs
- Write-up (two weeks of building and running it): [English](EN_POST_URL) · [Korean](KO_POST_URL)

<p align="center">
  <img src="docs/screenshots/home.png" width="19%" alt="Home: last-seen time and on-site buttons">
  <img src="docs/screenshots/certify.png" width="19%" alt="Report: certify with a single photo">
  <img src="docs/screenshots/hall.png" width="19%" alt="Hall of Fame: published report photos">
  <img src="docs/screenshots/tiers.png" width="19%" alt="Rarity tiers: certification card rarity">
</p>
<p align="center"><sub>Home · Report · Hall of Fame · Card rarity tiers (actual screens, 2026-09-30)</sub></p>

## Operations by the numbers (as of 2026-10-04)

| Metric | Value | Basis |
|---|---|---|
| Daily unique visitors, first week | Average 1,563, peak 2,823 (9/27) | Daily unique visitors, 9/22–9/28 |
| Cumulative visits | 17,634 | Sum of daily unique visitors, 9/22–10/4 (someone who comes on several days is counted several times) |
| Photo reports | 306 (274 published) | |
| On-site buttons | 770 taps ("I see it" 426, "I don't" 344) | Only taps made within the park's GPS radius |
| AI photo screening | Switched to a local model on 9/28. On 161 production reports since the switch: 88% handled automatically, 0 automatic decisions overturned by a human, 0 KRW in external costs | See "AI photo screening" below |
| Press | 4 newspapers in print, 3 broadcasters (see "Press" below) | Articles refer to the developer as "a graduate student in Busan" |

## Press

| Date | Outlet | Coverage |
|---|---|---|
| 9/22 | [JTBC News '지금 이 장면' (This Scene Now)](https://www.youtube.com/watch?v=0DWchYJrzFE) | Evening of launch day; introduced as a North Port "shark-finding" service |
| 9/24 | [KBC Gwangju Broadcasting, D News](https://news.ikbc.co.kr/article/view/kbc202609230034) | First exclusive story. "Inspired while writing a thesis... 'Is Bukangi Here Now?', built by a grad student before dawn" |
| 9/26 | [Busan Ilbo (exclusive)](https://www.busan.com/view/busan/view.php?code=2026092614372410741) | "'Is Bukangi here now?'... A website for sharing the North Port shark's location in real time appears" |
| 9/28 | [Chosun Ilbo, page A10](https://www.chosun.com/national/regional/2026/09/28/HQSLDGBIYFCQNDLIXTLBPRVEYI/) | "Bukangi over Haeundae": 460,000 visitors over the Chuseok holiday. Quotes an interview with the developer |
| 9/28 | [Busan Ilbo, page 2 lead story](https://www.busan.com/view/busan/view.php?code=2026092718311123044) | Introduced the "I see it / I don't" buttons and the certification cards |
| 9/28 | Seoul Shinmun page 10; Kookje Shinmun page 2 lead story | "A new way of sightseeing in which citizens share location information with one another as they search" |
| 9/28 | [MBN '보부상 요즘 그거'](https://www.youtube.com/watch?v=Cl-hmvv4Hu8) | "Onlookers become participants." Aired the site's screens |
| 10/2 | SBS 'Curious Story Y' (궁금한 이야기 Y) | Interview with the developer, filmed on Chuseok day (9/25) |

## Architecture

```
 User ──┬─ bukangi.com ──────▶ Cloudflare Workers static assets (React app)
        │                      └ worker.js: forwards only /c/<card> previews to the API
        │
        └─ api.bukangi.com ──▶ Cloudflare Tunnel (only allowed paths pass; everything else 404s)
                                  │
                                  ▼  a single Mac mini (no external ports opened; listens on 127.0.0.1 only)
                       Express server :8787 ── SQLite (WAL) + photo folder
                            ├─ AI screening engine :8788 (jev-visual + Qwen3.5-4B-4bit, MLX, local only)
                            └─ Discord webhook (decision alerts + signed approve/reject/undo links)
```

- **Photos** are served from the Cloudflare edge cache, while status board responses and **writes** (reports, buttons) go all the way to the Mac mini.
  The server sends `s-maxage=10`, but by default Cloudflare does not cache extensionless URLs, so serving the status board from the edge as well requires adding a separate cache rule.
  In local load tests: `/api/status` at 23,502 rps, report uploads at 4,405 rps (`OPS.md`). The real limit is the server's network connection.
- The **admin page** opens only on a separate host (admin) and authenticates with a Bearer token.

## Design decisions

| Observation | Decision |
|---|---|
| What people want to know is not the exact location but "is it there right now?" | Reduced the answer to a single line: the "last-seen time". Removed the decay that switched the status to "unconfirmed" after 2 hours; elapsed time is shown only as a badge |
| Photo reports on day one were in the single digits | Concluded the cause was the effort of taking and uploading a photo, so added the photo-free "I see it / I don't" buttons the same day. Accepted only within the park's GPS radius, once per device every 10 minutes |
| Location-check failures outnumbered successes by more than two to one | The logs showed Threads and Instagram in-app browsers were the cause. Added a prompt to open the site in an external browser |
| Report photos included screenshots and selfies | Defined screening as a classification problem: "Did the reporter take this photo themselves, and is the shark visible?" Auto-approve / auto-reject only when the AI is confident; ambiguous cases are handed to a human |
| General-purpose LLM screening was slow and silently stopped when its login expired | Replaced it with local inference that scores only the logits of candidate answers instead of generating an answer. Evaluated on 146 production reports, and before switching over, re-screened 147 photos on a test server to confirm the results matched, then deployed |
| Everything has to run on a single Mac mini | Photos go through the edge cache; uploads are capped at 8 concurrent + 200 queued, with 503 beyond that |

## AI photo screening

- Engine: [jev-visual](https://github.com/hr98w/jev-visual) (MIT) + Qwen3.5-4B-4bit. The code is not modified, and it is installed pinned to the commit used for evaluation.
- Decision: publish probability ≥ 0.7 means auto-approve, ≤ 0.3 means auto-reject, and anything in between goes to the operator.
- Evaluation (146 production reports; ground truth is the operator's final status): 69.2% handled automatically, automatic decision accuracy 101/101, 0 false approvals.
  The 0.7 threshold was chosen on those same 146 photos, and there were only 14 rejected samples, so these numbers are an optimistic upper bound. That is why every automatic decision is also sent to Discord, where a human can overturn it.
- Production (161 reports since the 9/28 switchover, as of 2026-10-04): 126 auto-approved, 16 auto-rejected (including 2 operator tests), 19 handed to a human (16 published, 2 rejected, 1 pending), 0 automatic decisions overturned by a human, 88% handled automatically. "Correct" here means "a human did not overturn it", so this is an operating record, not an independent label.
- Details: [`eval/README.md`](eval/README.md), [`SCREENING.md`](SCREENING.md)

## Security and privacy

- The server listens only on 127.0.0.1, and no router ports are opened. Only the paths the tunnel allows are exposed (`ops/cloudflared-config.example.yml`).
- The admin token and Discord signed links are compared with `timingSafeEqual`. The server will not start without a token.
- Uploads are checked for being images by their leading bytes (magic bytes), not their extension, and photo IDs are unguessable random values.
- Per-IP rate limits, request size limits, and prepared statements for all SQL.
- IP addresses and browser information are used only as hashes; the originals are not stored (`DATA.md`).
- The production site also uses Google Analytics (cookies) for visit statistics. If the build value `VITE_GA_ID` is not set, nothing is loaded.
- Report photos, the production DB, and secrets are not in the repository.

## Folders

```
src/            React + TypeScript UI (Vite)
server/         Express API, SQLite, AI screening integration, Discord alerts, card images
eval/           AI photo screening evaluation scripts and results (report IDs anonymized)
ops/            Mac mini ops scripts, launchd config, example tunnel config, jev engine installer
test/           Scripts for screen captures and flow checks (Playwright), load tests
art/, public/   Character art and static assets
worker.js       Cloudflare Worker (forwards only card preview paths to the API)
*.md            Docs: operations (OPS), deployment (DEPLOY), domain (DOMAIN), data (DATA), screening (SCREENING)
```

## Running locally

Requirements: Node.js (v25 in the development environment) and npm. To also run the AI screening engine, you need an Apple Silicon Mac (MLX) and Python 3.13.

```bash
npm install

# 1) UI only
npm run dev                                   # http://localhost:5173

# 2) With the API server
export ADMIN_TOKEN=$(openssl rand -hex 24)    # admin token (required)
export BUKANG_DATA=~/bukang-dev               # folder where the DB and photos are stored
export SITE_URL=http://localhost:5173         # UI origin that calls the report/admin APIs
export SCREEN_ENGINE=off                      # no screening engine (a human reviews on the admin page)
npm run seed                                  # sample data (optional)
npm run server                                # http://127.0.0.1:8787 , admin page at #/admin
```

### Key environment variables

| Name | Default | Description |
|---|---|---|
| `ADMIN_TOKEN` | (required) | Admin API token. 32+ random characters recommended |
| `BUKANG_DATA` | `~/bukang` | Location of the SQLite DB and photo folder |
| `PORT` / `HOST` | `8787` / `127.0.0.1` | Server address. Loopback only, in production too |
| `SITE_URL`, `ALLOWED_ORIGINS` | | UI origins allowed to call the report/admin APIs |
| `PUBLIC_URL` | | The API's external URL. If set, photos are returned as absolute URLs |
| `SERVE_STATIC` | `1` | Whether the server serves `dist/` and card images itself |
| `SCREEN_ENGINE` | `claude` | Photo screening engine: `claude` / `api` / `jev` / `off` |
| `JEV_URL`, `JEV_THRESHOLD` | `http://127.0.0.1:8788`, `0.7` | jev engine URL and auto-approve threshold (auto-reject if ≤ 1 − threshold) |
| `ANTHROPIC_API_KEY` | | Required only when `SCREEN_ENGINE=api` |
| `DISCORD_WEBHOOK` | | If set, sends decision alerts and signed links |
| `PARK_RADIUS` | `700` | Park radius (m) within which on-site buttons are accepted |
| `VITE_GA_ID` | (none) | Frontend build value. Google Analytics measurement ID. Leave empty to disable GA |

### AI screening engine (optional)

```bash
./ops/jev/setup.sh          # installs jev-visual (pinned commit) and the model, registers with launchd, 127.0.0.1:8788
export SCREEN_ENGINE=jev
npm run server
```

### Production deployment

Always-on operation on the Mac mini (launchd), the Cloudflare Tunnel, and domain setup are documented step by step in [`DEPLOY.md`](DEPLOY.md), [`DOMAIN.md`](DOMAIN.md), and [`OPS.md`](OPS.md).
For the tunnel, copy `ops/cloudflared-config.example.yml` to `~/.cloudflared/config.yml` and fill in `<TUNNEL_ID>`.

## How it was built

- Developed with **Claude Code**.
- Planning was done with **Claude Fable**, and **gstack** was used for the workflow.
- Implementation was handled by **Claude Opus 5** and **Claude Opus 5.5**.
- What to build, what to block, and when to switch screening models were my calls, made from the operating logs. The reasoning behind each decision is recorded in the commit messages.

## Third-party code and licenses

See [`THIRD_PARTY.md`](THIRD_PARTY.md). jev-visual (MIT) and the Qwen3.5 models (Apache-2.0) are downloaded at install time and are not included in this repository.

## License

MIT. See [`LICENSE`](LICENSE).
