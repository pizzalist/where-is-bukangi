import express from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, PHOTOS, photoPath, nextOrdinal } from "./db.js";
import { roll, isRevival } from "./rarity.js";
import { startScreener } from "./screener.js";
import { verify as verifyAction, enabled as notifyEnabled, notifyText } from "./notify.js";
import { cardPng, cardKey, cardStats, CARD_SIZE } from "./cards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "dist");
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";          // 기본은 루프백만. 터널이 앞에 선다
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const SERVE_STATIC = process.env.SERVE_STATIC !== "0"; // 운영에선 0 (Cloudflare Pages가 담당)
const MAX_PHOTO = 3 * 1024 * 1024;                     // 3MB (앱이 보내는 건 보통 70KB)
const UPLOAD_CONCURRENCY = 8;
const STATUS_TTL = Number(process.env.STATUS_TTL || 5000);
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");      // API의 바깥 주소. 있으면 사진을 절대주소로 준다
const SITE_ORIGINS = new Set([process.env.SITE_URL, ...(process.env.ALLOWED_ORIGINS || "").split(",")]
  .map((v) => (v || "").trim().replace(/\/$/, "")).filter(Boolean));       // 제보·운영자 API를 부를 수 있는 화면 주소
const photoUrl = (name) => (name ? `${PUBLIC_URL}/photos/${name}` : null);

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
    // 현장 탭이 위치를 쓴다. 우리 페이지에서만 허용하고 나머지는 계속 차단
    "Permissions-Policy": "geolocation=(self), microphone=(), camera=()",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  next();
});

/* ---------- CORS (화면이 Pages 같은 다른 주소에 있을 때) ----------
   공개 읽기(/api/status, /api/hall, /api/submissions/:id, /photos)는 누구나.
   제보·운영자 API는 SITE_URL(+ALLOWED_ORIGINS)에서 온 화면만. 쿠키를 안 쓰니 토큰 탈취 경로는 없다 */
const PUBLIC_READ = /^\/(api\/(status|hall)|api\/submissions\/[^/]+|api\/cards\/[^/]+|photos\/)/;
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next();                                   // 같은 주소에서 온 요청은 CORS 무관
  if (PUBLIC_READ.test(req.path) && req.method === "GET") res.set("Access-Control-Allow-Origin", "*");
  else if (SITE_ORIGINS.has(origin)) res.set({ "Access-Control-Allow-Origin": origin, "Vary": "Origin" });
  else if (req.method === "OPTIONS") return res.status(403).end();
  if (req.method === "OPTIONS") {
    res.set({ "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" });
    return res.status(204).end();
  }
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
const insVisitorHour = db.prepare(`INSERT OR IGNORE INTO visitors_hourly (hour, h) VALUES (?,?)`);
const delOldVisitorsHour = db.prepare(`DELETE FROM visitors_hourly WHERE hour < ?`);
const delOldVisitors = db.prepare(`DELETE FROM visitors WHERE day < ?`);
function today() { const d = new Date(Date.now() + 9 * 3600e3); return d.toISOString().slice(0, 10); }
/** 한국 시간 기준 시간 키. 기본은 지금 */
function hourKey(at) { return new Date((at ? new Date(at).getTime() : Date.now()) + 9 * 3600e3).toISOString().slice(0, 13); }
const bumpHour = db.prepare(`INSERT INTO stats_hourly (hour, kind, n) VALUES (?,?,1) ON CONFLICT(hour,kind) DO UPDATE SET n = n + 1`);
const bumpSource = db.prepare(`INSERT INTO sources (day, src, n) VALUES (?,?,1) ON CONFLICT(day,src) DO UPDATE SET n = n + 1`);
const bumpRoute = db.prepare(`INSERT INTO routes (day, route, n) VALUES (?,?,1) ON CONFLICT(day,route) DO UPDATE SET n = n + 1`);
/** 참조 주소를 출처 종류로만 분류한다. 전체 주소나 검색어는 저장하지 않는다 */
function classifySource(ref, ua) {
  const h = (() => { try { return new URL(String(ref)).hostname.toLowerCase(); } catch { return ""; } })();
  const u = String(ua || "").toLowerCase();
  if (/threads/.test(h) || /threads/.test(u)) return "threads";
  if (/instagram/.test(h) || /instagram/.test(u)) return "instagram";
  if (/kakao|daum/.test(h) || /kakaotalk/.test(u)) return "kakao";
  if (/facebook|fb\.com/.test(h) || /fban|fbav/.test(u)) return "facebook";
  if (/naver/.test(h) || /naver/.test(u)) return "naver";
  if (/google/.test(h)) return "google";
  if (/youtube|youtu\.be/.test(h)) return "youtube";
  if (/^(t\.co|x\.com|twitter)/.test(h)) return "twitter";
  if (/bukangi\.com$/.test(h)) return "internal";
  if (h) return "other";
  return "direct";                                  // 주소 직접 입력, QR, 메모 앱 등
}
const ROUTES = new Set(["home", "certify", "card", "hall", "tiers", "admin", "shot"]);
/** 클라이언트가 보낼 수 있는 이벤트만 허용. 아무 이름이나 받지 않는다 */
const EVENTS = new Set(["share", "save", "geo_fail", "card_view"]);
/** 집계는 부가 기능이라 실패해도 본 동작을 막지 않는다 */
function tally(kind, at) { try { bumpHour.run(hourKey(at), kind); } catch { /* 무시 */ } }
function daysAgo(n) { const d = new Date(Date.now() + 9 * 3600e3 - n * 864e5); return d.toISOString().slice(0, 10); }

