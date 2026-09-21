import type { CertType } from "./types";

/** 실제 TCG 등급 체계를 따른 9단계 */
export type Rarity = "common" | "uncommon" | "rare" | "holo" | "reverse" | "galaxy" | "fullart" | "rainbow" | "gold";

export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "holo", "reverse", "galaxy", "fullart", "rainbow", "gold"];

export interface RarityMeta {
  label: string; en: string; symbol: string; weight: number;
  frame: string; frame2: string; ink: string;
  layout: "normal" | "fullart";
  how: string;
}

export const RARITY_META: Record<Rarity, RarityMeta> = {
  common:   { label: "커먼",       en: "Common",       symbol: "●", weight: 25,  frame: "#7fd0f2", frame2: "#3fb6e8", ink: "#0f2a3a", layout: "normal",  how: "기본. 반사광만." },
  uncommon: { label: "언커먼",     en: "Uncommon",     symbol: "◆", weight: 20,  frame: "#b9d7e8", frame2: "#7fb0cf", ink: "#0f2a3a", layout: "normal",  how: "테두리에 얇은 은선." },
  rare:     { label: "레어",       en: "Rare",         symbol: "★", weight: 18,  frame: "#d9e2ec", frame2: "#98b5d3", ink: "#0f2a3a", layout: "normal",  how: "테두리 은박 포일." },
  holo:     { label: "홀로",       en: "Rare Holo",    symbol: "★", weight: 14,   frame: "#cfd8e3", frame2: "#8fb3d9", ink: "#0f2a3a", layout: "normal",  how: "사진 창에 무지개 홀로 띠. 목격이면 2배." },
  reverse:  { label: "리버스 홀로", en: "Reverse Holo", symbol: "★", weight: 9,   frame: "#c9d6e2", frame2: "#7f9fc0", ink: "#0f2a3a", layout: "normal",  how: "사진 빼고 카드 전체가 포일." },
  galaxy:   { label: "갤럭시",     en: "Galaxy Holo",  symbol: "✦", weight: 6, frame: "#2b2d6b", frame2: "#0b5c8a", ink: "#0f2a3a", layout: "normal",  how: "사진 창에 은하수 텍스처. 밤 촬영이면 3배." },
  fullart:  { label: "풀아트",     en: "Full Art",     symbol: "✦", weight: 4, frame: "#e8eef5", frame2: "#a9c4de", ink: "#ffffff", layout: "fullart", how: "사진이 카드 끝까지. 세로 결 포일." },
  rainbow:  { label: "레인보우",   en: "Rainbow Rare", symbol: "✧", weight: 2.5, frame: "#ffffff", frame2: "#ffd1f0", ink: "#ffffff", layout: "fullart", how: "카드 전체 무지개 + 글리터. 6시간 못 봄 뒤 첫 목격이면 확정." },
  gold:     { label: "시크릿 골드", en: "Secret Gold",  symbol: "✪", weight: 1.5, frame: "#f2c94c", frame2: "#a67c00", ink: "#3a2a00", layout: "fullart", how: "금박 + 글리터. 가장 희귀." },
};

/**
 * 등급 뽑기. 구역과 무관. 시각·인증 종류로만 가중치.
 * 목격: holo 이상 x2. 야간(22~06시): galaxy 이상 x3. 부활(6시간 못 봄 뒤 첫 목격): rainbow/gold 중 확정.
 */
export function rollRarity(opts: { type: CertType; takenAt: string; revival?: boolean; rng?: () => number }): Rarity {
  const rng = opts.rng ?? Math.random;
  if (opts.revival && opts.type === "seen") return rng() < 0.7 ? "rainbow" : "gold";
  const w: Record<Rarity, number> = Object.fromEntries(RARITY_ORDER.map((r) => [r, RARITY_META[r].weight])) as Record<Rarity, number>;
  const idx = (r: Rarity) => RARITY_ORDER.indexOf(r);
  if (opts.type === "seen") for (const r of RARITY_ORDER) if (idx(r) >= idx("holo")) w[r] *= 2;
  const h = new Date(opts.takenAt).getHours();
  if (h >= 22 || h < 6) for (const r of RARITY_ORDER) if (idx(r) >= idx("galaxy")) w[r] *= 3;
  const total = RARITY_ORDER.reduce((a, r) => a + w[r], 0);
  let x = rng() * total;
  for (const r of [...RARITY_ORDER].reverse()) { x -= w[r]; if (x <= 0) return r; }
  return "common";
}

export function oddsPercent(r: Rarity) {
  const total = RARITY_ORDER.reduce((a, k) => a + RARITY_META[k].weight, 0);
  const p = (RARITY_META[r].weight / total) * 100;
  return p >= 10 ? p.toFixed(0) : p >= 1 ? p.toFixed(1) : p.toFixed(2);
}

/** 재미 스탯. 시각·순번에서 결정적으로 계산 (같은 카드는 항상 같은 값). */
export function cardStats(ordinal: number, takenAt: string) {
  const d = new Date(takenAt);
  const seed = (ordinal * 9301 + d.getHours() * 49297 + d.getMinutes() * 233) % 233280;
  const r = (n: number) => (seed * (n + 1)) % 100;
  const length = (3.0 + (r(1) % 6) / 10).toFixed(1);
  const power = 60 + (r(2) % 40);
  const moves = [
    ["수로 순찰", "천천히 한 바퀴 돌고 사라진다"],
    ["무태 돌진", "먹잇감을 따라 순간 가속"],
    ["잠수", "2시간 동안 아무도 못 본다"],
    ["팬미팅", "인파가 몰리면 수면 위로 등장"],
    ["출근길 등장", "아침 9시, 여객터미널 앞"],
    ["야간 순항", "어두울수록 잘 보인다"],
  ];
  const m1 = moves[r(3) % moves.length], m2 = moves[(r(3) + 1 + (r(4) % (moves.length - 1))) % moves.length];
  return { length, power, moves: [m1, m2] as [string, string][] };
}
