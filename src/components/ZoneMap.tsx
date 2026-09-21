import type { ZoneCode } from "../lib/types";
import { ZONES } from "../lib/zones";

/**
 * 위성사진 기준 약도 (북쪽 위).
 * 수로는 닫힌 고리가 아니다. 서남쪽에서 들어와 원형 공원의 북쪽을 돌아
 * 동쪽 크루즈 부두 앞을 지난 뒤 남동쪽 방파제 사이로 바다로 빠진다.
 * 공원 남쪽은 육지(해안 산책로)라 수로가 끊긴다.
 * 보도교 번호는 기사 기준(제5보도교 = 크루즈 부두 앞), 나머지는 현장 확인 필요.
 */
const SHAPES: Record<ZoneCode, { d: string; lx: number; ly: number }> = {
  A: { d: "M161.2 47.7 A78 78 0 0 1 205.3 93.3 L186.5 100.2 A58 58 0 0 0 153.7 66.2 Z", lx: 181, ly: 73 },
  B: { d: "M205.3 93.3 A78 78 0 0 1 204.3 149.2 L185.8 141.7 A58 58 0 0 0 186.5 100.2 Z", lx: 200, ly: 121 },
  C: { d: "M204.3 149.2 A78 78 0 0 1 180.0 181.5 L167.7 165.7 A58 58 0 0 0 185.8 141.7 Z", lx: 186, ly: 161 },
  D: { d: "M180.0 181.5 A78 78 0 0 1 145.5 196.8 L142.1 177.1 A58 58 0 0 0 167.7 165.7 Z", lx: 160, ly: 182 },
  E: { d: "", lx: 0, ly: 0 },
  F: { d: "", lx: 0, ly: 0 },
};

export default function ZoneMap({ hot, active, onPick }: { hot?: ZoneCode | null; active?: ZoneCode | null; onPick?: (z: ZoneCode) => void }) {
  return (
    <svg className="zone-map" viewBox="0 0 300 226" role="img" aria-label="부캉이 출몰 구간 약도 (위성 기준)">
      <defs>
        <marker id="arw" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#7b909e" /></marker>
      </defs>
      <rect x="0" y="0" width="300" height="226" className="land" />

      {/* 바다 (동·남) */}
      <path d="M232 0 L300 0 L300 226 L120 226 L150 200 L200 176 L226 120 L232 40 Z" className="sea" />
      <text x="266" y="206" textAnchor="middle" className="landmark">바다</text>

      {/* 크루즈 부두 (동, 비스듬) */}
      <path d="M228 2 L258 2 L282 128 L250 134 Z" className="pier" />
      <text x="254" y="52" textAnchor="middle" className="label-sm">크루즈</text>
      <text x="254" y="64" textAnchor="middle" className="label-sm">부두</text>
      <rect x="262" y="78" width="13" height="42" rx="6" className="ship" />
      <text x="206" y="10" className="landmark">국제여객터미널 ↑</text>

      {/* 부산역 → 하늘광장 → 주차장 (서북) */}
      <rect x="2" y="12" width="38" height="24" rx="4" className="station" />
      <text x="21" y="23" textAnchor="middle" className="label-sm">부산역</text>
      <text x="21" y="33" textAnchor="middle" className="landmark">1호선</text>
      <path d="M42 24 L52 24" className="walk" markerEnd="url(#arw)" />
      <text x="47" y="18" textAnchor="middle" className="landmark">10분</text>
      <rect x="56" y="10" width="46" height="26" rx="5" className="plaza" />
      <text x="79" y="22" textAnchor="middle" className="label-sm">하늘광장</text>
      <text x="79" y="32" textAnchor="middle" className="landmark">공원 입구</text>
      <circle cx="114" cy="22" r="8" className="parkingdot" />
      <text x="114" y="25" textAnchor="middle" className="parkingtxt">P</text>
      <text x="126" y="25" className="landmark">주차장</text>

      {/* 수로: 서남 → 북 → 동 → 남동 (남쪽은 끊김) */}
      <path d="M61.3 153.0 A78 78 0 1 1 176.7 183.9 L165.3 167.5 A58 58 0 1 0 79.4 144.5 Z" className="water" />
      {/* 서남으로 빠지는 물길 */}
      <path d="M61.3 153.0 L79.4 144.5 L58 196 L38 190 Z" className="water" />
      <text x="40" y="208" textAnchor="middle" className="landmark">← 마리나</text>
      {/* 남동 수로 입구 → 바다 */}
      <path d="M176.7 183.9 L165.3 167.5 L196 190 L190 206 Z" className="water" />

      {/* 원형 공원 */}
      <circle cx="132" cy="120" r="56" className="green" />
      <circle cx="132" cy="120" r="34" className="green2" />
      <text x="132" y="117" textAnchor="middle" className="landmark">잔디마당</text>
      <text x="132" y="129" textAnchor="middle" className="landmark">야생화단지</text>
      <text x="86" y="192" textAnchor="middle" className="landmark">해안 산책로 (육지)</text>

      {/* 방파제 (수로 입구 양쪽) */}
      <g className="breakwater">
        <line x1="182" y1="188" x2="200" y2="200" />
        <line x1="160" y1="200" x2="176" y2="214" />
      </g>
      <text x="198" y="216" className="landmark">방파제</text>

      {/* 보도교 */}
      <g className="bridge">
        <line x1="166.8" y1="81.4" x2="188.2" y2="57.6" />
        <line x1="184.0" y1="120.0" x2="216.0" y2="120.0" />
        <line x1="174.1" y1="150.6" x2="200.0" y2="169.4" />
      </g>
      <text x="196" y="48" textAnchor="middle" className="label-sm">제4보도교</text>
      <text x="222" y="116" className="label-sm">제5보도교</text>
      <text x="214" y="170" className="label-sm">제6보도교</text>

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
