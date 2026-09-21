import type { Status, Submission } from "./types";
import { loadStatus as loadStatic } from "./store";

/** 서버가 있으면 서버를, 없으면 정적 파일을 쓴다 (아티팩트 데모용 폴백). */
let serverUp: boolean | null = null;

export async function fetchStatus(): Promise<Status> {
  if (serverUp !== false) {
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      if (r.ok) { serverUp = true; return await r.json(); }
    } catch { /* 폴백 */ }
    serverUp = false;
  }
  return loadStatic();
}

export interface DrawResult { id: string; ordinal: number; rarity: Submission["rarity"]; photo?: string }

/** 제보 전송. 서버가 등급과 순번을 정한다. 실패하면 null을 돌려주고 로컬로 처리한다. */
export async function postSubmission(body: { photo: string; thumb?: string; takenAt: string; zone?: string; lat?: number; lng?: number }): Promise<DrawResult | null> {
  if (serverUp === false) return null;
  try {
    const r = await fetch("/api/submissions", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    serverUp = true;
    return await r.json();
  } catch { serverUp = false; return null; }
}

export interface HallItem { id: string; ordinal: number; rarity: NonNullable<Submission["rarity"]>; zone?: string; takenAt: string; photo: string }
export async function fetchHall(): Promise<HallItem[]> {
  try { const r = await fetch("/api/hall"); return r.ok ? await r.json() : []; } catch { return []; }
}
