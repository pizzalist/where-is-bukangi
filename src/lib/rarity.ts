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
  galaxy:   { label: "갤럭시",     en: "Galaxy Holo",  symbol: "✦", weight: 6, frame: "#2b2d6b", frame2: "#0b5c8a", ink: "#0f2a3a", layout: "normal",  how: "카드 바탕이 은하수. 밤 촬영이면 3배." },
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

/** 문자열 해시 → 32bit */
function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** seed 기반 난수 (mulberry32) */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 기술 풀. 부캉이 소동에서 실제로 벌어진 일들. */
export const MOVES: [string, string][] = [
  ["수로 순찰", "천천히 한 바퀴 돌고 사라진다"],
  ["무태 돌진", "먹잇감을 따라 순간 가속"],
  ["잠수", "두 시간 동안 아무도 못 본다"],
  ["야간 순항", "어두울수록 잘 보인다"],
  ["팬미팅", "인파가 몰리면 수면 위로 등장"],
  ["출근길 등장", "아침 아홉 시, 여객터미널 앞"],
  ["상어야 고맙데이", "이디야 사장님이 커피를 쏜다"],
  ["사장님 나이스", "가게 앞 줄이 골목을 넘는다"],
  ["핑크퐁 풀매수", "아기상어 주가가 11% 뛴다"],
  ["롯데 3연승", "상어 나온 뒤로 계속 이긴다"],
  ["상어맘 소집", "유모차 부대가 데크를 채운다"],
  ["체인소맨 콜라보", "돔구장에서 제안이 들어온다"],
  ["굿즈화", "하루 만에 인형이 나온다"],
  ["출산설", "새끼 낳았다는 소문이 돈다"],
  ["당일치기", "서울에서 KTX를 타게 만든다"],
  ["경비정 호출", "해경이 출동한다"],
  ["유도 거부", "외해로 몰면 오히려 버틴다"],
  ["매출 48%", "편의점 줄이 바깥까지 늘어난다"],
  ["실검 점령", "하루 종일 검색어 1위"],
  ["드론 금지", "항만 상공이 막혀 있다"],
  ["지느러미 인증", "수면 위로 등지느러미만 슬쩍"],
  ["3만 관중", "사흘 만에 3만 명을 불러 모은다"],
  ["릴스 각", "찍는 순간 조회수가 터진다"],
  ["부산 사투리", "'와 저기 봐라' 소리가 퍼진다"],
  ["퇴근 저지", "다리 위 사람들이 안 흩어진다"],
];

/** 재미 스탯. 카드 id·순번·시각에서 결정적으로 계산 (같은 카드는 항상 같은 값). */
export function cardStats(ordinal: number, takenAt: string, id = "") {
  const r = rng(hash(`${id}|${ordinal}|${takenAt}`));
  const length = (2.8 + r() * 0.9).toFixed(1);   // 2.8~3.7m
  const power = 55 + Math.floor(r() * 45);        // 55~99
  const a = Math.floor(r() * MOVES.length);
  let b = Math.floor(r() * (MOVES.length - 1));
  if (b >= a) b += 1;
  return { length, power, moves: [MOVES[a], MOVES[b]] as [string, string][] };
}
