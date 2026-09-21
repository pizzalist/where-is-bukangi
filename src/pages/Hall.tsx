import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fetchHall, type HallItem } from "../lib/api";
import { RARITY_META } from "../lib/rarity";
import { ZONE_BY_CODE } from "../lib/zones";
import { fmtDate, fmtTime } from "../lib/store";
import type { ZoneCode } from "../lib/types";

export default function Hall({ onBack }: { onBack?: () => void }) {
  const [items, setItems] = useState<HallItem[] | null>(null);
  useEffect(() => { fetchHall().then(setItems); }, []);

  return (
    <div className="page">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <button className="backlink" onClick={onBack}>‹ 지금으로</button>
        <h1 style={{ fontSize: "1.6rem", margin: "0.6rem 0 0.2rem" }}>명예의 전당</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 0, fontSize: "0.9rem" }}>귀한 등급이 나온 순서예요. 검증된 사진만 올라가요.</p>

        {items === null && <div className="card" style={{ color: "var(--ink-3)" }}>불러오는 중</div>}
        {items?.length === 0 && <div className="card" style={{ color: "var(--ink-3)" }}>아직 올라온 카드가 없어요. 첫 번째가 되어보세요.</div>}

        <div className="hall-grid">
          {items?.map((it) => (
            <figure key={it.id} className={`hall-item hall-${it.rarity}`}>
              <img src={it.photo} alt="" loading="lazy" />
              <figcaption>
                <span className="hall-rank">{RARITY_META[it.rarity].symbol} {RARITY_META[it.rarity].label}</span>
                <b className="mono">No.{it.ordinal.toLocaleString()}</b>
                <small>{fmtDate(it.takenAt)} {fmtTime(it.takenAt)} · {it.zone ? ZONE_BY_CODE[it.zone as ZoneCode]?.name ?? it.zone : "위치 미확인"}</small>
              </figcaption>
            </figure>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
