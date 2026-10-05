/**
 * 공통 미들웨어: 보안 헤더, CORS, 레이트 리밋, 업로드 동시성 제한, 마지막 에러 처리.
 */
import { SITE_ORIGINS, UPLOAD_CONCURRENCY } from "../config.js";
import { tally } from "../stats.js";

/* ---------- 보안 헤더 ---------- */
export function securityHeaders(_req, res, next) {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // 현장 탭이 위치를 쓴다. 우리 페이지에서만 허용하고 나머지는 계속 차단
    "Permissions-Policy": "geolocation=(self), microphone=(), camera=()",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  next();
}

/* ---------- CORS (화면이 Pages 같은 다른 주소에 있을 때) ----------
   공개 읽기(/api/status, /api/hall, /api/submissions/:id, /photos)는 누구나.
   제보·운영자 API는 SITE_URL(+ALLOWED_ORIGINS)에서 온 화면만. 쿠키를 안 쓰니 토큰 탈취 경로는 없다 */
const PUBLIC_READ = /^\/(api\/(status|hall)|api\/submissions\/[^/]+|api\/cards\/[^/]+|photos\/)/;
export function cors(req, res, next) {
  const origin = req.headers.origin;
  if (!origin) return next();                                   // 같은 주소에서 온 요청은 CORS 무관
  if (PUBLIC_READ.test(req.path) && req.method === "GET") res.set("Access-Control-Allow-Origin", "*");
  else if (SITE_ORIGINS.has(origin)) res.set({ "Access-Control-Allow-Origin": origin, "Vary": "Origin" });
  else if (req.method === "OPTIONS") {
    // 거절은 응답만 나가고 흔적이 없어서, 출처를 몰라 "Load failed"가 9일간 안 보였다 (2026-10-01). 출처·경로·브라우저 종류만 남긴다
    const ua = String(req.headers["user-agent"] || "");
    const kind = /Instagram/.test(ua) ? "instagram" : /Barcelona|Threads/.test(ua) ? "threads" : /KAKAOTALK/i.test(ua) ? "kakao" : /Safari/.test(ua) ? "safari" : "other";
    console.log(`[CORS 거절] origin=${JSON.stringify(String(origin).slice(0, 80))} ${req.path} ${kind}`);
    tally("cors_reject");
    return res.status(403).end();
  }
  if (req.method === "OPTIONS") {
    res.set({
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    });
    return res.status(204).end();
  }
  next();
}

/* ---------- 레이트 리밋 (IP별 슬라이딩 윈도우) ---------- */
export function limiter({ windowMs, max, key = (req) => req.ip }) {
  const hits = new Map();
  setInterval(() => {                      // 메모리 누수 방지
    const cut = Date.now() - windowMs;
    for (const [k, arr] of hits) {
      const kept = arr.filter((t) => t > cut);
      if (kept.length) hits.set(k, kept);
      else hits.delete(k);
    }
  }, windowMs).unref();
  return (req, res, next) => {
    const k = key(req), now = Date.now(), cut = now - windowMs;
    const arr = (hits.get(k) || []).filter((t) => t > cut);
    if (arr.length >= max) return res.status(429).json({ error: "요청이 너무 잦아요. 잠시 뒤 다시 시도해주세요." });
    arr.push(now);
    hits.set(k, arr);
    next();
  };
}
export const clientIp = (req) => String(req.headers["cf-connecting-ip"] || req.ip || "");

/* ---------- 업로드 동시성 제한 ---------- */
let running = 0;
const waiting = [];
export function acquire() {
  if (running < UPLOAD_CONCURRENCY) { running++; return Promise.resolve(); }
  if (waiting.length > 200) return Promise.reject(new Error("BUSY"));
  return new Promise((res) => waiting.push(res)).then(() => { running++; });
}
export function release() {
  running--;
  const n = waiting.shift();
  if (n) n();
}
/** /healthz용 현재 업로드 부하 */
export const uploadLoad = () => ({ uploads: running, queued: waiting.length });

/* ---------- 마지막 에러 처리 ---------- */
export function errorHandler(err, _req, res, _next) {
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "요청이 너무 커요." });
  console.error("에러:", err?.message);
  res.status(500).json({ error: "서버 오류" });
}
