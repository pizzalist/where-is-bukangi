import express from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, PHOTOS, photoPath, nextOrdinal } from "./db.js";
import { roll, isRevival } from "./rarity.js";
import { startScreener } from "./screener.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "dist");
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";          // 기본은 루프백만. 터널이 앞에 선다
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const SERVE_STATIC = process.env.SERVE_STATIC !== "0"; // 운영에선 0 (Cloudflare Pages가 담당)
const MAX_PHOTO = 3 * 1024 * 1024;                     // 3MB (앱이 보내는 건 보통 70KB)
const UPLOAD_CONCURRENCY = 8;
const STATUS_TTL = Number(process.env.STATUS_TTL || 5000);

if (!ADMIN_TOKEN) { console.error("ADMIN_TOKEN 환경변수가 필요합니다."); process.exit(1); }
if (ADMIN_TOKEN.length < 24) console.warn("경고: ADMIN_TOKEN이 짧습니다. 32자 이상 무작위 문자열을 쓰세요.");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // Cloudflare 뒤

/* ---------- 보안 헤더 ---------- */
app.use((_req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  next();
});

/* ---------- 레이트 리밋 (IP별 슬라이딩 윈도우) ---------- */
function limiter({ windowMs, max, key = (req) => req.ip }) {
  const hits = new Map();
  setInterval(() => {                      // 메모리 누수 방지
    const cut = Date.now() - windowMs;
    for (const [k, arr] of hits) {
      const kept = arr.filter((t) => t > cut);
      kept.length ? hits.set(k, kept) : hits.delete(k);
    }
  }, windowMs).unref();
  return (req, res, next) => {
    const k = key(req), now = Date.now(), cut = now - windowMs;
    const arr = (hits.get(k) || []).filter((t) => t > cut);
    if (arr.length >= max) return res.status(429).json({ error: "요청이 너무 잦아요. 잠시 뒤 다시 시도해주세요." });
    arr.push(now); hits.set(k, arr); next();
  };
}
const clientIp = (req) => String(req.headers["cf-connecting-ip"] || req.ip || "");

/* ---------- 업로드 동시성 제한 ---------- */
let running = 0; const waiting = [];
function acquire() {
  if (running < UPLOAD_CONCURRENCY) { running++; return Promise.resolve(); }
  if (waiting.length > 200) return Promise.reject(new Error("BUSY"));
  return new Promise((res) => waiting.push(res)).then(() => { running++; });
}
function release() { running--; const n = waiting.shift(); if (n) n(); }

/* ---------- 공개: 사진 ---------- */
app.use("/photos", express.static(PHOTOS, {
  maxAge: "30d", immutable: true, index: false, dotfiles: "deny", fallthrough: false,
}), (err, _req, res, _next) => {
  // 경로 탈출·없는 파일은 404로 통일 (500으로 내부 사정을 흘리지 않는다)
  res.status(err?.status === 404 ? 404 : 404).json({ error: "없는 사진이에요." });
});

/* ---------- 방문 집계 ---------- */
const bumpVisit = db.prepare(`INSERT INTO visits (day, kind, n) VALUES (?,?,1) ON CONFLICT(day,kind) DO UPDATE SET n = n + 1`);
const qVisits = db.prepare(`SELECT kind, n FROM visits WHERE day = ?`);
const qVisitsAll = db.prepare(`SELECT kind, SUM(n) n FROM visits GROUP BY kind`);
const insVisitor = db.prepare(`INSERT OR IGNORE INTO visitors (day, h) VALUES (?,?)`);
const delOldVisitors = db.prepare(`DELETE FROM visitors WHERE day < ?`);
function today() { const d = new Date(Date.now() + 9 * 3600e3); return d.toISOString().slice(0, 10); }
function daysAgo(n) { const d = new Date(Date.now() + 9 * 3600e3 - n * 864e5); return d.toISOString().slice(0, 10); }

// 방문 집계는 DB에 남겨 서버를 재시작해도 순방문자가 어긋나지 않는다.
const countVisitTx = db.transaction((day, h) => {
  bumpVisit.run(day, "view");
  if (insVisitor.run(day, h).changes > 0) bumpVisit.run(day, "uniq");
});
function countVisit(req) {
  const day = today();
  // IP+UA를 그날의 소금과 함께 해시. 원본은 저장하지 않고 7일 뒤 해시도 지운다.
  const h = crypto.createHash("sha256")
    .update(`${day}|${clientIp(req)}|${req.headers["user-agent"] || ""}`)
    .digest("base64url").slice(0, 22);
  countVisitTx(day, h);
}
setInterval(() => { try { delOldVisitors.run(daysAgo(7)); } catch { /* 무시 */ } }, 6 * 3600e3).unref();

