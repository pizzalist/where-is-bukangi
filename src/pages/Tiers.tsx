import { motion } from "framer-motion";
import HoloCard from "../components/HoloCard";
import { RARITY_META, type Rarity } from "../lib/rarity";

const TIERS: { r: Rarity; odds: string; how: string }[] = [
  { r: "common", odds: "70%", how: "기본. 하늘색 프레임, 반사광만." },
  { r: "rare", odds: "22%", how: "테두리에 은빛 포일. 목격 인증이면 확률 2배." },
  { r: "epic", odds: "7%", how: "금·보라 포일 + 반짝임. 밤(22~06시) 촬영이면 3배." },
  { r: "legendary", odds: "1%", how: "카드 전체 무지개 홀로. 6시간 못 봄 뒤 첫 목격은 확정." },
];

export default function Tiers() {
  const at = "2026-09-21T15:10:00+09:00";
  return (
    <div className="page">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 style={{ fontSize: "1.6rem", margin: "1.2rem 0 0.2rem" }}>카드 등급</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 0, fontSize: "0.9rem" }}>한 사진에 한 번만 뽑아요. 구역과는 무관하고, 시각과 인증 종류로만 확률이 달라져요. 카드를 문질러 보세요.</p>
        <div className="tier-grid">
          {TIERS.map((t, i) => (
            <div key={t.r}>
              <HoloCard type="seen" ordinal={1200 + i} takenAt={at} zone="B" zoneName="중앙 데크" rarity={t.r} interactive fixed={{ mx: 30 + i * 12, my: 40 }} />
              <div className="tier-label">{RARITY_META[t.r].symbol} {RARITY_META[t.r].label} · {t.odds}<small>{t.how}</small></div>
            </div>
          ))}
        </div>
        <div className="section">
          <div className="section-head"><h2>컬렉션</h2></div>
          <div className="card" style={{ fontSize: "0.9rem", color: "var(--ink-2)" }}>내 카드 탭에 일반/레어/에픽/전설 칸 4개. 못 뽑은 건 실루엣. 전설이 나오면 상황판 타임라인에 한 줄 올라가요. (다음 버전)</div>
        </div>
      </motion.div>
    </div>
  );
}
