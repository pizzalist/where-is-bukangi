import type { Status, Submission } from "./types";

const KEY = "bukang.submissions.v1";
const COUNTER_KEY = "bukang.counters.v1";
const QUOTA_KEY = "bukang.quota.v1";

/** 하루 뽑기 상한. 재방문을 만들고 무작위 대량 업로드를 막는다. */
export const DAILY_LIMIT = 3;

function today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }

export function drawsLeft() {
  try {
    const q = JSON.parse(localStorage.getItem(QUOTA_KEY) || "null");
    if (!q || q.date !== today()) return DAILY_LIMIT;
    return Math.max(0, DAILY_LIMIT - q.used);
  } catch { return DAILY_LIMIT; }
}

export function consumeDraw() {
  try {
    const q = JSON.parse(localStorage.getItem(QUOTA_KEY) || "null");
    const used = (!q || q.date !== today()) ? 1 : q.used + 1;
    localStorage.setItem(QUOTA_KEY, JSON.stringify({ date: today(), used }));
  } catch { /* ignore */ }
}

export async function loadStatus(): Promise<Status> {
  const res = await fetch(`${import.meta.env.BASE_URL}status.json`, { cache: "no-store" });
  const s: Status & { demo?: boolean } = await res.json();
  // 드래프트 데모: 마지막 목격이 항상 "8분 전"이 되도록 모든 시각을 평행 이동
  if (s.demo && s.last) {
    const shift = Date.now() - 8 * 60000 - new Date(s.last.at).getTime();
    const mv = (iso: string) => new Date(new Date(iso).getTime() + shift).toISOString();
    s.updatedAt = mv(s.updatedAt);
    s.last = { ...s.last, at: mv(s.last.at) };
    s.timeline = s.timeline.map((e) => ({ ...e, at: mv(e.at) }));
  }
  return s;
}

export function loadSubmissions(): Submission[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function saveSubmissions(list: Submission[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
}
export function addSubmission(s: Submission) {
  const list = loadSubmissions();
  list.unshift(s);
  saveSubmissions(list);
}
export function updateSubmission(id: string, patch: Partial<Submission>) {
  const list = loadSubmissions().map((s) => (s.id === id ? { ...s, ...patch } : s));
  saveSubmissions(list);
  return list;
}

export function nextOrdinal(type: "seen" | "visit", base: { seen: number; visit: number }) {
  let c: { seen: number; visit: number };
  try { c = JSON.parse(localStorage.getItem(COUNTER_KEY) || "null") || { ...base }; } catch { c = { ...base }; }
  c[type] += 1;
  try { localStorage.setItem(COUNTER_KEY, JSON.stringify(c)); } catch { /* ignore */ }
  return c[type];
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** 정보 나이 (분) */
export function ageMinutes(iso: string, now = Date.now()) {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
}
export function fmtAge(min: number) {
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 ${min % 60}분 전`;
  return `${Math.floor(h / 24)}일 전`;
}
/** 부산에 있는 상어 이야기라, 어디서 보든 한국 시간으로 보여준다 */
function kstParts(iso: string) {
  const f = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value])) as Record<string, string>;
  return { y: p.year, m: p.month, d: p.day, hh: p.hour === "24" ? "00" : p.hour, mm: p.minute };
}
export function fmtTime(iso: string) {
  const p = kstParts(iso);
  return `${p.hh}:${p.mm}`;
}
/** 오늘이 아니면 날짜를 붙인다. "23:10"만 보이면 어제 건지 알 수 없다 */
export function fmtWhen(iso: string) {
  const p = kstParts(iso), t = kstParts(new Date().toISOString());
  if (p.y === t.y && p.m === t.m && p.d === t.d) return `${p.hh}:${p.mm}`;
  const y = kstParts(new Date(Date.now() - 864e5).toISOString());
  if (p.y === y.y && p.m === y.m && p.d === y.d) return `어제 ${p.hh}:${p.mm}`;
  return `${Number(p.m)}/${Number(p.d)} ${p.hh}:${p.mm}`;
}
/** 오늘(한국 시간) 기록인가 */
export function isToday(iso: string) {
  const p = kstParts(iso), t = kstParts(new Date().toISOString());
  return p.y === t.y && p.m === t.m && p.d === t.d;
}
export function fmtDate(iso: string) {
  const p = kstParts(iso);
  return `${p.y}.${p.m}.${p.d}`;
}

