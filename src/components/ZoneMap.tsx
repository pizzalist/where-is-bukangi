import type { ZoneCode } from "../lib/types";
import { ZONES } from "../lib/zones";

/**
 * 부캉이 출몰 구간 개념도 (제4~제6보도교). 실제 축척 아님.
 * 수로가 휘어 있어 상어가 빠져나가지 못하는 구간을 강조한다.
 */
const SHAPES: Record<ZoneCode, { d: string; lx: number; ly: number }> = {
  A: { d: "M118 16 L182 16 L180 54 L116 52 Z", lx: 149, ly: 40 },
  B: { d: "M116 52 L180 54 L176 98 L110 94 Z", lx: 143, ly: 80 },
  C: { d: "M110 94 L176 98 L166 136 L98 128 Z", lx: 137, ly: 120 },
  D: { d: "M98 128 L166 136 L156 168 L82 158 Z", lx: 124, ly: 154 },
  E: { d: "", lx: 0, ly: 0 },
  F: { d: "", lx: 0, ly: 0 },
};

export default function ZoneMap({ hot, active, onPick }: { hot?: ZoneCode | null; active?: ZoneCode | null; onPick?: (z: ZoneCode) => void }) {
  return (
    <svg className="zone-map" viewBox="0 0 260 190" role="img" aria-label="부캉이 출몰 구간 개념도">
      <rect x="0" y="0" width="260" height="190" className="land" />

      {/* 크루즈 부두 · 여객터미널 (동쪽) */}
      <rect x="196" y="10" width="58" height="46" rx="4" className="bldg" />
      <text x="225" y="30" textAnchor="middle" className="landmark">국제여객</text>
      <text x="225" y="44" textAnchor="middle" className="landmark">터미널</text>
      <rect x="196" y="64" width="58" height="34" rx="3" className="pier" />
      <text x="225" y="84" textAnchor="middle" className="landmark">크루즈 부두</text>

      {/* 공원 녹지 (서쪽) */}
      <rect x="6" y="14" width="66" height="150" rx="6" className="green" />
      <text x="39" y="92" textAnchor="middle" className="landmark">잔디마당</text>
      <text x="39" y="106" textAnchor="middle" className="landmark">조망언덕</text>

      {/* 휜 수로 */}
      <path d="M120 8 L184 8 L176 176 L78 164 L86 120 L124 126 Z" className="water" />
      <text x="206" y="118" textAnchor="middle" className="landmark">← 바다</text>

      {/* 보도교 */}
      <g className="bridge">
        <rect x="104" y="48" width="88" height="8" rx="2" />
        <rect x="100" y="92" width="88" height="8" rx="2" />
        <rect x="88" y="126" width="88" height="8" rx="2" />
      </g>
      <text x="80" y="42" textAnchor="middle" className="landmark">제4보도교</text>
      <text x="76" y="86" textAnchor="middle" className="landmark">제5보도교</text>
      <text x="64" y="150" textAnchor="middle" className="landmark">제6보도교</text>

      {ZONES.map((z) => {
        const s = SHAPES[z.code];
        if (!s.d) return null;
        return (
          <g key={z.code} onClick={() => onPick?.(z.code)} style={{ cursor: onPick ? "pointer" : "default" }}>
            <path d={s.d} className={`zone${hot === z.code ? " hot" : ""}${active === z.code ? " active" : ""}${z.main ? " main" : ""}`} />
            <text x={s.lx} y={s.ly} textAnchor="middle" className="label">{z.code}</text>
            {hot === z.code && <circle cx={s.lx} cy={s.ly - 16} r="5" className="marker" />}
          </g>
        );
      })}
    </svg>
  );
}
