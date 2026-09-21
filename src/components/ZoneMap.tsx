import type { ZoneCode } from "../lib/types";
import { ZONES } from "../lib/zones";

/**
 * 부캉이 출몰 구간 약도. 실제 축척 아님.
 * 방위는 네이버 지도와 같게: 왼쪽=부산역(내륙), 오른쪽=바다, 위=국제여객터미널.
 * 사람들이 부산역에서 걸어 들어오는 동선을 기준으로 그린다.
 */
const SHAPES: Record<ZoneCode, { d: string; lx: number; ly: number }> = {
  A: { d: "M148 30 L200 28 L202 62 L150 64 Z", lx: 175, ly: 51 },
  B: { d: "M150 64 L202 62 L205 100 L152 102 Z", lx: 178, ly: 87 },
  C: { d: "M152 102 L205 100 L208 136 L150 138 Z", lx: 179, ly: 124 },
  D: { d: "M150 138 L208 136 L211 174 L146 178 Z", lx: 179, ly: 160 },
  E: { d: "", lx: 0, ly: 0 },
  F: { d: "", lx: 0, ly: 0 },
};

export default function ZoneMap({ hot, active, onPick }: { hot?: ZoneCode | null; active?: ZoneCode | null; onPick?: (z: ZoneCode) => void }) {
  return (
    <svg className="zone-map" viewBox="0 0 300 200" role="img" aria-label="부캉이 출몰 구간 약도">
      <rect x="0" y="0" width="300" height="200" className="land" />

      {/* 바다 (오른쪽) */}
      <path d="M258 0 L300 0 L300 200 L252 200 Z" className="sea" />
      <text x="278" y="186" textAnchor="middle" className="landmark">바다</text>

      {/* 부산역 (왼쪽 출발점) */}
      <rect x="4" y="86" width="42" height="28" rx="4" className="station" />
      <text x="25" y="98" textAnchor="middle" className="label-sm">부산역</text>
      <text x="25" y="109" textAnchor="middle" className="landmark">1호선</text>
      <path d="M50 100 L60 100" className="walk" markerEnd="url(#arw)" />
      <defs><marker id="arw" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#7b909e" /></marker></defs>

      {/* 하늘광장 · 공원 진입 */}
      <rect x="64" y="86" width="52" height="28" rx="5" className="plaza" />
      <text x="90" y="98" textAnchor="middle" className="label-sm">하늘광장</text>
      <text x="90" y="109" textAnchor="middle" className="landmark">공원 입구</text>
      <text x="60" y="80" textAnchor="middle" className="landmark">도보 10분</text>

      {/* 공원 녹지 */}
      <ellipse cx="66" cy="164" rx="58" ry="30" className="green" />
      <text x="66" y="168" textAnchor="middle" className="landmark">잔디마당 · 조망언덕</text>

      {/* 국제여객터미널 · 크루즈 부두 */}
      <rect x="146" y="2" width="102" height="20" rx="4" className="bldg" />
      <text x="197" y="16" textAnchor="middle" className="label-sm">국제여객터미널</text>
      <rect x="216" y="56" width="36" height="80" rx="4" className="pier" />
      <text x="234" y="92" textAnchor="middle" className="landmark">크루즈</text>
      <text x="234" y="104" textAnchor="middle" className="landmark">부두</text>

      {/* 수로 (휘어서 바다로 못 나감) */}
      <path d="M146 26 L202 24 L212 178 L144 182 Z" className="water" />

      {/* 보도교 */}
      <g className="bridge">
        <rect x="124" y="58" width="98" height="7" rx="2" />
        <rect x="126" y="96" width="98" height="7" rx="2" />
        <rect x="128" y="132" width="98" height="7" rx="2" />
      </g>
      <text x="126" y="54" className="label-sm">제4보도교</text>
      <text x="128" y="92" className="label-sm">제5보도교</text>
      <text x="130" y="128" className="label-sm">제6보도교</text>

      {ZONES.map((z) => {
        const s = SHAPES[z.code];
        if (!s.d) return null;
        return (
          <g key={z.code} onClick={() => onPick?.(z.code)} style={{ cursor: onPick ? "pointer" : "default" }}>
            <path d={s.d} className={`zone${hot === z.code ? " hot" : ""}${active === z.code ? " active" : ""}${z.main ? " main" : ""}`} />
            <text x={s.lx} y={s.ly} textAnchor="middle" className="label">{z.code}</text>
            {hot === z.code && <circle cx={s.lx} cy={s.ly - 15} r="5" className="marker" />}
          </g>
        );
      })}
    </svg>
  );
}