// 방문 집계는 DB에 남겨 서버를 재시작해도 순방문자가 어긋나지 않는다.
const countVisitTx = db.transaction((day, h, hr) => {
  bumpVisit.run(day, "view"); bumpHour.run(hr, "view");
  if (insVisitor.run(day, h).changes > 0) bumpVisit.run(day, "uniq");          // 하루 기준 순방문
  if (insVisitorHour.run(hr, h).changes > 0) bumpHour.run(hr, "uniq");         // 시간 기준 순방문 (그래프용)
});
function countVisit(req) {
  const day = today();
  // IP+UA를 그날의 소금과 함께 해시. 원본은 저장하지 않고 7일 뒤 해시도 지운다.
  const h = crypto.createHash("sha256")
    .update(`${day}|${clientIp(req)}|${req.headers["user-agent"] || ""}`)
    .digest("base64url").slice(0, 22);
  countVisitTx(day, h, hourKey());
}
setInterval(() => { try { delOldVisitors.run(daysAgo(7)); delOldVisitorsHour.run(hourKey(Date.now() - 8 * 864e5)); } catch { /* 무시 */ } }, 6 * 3600e3).unref();

/* ---------- 공개: 상황판 (메모리 캐시) ---------- */
const ZONES = [
  { code: "A", name: "제4보도교" }, { code: "B", name: "제5보도교" },
  { code: "C", name: "제6보도교" }, { code: "D", name: "방파제" },
];
/* 현장 탭 설정. 탭 하나는 약한 신호라, 모아서 보여주고 금방 사라지게 한다 */
const PARK = { lat: 35.1144, lng: 129.0464, radius: Number(process.env.PARK_RADIUS || 700) };   // 공원 좌표 (src/lib/zones.ts와 같은 값). 반경은 환경변수로 즉시 조정 가능
const LIVE_MIN = Number(process.env.LIVE_MIN || 15);         // 이 시간 안의 탭만 "지금"으로 친다
const PING_COOLDOWN_MIN = Number(process.env.PING_COOLDOWN_MIN || 10);   // 같은 기기 재탭 간격
const MAX_ACC = 1500;    // 기지국 기반 위치는 오차가 크다. 이만큼까지만 봐준다
const distToPark = (lat, lng) => Math.hypot((PARK.lat - lat) * 111000, (PARK.lng - lng) * 91000);
/** 오차 반경을 감안해 판정. 인앱 브라우저는 GPS 대신 기지국 위치가 오는 경우가 많다 */
const inPark = (lat, lng, acc = 0) => distToPark(lat, lng) <= PARK.radius + Math.min(Math.max(acc, 0), MAX_ACC);
const qSubs = db.prepare(`SELECT id, zone, taken_at AS at, photo, thumb, ordinal FROM submissions WHERE status='approved' ORDER BY taken_at DESC LIMIT 40`);
const qObs = db.prepare(`SELECT kind, zone, at, note FROM observations ORDER BY at DESC LIMIT 40`);
const qNotices = db.prepare(`SELECT src, title, url, crit FROM notices ORDER BY created_at DESC LIMIT 6`);
const qOrdinal = db.prepare("SELECT v FROM meta WHERE k='ordinal'");
const qLivePings = db.prepare(`SELECT kind, zone, at, h FROM pings WHERE at > ? GROUP BY h, kind ORDER BY at DESC`);
const qRecentPing = db.prepare(`SELECT 1 FROM pings WHERE h = ? AND at > ? LIMIT 1`);
const insPing = db.prepare(`INSERT INTO pings (at, kind, zone, h, created_at) VALUES (?,?,?,?,?)`);
const delOldPings = db.prepare(`DELETE FROM pings WHERE at < ?`);
setInterval(() => { try { delOldPings.run(new Date(Date.now() - 6 * 3600e3).toISOString()); } catch { /* 무시 */ } }, 3600e3).unref();
const qSubCount = db.prepare(`SELECT
  COUNT(*) total,
  SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) approved,
  SUM(CASE WHEN substr(submitted_at,1,10) = strftime('%Y-%m-%d','now','+9 hours') THEN 1 ELSE 0 END) today
  FROM submissions`);

