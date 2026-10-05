/**
 * 환경변수와 서버 상수. 값과 기본값은 분리 전 index.js 그대로다.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DIST = path.join(__dirname, "..", "dist");
export const PORT = Number(process.env.PORT || 8787);
export const HOST = process.env.HOST || "127.0.0.1";          // 기본은 루프백만. 터널이 앞에 선다
export const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
export const SERVE_STATIC = process.env.SERVE_STATIC !== "0"; // 운영은 1: admin 주소가 운영자 화면을 낸다. 공개 경로는 터널이 제한
export const MAX_PHOTO = 3 * 1024 * 1024;                     // 3MB (앱이 보내는 건 보통 70KB)
export const UPLOAD_CONCURRENCY = 8;
export const STATUS_TTL = Number(process.env.STATUS_TTL || 5000);
// API의 바깥 주소. 있으면 사진을 절대주소로 준다
export const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
// 제보·운영자 API를 부를 수 있는 화면 주소
export const SITE_ORIGINS = new Set(
  [process.env.SITE_URL, ...(process.env.ALLOWED_ORIGINS || "").split(",")]
    .map((v) => (v || "").trim().replace(/\/$/, ""))
    .filter(Boolean),
);
export const SITE_URL = (process.env.SITE_URL || "").replace(/\/$/, "");

/* 현장 탭 설정. 탭 하나는 약한 신호라, 모아서 보여주고 금방 사라지게 한다 */
export const LIVE_MIN = Number(process.env.LIVE_MIN || 30);         // 이 시간 안의 탭만 "지금"으로 친다
export const PING_COOLDOWN_MIN = Number(process.env.PING_COOLDOWN_MIN || 10);   // 같은 기기 재탭 간격

/** 이 서버가 카드 렌더러에 넘기는 로컬 주소 */
export const LOCAL_BASE = `http://127.0.0.1:${PORT}`;

export const photoUrl = (name) => (name ? `${PUBLIC_URL}/photos/${name}` : null);
