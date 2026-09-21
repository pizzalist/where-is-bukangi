/**
 * AI 1차 심사.
 *  - 상어가 있고 사람이 안 찍혔으면 자동 공개
 *  - 명백히 상어가 아니거나 사람이 크게 찍혔으면 자동 반려
 *  - 애매하면 사람에게 넘긴다 (pending 유지)
 *
 * 엔진 두 가지:
 *  claude : claude CLI. 구독으로 돌아가 API 비용 0. 느림(수 초)
 *  api    : Anthropic API. 가장 싼 비전 모델. 빠름. 토큰 비용 발생
 *
 * 심사에는 원본이 아니라 작은 썸네일을 쓴다 (비용·속도).
 */
import { execFile } from "node:child_process";
import fsp from "node:fs/promises";
import path from "node:path";
import { db, photoPath } from "./db.js";

const ENGINE = process.env.SCREEN_ENGINE || "claude";       // claude | api | off
const MODEL = process.env.SCREEN_MODEL || "claude-haiku-4-5-20251001";
const INTERVAL = Number(process.env.SCREEN_INTERVAL || 20000);
const PASS_CONF = Number(process.env.SCREEN_PASS_CONF || 0.8);
const AUTO_APPROVE = process.env.SCREEN_AUTO_APPROVE !== "0";
const AUTO_REJECT = process.env.SCREEN_AUTO_REJECT !== "0";

const PROMPT = `Output ONLY compact JSON, no markdown, no explanation:
{"photo":true|false,"shark":true|false,"person":true|false,"confidence":0.0-1.0,"reason":"짧은 한국어 한 줄"}

photo = 카메라로 직접 찍은 실제 사진인가.
        스크린샷, 앱 화면, 그림, 일러스트, 카드 이미지, 밈, 웹에서 캡처한 것은 모두 false.
shark  = 실제 물속이나 물가에 상어(또는 큰 물고기)가 보이는가.
person = 사람 얼굴이 알아볼 만큼 크게 찍혔는가. 멀리 있는 인파는 false.

셋 다 엄격하게 판단해. 애매하면 confidence를 낮춰.`;

const qPending = db.prepare(`
  SELECT s.id, s.photo, s.thumb FROM submissions s
  LEFT JOIN screening c ON c.id = s.id
  WHERE s.status='pending' AND c.id IS NULL
  ORDER BY s.submitted_at ASC LIMIT 5`);
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
  if (!v.shark) return "reject";            // 상어 없음
  if (v.person) return "reject";            // 사람이 크게 찍힘
  return "pass";
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
  return verdict;
}

export function startScreener(onChange) {
  if (ENGINE === "off") { console.log("[심사] 꺼짐"); return; }
  console.log(`[심사] ${ENGINE} 엔진으로 ${INTERVAL / 1000}초마다 확인`);
  let busy = false;
  const tick = async () => {
    if (busy) return; busy = true;
    try { for (const row of qPending.all()) await screenOne(row, onChange); }
    catch (e) { console.error("[심사] 오류:", e.message); }
    busy = false;
  };
  setTimeout(tick, 3000);
  setInterval(tick, INTERVAL).unref();
}
