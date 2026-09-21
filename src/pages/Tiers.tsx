import { motion } from "framer-motion";
import HoloCard from "../components/HoloCard";
import { RARITY_META, RARITY_ORDER, oddsPercent } from "../lib/rarity";

export default function Tiers() {
  const at = "2026-09-21T15:10:00+09:00";
  return (
    <div className="page">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 style={{ fontSize: "1.6rem", margin: "1.2rem 0 0.2rem" }}>카드 등급 9종</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 0, fontSize: "0.9rem" }}>한 사진에 한 번만 뽑아요. 구역과 무관하고 시각·인증 종류로만 확률이 달라져요. 카드를 문지르거나 폰을 기울여봐요.</p>
        <div className="tier-grid">
          {RARITY_ORDER.map((r, i) => (
            <div key={r}>
              <HoloCard type="seen" ordinal={1200 + i} takenAt={at} zone="D" zoneName="웨이브스탠드" rarity={r} interactive sweep />
              <div className="tier-label">{RARITY_META[r].symbol} {RARITY_META[r].label} · {oddsPercent(r)}%<small>{RARITY_META[r].en} · {RARITY_META[r].how}</small></div>
            </div>
          ))}
        </div>
        <div className="section">
          <div className="section-head"><h2>가중치</h2></div>
          <div className="card" style={{ fontSize: "0.88rem", color: "var(--ink-2)" }}>목격 인증은 홀로 이상 확률 2배. 밤(22~06시) 촬영은 갤럭시 이상 3배. 6시간 넘게 "못 봄"이 이어진 뒤 첫 목격은 레인보우 또는 골드 확정. 컬렉션 칸과 전설 알림은 다음 버전.</div>
        </div>
      </motion.div>
    </div>
  );
}
