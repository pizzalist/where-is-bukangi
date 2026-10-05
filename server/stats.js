/**
 * 방문·이벤트 집계 (일별 방문, 시간대별 kind, 유입 경로, 첫 진입 화면).
 */
import crypto from "node:crypto";
import { db } from "./db.js";
import { clientIp } from "./http/middleware.js";

/* ---------- 방문 집계 ---------- */
const bumpVisit = db.prepare(
  `INSERT INTO visits (day, kind, n) VALUES (?,?,1) ON CONFLICT(day,kind) DO UPDATE SET n = n + 1`,
);
const insVisitor = db.prepare(`INSERT OR IGNORE INTO visitors (day, h) VALUES (?,?)`);
const insVisitorHour = db.prepare(`INSERT OR IGNORE INTO visitors_hourly (hour, h) VALUES (?,?)`);
const delOldVisitorsHour = db.prepare(`DELETE FROM visitors_hourly WHERE hour < ?`);
const delOldVisitors = db.prepare(`DELETE FROM visitors WHERE day < ?`);
export function today() {
  const d = new Date(Date.now() + 9 * 3600e3);
  return d.toISOString().slice(0, 10);
}
/** 한국 시간 기준 시간 키. 기본은 지금 */
export function hourKey(at) {
  return new Date((at ? new Date(at).getTime() : Date.now()) + 9 * 3600e3).toISOString().slice(0, 13);
}
const bumpHour = db.prepare(
  `INSERT INTO stats_hourly (hour, kind, n) VALUES (?,?,1) ON CONFLICT(hour,kind) DO UPDATE SET n = n + 1`,
);
export const bumpSource = db.prepare(
  `INSERT INTO sources (day, src, n) VALUES (?,?,1) ON CONFLICT(day,src) DO UPDATE SET n = n + 1`,
);
export const bumpRoute = db.prepare(
  `INSERT INTO routes (day, route, n) VALUES (?,?,1) ON CONFLICT(day,route) DO UPDATE SET n = n + 1`,
);
/** 참조 주소를 출처 종류로만 분류한다. 전체 주소나 검색어는 저장하지 않는다 */
export function classifySource(ref, ua) {
  const h = (() => { try { return new URL(String(ref)).hostname.toLowerCase(); } catch { return ""; } })();
  const u = String(ua || "").toLowerCase();
  if (/threads/.test(h) || /threads|barcelona/.test(u)) return "threads";   // 스레드 iOS 앱은 UA에 Barcelona를 쓴다
  if (/instagram/.test(h) || /instagram/.test(u)) return "instagram";
  if (/kakao|daum/.test(h) || /kakaotalk/.test(u)) return "kakao";
  if (/facebook|fb\.com/.test(h) || /fban|fbav/.test(u)) return "facebook";
  if (/naver/.test(h) || /naver/.test(u)) return "naver";
  if (/google/.test(h)) return "google";
  if (/youtube|youtu\.be/.test(h)) return "youtube";
  if (/^(t\.co|x\.com|twitter)/.test(h)) return "twitter";
  if (/bukangi\.com$/.test(h)) return "direct";   // 내부 이동은 유입이 아니다. 첫 진입 정보가 없으면 직접으로
  if (h) return "other";
  return "direct";                                  // 주소 직접 입력, QR, 메모 앱 등
}
export const ROUTES = new Set(["home", "certify", "card", "hall", "tiers", "admin", "shot"]);
/* 추적 링크 ?s= 코드. 링크를 복사해 여는 경우는 참조 주소가 없어 출처를 알 수 없다.
   채널마다 다른 코드를 붙여 배포하면 정확히 갈린다 */
export const SRC_CODES = {
  qr: "qr", poster: "qr", ps: "qr",            // 현장 포스터·팻말 QR
  card: "namecard", nc: "namecard",            // 명함
  th: "threads", ig: "instagram", kk: "kakao", oc: "openchat",
  nv: "naver_blog", yt: "youtube", pr: "press", dc: "discord", sl: "slack",
};
/** 클라이언트가 보낼 수 있는 이벤트만 허용. 아무 이름이나 받지 않는다 */
export const EVENTS = new Set(["share", "save", "geo_fail", "card_view"]);
/** 집계는 부가 기능이라 실패해도 본 동작을 막지 않는다 */
export function tally(kind, at) { try { bumpHour.run(hourKey(at), kind); } catch { /* 무시 */ } }
export function daysAgo(n) {
  const d = new Date(Date.now() + 9 * 3600e3 - n * 864e5);
  return d.toISOString().slice(0, 10);
}

// 방문 집계는 DB에 남겨 서버를 재시작해도 순방문자가 어긋나지 않는다.
const countVisitTx = db.transaction((day, h, hr) => {
  bumpVisit.run(day, "view"); bumpHour.run(hr, "view");
  const firstToday = insVisitor.run(day, h).changes > 0;
  if (firstToday) bumpVisit.run(day, "uniq");                                  // 하루 기준 순방문
  if (insVisitorHour.run(hr, h).changes > 0) bumpHour.run(hr, "uniq");         // 시간 기준 순방문 (그래프용)
  return firstToday;
});
/** 집계하고, 그 사람이 오늘 처음인지 돌려준다 */
export function countVisit(req) {
  const day = today();
  // IP+UA를 그날의 소금과 함께 해시. 원본은 저장하지 않고 7일 뒤 해시도 지운다.
  const h = crypto.createHash("sha256")
    .update(`${day}|${clientIp(req)}|${req.headers["user-agent"] || ""}`)
    .digest("base64url").slice(0, 22);
  return countVisitTx(day, h, hourKey());
}
setInterval(() => {
  try {
    delOldVisitors.run(daysAgo(7));
    delOldVisitorsHour.run(hourKey(Date.now() - 8 * 864e5));
  } catch { /* 무시 */ }
}, 6 * 3600e3).unref();
