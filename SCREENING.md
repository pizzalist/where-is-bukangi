**English** | [한국어](SCREENING.ko.md)

# AI First-Pass Screening

## What it does

When a report comes in, the AI looks at it first and sorts it into one of three outcomes. There is only one criterion: **"Is this a photo of Bukangi?"**
It doesn't matter if people are in the shot too.

| Verdict | Condition | Result |
|---|---|---|
| **Pass** | Real photo + shark visible + confidence ≥ 80% | Auto-approve |
| **Reject** | Screenshot, drawing, or card image, or no shark (confidence ≥ 80%) | Auto-reject |
| **Unsure** | Confidence < 80%, or the AI call failed | A human decides. Stays on the operator screen and **triggers a Discord notification** |

The operator screen shows the AI's opinion as a colored badge. Only the unsure ones remain, so there's far less to review.
The "person" field is recorded for reference only and is not used in the verdict.

## Real verdict examples (measured)

```
seed09       pass   real_photo=true  shark=true  person=false conf=0.85  13.3s
                    "A real photo clearly showing a large fish that looks like a shark in shallow water at the shoreline"
card screenshot reject real_photo=false shark=false person=false conf=0.95  13.2s
                    "A screenshot capturing 3 app card UIs; the shark inside the cards is a composite image"
```

It even catches the shark drawing inside an app screenshot as a "composite image".

## Discord notifications (unsure and failed only)

Only what the AI couldn't decide goes to the Discord channel: thumbnail + AI opinion + **approve / reject links**.
Tapping a link opens a confirmation screen, and one more button press processes it. You can finish it all on your phone.

```
DISCORD_WEBHOOK=https://discord.com/api/webhooks/...   # Channel settings → Integrations → Create webhook
PUBLIC_URL=https://api.<domain>                        # Link prefix (public address of the API server)
SITE_URL=https://<domain>                              # Admin page link (optional)
NOTIFY_ON=unsure,error                                  # Default. Add pass,reject to get everything
```

- Links are signed with `ADMIN_TOKEN`, so they can't be forged. They **only work while the report is pending**, so pressing twice is safe.
- Nothing happens if a link-preview bot opens the link (GET shows the confirmation screen; processing is a POST).
- If the webhook URL leaks, others can post to the channel, so use a channel only you can see. If it leaks, delete the webhook in Discord and create a new one.
- Screening continues even if a notification fails. It's logged as `[알림]` (notification).

## Concurrent uploads

The server accepts uploads 8 at a time and queues up to 200 (beyond that, 503 → the app tells the user to try again shortly).
Measured at 4,405 per second; all 1,000 concurrent submissions were confirmed saved (`OPS.md`).
Screening runs in a separate loop, so it doesn't block uploads. Every `SCREEN_INTERVAL`, it picks up `SCREEN_BATCH` pending photos
and runs `SCREEN_PARALLEL` of them concurrently. If it falls behind, reports simply pile up as pending and are processed in order.
The card is issued immediately on upload, so users don't wait for screening.

## Two engines

### claude CLI (default, zero cost)
```bash
SCREEN_ENGINE=claude
```
Calls the `claude` CLI. **It runs on a subscription, so there are no API charges.**
The trade-off is speed: 12–15 seconds per photo, and up to 60 seconds for the first call while it warms up.
Enough for a few hundred a day; at thousands it falls behind.

### API (fast, token cost)
```bash
SCREEN_ENGINE=api
SCREEN_MODEL=claude-haiku-4-5-20251001     # Cheapest vision model ($1/M input, $5/M output)
ANTHROPIC_API_KEY=sk-ant-...
```
1–2 seconds per photo. Screening sends a **480px thumbnail**, not the original.
Image tokens are width × height ÷ 750, so 480×360 ≈ 230 tokens, plus 250 prompt tokens and 60 answer tokens.
**About $0.0008 per photo = ₩1.1.**

| Reports per day | CLI (subscription) | API (Haiku 4.5) |
|---|---|---|
| 300 | ₩0. About 35 minutes at 2 concurrent | About ₩330 |
| 3,000 | ₩0, but runs all day (about 5.5 hours) | About ₩3,300 |
| 10,000 | Falls behind (18 hours). May also hit subscription limits | About ₩11,000 (₩330,000 a month) |

For reference, there were 30,000 visits over the first 3 days. If photo reports are 1–3% of visits, that's 100–500 a day.
In that range the CLI costs ₩0, and even the API is a few hundred won a day. Ten thousand a day is practically never going to happen.

**Recommendation:** Start with the CLI. If "AI 심사 대기" (awaiting AI screening) keeps piling up on the operator screen, switch to the API. It's two environment variables.