/* ---------- 공개: 상황판 (메모리 캐시) ---------- */
const ZONES = [
  { code: "A", name: "제4보도교" }, { code: "B", name: "제5보도교" },
  { code: "C", name: "제6보도교" }, { code: "D", name: "방파제" },
];
const qSubs = db.prepare(`SELECT id, zone, taken_at AS at, photo, ordinal FROM submissions WHERE status='approved' ORDER BY taken_at DESC LIMIT 40`);
const qObs = db.prepare(`SELECT kind, zone, at, note FROM observations ORDER BY at DESC LIMIT 40`);
const qNotices = db.prepare(`SELECT src, title, url, crit FROM notices ORDER BY created_at DESC LIMIT 6`);
const qOrdinal = db.prepare("SELECT v FROM meta WHERE k='ordinal'");
const qSubCount = db.prepare(`SELECT
  COUNT(*) total,
  SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) approved,
  SUM(CASE WHEN substr(submitted_at,1,10) = strftime('%Y-%m-%d','now','+9 hours') THEN 1 ELSE 0 END) today
  FROM submissions`);

function buildStatus() {
  const timeline = [
    ...qSubs.all().map((s) => ({ at: s.at, kind: "seen", zone: s.zone, tier: "confirmed", note: "현장 사진", photo: s.photo ? `/photos/${s.photo}` : null, ordinal: s.ordinal })),
    ...qObs.all().map((o) => ({ at: o.at, kind: o.kind, zone: o.zone, tier: "confirmed", note: o.note })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);

  const lastSeen = timeline.find((e) => e.kind === "seen") || null;
  const head = timeline[0] || null;
  const last = head && lastSeen && head.kind === "miss" && head.at > lastSeen.at ? head : lastSeen;

  const notices = qNotices.all().map((n) => ({ ...n, crit: !!n.crit }));
  const control = notices.find((n) => n.crit) || null;

  const vToday = Object.fromEntries(qVisits.all(today()).map((r) => [r.kind, r.n]));
  const vAll = Object.fromEntries(qVisitsAll.all().map((r) => [r.kind, r.n]));
  const subCount = qSubCount.get();

  return {
    updatedAt: new Date().toISOString(),
    stats: {
      visitsToday: vToday.uniq || 0, viewsToday: vToday.view || 0,
      visitsTotal: vAll.uniq || 0, viewsTotal: vAll.view || 0,
      reportsToday: subCount.today || 0, reportsTotal: subCount.total || 0,
      approvedTotal: subCount.approved || 0,
    },
    control: control ? { title: control.title, url: control.url } : null,
    last, zones: ZONES, timeline, notices,
    counters: { seen: Number(qOrdinal.get()?.v || 1204), visit: 0 },
  };
}
let cache = { at: 0, body: "", etag: "" };
function statusBody() {
  const now = Date.now();
  if (now - cache.at > STATUS_TTL) {
    const body = JSON.stringify(buildStatus());
    cache = { at: now, body, etag: `W/"${crypto.createHash("sha1").update(body).digest("base64url").slice(0, 20)}"` };
  }
  return cache;
}
app.get("/api/status", (req, res) => {
  try { countVisit(req); } catch { /* 집계 실패는 무시 */ }
  const { body, etag } = statusBody();
  res.set("Cache-Control", "public, max-age=10, s-maxage=10, stale-while-revalidate=30");
  res.set("ETag", etag);
  if (req.headers["if-none-match"] === etag) return res.status(304).end();
  res.type("application/json").send(body);
});

/* ---------- 공개: 명예의 전당 ---------- */
const HALL_ORDER = ["gold", "rainbow", "fullart", "galaxy", "reverse", "holo", "rare", "uncommon", "common"];
const qHall = db.prepare(`SELECT id, ordinal, rarity, zone, taken_at AS takenAt, photo FROM submissions WHERE status='approved' AND photo IS NOT NULL`);
let hallCache = { at: 0, body: "" };
app.get("/api/hall", (_req, res) => {
  const now = Date.now();
  if (now - hallCache.at > 30000) {
    const rows = qHall.all();
    rows.sort((a, b) => (HALL_ORDER.indexOf(a.rarity) - HALL_ORDER.indexOf(b.rarity)) || a.ordinal - b.ordinal);
    hallCache = { at: now, body: JSON.stringify(rows.slice(0, 60).map((r) => ({ ...r, photo: `/photos/${r.photo}` }))) };
  }
  res.set("Cache-Control", "public, max-age=30, s-maxage=30");
  res.type("application/json").send(hallCache.body);
});

/* ---------- 제보 ---------- */
const SIG = [
  { ext: "webp", test: (b) => b.length > 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
  { ext: "jpg",  test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png",  test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
];
const qLastSeen = db.prepare(`SELECT taken_at FROM submissions WHERE status='approved' ORDER BY taken_at DESC LIMIT 1`);
const insSub = db.prepare(`INSERT INTO submissions (id, ordinal, rarity, zone, taken_at, submitted_at, status, photo, lat, lng, thumb) VALUES (?,?,?,?,?,?,'pending',?,?,?,?)`);
const ZONE_CODES = new Set(ZONES.map((z) => z.code));

app.post("/api/submissions",
  limiter({ windowMs: 3600e3, max: 10, key: clientIp }),
  limiter({ windowMs: 60e3, max: 3, key: clientIp }),
  express.json({ limit: "5mb" }),
  async (req, res) => {
    try { await acquire(); } catch { return res.status(503).json({ error: "지금 사람이 몰려요. 잠시 뒤 다시 시도해주세요." }); }
    try {
      const { photo, thumb, takenAt, zone, lat, lng } = req.body || {};
      if (typeof photo !== "string" || typeof takenAt !== "string") return res.status(400).json({ error: "사진과 시각이 필요해요." });

      const t = Date.parse(takenAt);
      if (!Number.isFinite(t) || t > Date.now() + 3600e3 || t < Date.now() - 30 * 864e5)
        return res.status(400).json({ error: "촬영 시각이 이상해요." });
      if (zone != null && !ZONE_CODES.has(zone)) return res.status(400).json({ error: "구역이 이상해요." });

      const m = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(photo);
      if (!m) return res.status(400).json({ error: "사진 형식을 읽지 못했어요." });
      if (m[2].length * 0.75 > MAX_PHOTO) return res.status(413).json({ error: "사진이 너무 커요." });

      const buf = Buffer.from(m[2], "base64");
      const sig = SIG.find((s) => s.test(buf));
      if (!sig) return res.status(400).json({ error: "이미지 파일이 아니에요." });   // 확장자 위조 차단

      const id = crypto.randomBytes(9).toString("base64url");                        // 추측 불가 id
      const d = new Date();
      const relDir = path.join(String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0"));
      await fsp.mkdir(path.join(PHOTOS, relDir), { recursive: true });
      const name = path.join(relDir, `${id}.${sig.ext}`);
      await fsp.writeFile(photoPath(name), buf);

      // 심사용 썸네일 (있으면 저장. 없으면 원본으로 심사)
      let thumbName = null;
      const tm = typeof thumb === "string" && /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(thumb);
      if (tm && tm[2].length * 0.75 < 400 * 1024) {
        const tbuf = Buffer.from(tm[2], "base64");
        if (SIG.find((s2) => s2.test(tbuf))) {
          thumbName = path.join(relDir, `${id}.t.${tm[1] === "jpeg" ? "jpg" : tm[1]}`);
          await fsp.writeFile(photoPath(thumbName), tbuf);
        }
      }

      const rarity = roll({ takenAt, revival: isRevival(qLastSeen.get()?.taken_at) });
      const ordinal = nextOrdinal();
      insSub.run(id, ordinal, rarity, zone || null, new Date(t).toISOString(), new Date().toISOString(), name,
        Number.isFinite(lat) ? lat : null, Number.isFinite(lng) ? lng : null, thumbName);

      res.json({ id, ordinal, rarity, photo: `/photos/${name}` });
    } catch (e) {
      console.error("submission 실패:", e.message);
      res.status(500).json({ error: "저장하지 못했어요." });
    } finally { release(); }
  });

const qSub = db.prepare(`SELECT id, ordinal, rarity, zone, taken_at AS takenAt, status, photo FROM submissions WHERE id=?`);
app.get("/api/submissions/:id", limiter({ windowMs: 60e3, max: 60, key: clientIp }), (req, res) => {
  const r = qSub.get(String(req.params.id).slice(0, 32));
  if (!r) return res.status(404).json({ error: "없는 카드예요." });
  res.set("Cache-Control", "public, max-age=30");
  res.json({ ...r, photo: r.photo ? `/photos/${r.photo}` : null });
});

/* ---------- 운영자 ---------- */
const TOKEN_BUF = Buffer.from(`Bearer ${ADMIN_TOKEN}`);
function auth(req, res, next) {
  const got = Buffer.from(req.headers.authorization || "");
  // 길이가 달라도 타이밍이 새지 않게
  const ok = got.length === TOKEN_BUF.length && crypto.timingSafeEqual(got, TOKEN_BUF);
  if (ok) return next();
  res.status(401).json({ error: "운영자만 가능해요." });
}
const adminGuard = [limiter({ windowMs: 15 * 60e3, max: 60, key: clientIp }), auth, express.json({ limit: "64kb" })];

const qQueue = db.prepare(`
  SELECT s.id, s.ordinal, s.rarity, s.zone, s.taken_at AS takenAt, s.submitted_at AS submittedAt, s.photo, s.lat, s.lng,
         c.verdict AS aiVerdict, c.shark AS aiShark, c.person AS aiPerson, c.confidence AS aiConf, c.reason AS aiReason
  FROM submissions s LEFT JOIN screening c ON c.id = s.id
  WHERE s.status='pending' ORDER BY s.submitted_at DESC LIMIT 100`);
app.get("/api/admin/queue", limiter({ windowMs: 15 * 60e3, max: 120, key: clientIp }), auth, (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(qQueue.all().map((r) => ({ ...r, photo: r.photo ? `/photos/${r.photo}` : null })));
});

const updSub = db.prepare(`UPDATE submissions SET status=?, zone=COALESCE(?, zone) WHERE id=?`);
app.post("/api/admin/:id/:action", adminGuard, (req, res) => {
  const { id, action } = req.params;
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "알 수 없는 동작" });
  const zone = req.body?.zone;
  if (zone != null && zone !== "" && !ZONE_CODES.has(zone)) return res.status(400).json({ error: "구역이 이상해요." });
  const r = updSub.run(action === "approve" ? "approved" : "rejected", zone || null, String(id).slice(0, 32));
  cache.at = 0; hallCache.at = 0;                        // 캐시 즉시 무효화
  res.json({ ok: r.changes > 0 });
});

const insObs = db.prepare(`INSERT INTO observations (kind, zone, at, note, created_at) VALUES (?,?,?,?,?)`);
app.post("/api/admin/observation", adminGuard, (req, res) => {
  const { kind, zone, at, note } = req.body || {};
  if (!["seen", "miss"].includes(kind)) return res.status(400).json({ error: "kind는 seen 또는 miss" });
  if (zone != null && zone !== "" && !ZONE_CODES.has(zone)) return res.status(400).json({ error: "구역이 이상해요." });
  insObs.run(kind, zone || null, at ? new Date(at).toISOString() : new Date().toISOString(), String(note || "").slice(0, 200), new Date().toISOString());
  cache.at = 0;
  res.json({ ok: true });
});

const insNotice = db.prepare(`INSERT INTO notices (src, title, url, crit, created_at) VALUES (?,?,?,?,?)`);
app.post("/api/admin/notice", adminGuard, (req, res) => {
  const { src, title, url, crit } = req.body || {};
  if (!src || !title) return res.status(400).json({ error: "src와 title 필요" });
  if (url && !/^https?:\/\//.test(url)) return res.status(400).json({ error: "url 형식이 아니에요." });
  insNotice.run(String(src).slice(0, 60), String(title).slice(0, 200), url || null, crit ? 1 : 0, new Date().toISOString());
  cache.at = 0;
  res.json({ ok: true });
});

/* ---------- 상태 점검 ---------- */
app.get("/healthz", (_req, res) => res.json({ ok: true, uploads: running, queued: waiting.length }));

/* ---------- 정적 (개발용) ---------- */
if (SERVE_STATIC && fs.existsSync(DIST)) {
  app.use(express.static(DIST, { maxAge: "1h", index: "index.html" }));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(DIST, "index.html")));
} else {
  app.use((_req, res) => res.status(404).json({ error: "not found" }));
}

app.use((err, _req, res, _next) => {
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "요청이 너무 커요." });
  console.error("에러:", err?.message);
  res.status(500).json({ error: "서버 오류" });
});

startScreener(() => { cache.at = 0; hallCache.at = 0; });

const server = app.listen(PORT, HOST, () =>
  console.log(`부캉이 서버 http://${HOST}:${PORT}  데이터=${PHOTOS}  정적서빙=${SERVE_STATIC ? "on" : "off"}`));
server.headersTimeout = 20000;
server.requestTimeout = 30000;
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { server.close(() => process.exit(0)); });
