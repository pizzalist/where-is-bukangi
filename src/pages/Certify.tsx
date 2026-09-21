import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import exifr from "exifr";
import type { Status, ZoneCode, Submission } from "../lib/types";
import { addSubmission, drawsLeft, useDraw, DAILY_LIMIT } from "../lib/store";
import { RARITY_ORDER, RARITY_META, oddsPercent } from "../lib/rarity";
import { postSubmission } from "../lib/api";
import { ZONES, ZONE_BY_CODE, inPark, DEFAULT_ZONE } from "../lib/zones";
import ZoneMap from "../components/ZoneMap";
const SMILE = `${import.meta.env.BASE_URL}bukang-smile.webp`;
import CropBox from "../components/CropBox";

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Certify({ onDone, onTiers }: { status: Status; onDone: (s: Submission) => void; onTiers?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState<string | undefined>();
  const [photo, setPhoto] = useState<string | undefined>();
  const [thumb, setThumb] = useState<string | undefined>();
  const [takenAt, setTakenAt] = useState(toLocalInput(new Date()));
  const [zone, setZone] = useState<ZoneCode | "">(DEFAULT_ZONE);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [auto, setAuto] = useState<string[]>([]);
  const [left, setLeft] = useState(drawsLeft());

  async function onFile(f: File) {
    const url = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
    setRaw(url);
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

  function reset() { setRaw(undefined); setPhoto(undefined); setThumb(undefined); setAuto([]); if (fileRef.current) fileRef.current.value = ""; }

  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState("");

  async function draw() {
    if (!photo || sending) return;
    setSending(true); setSendErr("");
    const iso = new Date(takenAt).toISOString();
    try {
      // 등급과 순번은 반드시 서버가 정한다. 실패하면 카드를 만들지 않는다.
      const r = await postSubmission({ photo, thumb, takenAt: iso, zone: zone || undefined, lat: gps?.lat, lng: gps?.lng });
      if (!r) throw new Error("제보를 저장하지 못했어요.");
      const s: Submission = {
        id: r.id, type: "seen", zone: zone || undefined, takenAt: iso, submittedAt: new Date().toISOString(),
        exifGps: gps, photoDataUrl: photo, status: "pending", ordinal: r.ordinal, rarity: r.rarity,
      };
      addSubmission(s);
      useDraw();
      setLeft(drawsLeft());
      onDone(s);
    } catch (e) {
      setSendErr((e as Error).message || "서버에 닿지 않아요. 잠시 뒤 다시 시도해주세요.");
    } finally { setSending(false); }
  }

  return (
    <div className="page">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "grid", gap: "1rem", paddingTop: "1.6rem" }}>
        <div style={{ textAlign: "center" }}>
          <img src={SMILE} alt="" width={photo ? 72 : 110} height={photo ? 72 : 110} />
          <h1 style={{ fontSize: "1.8rem", margin: "0.4rem 0 0.25rem" }}>{photo ? "언제, 어디서 봤어요?" : "사진 한 장이면 끝"}</h1>
          <p style={{ color: "var(--ink-2)", margin: 0, fontSize: "0.95rem" }}>
            {photo ? "사진에서 읽은 값이에요. 다르면 바꿔주세요." : "부캉이 사진을 올리면 카드가 바로 뽑혀요."}
          </p>
          <div className="quota">오늘 <b>{left}</b>장 남음 <span>· 매일 {DAILY_LIMIT}장, 자정에 채워져요</span></div>
        </div>

        {raw && !photo && (
          <CropBox src={raw} onDone={(d, t) => { setPhoto(d); setThumb(t); }} onCancel={reset} />
        )}

        {!(raw && !photo) && (
        <button className="pickbox" onClick={() => { if (left > 0) { reset(); fileRef.current?.click(); } }} disabled={left <= 0}>
          {photo ? <img src={photo} alt="" /> : (
            <span className="pickbox-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 7h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
              사진 고르기
            </span>
          )}
          {photo && <span className="pickbox-change">바꾸기</span>}
        </button>
        )}
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
                  <b>{zone ? ZONE_BY_CODE[zone].full : "지도에서 골라주세요"}</b>{zone === DEFAULT_ZONE && <small className="pm-def">처음 나타난 곳</small>}
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
              <button className="btn btn-big" onClick={draw} disabled={left <= 0 || sending}>{sending ? "보내는 중…" : left > 0 ? "카드 뽑기" : "오늘 뽑기를 다 썼어요"}</button>
              {sendErr && <div className="alert warn">{sendErr}</div>}
              <p className="reportnote">이 카드는 <b>제보로도 들어가요.</b> 시각과 위치가 상황판 타임라인에 쌓여서 다음 사람이 "지금 있나"를 알 수 있어요.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="tiers-promo">
          <div className="tp-head">
            <div>
              <b>등급 9종</b>
              <small>커먼부터 시크릿 골드까지</small>
            </div>
            <button className="tp-more" onClick={onTiers}>전부 보기 ›</button>
          </div>
          <div className="tp-grid">
            {RARITY_ORDER.map((r) => (
              <button key={r} className={`tp-cell tp-${r}`} onClick={onTiers}>
                <span className="tp-sym">{RARITY_META[r].symbol}</span>
                <span className="tp-name">{RARITY_META[r].label}</span>
                <span className="tp-odds">{oddsPercent(r)}%</span>
              </button>
            ))}
          </div>
        </div>

        <details className="privacy">
          <summary>사진은 어떻게 쓰이나요?</summary>
          <ul>
            <li>올린 사진은 <b>운영자 확인 뒤 공개</b>돼요. 상황판 기록과 명예의 전당에 촬영 시각·구역과 함께 실려요.</li>
            <li>사진과 기록은 <b>부캉이 기록으로 계속 보관</b>해요.</li>
            <li>이름·연락처 같은 개인정보는 받지 않아요. 누가 올렸는지 저희도 몰라요.</li>
            <li><b>부캉이만 나온 사진을 올려주세요.</b> 사람이 찍힌 사진은 반려돼요.</li>
          </ul>
        </details>
      </motion.div>
    </div>
  );
}
