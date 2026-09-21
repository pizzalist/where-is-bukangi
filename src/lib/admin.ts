import type { ZoneCode } from "./types";
import type { Rarity } from "./rarity";

const KEY = "bukang.admin.token";
export function getToken() { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } }
export function setToken(t: string) { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* ignore */ } }

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(init?.headers || {}) },
  });
  if (r.status === 401) throw new Error("UNAUTHORIZED");
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
  return r.json();
}

export interface QueueItem {
  id: string; ordinal: number; rarity: Rarity; zone: ZoneCode | null;
  takenAt: string; submittedAt: string; photo: string | null; lat: number | null; lng: number | null;
  aiVerdict?: "pass" | "reject" | "unsure" | "error" | null;
  aiShark?: number | null; aiPerson?: number | null; aiConf?: number | null; aiReason?: string | null;
}

export const adminApi = {
  queue: () => call<QueueItem[]>("/api/admin/queue"),
  decide: (id: string, action: "approve" | "reject", zone?: ZoneCode | null) =>
    call<{ ok: true }>(`/api/admin/${id}/${action}`, { method: "POST", body: JSON.stringify({ zone }) }),
  observation: (b: { kind: "seen" | "miss"; zone?: ZoneCode | null; at?: string; note?: string }) =>
    call<{ ok: true }>("/api/admin/observation", { method: "POST", body: JSON.stringify(b) }),
  notice: (b: { src: string; title: string; url?: string; crit?: boolean }) =>
    call<{ ok: true }>("/api/admin/notice", { method: "POST", body: JSON.stringify(b) }),
};
