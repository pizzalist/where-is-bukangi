/**
 * 공개 읽기 데이터와 메모리 캐시: 상황판(/api/status)과 명예의 전당(/api/hall).
 * 운영자 처리·현장 탭·AI 심사가 invalidate*()로 캐시를 바로 비운다.
 */
import crypto from "node:crypto";
import { db } from "./db.js";
import { STATUS_TTL, LIVE_MIN, photoUrl } from "./config.js";
import { ZONES } from "./zones.js";
import { today } from "./stats.js";

/* ---------- 공개: 상황판 (메모리 캐시) ---------- */
const qVisits = db.prepare(`SELECT kind, n FROM visits WHERE day = ?`);
const qVisitsAll = db.prepare(`SELECT kind, SUM(n) n FROM visits GROUP BY kind`);
const qSubs = db.prepare(`SELECT id, zone, taken_at AS at, photo, thumb, ordinal FROM submissions
  WHERE status='approved' ORDER BY taken_at DESC LIMIT 40`);
const qObs = db.prepare(`SELECT kind, zone, at, note FROM observations ORDER BY at DESC LIMIT 40`);
const qNotices = db.prepare(`SELECT src, title, url, crit FROM notices ORDER BY created_at DESC LIMIT 20`);
const qOrdinal = db.prepare("SELECT v FROM meta WHERE k='ordinal'");
const qLivePings = db.prepare(`SELECT kind, zone, at, h FROM pings WHERE at > ? GROUP BY h, kind ORDER BY at DESC`);
const qLastSeenPing = db.prepare(`SELECT at, zone FROM pings WHERE kind='seen' ORDER BY at DESC LIMIT 1`);
const qSubCount = db.prepare(`SELECT
  COUNT(*) total,
  SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) approved,
  -- submitted_at은 UTC로 저장돼 있다. 한국 날짜로 바꿔서 비교해야 새벽 0~9시 제보가 전날로 빠지지 않는다
  SUM(CASE WHEN substr(datetime(submitted_at,'+9 hours'),1,10) = strftime('%Y-%m-%d','now','+9 hours')
      THEN 1 ELSE 0 END) today
  FROM submissions`);

function buildStatus() {
  const timeline = [
    ...qSubs.all().map((s) => ({
      at: s.at, kind: "seen", zone: s.zone, tier: "confirmed", note: "현장 사진",
      photo: photoUrl(s.thumb || s.photo), ordinal: s.ordinal, source: "photo",
    })),
    ...qObs.all().map((o) => ({
      at: o.at, kind: o.kind, zone: o.zone, tier: "confirmed", note: o.note, source: "observation",
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);

  // 헤드라인 근거. 사진·관측 외에 현장 탭("보여요")도 후보다. 공원 안에서만 눌리니 시각은 믿을 만하고,
  // 근거 표시만 "현장 제보"로 구분한다. 타임라인에는 넣지 않는다 (탭은 사진·관측보다 약한 기록)
  let lastSeen = timeline.find((e) => e.kind === "seen") || null;
  const lastPing = qLastSeenPing.get();
  if (lastPing && (!lastSeen || lastPing.at > lastSeen.at)) {
    lastSeen = {
      at: lastPing.at, kind: "seen", zone: lastPing.zone, tier: "confirmed",
      note: "현장 제보", photo: null, source: "ping",
    };
  }
  const head = timeline[0] || null;
  const last = head && lastSeen && head.kind === "miss" && head.at > lastSeen.at ? head : lastSeen;

  const notices = qNotices.all().map((n) => ({ ...n, crit: !!n.crit }));
  const control = notices.find((n) => n.crit) || null;

  // 현장 탭 집계. 사람 수는 기기 해시 기준 중복 제거
  const cut = new Date(Date.now() - LIVE_MIN * 60e3).toISOString();
  const pg = qLivePings.all(cut);
  const live = pg.length
    ? {
        seen: pg.filter((p) => p.kind === "seen").length,
        miss: pg.filter((p) => p.kind === "miss").length,
        at: pg[0].at,
        zone: pg.find((p) => p.kind === "seen" && p.zone)?.zone ?? null,
        windowMin: LIVE_MIN,
      }
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
export function statusBody() {
  const now = Date.now();
  if (now - cache.at > STATUS_TTL) {
    const body = JSON.stringify(buildStatus());
    const etag = `W/"${crypto.createHash("sha1").update(body).digest("base64url").slice(0, 20)}"`;
    cache = { at: now, body, etag };
  }
  return cache;
}
export function invalidateStatus() { cache.at = 0; }

/* ---------- 공개: 명예의 전당 ---------- */
const HALL_ORDER = ["gold", "rainbow", "fullart", "galaxy", "reverse", "holo", "rare", "uncommon", "common"];
const qHall = db.prepare(`SELECT id, ordinal, rarity, zone, taken_at AS takenAt, photo, thumb FROM submissions
  WHERE status='approved' AND photo IS NOT NULL`);
let hallCache = { at: 0, body: "" };
export function hallBody() {
  const now = Date.now();
  if (now - hallCache.at > 30000) {
    const rows = qHall.all();
    rows.sort((a, b) => (HALL_ORDER.indexOf(a.rarity) - HALL_ORDER.indexOf(b.rarity)) || a.ordinal - b.ordinal);
    // 목록은 썸네일, 원본은 카드 상세(/api/submissions/:id)에서만
    const list = rows.slice(0, 60).map(({ thumb, ...r }) => ({ ...r, photo: photoUrl(thumb || r.photo) }));
    hallCache = { at: now, body: JSON.stringify(list) };
  }
  return hallCache.body;
}
export function invalidateHall() { hallCache.at = 0; }
