import { useEffect, useRef, useState } from "react";
import type { CertType, ZoneCode } from "../lib/types";
import { RARITY_META, cardStats, type Rarity } from "../lib/rarity";
import { fmtDate, fmtTime } from "../lib/store";
import { SITE_HOST } from "../lib/site";

const SAMPLE = `${import.meta.env.BASE_URL}sample.webp`;

export interface HoloCardProps {
  type: CertType;
  ordinal: number;
  takenAt: string;
  zone?: ZoneCode;
  zoneName?: string;
  photoDataUrl?: string;
  rarity: Rarity;
  id?: string;
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
  const [active, setActive] = useState(!!p.fixed);
  const touching = useRef(false);
  const meta = RARITY_META[p.rarity];
  const stats = cardStats(p.ordinal, p.takenAt, p.id);

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

  // 자동 스윕 (예시 페이지). 화면에 보이는 카드만, 30fps로. 9장이 동시에 60fps로 돌면 폰이 버벅인다.
  useEffect(() => {
    if (!p.sweep) return;
    const el = ref.current; if (!el) return;
    let visible = false, raf = 0, last = 0; const t0 = performance.now();
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || touching.current || t - last < 33) return;
      last = t; const a = (t - t0) / 2200; setPos(50 + Math.cos(a) * 32, 50 + Math.sin(a * 0.8) * 26);
    };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; setActive(visible); }, { rootMargin: "40px" });
    io.observe(el);
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [p.sweep]);

  useEffect(() => {
    if (!p.interactive) return;
    const el = ref.current; if (!el) return;
    let asked = false;
    const askTilt = () => {
      if (asked) return; asked = true;
      const D = (window as Window & { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
      D?.requestPermission?.().catch(() => null); // iOS는 제스처 안에서만 허용, 안드로이드는 권한 자체가 없음
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      askTilt();
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
          <div className="holo-bleed">
            <img src={p.photoDataUrl ?? SAMPLE} alt="" draggable={false} />
            <div className="fx fx-art" /><div className="fx fx-artglitter" />
          </div>
        )}
        <div className="holo-frame">
          <div className="holo-top">
            <span className="holo-name">부캉이</span>
            <span className="holo-no mono">No.{p.ordinal.toLocaleString()}</span>
          </div>
          {meta.layout === "normal" && (
            <div className="holo-photo">
              <img src={p.photoDataUrl ?? SAMPLE} alt="" draggable={false} />
              <div className="fx fx-art" /><div className="fx fx-artglitter" />
              <span className="holo-stamp">부캉이 인증</span>
            </div>
          )}
          {meta.layout === "fullart" && <div className="holo-spacer" />}
          <div className="holo-panel">
            <div className="holo-stats">
              <span>길이 <b className="mono">{stats.length}m</b></span>
              <span>출몰력 <b className="mono">{stats.power}</b></span>
              <span>{p.zone ? p.zoneName : "위치 미확인"}</span>
            </div>
            <div className="holo-moves">
              {stats.moves.map(([n, d]) => (<div key={n}><b>{n}</b><span>{d}</span></div>))}
            </div>
            <div className="holo-flavor">{fmtDate(p.takenAt)} {fmtTime(p.takenAt)} 부산 북항 친수공원 인증.</div>
            <div className="holo-bottom">
              <span className="holo-rarity">{meta.symbol} {meta.label}</span>
              <span className="holo-site mono">{p.ordinal.toLocaleString()} · {SITE_HOST}</span>
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
