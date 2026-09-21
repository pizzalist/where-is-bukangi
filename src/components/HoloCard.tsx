import { useEffect, useRef, useState } from "react";
import type { CertType, ZoneCode } from "../lib/types";
import { RARITY_META, cardStats, type Rarity } from "../lib/rarity";
import { fmtDate, fmtTime } from "../lib/store";

export interface HoloCardProps {
  type: CertType;
  ordinal: number;
  takenAt: string;
  zone: ZoneCode;
  zoneName: string;
  photoDataUrl?: string;
  rarity: Rarity;
  interactive?: boolean;
  /** 고정 각도 미리보기 (예시 페이지용). 0~100 */
  fixed?: { mx: number; my: number };
}

/** 포켓몬 카드식 3D 홀로 카드. 포인터/기울기에 따라 회전 + 포일 이동 + 반사광. */
export default function HoloCard(p: HoloCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(!!p.fixed);
  const meta = RARITY_META[p.rarity];
  const stats = cardStats(p.ordinal, p.takenAt);
  const seen = p.type === "seen";

  function setPos(mx: number, my: number) {
    const el = ref.current; if (!el) return;
    const rx = ((my - 50) / 50) * -14, ry = ((mx - 50) / 50) * 14;
    el.style.setProperty("--mx", `${mx}%`); el.style.setProperty("--my", `${my}%`);
    el.style.setProperty("--rx", `${rx}deg`); el.style.setProperty("--ry", `${ry}deg`);
    el.style.setProperty("--px", `${100 - mx}%`); el.style.setProperty("--py", `${100 - my}%`);
    el.style.setProperty("--hyp", `${Math.min(1, Math.hypot(mx - 50, my - 50) / 50)}`);
  }

  useEffect(() => { if (p.fixed) setPos(p.fixed.mx, p.fixed.my); }, [p.fixed]);

  useEffect(() => {
    if (!p.interactive) return;
    const el = ref.current; if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      setPos(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
      setActive(true);
    };
    const onLeave = () => { setActive(false); setPos(50, 50); };
    el.addEventListener("pointermove", onMove); el.addEventListener("pointerleave", onLeave); el.addEventListener("pointerup", onLeave);
    // 기울기 (iOS는 권한 필요, 아래 버튼에서 요청)
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      const mx = 50 + Math.max(-1, Math.min(1, e.gamma / 30)) * 50;
      const my = 50 + Math.max(-1, Math.min(1, (e.beta - 40) / 30)) * 50;
      setPos(mx, my); setActive(true);
    };
    addEventListener("deviceorientation", onTilt);
    return () => { el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerleave", onLeave); el.removeEventListener("pointerup", onLeave); removeEventListener("deviceorientation", onTilt); };
  }, [p.interactive]);

  return (
    <div ref={ref} className={`holo holo-${p.rarity}${active ? " active" : ""}`} style={{ ["--frame" as string]: meta.frame, ["--frame2" as string]: meta.frame2, ["--ink" as string]: meta.ink }}>
      <div className="holo-inner">
        <div className="holo-frame">
          <div className="holo-top">
            <span className="holo-name">부캉이 <small>{seen ? "목격" : "방문"}</small></span>
            <span className="holo-no mono">No.{p.ordinal.toLocaleString()}</span>
          </div>
          <div className="holo-photo">
            {p.photoDataUrl ? <img src={p.photoDataUrl} alt="" draggable={false} /> : <div className="holo-photo-ph"><SharkSil /></div>}
            <span className="holo-stamp">{seen ? "목격 인증" : "방문 인증"}</span>
          </div>
          <div className="holo-stats">
            <span>길이 <b className="mono">{stats.length}m</b></span>
            <span>출몰력 <b className="mono">{stats.power}</b></span>
            <span>{p.zone}구역 · {p.zoneName}</span>
          </div>
          <div className="holo-moves">
            {stats.moves.map(([n, d]) => (<div key={n}><b>{n}</b><span>{d}</span></div>))}
          </div>
          <div className="holo-flavor">{fmtDate(p.takenAt)} {fmtTime(p.takenAt)} 부산 북항 친수공원에서 {seen ? "직접 목격" : "현장 방문"}.</div>
          <div className="holo-bottom">
            <span className={`holo-rarity r-${p.rarity}`}>{meta.symbol} {meta.label}</span>
            <span className="holo-site">bukang.kr · #부캉이</span>
          </div>
        </div>
        <div className="holo-foil" />
        <div className="holo-sparkle" />
        <div className="holo-glare" />
      </div>
    </div>
  );
}

function SharkSil() {
  return (
    <svg viewBox="0 0 200 124" width="70%" aria-hidden="true">
      <path d="M150 62 L192 30 L182 62 L192 94 Z" fill="rgba(255,255,255,.55)" />
      <path d="M20 66 C40 30, 110 22, 160 62 C110 100, 40 96, 20 66 Z" fill="rgba(255,255,255,.7)" />
      <path d="M92 36 L112 6 L126 40 Z" fill="rgba(255,255,255,.55)" />
      <circle cx="46" cy="58" r="6" fill="#0f2a3a" />
    </svg>
  );
}
