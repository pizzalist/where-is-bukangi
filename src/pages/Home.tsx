import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Status, Event } from "../lib/types";
import { ageMinutes, fmtAge, fmtTime, DECAY_MIN } from "../lib/store";
import Shark from "../components/Shark";
import ZoneMap from "../components/ZoneMap";

type HeroState = "seen" | "miss" | "stale" | "none" | "crit";

function deriveHero(s: Status, now: number): { state: HeroState; headline: string; sub: string; ageMin: number } {
  if (s.control) return { state: "crit", headline: "출입통제 중", sub: s.control.title, ageMin: 0 };
  if (!s.last) return { state: "none", headline: "최근 확인 없음", sub: "아직 확인된 기록이 없어요", ageMin: 0 };
  const a = ageMinutes(s.last.at, now);
  const zone = s.zones.find((z) => z.code === s.last!.zone)?.name ?? "";
  if (s.last.kind === "miss") return { state: "miss", headline: `최근 관측 미목격 · ${fmtTime(s.last.at)}`, sub: `${s.last.zone}구역 ${zone} · ${s.last.note ?? ""}`, ageMin: a };
  if (a > DECAY_MIN) return { state: "stale", headline: `미확인 · 마지막 확인 ${fmtTime(s.last.at)}`, sub: `${s.last.zone}구역 ${zone} · 2시간 넘게 새 확인이 없어요`, ageMin: a };
  return { state: "seen", headline: `마지막 확인 목격 ${fmtTime(s.last.at)}`, sub: `${s.last.zone}구역 ${zone} · ${s.last.evidence ?? ""}`, ageMin: a };
}

const TIER_LABEL = { confirmed: "확인됨", est: "SNS 추정", auto: "미확인" } as const;
const TIER_CLASS = { confirmed: "ok", est: "est", auto: "auto" } as const;

export default function Home({ status }: { status: Status }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const hero = useMemo(() => deriveHero(status, now), [status, now]);
  const hotZone = hero.state === "seen" ? status.last!.zone : null;
  const [pick, setPick] = useState<string | null>(null);

  const byZone = useMemo(() => {
    const m: Record<string, Event[]> = {};
    for (const e of status.timeline) (m[e.zone] ||= []).push(e);
    return m;
  }, [status.timeline]);

  return (
    <div className="page">
      <motion.section
        className={`hero state-${hero.state}`}
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 24 }}
      >
        <div className="kicker">부산 북항 친수공원 · 지금</div>
        <AnimatePresence mode="wait">
          <motion.h1 key={hero.headline} className="headline" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {hero.headline}
          </motion.h1>
        </AnimatePresence>
        <p className="sub">{hero.sub}</p>
        <div className="meta">
          {hero.state !== "none" && hero.state !== "crit" && <span className="pill"><span className="age">{fmtAge(hero.ageMin)}</span></span>}
          {status.last && hero.state === "seen" && <span className="pill">{TIER_LABEL[status.last.tier]}</span>}
          <span className="pill">갱신 <span className="age">{fmtAge(ageMinutes(status.updatedAt, now))}</span></span>
        </div>
        <Shark className="shark" size={150} />
      </motion.section>

      <section className="section">
        <div className="section-head">
          <h2>어느 구역에서</h2>
          <span className="more">탭하면 그 구역 기록</span>
        </div>
        <ZoneMap hot={hotZone} active={pick as never} onPick={(z) => setPick(pick === z ? null : z)} />
        <div className="zone-legend">
          {status.zones.map((z) => (
            <button key={z.code} className="zone-chip" style={{ cursor: "pointer" }} onClick={() => setPick(pick === z.code ? null : z.code)}>
              <b>{z.code}</b>{z.name}
            </button>
          ))}
        </div>
        <AnimatePresence>
          {pick && (
            <motion.div className="card" style={{ marginTop: "0.6rem" }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <strong>{pick}구역</strong> · 오늘 기록 {byZone[pick]?.length ?? 0}건
              {(byZone[pick] ?? []).slice(0, 3).map((e, i) => (
                <div key={i} style={{ fontSize: "0.88rem", color: "var(--ink-2)" }}>
                  <span className="mono">{fmtTime(e.at)}</span> · {e.kind === "miss" ? "미목격" : "목격"} · {TIER_LABEL[e.tier]}
                </div>
              ))}
              {!(byZone[pick]?.length) && <div style={{ fontSize: "0.88rem", color: "var(--ink-3)" }}>기록 없음</div>}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>오늘의 기록</h2>
          <span className="more">색이 곧 신뢰 등급</span>
        </div>
        <ul className="timeline">
          {status.timeline.map((e, i) => (
            <motion.li
              key={i}
              className={`tl-item ${e.tier} ${e.kind}`}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            >
              <span className="time">{fmtTime(e.at)}</span>
              <span className="body">
                {e.kind === "miss" ? "관측했지만 못 봄" : `${e.zone}구역에서 목격`}
                <small>{e.note}</small>
              </span>
              <span className={`pill ${TIER_CLASS[e.tier]}`}>{TIER_LABEL[e.tier]}</span>
            </motion.li>
          ))}
        </ul>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>안전 · 공지</h2>
          <span className="more">원문 링크</span>
        </div>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {status.notices.map((n, i) => (
            <a key={i} className={`notice${n.crit ? " crit" : ""}`} href={n.url} target="_blank" rel="noreferrer">
              <div>
                <div className="src">{n.src}</div>
                <div className="t">{n.title}</div>
              </div>
            </a>
          ))}
        </div>
        <p className="disclaimer">비공식 관람 정보입니다. 물가 접근 금지 등 해경·구청 안내를 따르세요. "확인 없음"은 "없음"이 아닙니다.</p>
      </section>
    </div>
  );
}
