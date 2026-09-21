import type { ZoneCode } from "../lib/types";
import { ZONES } from "../lib/zones";

/**
 * 북항 친수공원 별빛수로 개념도. 실제 축척 아님.
 * 수로는 서남(바다·마리나) → 동북(여객터미널) 방향으로 흐른다.
 * 구역 경계는 안내도 기준 초안이며 현장 확인 후 조정.
 */
const SHAPES: Record<ZoneCode, { d: string; lx: number; ly: number }> = {
  A: { d: "M6 108 L58 92 L64 118 L12 134 Z", lx: 34, ly: 112 },
  B: { d: "M58 92 L112 76 L118 102 L64 118 Z", lx: 88, ly: 96 },
  C: { d: "M112 76 L168 62 L174 88 L118 102 Z", lx: 143, ly: 81 },
  D: { d: "M168 62 L224 52 L230 78 L174 88 Z", lx: 199, ly: 68 },
  E: { d: "M224 52 L276 46 L282 72 L230 78 Z", lx: 253, ly: 61 },
  F: { d: "M276 46 L324 44 L328 70 L282 72 Z", lx: 302, ly: 57 },
};

export default function ZoneMap({ hot, active, onPick }: { hot?: ZoneCode | null; active?: ZoneCode | null; onPick?: (z: ZoneCode) => void }) {
  return (
    <svg className="zone-map" viewBox="0 0 336 160" role="img" aria-label="북항 친수공원 별빛수로 구역 개념도">
      <rect x="0" y="0" width="336" height="160" className="land" />

      {/* 바다 (서남쪽) */}
      <path d="M0 96 L20 92 L26 160 L0 160 Z" className="sea" />
      <text x="12" y="152" className="landmark">바다</text>

      {/* 별빛수로 */}
      <path d="M2 100 L326 40 L332 74 L10 136 Z" className="water" />

      {/* 산책로 */}
      <path d="M4 138 L332 76" className="path" />
      <path d="M0 94 L324 36" className="path" />

      {/* 보도교 */}
      <g className="bridge">
        <rect x="60" y="78" width="7" height="46" transform="rotate(-10 63 101)" />
        <rect x="170" y="52" width="7" height="42" transform="rotate(-10 173 73)" />
        <rect x="226" y="44" width="7" height="40" transform="rotate(-8 229 64)" />
      </g>
      <text x="63" y="74" textAnchor="middle" className="landmark">제2보도교</text>
      <text x="173" y="48" textAnchor="middle" className="landmark">오페라브릿지</text>
      <text x="231" y="40" textAnchor="middle" className="landmark">제3보도교</text>

      {/* 랜드마크 */}
      <rect x="286" y="6" width="46" height="20" rx="3" className="bldg" />
      <text x="309" y="19" textAnchor="middle" className="landmark">여객터미널</text>
      <rect x="120" y="120" width="52" height="18" rx="3" className="bldg" />
      <text x="146" y="132" textAnchor="middle" className="landmark">오페라하우스</text>
      <text x="252" y="118" textAnchor="middle" className="landmark">야생화단지 · 잔디마당</text>

      {ZONES.map((z) => {
        const s = SHAPES[z.code];
        return (
          <g key={z.code} onClick={() => onPick?.(z.code)} style={{ cursor: onPick ? "pointer" : "default" }}>
            <path d={s.d} className={`zone${hot === z.code ? " hot" : ""}${active === z.code ? " active" : ""}`} />
            <text x={s.lx} y={s.ly} textAnchor="middle" className="label">{z.code}</text>
            {hot === z.code && <circle cx={s.lx} cy={s.ly - 17} r="5.5" className="marker" />}
          </g>
        );
      })}
    </svg>
  );
}