function buildStatus() {
  const timeline = [
    ...qSubs.all().map((s) => ({ at: s.at, kind: "seen", zone: s.zone, tier: "confirmed", note: "현장 사진", photo: photoUrl(s.thumb || s.photo), ordinal: s.ordinal })),
    ...qObs.all().map((o) => ({ at: o.at, kind: o.kind, zone: o.zone, tier: "confirmed", note: o.note })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);

  const lastSeen = timeline.find((e) => e.kind === "seen") || null;
  const head = timeline[0] || null;
  const last = head && lastSeen && head.kind === "miss" && head.at > lastSeen.at ? head : lastSeen;

  const notices = qNotices.all().map((n) => ({ ...n, crit: !!n.crit }));
  const control = notices.find((n) => n.crit) || null;

  // 현장 탭 집계. 사람 수는 기기 해시 기준 중복 제거
  const cut = new Date(Date.now() - LIVE_MIN * 60e3).toISOString();
  const pg = qLivePings.all(cut);
  const live = pg.length
    ? { seen: pg.filter((p) => p.kind === "seen").length, miss: pg.filter((p) => p.kind === "miss").length,
        at: pg[0].at, zone: pg.find((p) => p.kind === "seen" && p.zone)?.zone ?? null, windowMin: LIVE_MIN }
    : null;

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
    live,
    last, zones: ZONES, timeline, notices,
    counters: { seen: Number(qOrdinal.get()?.v || 0), visit: 0 },
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
/* 방문 집계. 앱이 페이지를 "실제로 열 때" 한 번만 POST한다. 30초 상황 폴링과는 분리.
   헤드리스 브라우저(카드 렌더러·테스트)와 봇은 세지 않는다 */
app.post("/api/visit", limiter({ windowMs: 60e3, max: 30, key: clientIp }), express.json({ limit: "1kb" }), (req, res) => {
  const ua = String(req.headers["user-agent"] || "");
  if (/HeadlessChrome|bot|crawler|spider|Playwright/i.test(ua)) return res.status(204).end();
  try {
    countVisit(req);
    const day = today();
    bumpSource.run(day, classifySource(req.body?.ref || req.headers.referer, ua));
    const r = String(req.body?.route || "home");
    bumpRoute.run(day, ROUTES.has(r) ? r : "other");
  } catch { /* 집계 실패는 무시 */ }
  res.status(204).end();
});

/* 화면에서 일어난 행동. 공유·저장·위치 실패처럼 서버가 알 수 없는 것만 받는다 */
app.post("/api/event", limiter({ windowMs: 60e3, max: 60, key: clientIp }), express.json({ limit: "1kb" }), (req, res) => {
  const ua = String(req.headers["user-agent"] || "");
  if (/HeadlessChrome|bot|crawler|spider|Playwright/i.test(ua)) return res.status(204).end();
  const name = String(req.body?.name || "");
  if (EVENTS.has(name)) tally(name);
  res.status(204).end();
});

/* 현장 탭. 공원 안에서만, 같은 기기는 PING_COOLDOWN_MIN분에 한 번.
   사진 제보와 달리 카드도 안 나오고 타임라인에도 안 들어간다. "지금" 한 줄만 바꾼다 */
app.post("/api/ping", limiter({ windowMs: 10 * 60e3, max: 12, key: clientIp }), express.json({ limit: "2kb" }), (req, res) => {
  const { kind, zone, lat, lng, acc } = req.body || {};
  if (!["seen", "miss"].includes(kind)) return res.status(400).json({ error: "kind는 seen 또는 miss" });
  if (zone != null && zone !== "" && !ZONE_CODES.has(zone)) return res.status(400).json({ error: "구역이 이상해요." });
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: "위치를 확인할 수 없어요." });
  if (!inPark(lat, lng, Number(acc) || 0)) {
    // 반경이 실제로 걸림돌인지 보려면 거절 기록이 있어야 한다. 좌표는 남기지 않고 거리만
    console.log(`[탭] 반경 밖 거절 ${Math.round(distToPark(lat, lng))}m (오차 ${Math.round(Number(acc) || 0)}m, 기준 ${PARK.radius}m)`);
    tally("ping_far");
    return res.status(403).json({ error: "공원 근처에서만 누를 수 있어요." });
  }

  const h = crypto.createHash("sha256").update(`ping|${clientIp(req)}|${req.headers["user-agent"] || ""}`).digest("base64url").slice(0, 22);
  const since = new Date(Date.now() - PING_COOLDOWN_MIN * 60e3).toISOString();
  if (qRecentPing.get(h, since)) return res.status(429).json({ error: `${PING_COOLDOWN_MIN}분에 한 번만 누를 수 있어요.` });

  const now = new Date().toISOString();
  insPing.run(now, kind, zone || null, h, now);
  tally(kind === "seen" ? "ping_seen" : "ping_miss");
  cache.at = 0;                                    // 상황판 즉시 갱신
  res.json({ ok: true });
});

