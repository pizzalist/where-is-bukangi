/**
 * 운영자 API (/api/admin/*). Authorization: Bearer <ADMIN_TOKEN> 필요.
 */
import express from "express";
import crypto from "node:crypto";
import { db } from "../db.js";
import { ADMIN_TOKEN, photoUrl } from "../config.js";
import { ZONE_CODES } from "../zones.js";
import { limiter, clientIp } from "../http/middleware.js";
import { tally, hourKey, daysAgo } from "../stats.js";
import { invalidateStatus, invalidateHall } from "../status.js";
import { warmCard } from "./cards.js";

/* 운영자 목록. 대기 중(pending)뿐 아니라 AI가 자동으로 반려·통과시킨 것도 볼 수 있어야 한다.
   흐린 상어 사진을 AI가 반려하는 경우가 있어서, 사람이 뒤집을 수 있게 */
const qQueue = db.prepare(`
  SELECT s.id, s.ordinal, s.rarity, s.zone, s.taken_at AS takenAt, s.submitted_at AS submittedAt,
         s.photo, s.lat, s.lng, s.status,
         c.verdict AS aiVerdict, c.shark AS aiShark, c.person AS aiPerson, c.confidence AS aiConf, c.reason AS aiReason
  FROM submissions s LEFT JOIN screening c ON c.id = s.id
  WHERE s.status=? ORDER BY s.submitted_at DESC LIMIT ?`);
const QUEUE_STATUS = new Set(["pending", "rejected", "approved"]);
const updSub = db.prepare(`UPDATE submissions SET status=?, zone=COALESCE(?, zone) WHERE id=?`);
/* 시간대별 통계. 기본 24시간, 최대 7일 */
const qHourly = db.prepare(`SELECT hour, kind, n FROM stats_hourly WHERE hour >= ? ORDER BY hour`);
const HOURLY_ZERO = {
  view: 0, uniq: 0, report: 0, ping_seen: 0, ping_miss: 0, ping_far: 0,
  card: 0, share: 0, save: 0, card_view: 0, geo_fail: 0,
};
/* 유입 경로·화면별 (날짜 단위) */
const qSources = db.prepare(`SELECT src, SUM(n) n FROM sources WHERE day >= ? GROUP BY src ORDER BY n DESC`);
const qRoutes = db.prepare(`SELECT route, SUM(n) n FROM routes WHERE day >= ? GROUP BY route ORDER BY n DESC`);
const insObs = db.prepare(`INSERT INTO observations (kind, zone, at, note, created_at) VALUES (?,?,?,?,?)`);
const insNotice = db.prepare(`INSERT INTO notices (src, title, url, crit, created_at) VALUES (?,?,?,?,?)`);

export function mountAdmin(app) {
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

  app.get("/api/admin/queue", limiter({ windowMs: 15 * 60e3, max: 240, key: clientIp }), auth, (req, res) => {
    const status = QUEUE_STATUS.has(String(req.query.status)) ? String(req.query.status) : "pending";
    const limit = Math.min(Math.max(Number(req.query.limit) || (status === "pending" ? 100 : 50), 1), 200);
    res.set("Cache-Control", "no-store");
    res.json(qQueue.all(status, limit).map((r) => ({ ...r, photo: photoUrl(r.photo) })));
  });

  app.post("/api/admin/:id/:action", adminGuard, (req, res) => {
    const { id, action } = req.params;
    if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "알 수 없는 동작" });
    const zone = req.body?.zone;
    if (zone != null && zone !== "" && !ZONE_CODES.has(zone)) return res.status(400).json({ error: "구역이 이상해요." });
    const r = updSub.run(action === "approve" ? "approved" : "rejected", zone || null, String(id).slice(0, 32));
    invalidateStatus(); invalidateHall();                  // 캐시 즉시 무효화
    if (action === "approve") { tally("card"); warmCard(String(id).slice(0, 32)); }
    res.json({ ok: r.changes > 0 });
  });

  app.get("/api/admin/hourly", limiter({ windowMs: 15 * 60e3, max: 120, key: clientIp }), auth, (req, res) => {
    const hours = Math.min(Math.max(Number(req.query.hours) || 24, 6), 24 * 7);
    const from = hourKey(Date.now() - (hours - 1) * 3600e3);
    const rows = qHourly.all(from);
    const by = {};
    for (const r of rows) (by[r.hour] ||= {})[r.kind] = r.n;
    const out = [];
    for (let i = hours - 1; i >= 0; i--) {
      const h = hourKey(Date.now() - i * 3600e3);
      out.push({ hour: h, ...HOURLY_ZERO, ...(by[h] || {}) });
    }
    res.set("Cache-Control", "no-store");
    const since = (db.prepare("SELECT MIN(hour) m FROM stats_hourly WHERE kind='view'").get() || {}).m || null;
    res.json({ rows: out, since });
  });

  app.get("/api/admin/breakdown", limiter({ windowMs: 15 * 60e3, max: 120, key: clientIp }), auth, (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 1, 1), 30);
    const from = daysAgo(days - 1);
    res.set("Cache-Control", "no-store");
    res.json({ from, sources: qSources.all(from), routes: qRoutes.all(from) });
  });

  app.post("/api/admin/observation", adminGuard, (req, res) => {
    const { kind, zone, at, note } = req.body || {};
    if (!["seen", "miss"].includes(kind)) return res.status(400).json({ error: "kind는 seen 또는 miss" });
    if (zone != null && zone !== "" && !ZONE_CODES.has(zone)) return res.status(400).json({ error: "구역이 이상해요." });
    const when = at ? new Date(at).toISOString() : new Date().toISOString();
    insObs.run(kind, zone || null, when, String(note || "").slice(0, 200), new Date().toISOString());
    invalidateStatus();
    res.json({ ok: true });
  });

  app.post("/api/admin/notice", adminGuard, (req, res) => {
    const { src, title, url, crit } = req.body || {};
    if (!src || !title) return res.status(400).json({ error: "src와 title 필요" });
    if (url && !/^https?:\/\//.test(url)) return res.status(400).json({ error: "url 형식이 아니에요." });
    insNotice.run(
      String(src).slice(0, 60), String(title).slice(0, 200), url || null, crit ? 1 : 0, new Date().toISOString(),
    );
    invalidateStatus();
    res.json({ ok: true });
  });
}
