import type { CertType } from "./types";

export type Rarity = "common" | "rare" | "epic" | "legendary";

export const RARITY_META: Record<Rarity, { label: string; symbol: string; frame: string; frame2: string; ink: string }> = {
  common:    { label: "일반", symbol: "●",  frame: "#7fd0f2", frame2: "#3fb6e8", ink: "#0f2a3a" },
  rare:      { label: "레어", symbol: "◆",  frame: "#cfd8e3", frame2: "#8fb3d9", ink: "#0f2a3a" },
  epic:      { label: "에픽", symbol: "★",  frame: "#f2c94c", frame2: "#8e44ad", ink: "#2b1a3d" },
  legendary: { label: "전설", symbol: "✦",  frame: "#ffffff", frame2: "#ffd166", ink: "#0f2a3a" },
};

/**
 * 등급 뽑기. 구역과 무관. 시각과 종류로만 가중치.
 * 기본: 일반 70 / 레어 22 / 에픽 7 / 전설 1
 * 목격: 레어 이상 x2. 야간(22~06시): 에픽 이상 x3. 부활(6시간 못 봄 뒤 첫 목격): 전설 확정.
 */
export function rollRarity(opts: { type: CertType; takenAt: string; revival?: boolean; rng?: () => number }): Rarity {
  if (opts.revival && opts.type === "seen") return "legendary";
  const rng = opts.rng ?? Math.random;
  let w = { common: 70, rare: 22, epic: 7, legendary: 1 };
  if (opts.type === "seen") w = { ...w, rare: w.rare * 2, epic: w.epic * 2, legendary: w.legendary * 2 };
  const h = new Date(opts.takenAt).getHours();
  if (h >= 22 || h < 6) w = { ...w, epic: w.epic * 3, legendary: w.legendary * 3 };
  const total = w.common + w.rare + w.epic + w.legendary;
  let r = rng() * total;
  for (const k of ["legendary", "epic", "rare", "common"] as Rarity[]) { r -= w[k]; if (r <= 0) return k; }
  return "common";
}

/** 재미 스탯. 시각·순번에서 결정적으로 계산 (같은 카드는 항상 같은 값). */
export function cardStats(ordinal: number, takenAt: string) {
  const d = new Date(takenAt);
  const seed = (ordinal * 9301 + d.getHours() * 49297 + d.getMinutes() * 233) % 233280;
  const r = (n: number) => (seed * (n + 1)) % 100;
  const length = (3.0 + (r(1) % 6) / 10).toFixed(1); // 3.0~3.5m
  const power = 60 + (r(2) % 40);                     // 60~99
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