app.get("/api/status", (req, res) => {
  const { body, etag } = statusBody();
  res.set("Cache-Control", "public, max-age=10, s-maxage=10, stale-while-revalidate=30");
  res.set("ETag", etag);
  if (req.headers["if-none-match"] === etag) return res.status(304).end();
  res.type("application/json").send(body);
});

/* ---------- 공개: 명예의 전당 ---------- */
const HALL_ORDER = ["gold", "rainbow", "fullart", "galaxy", "reverse", "holo", "rare", "uncommon", "common"];
const qHall = db.prepare(`SELECT id, ordinal, rarity, zone, taken_at AS takenAt, photo, thumb FROM submissions WHERE status='approved' AND photo IS NOT NULL`);
let hallCache = { at: 0, body: "" };
app.get("/api/hall", (_req, res) => {
  const now = Date.now();
  if (now - hallCache.at > 30000) {
    const rows = qHall.all();
    rows.sort((a, b) => (HALL_ORDER.indexOf(a.rarity) - HALL_ORDER.indexOf(b.rarity)) || a.ordinal - b.ordinal);
    // 목록은 썸네일, 원본은 카드 상세(/api/submissions/:id)에서만
    hallCache = { at: now, body: JSON.stringify(rows.slice(0, 60).map(({ thumb, ...r }) => ({ ...r, photo: photoUrl(thumb || r.photo) }))) };
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
      tally("report");
      insSub.run(id, ordinal, rarity, zone || null, new Date(t).toISOString(), new Date().toISOString(), name,
        Number.isFinite(lat) ? lat : null, Number.isFinite(lng) ? lng : null, thumbName);

      res.json({ id, ordinal, rarity, photo: photoUrl(name) });
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
  res.json({ ...r, photo: photoUrl(r.photo) });
});

/* ---------- 카드 PNG (저장·공유용). 화면의 홀로 카드를 서버가 그대로 찍는다 ---------- */
const qCardRow = db.prepare(`SELECT id, ordinal, rarity, zone, taken_at, photo FROM submissions WHERE id=?`);
const ZONE_NAME = Object.fromEntries(ZONES.map((z) => [z.code, z.name]));
app.get(/^\/api\/cards\/([A-Za-z0-9_-]{6,32})\.(png|jpg)$/, limiter({ windowMs: 15 * 60e3, max: 120, key: clientIp }), async (req, res) => {
  const fmt = req.params[1];
  const r = qCardRow.get(req.params[0]);
  if (!r) return res.status(404).json({ error: "없는 카드예요." });
  if (!SERVE_STATIC) return res.status(503).json({ error: "이 서버는 카드 이미지를 만들 수 없어요 (SERVE_STATIC=0)." });
  try {
    const file = await cardPng(r, r.zone ? ZONE_NAME[r.zone] || "" : "", `http://127.0.0.1:${PORT}`, fmt);
    res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
    res.set("ETag", `"${cardKey(r, fmt)}"`);
    res.type(fmt === "jpg" ? "jpeg" : "png").sendFile(file);
  } catch (e) {
    if (e.message === "BUSY") return res.status(503).json({ error: "지금 카드를 만드는 요청이 많아요. 잠시 뒤 다시 눌러주세요." });
    console.error("[카드] 실패:", e.message);
    res.status(500).json({ error: "카드 이미지를 만들지 못했어요. 잠시 뒤 다시 눌러주세요." });
  }
});

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** 공개되면 링크 미리보기 이미지를 미리 구워둔다. 카톡·스레드 크롤러가 찬 상태로 기다리면 미리보기를 포기한다 */
function warmCard(id) {
  if (!SERVE_STATIC) return;
  const r = qCardRow.get(id);
  if (!r) return;
  cardPng(r, r.zone ? ZONE_NAME[r.zone] || "" : "", `http://127.0.0.1:${PORT}`, "jpg")
    .then(() => console.log(`[카드] 미리보기 예열 ${id}`))
    .catch((e) => console.warn("[카드] 예열 실패:", e.message));
}

/* ---------- 카드 공유 링크 /c/:id ----------
   카톡·스레드 봇이 읽는 OG 태그(이 카드 이미지)를 주고, 사람은 바로 앱의 카드 화면으로 보낸다.
   이동은 반드시 자바스크립트로만. <meta http-equiv="refresh">를 쓰면 메타(스레드·페북) 크롤러가
   그걸 따라가서 앱 첫 화면의 OG(사이트 공용 이미지)를 읽어버린다. 봇은 JS를 안 돌리니 카드 OG가 남는다. */
const RARITY_LABEL = { common: "커먼", uncommon: "언커먼", rare: "레어", holo: "홀로", reverse: "리버스 홀로", galaxy: "갤럭시", fullart: "풀아트", rainbow: "레인보우", gold: "시크릿 골드" };
const SITE_URL = (process.env.SITE_URL || "").replace(/\/$/, "");
app.get(/^\/c\/([A-Za-z0-9_-]{6,32})$/, limiter({ windowMs: 15 * 60e3, max: 120, key: clientIp }), (req, res) => {
  const r = qCardRow.get(req.params[0]);
  const site = SITE_URL || `${req.protocol}://${req.get("host")}`;
  if (!r) return res.redirect(302, `${site}/#/`);
  const when = new Date(r.taken_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const title = `부캉이 인증 카드 No.${Number(r.ordinal).toLocaleString()}`;
  const desc = `${when} ${r.zone ? ZONE_NAME[r.zone] || "" : "부산 북항 친수공원"} · ${RARITY_LABEL[r.rarity] || r.rarity}`;
  const img = `${PUBLIC_URL || site}/api/cards/${r.id}.jpg`;   // 미리보기는 가벼운 쪽
  const app = `${site}/#/card/${r.id}`;
  if (!/bot|crawler|spider|facebookexternalhit|kakaotalk-scrap|Twitterbot|Slackbot|meta-externalagent/i.test(String(req.headers["user-agent"] || ""))) {
    tally("card_view"); try { bumpSource.run(today(), "card_link"); } catch { /* 무시 */ }
  }
  res.set("Cache-Control", "public, max-age=60, s-maxage=300");
  res.type("html").send(`<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta property="og:type" content="website"><meta property="og:site_name" content="부캉이 지금 있나">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(site)}/c/${esc(r.id)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="${CARD_SIZE.jpg.w}"><meta property="og:image:height" content="${CARD_SIZE.jpg.h}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(img)}">
<script>location.replace(${JSON.stringify(app)})</script>
</head><body style="font-family:-apple-system,system-ui,sans-serif;padding:32px;text-align:center"><p style="color:#567">카드를 여는 중…</p><a href="${esc(app)}" style="display:inline-block;padding:14px 26px;background:#0b5c8a;color:#fff;border-radius:12px;text-decoration:none;font-weight:700">${esc(title)} 보기</a></body></html>`);
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
  res.json(qQueue.all().map((r) => ({ ...r, photo: photoUrl(r.photo) })));
});

const updSub = db.prepare(`UPDATE submissions SET status=?, zone=COALESCE(?, zone) WHERE id=?`);
app.post("/api/admin/:id/:action", adminGuard, (req, res) => {
  const { id, action } = req.params;
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "알 수 없는 동작" });
  const zone = req.body?.zone;
  if (zone != null && zone !== "" && !ZONE_CODES.has(zone)) return res.status(400).json({ error: "구역이 이상해요." });
  const r = updSub.run(action === "approve" ? "approved" : "rejected", zone || null, String(id).slice(0, 32));
  cache.at = 0; hallCache.at = 0;                        // 캐시 즉시 무효화
  if (action === "approve") { tally("card"); warmCard(String(id).slice(0, 32)); }
  res.json({ ok: r.changes > 0 });
});

