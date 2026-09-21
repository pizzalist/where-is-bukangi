/**
 * AI 1차 심사.
 *  - 실제 사진이고 상어가 보이면 자동 공개 (사람이 같이 나와도 됨)
 *  - 스크린샷·그림·카드 이미지이거나 상어가 없으면 자동 반려
 *  - 애매하면(확신 낮음) 사람에게 넘긴다 (pending 유지 + 디스코드 알림)
 *
 * 엔진 두 가지:
 *  claude : claude CLI. 구독으로 돌아가 API 비용 0. 느림(12~15초/장)
 *  api    : Anthropic API (Haiku 4.5). 빠름(1~2초). 장당 1원쯤
 *
 * 심사에는 원본이 아니라 384px 썸네일을 쓴다 (비용·속도).
 * 여러 장이 밀리면 SCREEN_PARALLEL 만큼 동시에 돌린다.
 */
import { execFile } from "node:child_process";
import fsp from "node:fs/promises";
import path from "node:path";
import { db, photoPath } from "./db.js";
import { notifyVerdict } from "./notify.js";

const ENGINE = process.env.SCREEN_ENGINE || "claude";       // claude | api | off
const MODEL = process.env.SCREEN_MODEL || "claude-haiku-4-5-20251001";
const INTERVAL = Number(process.env.SCREEN_INTERVAL || 20000);
const PASS_CONF = Number(process.env.SCREEN_PASS_CONF || 0.8);
const AUTO_APPROVE = process.env.SCREEN_AUTO_APPROVE !== "0";
const AUTO_REJECT = process.env.SCREEN_AUTO_REJECT !== "0";
const PARALLEL = Math.max(1, Number(process.env.SCREEN_PARALLEL || (ENGINE === "api" ? 4 : 2)));
const BATCH = Math.max(1, Number(process.env.SCREEN_BATCH || 20));

const PROMPT = `Output ONLY compact JSON, no markdown, no explanation:
{"photo":true|false,"shark":true|false,"person":true|false,"confidence":0.0-1.0,"reason":"짧은 한국어 한 줄"}

photo  = 카메라로 직접 찍은 실제 사진인가.
         스크린샷, 앱 화면, 그림, 일러스트, 카드 이미지, 밈, 웹에서 캡처한 것은 모두 false.
shark  = 실제 물속이나 물가에 상어(지느러미·등·그림자만 보여도 됨)가 보이는가.
         사람이 같이 나와도 상관없다. 사람이 주인공이고 상어가 전혀 없으면 false.
person = 사람이 같이 나오는가 (참고용. 판정에는 안 쓴다).

photo와 shark는 엄격하게. 애매하면 confidence를 낮춰.`;

const qPending = db.prepare(`
  SELECT s.id, s.ordinal, s.zone, s.taken_at, s.rarity, s.photo, s.thumb FROM submissions s
  LEFT JOIN screening c ON c.id = s.id
  WHERE s.status='pending' AND c.id IS NULL
  ORDER BY s.submitted_at ASC LIMIT ${BATCH}`);
const insScreen = db.prepare(`INSERT OR REPLACE INTO screening (id, verdict, shark, person, confidence, reason, engine, ms, created_at) VALUES (?,?,?,?,?,?,?,?,?)`);
const updStatus = db.prepare(`UPDATE submissions SET status=? WHERE id=? AND status='pending'`);

function parseJson(text) {
  const m = /\{[\s\S]*\}/.exec(text || "");
  if (!m) throw new Error("JSON 없음");
  return JSON.parse(m[0]);
}

function viaClaudeCli(imgPath) {
  return new Promise((resolve, reject) => {
    execFile("claude", ["-p", `Read the image at ${imgPath} and answer.\n${PROMPT}`, "--allowedTools", "Read"],
      { timeout: 120000, maxBuffer: 1 << 20 },
      (err, stdout) => err ? reject(err) : resolve(parseJson(stdout)));
  });
}

async function viaApi(imgPath) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY 없음");
  const buf = await fsp.readFile(imgPath);
  const ext = path.extname(imgPath).slice(1).replace("jpg", "jpeg");
  const r = await fetch(`${process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 120,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: `image/${ext}`, data: buf.toString("base64") } },
        { type: "text", text: PROMPT },
      ] }],
    }),
  });
  if (!r.ok) throw new Error(`API ${r.status}`);
  const j = await r.json();
  return parseJson(j.content?.[0]?.text);
}

function decide(v) {
  const sure = (v.confidence ?? 0) >= PASS_CONF;
  if (!sure) return "unsure";
  if (v.photo === false) return "reject";   // 스크린샷·그림·카드 이미지
  if (!v.shark) return "reject";            // 상어 없음 = 부캉이와 무관
  return "pass";                            // 사람이 같이 나와도 통과
}

export async function screenOne(row, onChange) {
  const img = photoPath(row.thumb || row.photo);
  const t0 = Date.now();
  let verdict = "error", v = { photo: null, shark: null, person: null, confidence: null, reason: "" };
  try {
    v = ENGINE === "api" ? await viaApi(img) : await viaClaudeCli(img);
    verdict = decide(v);
  } catch (e) {
    v.reason = String(e.message).slice(0, 120);
  }
  const ms = Date.now() - t0;
  insScreen.run(row.id, verdict, v.shark ? 1 : 0, v.person ? 1 : 0, v.confidence ?? null, v.reason || "", ENGINE, ms, new Date().toISOString());

  if (verdict === "pass" && AUTO_APPROVE) updStatus.run("approved", row.id);
  else if (verdict === "reject" && AUTO_REJECT) updStatus.run("rejected", row.id);
  if (verdict === "pass" || verdict === "reject") onChange?.();

  console.log(`[심사] ${row.id} → ${verdict} (실사진=${v.photo} 상어=${v.shark} 사람=${v.person} 확신=${v.confidence} ${ms}ms) ${v.reason}`);
  if (verdict === "unsure" || verdict === "error") await notifyVerdict(row, verdict, v);   // 사람 손이 필요한 것만 알림
  return verdict;
}

export function startScreener(onChange) {
  if (ENGINE === "off") { console.log("[심사] 꺼짐"); return; }
  console.log(`[심사] ${ENGINE} 엔진, ${INTERVAL / 1000}초마다 최대 ${BATCH}장, 동시 ${PARALLEL}장`);
  let busy = false;
  const tick = async () => {
    if (busy) return; busy = true;
    try {
      const rows = qPending.all();
      let i = 0;
      const worker = async () => { while (i < rows.length) { const row = rows[i++]; try { await screenOne(row, onChange); } catch (e) { console.error("[심사] 오류:", e.message); } } };
      await Promise.all(Array.from({ length: Math.min(PARALLEL, rows.length) }, worker));
    } catch (e) { console.error("[심사] 오류:", e.message); }
    busy = false;
  };
  setTimeout(tick, 3000);
  setInterval(tick, INTERVAL).unref();
}
