/**
 * 운영자 알림 (디스코드 웹훅).
 * AI가 판단을 보류했거나(unsure) 실패한(error) 제보만 보낸다. 통과·반려는 조용히 처리.
 * 메시지에 썸네일과 "공개 / 반려" 서명 링크를 붙여서 폰에서 바로 처리할 수 있게 한다.
 *
 * 환경변수
 *  DISCORD_WEBHOOK  웹훅 URL. 없으면 알림 꺼짐
 *  PUBLIC_URL       API 서버의 바깥 주소 (터널 주소). 서명 링크의 앞부분
 *  SITE_URL         사이트 주소. 관리자 페이지 링크용 (선택)
 *  NOTIFY_ON        알릴 판정. 기본 "unsure,error"
 */
import crypto from "node:crypto";
import fsp from "node:fs/promises";
import { photoPath } from "./db.js";

const WEBHOOK = process.env.DISCORD_WEBHOOK || "";
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const SITE_URL = (process.env.SITE_URL || "").replace(/\/$/, "");
const ON = new Set((process.env.NOTIFY_ON || "unsure,error").split(",").map((s) => s.trim()).filter(Boolean));
const SECRET = process.env.ADMIN_TOKEN || "";

export const enabled = !!WEBHOOK;

/** 링크 서명. 같은 (id, action)이면 항상 같은 값 → 링크는 pending일 때만 통한다 */
export function sign(id, action) {
  return crypto.createHmac("sha256", SECRET).update(`${id}.${action}`).digest("base64url").slice(0, 22);
}
export function verify(id, action, sig) {
  const a = Buffer.from(sign(id, action)), b = Buffer.from(String(sig || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function actionUrl(id, action) {
  return PUBLIC_URL ? `${PUBLIC_URL}/r/${id}/${action}/${sign(id, action)}` : null;
}

const ZONE_NAME = { A: "제4보도교", B: "제5보도교", C: "제6보도교", D: "방파제" };
const VERDICT_LABEL = { unsure: "AI 판단 보류", error: "AI 심사 실패", pass: "AI 통과", reject: "AI 반려" };
const COLOR = { unsure: 0xf5a623, error: 0xd0021b, pass: 0x2ecc71, reject: 0x95a5a6 };

function fmtKST(iso) {
  try { return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

/**
 * 심사 결과 하나를 알린다. 실패해도 예외를 던지지 않는다 (심사가 멈추면 안 되니까).
 * row: { id, ordinal, zone, taken_at, rarity, thumb, photo }
 * v:   { photo, shark, person, confidence, reason }
 */
export async function notifyVerdict(row, verdict, v) {
  if (!WEBHOOK || !ON.has(verdict)) return false;
  const approve = actionUrl(row.id, "approve"), reject = actionUrl(row.id, "reject");
  const lines = [];
  if (approve && reject) lines.push(`[✅ 공개](${approve})   [❌ 반려](${reject})`);
  else lines.push("PUBLIC_URL이 없어 링크를 못 만들었어요. 관리자 페이지에서 처리하세요.");
  if (SITE_URL) lines.push(`[관리자 페이지](${SITE_URL}/#/admin)`);

  const embed = {
    title: `${VERDICT_LABEL[verdict] || verdict} · No.${Number(row.ordinal || 0).toLocaleString()}`,
    color: COLOR[verdict] ?? 0x888888,
    description: lines.join("\n"),
    fields: [
      { name: "구역", value: row.zone ? `${row.zone} ${ZONE_NAME[row.zone] || ""}` : "미지정", inline: true },
      { name: "촬영", value: fmtKST(row.taken_at), inline: true },
      { name: "등급", value: String(row.rarity || "-"), inline: true },
      { name: "AI", value: `실사진 ${v.photo == null ? "?" : v.photo ? "O" : "X"} · 상어 ${v.shark == null ? "?" : v.shark ? "O" : "X"} · 사람 ${v.person == null ? "?" : v.person ? "O" : "X"}${v.confidence != null ? ` · 확신 ${Math.round(v.confidence * 100)}%` : ""}` },
      ...(v.reason ? [{ name: "이유", value: String(v.reason).slice(0, 200) }] : []),
    ],
    footer: { text: `id ${row.id}` },
    timestamp: new Date().toISOString(),
  };

  const fd = new FormData();
  const file = row.thumb || row.photo;
  if (file) {
    try {
      const buf = await fsp.readFile(photoPath(file));
      const ext = file.endsWith(".webp") ? "webp" : file.endsWith(".png") ? "png" : "jpg";
      fd.append("files[0]", new Blob([buf], { type: `image/${ext === "jpg" ? "jpeg" : ext}` }), `thumb.${ext}`);
      embed.image = { url: `attachment://thumb.${ext}` };
    } catch (e) { console.warn("[알림] 썸네일 읽기 실패:", e.message); }
  }
  fd.append("payload_json", JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }));

  try {
    const r = await fetch(WEBHOOK, { method: "POST", body: fd, signal: AbortSignal.timeout(10000) });
    if (!r.ok) { console.warn(`[알림] 디스코드 ${r.status}: ${(await r.text()).slice(0, 200)}`); return false; }
    return true;
  } catch (e) { console.warn("[알림] 전송 실패:", e.message); return false; }
}

/** 서버 시작 시 한 번. 웹훅이 살아 있는지 확인용 */
export async function notifyText(text) {
  if (!WEBHOOK) return false;
  try {
    const r = await fetch(WEBHOOK, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: String(text).slice(0, 1900), allowed_mentions: { parse: [] } }), signal: AbortSignal.timeout(10000) });
    return r.ok;
  } catch { return false; }
}
