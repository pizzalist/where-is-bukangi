import type { ZoneCode } from "../lib/types";

/**
 * 손으로 그린 북항 친수공원 수로 개념도. 실제 축척 아님.
 * 구역 경계는 현장에서 확정 후 좌표 수정.
 */
const ZONES: { code: ZoneCode; d: string; lx: number; ly: number }[] = [
  { code: "E", d: "M8 58 L60 44 L60 84 L8 96 Z", lx: 28, ly: 74 },
  { code: "D", d: "M60 44 L120 40 L120 84 L60 84 Z", lx: 86, ly: 66 },
  { code: "C", d: "M120 40 L180 40 L180 84 L120 84 Z", lx: 146, ly: 66 },
  { code: "B", d: "M180 40 L250 42 L250 84 L180 84 Z", lx: 211, ly: 66 },
  { code: "A", d: "M250 42 L318 50 L318 88 L250 84 Z", lx: 280, ly: 70 },
];

export default function ZoneMap({ hot, active, onPick }: { hot?: ZoneCode | null; active?: ZoneCode | null; onPick?: (z: ZoneCode) => void }) {
  return (
    <svg className="zone-map" viewBox="0 0 330 150" role="img" aria-label="북항 친수공원 수로 구역 개념도">
      {/* 육지 */}
      <rect x="0" y="0" width="330" height="150" className="land" />
      {/* 수로 */}
      <path d="M0 52 C40 40, 90 36, 160 38 C230 40, 290 44, 330 52 L330 92 C290 84, 230 86, 160 88 C90 90, 40 92, 0 100 Z" className="water" />
      {/* 데크 */}
      <path d="M60 86 L250 86 L250 96 L60 96 Z" className="deck" />
      {/* 다리 */}
      <rect x="140" y="30" width="20" height="66" fill="#d8cfbd" opacity="0.9" />
      <text x="150" y="26" textAnchor="middle" className="landmark">다리</text>
      {/* 여객터미널 */}
      <rect x="252" y="8" width="66" height="26" rx="4" fill="#e3dccb" />
      <text x="285" y="25" textAnchor="middle" className="landmark">국제여객터미널</text>
      <text x="155" y="112" textAnchor="middle" className="landmark">친수공원 데크</text>
      <text x="26" y="122" textAnchor="middle" className="landmark">외해 →</text>

      {ZONES.map((z) => (
        <g key={z.code}>
          <path
            d={z.d}
            className={`zone${hot === z.code ? " hot" : ""}${active === z.code ? " active" : ""}`}
            onClick={() => onPick?.(z.code)}
          />
          <text x={z.lx} y={z.ly} textAnchor="middle" className="label">{z.code}</text>
          {hot === z.code && <circle cx={z.lx} cy={z.ly - 16} r="5" className="marker" />}
        </g>
      ))}
    </svg>
  );
}
