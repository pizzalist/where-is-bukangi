import { useRef, useState } from "react";
import { motion } from "framer-motion";
import exifr from "exifr";
import type { Status, ZoneCode, CertType, Submission } from "../lib/types";
import { addSubmission, uid, nextOrdinal } from "../lib/store";
import ZoneMap from "../components/ZoneMap";

/** 구역 중심 좌표 (초안, 현장에서 확정). 가장 가까운 구역으로 배정. */
const ZONE_CENTERS: Record<Exclude<ZoneCode, "F">, { lat: number; lng: number }> = {
  A: { lat: 35.1035, lng: 129.0420 },
  B: { lat: 35.1030, lng: 129.0400 },
  C: { lat: 35.1027, lng: 129.0385 },
  D: { lat: 35.1024, lng: 129.0368 },
  E: { lat: 35.1020, lng: 129.0350 },
};
function nearestZone(lat: number, lng: number): ZoneCode {
  let best: ZoneCode = "F", bd = Infinity;
  for (const [code, c] of Object.entries(ZONE_CENTERS)) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bd) { bd = d; best = code as ZoneCode; }
  }
  // 대략 400m 밖이면 불명
  return bd > (0.004 ** 2) ? "F" : best;
}

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Certify({ status, onDone }: { status: Status; onDone: (s: Submission) => void }) {
  const [type, setType] = useState<CertType>("seen");
  const [zone, setZone] = useState<ZoneCode | null>(null);
  const [takenAt, setTakenAt] = useState(toLocalInput(new Date()));
  const [photo, setPhoto] = useState<string | undefined>();
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [exifNote, setExifNote] = useState<string>("");
  const [link, setLink] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(f: File) {
    const url = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
    setPhoto(url);
    try {
      const [ex, g] = await Promise.all([
        exifr.parse(f, { pick: ["DateTimeOriginal"] }).catch(() => null),
        exifr.gps(f).catch(() => null),
      ]);
      const notes: string[] = [];
      if (ex?.DateTimeOriginal) { setTakenAt(toLocalInput(new Date(ex.DateTimeOriginal))); notes.push("촬영 시각 자동 입력"); }
      if (g?.latitude && g?.longitude) {
        setGps({ lat: g.latitude, lng: g.longitude });
        const z = nearestZone(g.latitude, g.longitude);
        setZone(z); notes.push(z === "F" ? "위치가 수로 밖이에요. 구역을 직접 골라주세요" : `${z}구역으로 자동 배정`);
      } else {
        notes.push("위치 정보 없음. 지도에서 구역을 골라주세요 (카톡·인스타 거친 사진은 위치가 지워져요)");
      }
      setExifNote(notes.join(" · "));
    } catch { setExifNote("사진 정보를 읽지 못했어요. 시각과 구역을 직접 입력해주세요"); }
  }

  const canSubmit = !!zone && (!!photo || !!link);

  function submit() {
    if (!zone) return;
    const s: Submission = {
      id: uid(), type, zone, takenAt: new Date(takenAt).toISOString(), submittedAt: new Date().toISOString(),
      exifGps: gps, photoDataUrl: photo, link: link || undefined, status: "pending",
      ordinal: nextOrdinal(type, status.counters),
    };
    addSubmission(s);
    onDone(s);
  }

  return (
    <div className="page">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 style={{ fontSize: "1.6rem", margin: "1.2rem 0 0.2rem" }}>인증받기</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 0 }}>사진 한 장이면 바로 카드를 드려요. 상황판에는 운영자가 확인한 것만 올라가요. 사진은 공개하지 않고 24시간 안에 지워요.</p>

        <div className="field">
          <label>어떤 인증인가요</label>
          <div className="seg">
            <button className={type === "seen" ? "on" : ""} onClick={() => setType("seen")}>목격 인증<br /><small style={{ fontWeight: 400 }}>상어가 찍힌 사진</small></button>
            <button className={type === "visit" ? "on" : ""} onClick={() => setType("visit")}>방문 인증<br /><small style={{ fontWeight: 400 }}>현장 어디든 OK</small></button>
          </div>
          <div className="hint">물가에 가까이 갈 필요 없어요. 멀리서 찍어도 인증돼요.</div>
        </div>

        <div className="field">
          <label>사진</label>
          <div className="drop" onClick={() => fileRef.current?.click()}>
            {photo ? <img src={photo} alt="" /> : <div>탭해서 카메라 앨범에서 고르기</div>}
            <div style={{ fontSize: "0.8rem" }}>앨범 원본이면 시각·위치가 자동으로 들어가요</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          {exifNote && <div className="alert ok">{exifNote}</div>}
        </div>

        <div className="field">
          <label>또는 인스타·유튜브 링크</label>
          <input type="url" placeholder="https://www.instagram.com/reel/..." value={link} onChange={(e) => setLink(e.target.value)} />
          <div className="hint">링크는 "SNS 추정" 등급으로 들어가요. 댓글의 "지금 보여요" 같은 표현에서 시각을 추정해요.</div>
        </div>

        <div className="field">
          <label>본 시각</label>
          <input type="datetime-local" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
        </div>

        <div className="field">
          <label>구역 {zone && <span className="pill est">{zone}</span>}</label>
          <ZoneMap active={zone} onPick={setZone} />
          <div className="zone-legend">
            {status.zones.map((z) => (
              <button key={z.code} className="zone-chip" style={{ cursor: "pointer", ...(zone === z.code ? { borderColor: "var(--sky-deep)", color: "var(--sky-deep)" } : {}) }} onClick={() => setZone(z.code)}>
                <b>{z.code}</b>{z.name}
              </button>
            ))}
          </div>
        </div>

        <button className="btn" disabled={!canSubmit} onClick={submit}>카드 받기</button>
        <p className="disclaimer">연락처는 받지 않아요. 얼굴이 크게 나온 사진은 반려될 수 있어요.</p>
      </motion.div>
    </div>
  );
}
