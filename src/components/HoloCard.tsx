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
  /** 고정 각도 (0~100). 예시용 */
  fixed?: { mx: number; my: number };
  /** 손 안 댈 때 자동으로 천천히 도는 데모 */
  sweep?: boolean;
}

/**
 * 포켓몬 TCG 스타일 3D 홀로 카드.
 * 포인터/기울기 → 회전각(--rx/--ry), 포일 위치(--posx/--posy), 반사광 위치(--mx/--my), 세기(--hyp).
 * 효과 레이어: .fx-shine(포일) .fx-glitter(반짝이) .fx-glare(반사광). 등급별 CSS에서 조합.
 */
export default function HoloCard(p: HoloCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(!!p.fixed || !!p.sweep);
  const touching = useRef(false);
  const meta = RARITY_META[p.rarity];
  const stats = cardStats(p.ordinal, p.takenAt);
  const seen = p.type === "seen";

  function setPos(mx: number, my: number) {
    const el = ref.current; if (!el) return;
    mx = Math.max(0, Math.min(100, mx)); my = Math.max(0, Math.min(100, my));
    const rx = ((my - 50) / 50) * -13, ry = ((mx - 50) / 50) * 13;
    const hyp = Math.min(1, Math.hypot(mx - 50, my - 50) / 50);
    el.style.setProperty("--mx", `${mx}%`); el.style.setProperty("--my", `${my}%`);
    el.style.setProperty("--rx", `${rx}deg`); el.style.setProperty("--ry", `${ry}deg`);
    el.style.setProperty("--posx", `${50 + (mx - 50) / 1.5}%`); el.style.setProperty("--posy", `${50 + (my - 50) / 1.5}%`);
    el.style.setProperty("--hyp", `${hyp}`);
  }

  useEffect(() => { if (p.fixed) setPos(p.fixed.mx, p.fixed.my); }, [p.fixed]);

  // 자동 스윕 (예시 페이지)
  useEffect(() => {
    if (!p.sweep) return;
    let raf = 0; const t0 = performance.now();
    const loop = (t: number) => {
      if (!touching.current) { const a = (t - t0) / 2200; setPos(50 + Math.cos(a) * 32, 50 + Math.sin(a * 0.8) * 26); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [p.sweep]);

  useEffect(() => {
    if (!p.interactive) return;
    const el = ref.current; if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      touching.current = true;
      setPos(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
      setActive(true);
    };
    const onLeave = () => { touching.current = false; if (!p.sweep) { setActive(false); setPos(50, 50); } };
    el.addEventListener("pointermove", onMove); el.addEventListener("pointerleave", onLeave); el.addEventListener("pointerup", onLeave); el.addEventListener("pointercancel", onLeave);
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      touching.current = true;
      setPos(50 + Math.max(-1, Math.min(1, e.gamma / 28)) * 50, 50 + Math.max(-1, Math.min(1, (e.beta - 40) / 28)) * 50);
      setActive(true);
    };
    addEventListener("deviceorientation", onTilt);
    return () => { el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerleave", onLeave); el.removeEventListener("pointerup", onLeave); el.removeEventListener("pointercancel", onLeave); removeEventListener("deviceorientation", onTilt); };
  }, [p.interactive, p.sweep]);

  const style = { ["--frame" as string]: meta.frame, ["--frame2" as string]: meta.frame2, ["--ink" as string]: meta.ink } as React.CSSProperties;

  return (
    <div ref={ref} className={`holo holo-${p.rarity} layout-${meta.layout}${active ? " active" : ""}`} style={style}>
      <div className="holo-inner">
        {meta.layout === "fullart" && (
          <div className="holo-bleed">{p.photoDataUrl ? <img src={p.photoDataUrl} alt="" draggable={false} /> : <div className="holo-photo-ph"><SharkSil /></div>}</div>
        )}
        <div className="holo-frame">
          <div className="holo-top">
            <span className="holo-name">부캉이 <small>{seen ? "목격" : "방문"}</small></span>
            <span className="holo-no mono">No.{p.ordinal.toLocaleString()}</span>
          </div>
          {meta.layout === "normal" && (
            <div className="holo-photo">
              {p.photoDataUrl ? <img src={p.photoDataUrl} alt="" draggable={false} /> : <div className="holo-photo-ph"><SharkSil /></div>}
              <span className="holo-stamp">{seen ? "목격 인증" : "방문 인증"}</span>
            </div>
          )}
          {meta.layout === "fullart" && <div className="holo-spacer" />}
          <div className="holo-panel">
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
              <span className="holo-rarity">{meta.symbol} {meta.label}</span>
              <span className="holo-site">bukang.kr · #부캉이</span>
            </div>
          </div>
        </div>
        <div className="fx fx-shine" />
        <div className="fx fx-glitter" />
        <div className="fx fx-glare" />
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