### jev (local Jev-style scoring, production default since 2026-09-28)
```bash
SCREEN_ENGINE=jev
JEV_URL=http://127.0.0.1:8788   # The jev program on the same Mac mini. Not exposed externally
JEV_THRESHOLD=0.7               # p(approve) ≥ 0.7 approve, ≤ 0.3 reject, anything in between goes to a human
```
Instead of generating text, it reads only the scores of the answer-option tokens (approve/reject) and converts them into a probability.
It uses the [jev-visual](https://github.com/hr98w/jev-visual) repo without code changes, with the model `mlx-community/Qwen3.5-4B-4bit`.
The Node server can't run the model itself, so a Python program runs permanently on the Mac mini and the server queries it.

Installation and always-on setup is one command (Apple Silicon, requires uv):
```bash
./ops/jev/setup.sh       # Installs the repo (pinned commit), virtualenv, and model (pinned version) into ~/bukang-jev + registers with launchd
```
- The prompt is `server/jev-prompt.json`. It's a direct copy of v2 used in the evaluation, so don't edit it by hand
- Screening sends the original photo (same conditions as the evaluation). About 2.2 seconds per photo, about 6GB of memory
- The source question (taken directly / screen capture, etc.) is recorded only and not used in the verdict. It had low reliability in the evaluation
- If the jev program is down, screening is recorded as "오류" (error) and the report goes to the human queue. The service doesn't stop

**Evaluation (146 production reports; ground truth is the operator's final decision)**

| | claude CLI | jev 4B, 0.7 |
|---|---|---|
| Automated | 108 (74.0%) | 101 (69.2%) |
| Accuracy of automated decisions | 99.1% (107/108) | 100% (101/101) |
| False reports auto-approved | 0 | 0 |
| Screening failures | 6 (login expired) | 0 |
| Per photo | 11.4s | 2.2s |

The speedup from 11.4s → 2.2s is a whole-system comparison in which the CLI invocation, the internet round trip, and the model size all changed together. Changing only how the answer is extracted, with the same 4B model, gives a median of 2.22s vs 4.34s over all 146 photos, or 1.29x on the 60 photos both methods answered. Also, with plain generation-based answering, 86 of 146 photos failed to produce an answer within the output length limit (`eval/`).

Production results (242 reports since the 9/28 switch, as of 2026-10-05): 194 auto-approved, 17 auto-rejected (including 2 operator test photos), 31 handed to a human (27 published, 4 rejected), 0 automated decisions overturned by a human, 87% handled automatically. "Correct" here means "a human did not overturn it".

Known weakness: jev may approve a **video frame or screen capture** in which the shark is clearly visible (claude marks these unsure).
Screen captures without a shark are reliably rejected. Auto-approved reports can be reversed from "AI가 통과시킨 것" (passed by AI) in the admin page.
Evaluation records: `eval/` in this repo (at evaluation time, the prompt was pinned by a commit in a separate repo before running; commit ec12d4f).

**Rolling back**: set `SCREEN_ENGINE=claude` in the server config → restart the server. To stop the jev program: `launchctl bootout gui/$(id -u)/kr.bukangi.jev`.

## Configuration

| Environment variable | Default | Meaning |
|---|---|---|
| `SCREEN_ENGINE` | `claude` | `claude` / `api` / `jev` / `off` |
| `SCREEN_INTERVAL` | `20000` | Polling interval (ms) |
| `SCREEN_BATCH` | `20` | Photos picked up per round |
| `SCREEN_PARALLEL` | CLI 2 / API 4 | Photos screened concurrently |
| `SCREEN_PASS_CONF` | `0.8` | Minimum confidence for automated handling |
| `SCREEN_AUTO_APPROVE` | On | If `0`, a human also confirms passes |
| `SCREEN_AUTO_REJECT` | On | If `0`, a human also confirms rejections |
| `DISCORD_WEBHOOK` | None | If set, unsure and failed results go to Discord |
| `PUBLIC_URL` | None | API address used in Discord links |
| `NOTIFY_ON` | `unsure,error` | Verdicts to notify on |

**For the first few days, we recommend `SCREEN_AUTO_APPROVE=0` and just watching the AI's opinions.**
It's safe to turn on automation once you've confirmed by eye that the verdicts are trustworthy.

## Screening log

Every verdict is stored in the `screening` table. It serves as the baseline for measuring accuracy later
or for comparison when switching models.

```sql
SELECT verdict, COUNT(*) FROM screening GROUP BY verdict;
SELECT AVG(ms) FROM screening;   -- average processing time
```