/* 시간대별 통계. 기본 24시간, 최대 7일 */
const qHourly = db.prepare(`SELECT hour, kind, n FROM stats_hourly WHERE hour >= ? ORDER BY hour`);
app.get("/api/admin/hourly", limiter({ windowMs: 15 * 60e3, max: 120, key: clientIp }), auth, (req, res) => {
  const hours = Math.min(Math.max(Number(req.query.hours) || 24, 6), 24 * 7);
  const from = hourKey(Date.now() - (hours - 1) * 3600e3);
  const rows = qHourly.all(from);
  const by = {};
  for (const r of rows) (by[r.hour] ||= {})[r.kind] = r.n;
  const out = [];
  for (let i = hours - 1; i >= 0; i--) {
    const h = hourKey(Date.now() - i * 3600e3);
    out.push({ hour: h, ...{ view: 0, uniq: 0, report: 0, ping_seen: 0, ping_miss: 0, ping_far: 0, card: 0, share: 0, save: 0, card_view: 0, geo_fail: 0 }, ...(by[h] || {}) });
  }
  res.set("Cache-Control", "no-store");
  res.json({ rows: out, since: (db.prepare("SELECT MIN(hour) m FROM stats_hourly WHERE kind='view'").get() || {}).m || null });
});

/* 유입 경로·화면별 (날짜 단위) */
const qSources = db.prepare(`SELECT src, SUM(n) n FROM sources WHERE day >= ? GROUP BY src ORDER BY n DESC`);
const qRoutes = db.prepare(`SELECT route, SUM(n) n FROM routes WHERE day >= ? GROUP BY route ORDER BY n DESC`);
app.get("/api/admin/breakdown", limiter({ windowMs: 15 * 60e3, max: 120, key: clientIp }), auth, (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 1, 1), 30);
  const from = daysAgo(days - 1);
  res.set("Cache-Control", "no-store");
  res.json({ from, sources: qSources.all(from), routes: qRoutes.all(from) });
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

