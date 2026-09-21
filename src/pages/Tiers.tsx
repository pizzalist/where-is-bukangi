import { motion } from "framer-motion";
import HoloCard from "../components/HoloCard";
import { RARITY_META, RARITY_ORDER, oddsPercent } from "../lib/rarity";
import { useTiltAvailable } from "../lib/tilt";

export default function Tiers({ onBack }: { onBack?: () => void }) {
  const tilt = useTiltAvailable();
  const at = "2026-09-21T15:10:00+09:00";
  return (
    <div className="page">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <button className="backlink" onClick={onBack}>‹ 카드 뽑기로</button>
        <h1 style={{ fontSize: "1.6rem", margin: "0.6rem 0 0.2rem" }}>카드 등급 9종</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 0, fontSize: "0.9rem" }}>{tilt ? "폰을 기울이거나 문질러보세요. " : ""}한 사진에 한 번만 뽑아요. 구역과 무관하고 시각·인증 종류로만 확률이 달라져요. 카드를 손가락으로 문질러보세요.</p>
        <div className="tier-grid">
          {RARITY_ORDER.map((r, i) => (
            <div key={r}>
              <HoloCard id={r} type="seen" ordinal={1200 + i} takenAt={at} zone="D" zoneName="웨이브스탠드" rarity={r} interactive sweep />
              <div className="tier-label">{RARITY_META[r].symbol} {RARITY_META[r].label} · {oddsPercent(r)}%<small>{RARITY_META[r].en} · {RARITY_META[r].how}</small></div>
            </div>
          ))}
        </div>
          <button className="btn btn-big" style={{ marginTop: "1.2rem" }} onClick={onBack}>카드 뽑으러 가기</button>
      </motion.div>
    </div>
  );
}
