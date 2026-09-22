/**
 * 카드 PNG 렌더러. 화면의 홀로 카드를 헤드리스 크로미움으로 그대로 찍어서 저장한다.
 * 캔버스로 따로 그리면 CSS 효과(블렌드·필터·텍스처)를 못 따라가서, 화면 그 자체를 찍는다.
 *
 *  - 앱의 #/shot/<id> 화면을 연다 (카드 데이터는 ?d= 로 넘겨서 API 왕복이 없다)
 *  - 폰트·사진 준비가 끝나면 .shot-wrap 을 투명 배경으로 캡처
 *  - 결과는 <데이터>/cards/<id>.<키>.png 에 캐시. 키는 카드 내용(순번·등급·구역·시각·사진)의 해시
 *  - 브라우저는 하나만 띄워 두고 10분 놀면 닫는다. 동시 렌더는 CARD_PARALLEL(기본 2)장
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { ROOT } from "./db.js";

const DIR = path.join(ROOT, "cards");
fs.mkdirSync(DIR, { recursive: true });
const PARALLEL = Math.max(1, Number(process.env.CARD_PARALLEL || 2));
const IDLE_MS = 10 * 60e3;
const WIDTH = 420;      // CSS px. deviceScaleFactor 3 → 1260px 폭 PNG
const SITE_HOST = (process.env.SITE_URL || "").replace(/^https?:\/\//, "").replace(/\/$/, "") || "bukangi.com";

let browser = null, idle = null, active = 0;
const waiting = [];

async function getBrowser() {
  if (!browser) {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
    browser.on("disconnected", () => { browser = null; });
    console.log("[카드] 브라우저 시작");
  }
  clearTimeout(idle);
  idle = setTimeout(() => { browser?.close().catch(() => {}); browser = null; console.log("[카드] 브라우저 종료(유휴)"); }, IDLE_MS);
  idle.unref?.();
  return browser;
}

function slot() {
  if (active < PARALLEL) { active++; return Promise.resolve(); }
  if (waiting.length > 50) return Promise.reject(new Error("BUSY"));
  return new Promise((res) => waiting.push(res)).then(() => { active++; });
}
function release() { active--; const n = waiting.shift(); if (n) n(); }

export function cardKey(row, fmt = "png") {
  return crypto.createHash("sha1").update(JSON.stringify([row.ordinal, row.rarity, row.zone, row.taken_at, row.photo, SITE_HOST, fmt, 3])).digest("base64url").slice(0, 10);
}

/** 저장용(png)은 크고 선명하게, 링크 미리보기용(jpg)은 작고 가볍게 */
const FMT = {
  png: { scale: 3, type: "png", opts: { omitBackground: true } },
  jpg: { scale: 1.5, type: "jpeg", opts: { quality: 86 } },   // 약 740x990, 150KB 안팎. 카톡·스레드가 읽는 크기
};
export const CARD_SIZE = { png: { w: 1476, h: 1983 }, jpg: { w: 738, h: 992 } };

/**
 * row: { id, ordinal, rarity, zone, taken_at, photo }  zoneName: 표시용 구역 이름
 * localBase: 앱과 사진을 낼 수 있는 이 서버의 로컬 주소 (http://127.0.0.1:8787)
 * 반환: PNG 파일 경로
 */
export async function cardPng(row, zoneName, localBase, fmt = "png") {
  const f = FMT[fmt] || FMT.png;
  const key = cardKey(row, fmt);
  const file = path.join(DIR, `${row.id}.${key}.${fmt}`);
  if (fs.existsSync(file)) return file;

  await slot();
  const t0 = Date.now();
  try {
    if (fs.existsSync(file)) return file;                 // 기다리는 사이 다른 요청이 만들었을 수 있다
    const b = await getBrowser();
    const ctx = await b.newContext({ viewport: { width: WIDTH + 80, height: 900 }, deviceScaleFactor: f.scale });
    try {
      const page = await ctx.newPage();
      const d = Buffer.from(JSON.stringify({
        id: row.id, ordinal: row.ordinal, rarity: row.rarity, zone: row.zone, zoneName,
        takenAt: row.taken_at, photo: row.photo ? `${localBase}/photos/${row.photo}` : null,
        site: SITE_HOST,                                    // 카드 하단 주소. 없으면 127.0.0.1이 찍힌다
      })).toString("base64url");
      await page.goto(`${localBase}/?d=${d}&bg=${fmt === "jpg" ? 1 : 0}#/shot/${row.id}`, { waitUntil: "load", timeout: 20000 });
      await page.waitForSelector('.shot-wrap[data-ready="1"]', { timeout: 20000 });
      await page.waitForTimeout(120);                       // 마지막 페인트 한 프레임
      const buf = await page.locator(".shot-wrap").screenshot({ type: f.type, timeout: 15000, ...f.opts });
      const tmp = `${file}.${process.pid}.tmp`;
      await fsp.writeFile(tmp, buf);
      await fsp.rename(tmp, file);
      console.log(`[카드] ${row.id} No.${row.ordinal} ${row.rarity} ${fmt} ${Math.round(buf.length / 1024)}KB ${Date.now() - t0}ms`);
      return file;
    } finally { await ctx.close().catch(() => {}); }
  } finally { release(); }
}

export function cardStats() { return { active, waiting: waiting.length, browser: !!browser }; }
