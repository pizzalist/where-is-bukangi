import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import exifr from "exifr";
import type { Status, ZoneCode, Submission } from "../lib/types";
import { addSubmission, uid, nextOrdinal } from "../lib/store";
import { rollRarity, RARITY_ORDER, RARITY_META, oddsPercent } from "../lib/rarity";
import { ZONES, ZONE_BY_CODE, inPark } from "../lib/zones";
import ZoneMap from "../components/ZoneMap";
import Shark from "../components/Shark";

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Certify({ status, onDone }: { status: Status; onDone: (s: Submission) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | undefined>();
  const [takenAt, setTakenAt] = useState(toLocalInput(new Date()));
  const [zone, setZone] = useState<ZoneCode | "">("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [auto, setAuto] = useState<string[]>([]);

  async function onFile(f: File) {
    const url = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
    setPhoto(url);
    const got: string[] = [];
    try {
      const [ex, g] = await Promise.all([exifr.parse(f, { pick: ["DateTimeOriginal"] }).catch(() => null), exifr.gps(f).catch(() => null)]);
      if (ex?.DateTimeOriginal) { setTakenAt(toLocalInput(new Date(ex.DateTimeOriginal))); got.push("시각"); }
      if (g?.latitude && g?.longitude) {
        setGps({ lat: g.latitude, lng: g.longitude });
        if (inPark(g.latitude, g.longitude)) got.push("공원 안에서 찍은 사진");
      }
    } catch { /* 없으면 직접 고르기 */ }
    setAuto(got);
  }

  function draw() {
    if (!photo) return;
    const iso = new Date(takenAt).toISOString();
    const s: Submission = {
      id: uid(), type: "seen", zone: zone || undefined, takenAt: iso, submittedAt: new Date().toISOString(),
      exifGps: gps, photoDataUrl: photo, status: "pending",
      ordinal: nextOrdinal("seen", status.counters), rarity: rollRarity({ type: "seen", takenAt: iso }),
    };
    addSubmission(s);
    onDone(s);
  }

  return (
    <div className="page">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "grid", gap: "1rem", paddingTop: "1.6rem" }}>
        <div style={{ textAlign: "center" }}>
          <Shark size={photo ? 72 : 110} />
          <h1 style={{ fontSize: "1.8rem", margin: "0.4rem 0 0.25rem" }}>{photo ? "언제, 어디서 봤어요?" : "사진 한 장이면 끝"}</h1>
          <p style={{ color: "var(--ink-2)", margin: 0, fontSize: "0.95rem" }}>
            {photo ? "사진에서 읽은 값이에요. 다르면 바꿔주세요." : "부캉이 사진을 올리면 카드가 바로 뽑혀요."}
          </p>
        </div>

        <button className="pickbox" onClick={() => fileRef.current?.click()}>
          {photo ? <img src={photo} alt="" /> : (
            <span className="pickbox-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 7h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
              사진 고르기
            </span>
          )}
          {photo && <span className="pickbox-change">바꾸기</span>}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />

        <AnimatePresence>
          {photo && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} style={{ display: "grid", gap: "0.6rem", overflow: "hidden" }}>
              {auto.length > 0 && <div className="autonote">{auto.join(" · ")} 확인</div>}
              <label className="pickrow">
                <span className="pl">본 시각</span>
                <input type="datetime-local" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
              </label>
              <div className="pickmap">
                <div className="pm-head">
                  <span className="pl">본 곳</span>
                  <b>{zone ? ZONE_BY_CODE[zone].full : "지도에서 골라주세요"}</b>
                </div>
                <ZoneMap active={zone || null} onPick={(z) => setZone(z)} />
                <div className="pm-chips">
                  {ZONES.map((z) => (
                    <button key={z.code} type="button" className={`pm-chip${zone === z.code ? " on" : ""}`} onClick={() => setZone(z.code)}>
                      <b>{z.code}</b>{z.name}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-big" onClick={draw}>카드 뽑기</button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="tiers-promo">
          <div className="tp-head">
            <div>
              <b>등급 9종</b>
              <small>커먼부터 시크릿 골드까지</small>
            </div>
            <a href="#/tiers" className="tp-more">전부 보기 ›</a>
          </div>
          <div className="tp-grid">
            {RARITY_ORDER.map((r) => (
              <a key={r} href="#/tiers" className={`tp-cell tp-${r}`}>
                <span className="tp-sym">{RARITY_META[r].symbol}</span>
                <span className="tp-name">{RARITY_META[r].label}</span>
                <span className="tp-odds">{oddsPercent(r)}%</span>
              </a>
            ))}
          </div>
        </div>

        <p className="disclaimer">올린 사진과 기록은 부캉이 소식으로 사람들에게 공유돼요.</p>
      </motion.div>
    </div>
  );
}
