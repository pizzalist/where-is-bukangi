import type { ZoneCode } from "../lib/types";
import { ZONES } from "../lib/zones";

/**
 * 위성사진 기하를 따른 약도 (북쪽 위).
 * 원형 공원을 고리 수로가 감싸고, 수로는 동남쪽 방파제 사이로 바다와 만난 뒤
 * 동→북→서로 감아 돌아 서남쪽(마리나 방향)으로 빠진다. 이 휜 구조 때문에 상어가 못 나간다.
 * 크루즈 부두는 동쪽, 부산역·하늘광장은 서북쪽.
 * 보도교 번호는 기사 기준(제5보도교 = 크루즈 부두 앞)이며 나머지는 현장 확인 필요.
 */
const SHAPES: Record<ZoneCode, { d: string; lx: number; ly: number }> = {
  A: { d: "M114.1 45.2 A80 80 0 0 1 191.0 74.7 L175.3 87.1 A60 60 0 0 0 117.6 64.9 Z", lx: 153, ly: 59 },
  B: { d: "M191.0 74.7 A80 80 0 0 1 206.3 140.6 L186.7 136.5 A60 60 0 0 0 175.3 87.1 Z", lx: 196, ly: 108 },
  C: { d: "M206.3 140.6 A80 80 0 0 1 181.5 183.5 L168.1 168.6 A60 60 0 0 0 186.7 136.5 Z", lx: 189, ly: 159 },
  D: { d: "M181.5 183.5 A80 80 0 0 1 130.8 204.0 L130.1 184.0 A60 60 0 0 0 168.1 168.6 Z", lx: 154, ly: 189 },
  E: { d: "", lx: 0, ly: 0 },
  F: { d: "", lx: 0, ly: 0 },
};

export default function ZoneMap({ hot, active, onPick }: { hot?: ZoneCode | null; active?: ZoneCode | null; onPick?: (z: ZoneCode) => void }) {
  return (
    <svg className="zone-map" viewBox="0 0 300 232" role="img" aria-label="부캉이 출몰 구간 약도 (위성 기준)">
      <defs>
        <marker id="arw" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#7b909e" /></marker>
      </defs>
      <rect x="0" y="0" width="300" height="232" className="land" />

      {/* 바다 (동·남) */}
      <path d="M300 0 L300 232 L96 232 L118 210 L172 214 L214 176 L236 96 L232 0 Z" className="sea" />
      <text x="262" y="200" textAnchor="middle" className="landmark">바다</text>

      {/* 크루즈 부두 (동쪽, 비스듬한 긴 부두) */}
      <path d="M226 6 L262 6 L286 150 L250 154 Z" className="pier" />
      <text x="258" y="66" textAnchor="middle" className="label-sm">크루즈</text>
      <text x="258" y="78" textAnchor="middle" className="label-sm">부두</text>
      <rect x="266" y="98" width="14" height="44" rx="6" className="ship" />
      <text x="212" y="14" className="landmark">국제여객터미널 ↑</text>

      {/* 부산역 → 하늘광장 (서북) */}
      <rect x="4" y="18" width="40" height="26" rx="4" className="station" />
      <text x="24" y="30" textAnchor="middle" className="label-sm">부산역</text>
      <text x="24" y="40" textAnchor="middle" className="landmark">1호선</text>
      <path d="M46 31 L70 31" className="walk" markerEnd="url(#arw)" />
      <text x="58" y="26" textAnchor="middle" className="landmark">도보 10분</text>
      <rect x="74" y="14" width="46" height="26" rx="5" className="plaza" />
      <text x="97" y="26" textAnchor="middle" className="label-sm">하늘광장</text>
      <text x="97" y="36" textAnchor="middle" className="landmark">공원 입구</text>

      {/* 고리 수로 + 서남쪽 연장 */}
      <path d="M130.8 204.0 A80 80 0 1 1 191.0 74.7 L175.3 87.1 A60 60 0 1 0 130.1 184.0 Z" className="water" />
      <path d="M60 158 L44 232 L22 232 L44 150 Z" className="water" />
      <text x="34" y="200" textAnchor="middle" className="landmark" transform="rotate(-76 34 200)">마리나 방향 →</text>

      {/* 원형 공원 */}
      <circle cx="128" cy="124" r="58" className="green" />
      <circle cx="128" cy="124" r="36" className="green2" />
      <text x="128" y="120" textAnchor="middle" className="landmark">잔디마당</text>
      <text x="128" y="132" textAnchor="middle" className="landmark">야생화단지</text>

      {/* 방파제 (수로 입구 양쪽) */}
      <g className="breakwater">
        <line x1="166.5" y1="196.4" x2="173.1" y2="208.8" />
        <line x1="119.4" y1="205.6" x2="118.0" y2="219.5" />
      </g>
      <text x="150" y="226" textAnchor="middle" className="landmark">방파제 · 수로 입구</text>

      {/* 보도교 */}
      <g className="bridge">
        <line x1="122.0" y1="67.3" x2="119.3" y2="41.5" />
        <line x1="73.2" y1="108.3" x2="48.2" y2="101.1" />
        <line x1="183.8" y1="112.1" x2="209.2" y2="106.7" />
        <line x1="175.3" y1="155.9" x2="196.8" y2="170.4" />
      </g>
      <text x="112" y="52" textAnchor="end" className="label-sm">제4보도교</text>
      <text x="214" y="98" className="label-sm">제5보도교</text>
      <text x="200" y="181" className="label-sm">제6보도교</text>

      {ZONES.map((z) => {
        const s = SHAPES[z.code];
        if (!s.d) return null;
        return (
          <g key={z.code} onClick={() => onPick?.(z.code)} style={{ cursor: onPick ? "pointer" : "default" }}>
            <path d={s.d} className={`zone${hot === z.code ? " hot" : ""}${active === z.code ? " active" : ""}${z.main ? " main" : ""}`} />
            <text x={s.lx} y={s.ly + 4} textAnchor="middle" className="label">{z.code}</text>
            {hot === z.code && <circle cx={s.lx} cy={s.ly - 12} r="4.5" className="marker" />}
          </g>
        );
      })}
    </svg>
  );
}
