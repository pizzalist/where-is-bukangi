import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, PHOTOS, photoPath, nextOrdinal } from "./db.js";
import { roll, isRevival } from "./rarity.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "dist");
const PORT = Number(process.env.PORT || 8787);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "bukang-dev";
const DECAY_MIN = 120;

const app = express();
app.use(express.json({ limit: "12mb" }));

/* ---------- 공개: 사진 ---------- */
app.use("/photos", express.static(PHOTOS, { maxAge: "7d", immutable: true }));

/* ---------- 공개: 상황판 ---------- */
function buildStatus() {
  const zones = [
    { code: "A", name: "제4보도교" }, { code: "B", name: "제5보도교" },
    { code: "C", name: "제6보도교" }, { code: "D", name: "방파제" },
  ];
  // 타임라인: 승인된 제보 + 운영자 관측
  const subs = db.prepare(`
    SELECT id, zone, taken_at AS at, photo, rarity, ordinal FROM submissions
    WHERE status='approved' ORDER BY taken_at DESC LIMIT 40`).all();
  const obs = db.prepare(`SELECT kind, zone, at, note FROM observations ORDER BY at DESC LIMIT 40`).all();

  const timeline = [
    ...subs.map((s) => ({ at: s.at, kind: "seen", zone: s.zone, tier: "confirmed", note: "현장 사진", photo: s.photo ? `/photos/${s.photo}` : null, ordinal: s.ordinal })),
    ...obs.map((o) => ({ at: o.at, kind: o.kind, zone: o.zone, tier: "confirmed", note: o.note })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);

  const lastSeen = timeline.find((e) => e.kind === "seen") || null;
  const lastAny = timeline[0] || null;
  const last = lastSeen && lastAny && lastAny.kind === "miss" && lastAny.at > lastSeen.at ? lastAny : lastSeen;

  const notices = db.prepare(`SELECT src, title, url, crit FROM notices ORDER BY created_at DESC LIMIT 6`).all()
    .map((n) => ({ ...n, crit: !!n.crit }));
  const control = notices.find((n) => n.crit) || null;

  const counters = { seen: Number(db.prepare("SELECT v FROM meta WHERE k='ordinal'").get()?.v || 1204), visit: 0 };

  return { updatedAt: new Date().toISOString(), control: control ? { title: control.title, url: control.url } : null, last, counters, zones, timeline, notices };
}
app.get("/api/status", (_req, res) => { res.set("Cache-Control", "public, max-age=15"); res.json(buildStatus()); });

/* ---------- 공개: 명예의 전당 ---------- */
app.get("/api/hall", (_req, res) => {
  const order = ["gold", "rainbow", "fullart", "galaxy", "reverse", "holo", "rare", "uncommon", "common"];
  const rows = db.prepare(`SELECT id, ordinal, rarity, zone, taken_at AS takenAt, photo FROM submissions WHERE status='approved' AND photo IS NOT NULL`).all();
  rows.sort((a, b) => (order.indexOf(a.rarity) - order.indexOf(b.rarity)) || a.ordinal - b.ordinal);
  res.set("Cache-Control", "public, max-age=60");
  res.json(rows.slice(0, 60).map((r) => ({ ...r, photo: `/photos/${r.photo}` })));
});

/* ---------- 제보 ---------- */
const RATE = new Map();
app.post("/api/submissions", (req, res) => {
  const ip = req.headers["cf-connecting-ip"] || req.ip;
  const now = Date.now();
  const hits = (RATE.get(ip) || []).filter((t) => now - t < 3600e3);
  if (hits.length >= 10) return res.status(429).json({ error: "너무 잦은 요청이에요. 잠시 뒤 다시 시도해주세요." });
  RATE.set(ip, [...hits, now]);

  const { photo, takenAt, zone, lat, lng } = req.body || {};
  if (!photo || !takenAt) return res.status(400).json({ error: "사진과 시각이 필요해요." });
  const m = /^data:image\/(webp|jpeg|png);base64,(.+)$/.exec(photo);
  if (!m) return res.status(400).json({ error: "사진 형식을 읽지 못했어요." });
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 6 * 1024 * 1024) return res.status(413).json({ error: "사진이 너무 커요." });

  const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const d = new Date();
  const dir = path.join(PHOTOS, `${d.getFullYear()}`, String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0"));
  fs.mkdirSync(dir, { recursive: true });
  const name = path.join(path.relative(PHOTOS, dir), `${id}.${m[1] === "jpeg" ? "jpg" : m[1]}`);
  fs.writeFileSync(photoPath(name), buf);

  const lastSeen = db.prepare(`SELECT taken_at FROM submissions WHERE status='approved' ORDER BY taken_at DESC LIMIT 1`).get()?.taken_at;
  const rarity = roll({ takenAt, revival: isRevival(lastSeen) });
  const ordinal = nextOrdinal();

  db.prepare(`INSERT INTO submissions (id, ordinal, rarity, zone, taken_at, submitted_at, status, photo, lat, lng)
    VALUES (?,?,?,?,?,?,'pending',?,?,?)`)
    .run(id, ordinal, rarity, zone || null, takenAt, new Date().toISOString(), name, lat ?? null, lng ?? null);

  res.json({ id, ordinal, rarity, photo: `/photos/${name}` });
});

app.get("/api/submissions/:id", (req, res) => {
  const r = db.prepare(`SELECT id, ordinal, rarity, zone, taken_at AS takenAt, status, photo FROM submissions WHERE id=?`).get(req.params.id);
  if (!r) return res.status(404).json({ error: "없는 카드예요." });
  res.json({ ...r, photo: r.photo ? `/photos/${r.photo}` : null });
});

/* ---------- 운영자 ---------- */
function auth(req, res, next) {
  if ((req.headers.authorization || "") === `Bearer ${ADMIN_TOKEN}`) return next();
  res.status(401).json({ error: "운영자만 가능해요." });
}
app.get("/api/admin/queue", auth, (_req, res) => {
  const rows = db.prepare(`SELECT id, ordinal, rarity, zone, taken_at AS takenAt, submitted_at AS submittedAt, photo, lat, lng
    FROM submissions WHERE status='pending' ORDER BY submitted_at DESC LIMIT 100`).all();
  res.json(rows.map((r) => ({ ...r, photo: r.photo ? `/photos/${r.photo}` : null })));
});
app.post("/api/admin/:id/:action", auth, (req, res) => {
  const { id, action } = req.params;
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "알 수 없는 동작" });
  const zone = req.body?.zone;
  db.prepare(`UPDATE submissions SET status=?, zone=COALESCE(?, zone) WHERE id=?`)
    .run(action === "approve" ? "approved" : "rejected", zone || null, id);
  res.json({ ok: true });
});
app.post("/api/admin/observation", auth, (req, res) => {
  const { kind, zone, at, note } = req.body || {};
  if (!["seen", "miss"].includes(kind)) return res.status(400).json({ error: "kind는 seen 또는 miss" });
  db.prepare(`INSERT INTO observations (kind, zone, at, note, created_at) VALUES (?,?,?,?,?)`)
    .run(kind, zone || null, at || new Date().toISOString(), note || null, new Date().toISOString());
  res.json({ ok: true });
});
app.post("/api/admin/notice", auth, (req, res) => {
  const { src, title, url, crit } = req.body || {};
  if (!src || !title) return res.status(400).json({ error: "src와 title 필요" });
  db.prepare(`INSERT INTO notices (src, title, url, crit, created_at) VALUES (?,?,?,?,?)`)
    .run(src, title, url || null, crit ? 1 : 0, new Date().toISOString());
  res.json({ ok: true });
});

/* ---------- 정적 ---------- */
app.use(express.static(DIST));
app.get(/.*/, (_req, res) => res.sendFile(path.join(DIST, "index.html")));

app.listen(PORT, () => console.log(`부캉이 서버 http://localhost:${PORT}  (데이터: ${PHOTOS})  DECAY=${DECAY_MIN}분`));
