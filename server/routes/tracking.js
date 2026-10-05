/**
 * 화면이 보내는 기록: 방문(/api/visit), 행동 이벤트(/api/event), 현장 탭(/api/ping).
 */
import express from "express";
import crypto from "node:crypto";
import { db } from "../db.js";
import { PING_COOLDOWN_MIN } from "../config.js";
import { ZONE_CODES, PARK, distToPark, inPark } from "../zones.js";
import { limiter, clientIp } from "../http/middleware.js";
import {
  today, tally, countVisit, classifySource, bumpSource, bumpRoute, SRC_CODES, ROUTES, EVENTS,
} from "../stats.js";
import { invalidateStatus } from "../status.js";

const qRecentPing = db.prepare(`SELECT 1 FROM pings WHERE h = ? AND at > ? LIMIT 1`);
const insPing = db.prepare(`INSERT INTO pings (at, kind, zone, h, created_at) VALUES (?,?,?,?,?)`);
const delOldPings = db.prepare(`DELETE FROM pings WHERE at < ?`);
// 탭은 7일 보관. 헤드라인이 탭 시각을 쓰므로 너무 빨리 지우면 시각이 거꾸로 간다 ("지금" 집계는 따로 30분 창)
setInterval(() => {
  try { delOldPings.run(new Date(Date.now() - 7 * 864e5).toISOString()); } catch { /* 무시 */ }
}, 3600e3).unref();

export function mountTracking(app) {
  /* 방문 집계. 앱이 페이지를 "실제로 열 때" 한 번만 POST한다. 30초 상황 폴링과는 분리.
     헤드리스 브라우저(카드 렌더러·테스트)와 봇은 세지 않는다 */
  app.post("/api/visit",
    limiter({ windowMs: 60e3, max: 30, key: clientIp }),
    express.json({ limit: "1kb" }),
    (req, res) => {
      const ua = String(req.headers["user-agent"] || "");
      if (/HeadlessChrome|bot|crawler|spider|Playwright/i.test(ua)) return res.status(204).end();
      try {
        countVisit(req);
        // 유입 경로·첫 진입 화면은 방문 한 번에 한 번만 센다 (클라이언트가 첫 진입에만 first를 보낸다).
        // 새로고침까지 세면 합계가 방문자 수와 안 맞고 참조 주소가 우리 사이트라 뭉개진다.
        // 하루 기준이 아니라 방문 기준이라, 아침에 카톡·저녁에 인스타로 오면 둘 다 잡힌다
        if (req.body?.first === true) {
          const day = today();
          const tag = SRC_CODES[String(req.body?.s || "").toLowerCase()];
          bumpSource.run(day, tag || classifySource(req.body?.ref || req.headers.referer, ua));
          const r = String(req.body?.route || "home");
          bumpRoute.run(day, ROUTES.has(r) ? r : "other");
        }
      } catch { /* 집계 실패는 무시 */ }
      res.status(204).end();
    });

  /* 화면에서 일어난 행동. 공유·저장·위치 실패처럼 서버가 알 수 없는 것만 받는다 */
  app.post("/api/event",
    limiter({ windowMs: 60e3, max: 60, key: clientIp }),
    express.json({ limit: "1kb" }),
    (req, res) => {
      const ua = String(req.headers["user-agent"] || "");
      if (/HeadlessChrome|bot|crawler|spider|Playwright/i.test(ua)) return res.status(204).end();
      const name = String(req.body?.name || "");
      if (EVENTS.has(name)) tally(name);
      res.status(204).end();
    });

  /* 현장 탭. 공원 안에서만, 같은 기기는 PING_COOLDOWN_MIN분에 한 번.
     사진 제보와 달리 카드도 안 나오고 타임라인에도 안 들어간다. "지금" 한 줄만 바꾼다 */
  app.post("/api/ping",
    limiter({ windowMs: 10 * 60e3, max: 12, key: clientIp }),
    express.json({ limit: "2kb" }),
    (req, res) => {
      const { kind, zone, lat, lng, acc } = req.body || {};
      if (!["seen", "miss"].includes(kind)) return res.status(400).json({ error: "kind는 seen 또는 miss" });
      if (zone != null && zone !== "" && !ZONE_CODES.has(zone)) return res.status(400).json({ error: "구역이 이상해요." });
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ error: "위치를 확인할 수 없어요." });
      }
      if (!inPark(lat, lng, Number(acc) || 0)) {
        // 반경이 실제로 걸림돌인지 보려면 거절 기록이 있어야 한다. 좌표는 남기지 않고 거리만
        const dist = Math.round(distToPark(lat, lng));
        console.log(`[탭] 반경 밖 거절 ${dist}m (오차 ${Math.round(Number(acc) || 0)}m, 기준 ${PARK.radius}m)`);
        tally("ping_far");
        return res.status(403).json({ error: "공원 근처에서만 누를 수 있어요." });
      }

      const h = crypto.createHash("sha256")
        .update(`ping|${clientIp(req)}|${req.headers["user-agent"] || ""}`)
        .digest("base64url").slice(0, 22);
      const since = new Date(Date.now() - PING_COOLDOWN_MIN * 60e3).toISOString();
      if (qRecentPing.get(h, since)) {
        return res.status(429).json({ error: `${PING_COOLDOWN_MIN}분에 한 번만 누를 수 있어요.` });
      }

      const now = new Date().toISOString();
      insPing.run(now, kind, zone || null, h, now);
      tally(kind === "seen" ? "ping_seen" : "ping_miss");
      invalidateStatus();                              // 상황판 즉시 갱신
      res.json({ ok: true });
    });
}
