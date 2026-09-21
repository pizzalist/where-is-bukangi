// 서버가 등급을 정한다 (클라이언트 조작 방지)
export const ORDER = ["common", "uncommon", "rare", "holo", "reverse", "galaxy", "fullart", "rainbow", "gold"];
const W = { common: 25, uncommon: 20, rare: 18, holo: 14, reverse: 9, galaxy: 6, fullart: 4, rainbow: 2.5, gold: 1.5 };

export function roll({ takenAt, revival = false }) {
  if (revival) return Math.random() < 0.7 ? "rainbow" : "gold";
  const w = { ...W };
  const idx = (r) => ORDER.indexOf(r);
  for (const r of ORDER) if (idx(r) >= idx("holo")) w[r] *= 2;       // 목격 인증
  const h = new Date(takenAt).getHours();
  if (h >= 22 || h < 6) for (const r of ORDER) if (idx(r) >= idx("galaxy")) w[r] *= 3;
  const total = ORDER.reduce((a, r) => a + w[r], 0);
  let x = Math.random() * total;
  for (const r of [...ORDER].reverse()) { x -= w[r]; if (x <= 0) return r; }
  return "common";
}

/** 6시간 넘게 목격이 없었으면 부활 */
export function isRevival(lastSeenAt) {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() > 6 * 3600 * 1000;
}