/* ---------- 디스코드 서명 링크로 공개/반려 ----------
   GET  /r/:id/:action/:sig → 확인 화면 (링크 미리보기 봇이 열어도 아무 일 없음)
   POST /r/:id/:action/:sig → 실제 처리. pending일 때만 통한다 */
const qPendingOne = db.prepare(`SELECT id, ordinal, zone, photo, thumb, status FROM submissions WHERE id=?`);
function actionPage(title, body) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;background:#f4f6f8;margin:0;padding:24px;color:#111}
.box{max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,.08)}
img{width:100%;border-radius:12px;display:block;margin:12px 0}h1{font-size:1.2rem;margin:0 0 6px}p{color:#555;margin:6px 0}
button{width:100%;padding:14px;border:0;border-radius:12px;font-size:1.05rem;font-weight:700;color:#fff;margin-top:12px}
.ok{background:#1a7f37}.no{background:#b42318}.muted{color:#888;font-size:.9rem}</style>
<div class="box">${body}</div>`;
}
const actionLimiter = limiter({ windowMs: 15 * 60e3, max: 60, key: clientIp });
app.get("/r/:id/:action/:sig", actionLimiter, (req, res) => {
  const { id, action, sig } = req.params;
  res.set("Cache-Control", "no-store");
  if (!["approve", "reject"].includes(action) || !verifyAction(id, action, sig)) return res.status(404).send(actionPage("없는 링크", "<h1>없는 링크예요</h1>"));
  const r = qPendingOne.get(String(id).slice(0, 32));
  if (!r) return res.status(404).send(actionPage("없는 제보", "<h1>없는 제보예요</h1>"));
  if (r.status !== "pending") return res.send(actionPage("이미 처리됨", `<h1>이미 처리된 제보예요</h1><p>현재 상태: ${esc(r.status === "approved" ? "공개" : "반려")}</p>`));
  const img = r.thumb || r.photo;
  res.send(actionPage(`No.${r.ordinal} ${action === "approve" ? "공개" : "반려"}`,
    `<h1>No.${esc(r.ordinal)} · ${r.zone ? esc(r.zone) + " 구역" : "구역 없음"}</h1>
     ${img ? `<img src="/photos/${esc(img)}" alt="">` : ""}
     <form method="post"><button class="${action === "approve" ? "ok" : "no"}">${action === "approve" ? "✅ 공개할게요" : "❌ 반려할게요"}</button></form>
     <p class="muted">이 링크는 이 제보가 대기 중일 때만 동작해요.</p>`));
});
app.post("/r/:id/:action/:sig", actionLimiter, (req, res) => {
  const { id, action, sig } = req.params;
  res.set("Cache-Control", "no-store");
  if (!["approve", "reject"].includes(action) || !verifyAction(id, action, sig)) return res.status(404).send(actionPage("없는 링크", "<h1>없는 링크예요</h1>"));
  const r = qPendingOne.get(String(id).slice(0, 32));
  if (!r) return res.status(404).send(actionPage("없는 제보", "<h1>없는 제보예요</h1>"));
  if (r.status !== "pending") return res.send(actionPage("이미 처리됨", `<h1>이미 처리된 제보예요</h1><p>현재 상태: ${esc(r.status === "approved" ? "공개" : "반려")}</p>`));
  const u = db.prepare(`UPDATE submissions SET status=? WHERE id=? AND status='pending'`).run(action === "approve" ? "approved" : "rejected", r.id);
  cache.at = 0; hallCache.at = 0;
  res.send(actionPage("완료", `<h1>${action === "approve" ? "공개했어요 ✅" : "반려했어요 ❌"}</h1><p>No.${esc(r.ordinal)}${u.changes ? "" : " (이미 처리돼 있었어요)"}</p>`));
});

/* ---------- 상태 점검 ---------- */
app.get("/healthz", (_req, res) => res.json({ ok: true, uploads: running, queued: waiting.length, cards: cardStats() }));

/* ---------- 정적 (개발용) ---------- */
if (SERVE_STATIC && fs.existsSync(DIST)) {
  // index.html과 version.json은 캐시하지 않는다. admin.bukangi.com이 검수본이라 즉시 반영돼야 한다.
  // 자산은 파일명에 해시가 있어 오래 캐시해도 안전하다.
  app.use(express.static(DIST, {
    index: "index.html",
    setHeaders: (res, p) => res.set("Cache-Control", /index\.html$|version\.json$/.test(p) ? "no-store" : "public, max-age=604800, immutable"),
  }));
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
