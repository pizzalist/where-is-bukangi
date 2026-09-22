import type { Status, Submission } from "./types";
import { loadStatus as loadStatic } from "./store";
import { API_BASE } from "./site";

/** 서버가 있으면 서버를, 없으면 정적 파일을 쓴다 (아티팩트 데모용 폴백). */
let serverUp: boolean | null = null;

export function isServerUp() { return serverUp === true; }

export async function fetchStatus(): Promise<Status> {
  try {
    const r = await fetch(`${API_BASE}/api/status`, { cache: "no-store" });
    if (r.ok) { serverUp = true; return await r.json(); }
  } catch { /* 아래 폴백 */ }
  serverUp = false;
  // 서버가 없으면 데모 데이터를 쓰되, 진짜인 척하지 않는다
  const s = await loadStatic();
  return { ...s, demo: true };
}

export interface DrawResult { id: string; ordinal: number; rarity: Submission["rarity"]; photo?: string }

/** 제보 전송. 서버가 등급과 순번을 정한다. 실패하면 null (호출부가 오류를 보여준다). */
export async function postSubmission(body: { photo: string; thumb?: string; takenAt: string; zone?: string; lat?: number; lng?: number }): Promise<DrawResult | null> {
  try {
    const r = await fetch(`${API_BASE}/api/submissions`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!r.ok) {
      const msg = (await r.json().catch(() => ({}))).error;
      throw new Error(msg || "제보를 저장하지 못했어요.");
    }
    serverUp = true;
    return await r.json();
  } catch (e) {
    serverUp = false;
    throw e instanceof Error ? e : new Error("서버에 닿지 않아요.");
  }
}

export interface HallItem { id: string; ordinal: number; rarity: NonNullable<Submission["rarity"]>; zone?: string; takenAt: string; photo: string }
export async function fetchHall(): Promise<HallItem[]> {
  try { const r = await fetch(`${API_BASE}/api/hall`); return r.ok ? await r.json() : []; } catch { return []; }
}

export interface CardInfo { id: string; ordinal: number; rarity: NonNullable<Submission["rarity"]>; zone?: string | null; zoneName?: string; takenAt: string; status: Submission["status"]; photo?: string | null }
/** 공유 링크로 들어온 카드. 내 기기에 없으면 서버에서 가져온다. */
export async function fetchCard(id: string): Promise<CardInfo | null> {
  try { const r = await fetch(`${API_BASE}/api/submissions/${encodeURIComponent(id)}`); return r.ok ? await r.json() : null; } catch { return null; }
}

/** 현장 탭. 공원 안에서만 통한다. 실패 사유를 그대로 올려 호출부가 보여준다 */
export async function sendPing(body: { kind: "seen" | "miss"; zone?: string; lat: number; lng: number }): Promise<void> {
  const r = await fetch(`${API_BASE}/api/ping`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "지금은 보낼 수 없어요.");
}
