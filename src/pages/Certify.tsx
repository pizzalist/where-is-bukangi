import { useRef, useState } from "react";
import { motion } from "framer-motion";
import exifr from "exifr";
import type { Status, ZoneCode, Submission } from "../lib/types";
import { addSubmission, uid, nextOrdinal } from "../lib/store";
import { rollRarity, RARITY_ORDER, RARITY_META, oddsPercent } from "../lib/rarity";
import Shark from "../components/Shark";

/** 구역 중심 좌표 (초안). 가장 가까운 구역으로 조용히 배정, 멀면 F(불명). */
const ZONE_CENTERS: Record<Exclude<ZoneCode, "F">, { lat: number; lng: number }> = {
  A: { lat: 35.1035, lng: 129.0420 }, B: { lat: 35.1030, lng: 129.0400 }, C: { lat: 35.1027, lng: 129.0385 },
  D: { lat: 35.1024, lng: 129.0368 }, E: { lat: 35.1020, lng: 129.0350 },
};
function nearestZone(lat: number, lng: number): ZoneCode {
  let best: ZoneCode = "F", bd = Infinity;
  for (const [code, c] of Object.entries(ZONE_CENTERS)) { const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2; if (d < bd) { bd = d; best = code as ZoneCode; } }
  return bd > 0.004 ** 2 ? "F" : best;
}

export default function Certify({ status, onDone }: { status: Status; onDone: (s: Submission) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(f: File) {
    setBusy(true);
    const photo = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
    let takenAt = new Date().toISOString(); let zone: ZoneCode = "F"; let gps: { lat: number; lng: number } | null = null;
    try {
      const [ex, g] = await Promise.all([exifr.parse(f, { pick: ["DateTimeOriginal"] }).catch(() => null), exifr.gps(f).catch(() => null)]);
      if (ex?.DateTimeOriginal) takenAt = new Date(ex.DateTimeOriginal).toISOString();
      if (g?.latitude && g?.longitude) { gps = { lat: g.latitude, lng: g.longitude }; zone = nearestZone(g.latitude, g.longitude); }
    } catch { /* 없으면 기본값 */ }
    const s: Submission = {
      id: uid(), type: "seen", zone, takenAt, submittedAt: new Date().toISOString(), exifGps: gps, photoDataUrl: photo, status: "pending",
      ordinal: nextOrdinal("seen", status.counters), rarity: rollRarity({ type: "seen", takenAt }),
    };
    addSubmission(s);
    onDone(s);
  }

  return (
    <div className="page">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "grid", gap: "1.2rem", paddingTop: "2rem" }}>
        <div style={{ textAlign: "center" }}>
          <Shark size={120} />
          <h1 style={{ fontSize: "1.9rem", margin: "0.5rem 0 0.3rem" }}>사진 한 장이면 끝</h1>
          <p style={{ color: "var(--ink-2)", margin: 0 }}>부캉이 사진을 올리면 카드가 바로 뽑혀요.<br />등급은 랜덤, 한 장에 한 번.</p>
        </div>

        <button className="btn" style={{ padding: "1.1rem", fontSize: "1.1rem", borderRadius: 18 }} disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? "뽑는 중…" : "사진 올리고 카드 뽑기"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />

        <div className="card" style={{ padding: "0.9rem 1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <b style={{ fontFamily: "Jua", fontWeight: 400 }}>등급 9종</b>
            <a href="#/tiers" style={{ fontSize: "0.82rem" }}>전부 보기</a>
          </div>
          <div className="tier-strip">
            {RARITY_ORDER.map((r) => (
              <a key={r} href="#/tiers" className={`tier-dot tier-dot-${r}`} title={RARITY_META[r].label}>
                <span>{RARITY_META[r].symbol}</span>
                <small>{RARITY_META[r].label}<br />{oddsPercent(r)}%</small>
              </a>
            ))}
          </div>
        </div>

        <p className="disclaimer">사진은 공개하지 않고 24시간 안에 지워요. 연락처는 안 받아요. 사진 속 시각·위치로 카드가 채워져요.</p>
      </motion.div>
    </div>
  );
}
