import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Status, Event, ZoneCode } from "../lib/types";
import { ageMinutes, fmtAge, fmtTime, DECAY_MIN } from "../lib/store";
const TWO = `${import.meta.env.BASE_URL}bukang-two.webp`;
import ZoneMap from "../components/ZoneMap";
import { RARITY_ORDER, RARITY_META } from "../lib/rarity";
import { ZONES, ZONE_BY_CODE, naverDirections, naverPlace, PARK } from "../lib/zones";

type HeroState = "seen" | "miss" | "stale" | "none" | "crit";

function deriveHero(s: Status, now: number): { state: HeroState; headline: string; sub: string; ageMin: number } {
  if (s.control) return { state: "crit", headline: "출입통제 중", sub: s.control.title, ageMin: 0 };
  if (!s.last) return { state: "none", headline: "최근 확인 없음", sub: "아직 확인된 기록이 없어요", ageMin: 0 };
  const a = ageMinutes(s.last.at, now);
  if (s.last.kind === "miss") return { state: "miss", headline: `최근 관측 미목격 · ${fmtTime(s.last.at)}`, sub: `${ZONE_BY_CODE[s.last.zone]?.full ?? ""} · ${s.last.note ?? ""}`, ageMin: a };
  if (a > DECAY_MIN) return { state: "stale", headline: `미확인 · 마지막 확인 ${fmtTime(s.last.at)}`, sub: `${ZONE_BY_CODE[s.last.zone]?.full ?? ""} · 2시간 넘게 새 확인이 없어요`, ageMin: a };
  return { state: "seen", headline: `마지막 확인 목격 ${fmtTime(s.last.at)}`, sub: `${ZONE_BY_CODE[s.last.zone]?.full ?? ""} · ${s.last.evidence ?? ""}`, ageMin: a };
}

const TIER_LABEL = { confirmed: "확인됨", est: "SNS 추정", auto: "미확인" } as const;
const TIER_CLASS = { confirmed: "ok", est: "est", auto: "auto" } as const;

export default function Home({ status, onDraw }: { status: Status; onDraw?: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const hero = useMemo(() => deriveHero(status, now), [status, now]);
  const hotZone = hero.state === "seen" ? status.last!.zone : null;
  const [pick, setPick] = useState<ZoneCode | null>(null);

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
        <img className="shark" src={TWO} alt="" width={150} height={150} />
      </motion.section>

      <button className="cta" onClick={onDraw}>
        <div>
          <b>부캉이 봤나?</b>
          <small>부캉이 인증 카드 뽑기</small>
        </div>
        <div className="cta-dots">{RARITY_ORDER.slice(3).map((r) => <span key={r} className={`tier-dot tier-dot-${r} mini`}>{RARITY_META[r].symbol}</span>)}</div>
      </button>

      <section className="section">
        <div className="section-head">
          <h2>어느 구역에서</h2>
        </div>
        <a className="go go-wide" href={naverDirections()} target="_blank" rel="noreferrer">네이버 길찾기 · {PARK.name}</a>
        <ZoneMap hot={hotZone} active={pick} onPick={(z) => setPick(pick === z ? null : z)} />
        <div className="map-legend">
          <span><i className="lg-hot" />마지막으로 목격이 확인된 구역</span>
          <span><i className="lg-zone" />수로 구간 · 탭하면 기록</span><span><i className="lg-bw" />방파제</span>
        </div>
        <div className="zone-list">
          {ZONES.map((z) => (
            <button key={z.code} className={`zone-row${hotZone === z.code ? " hot" : ""}${pick === z.code ? " on" : ""}`} onClick={() => setPick(pick === z.code ? null : z.code)}>
              <span className="zc">{z.code}</span>
              <span className="zn">
                {z.full}{z.main && <em className="zmain">주 목격</em>}
                <small>{z.landmark}</small>
              </span>
            </button>
          ))}
        </div>
        <p className="zone-note">상어는 수로가 휜 구조 탓에 이 구간을 벗어나지 못하고 있어요. 구간 안 이동은 도보 몇 분이라 길찾기는 공원 한 곳으로만 안내해요.</p>
        <AnimatePresence>
          {pick && (
            <motion.div className="card" style={{ marginTop: "0.6rem" }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <strong>{ZONE_BY_CODE[pick]?.full ?? pick}</strong> · 오늘 기록 {byZone[pick]?.length ?? 0}건
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
                {e.kind === "miss" ? "관측했지만 못 봄" : `${ZONE_BY_CODE[e.zone]?.name ?? e.zone}에서 목격`}
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
        <div className="section">
          <div className="section-head"><h2>찾아가기</h2></div>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <a className="notice" href={naverPlace("북항친수공원 주차장")} target="_blank" rel="noreferrer">
              <div>
                <div className="src">주차</div>
                <div className="t">공원 부설주차장</div>
                <div className="src">요금·잔여 면수는 지도에서 확인하세요. 주말에는 만차가 잦아요.</div>
              </div>
            </a>
            <a className="notice" href={naverPlace("부산역")} target="_blank" rel="noreferrer">
              <div>
                <div className="src">지하철</div>
                <div className="t">1호선 부산역 · 중앙역에서 도보</div>
                <div className="src">부산역에서 도보로 공원 입구까지 갈 수 있어요.</div>
              </div>
            </a>
            <div className="notice">
              <div>
                <div className="src">운영 시간</div>
                <div className="t">05:00 ~ 24:00</div>
                <div className="src">부산시설공단 운영 · 주소 {PARK.address}</div>
              </div>
            </div>
          </div>
        </div>

        <p className="disclaimer">비공식 관람 정보입니다. 물가 접근 금지 등 해경·구청 안내를 따르세요. "확인 없음"은 "없음"이 아닙니다.</p>
      </section>
    </div>
  );
}
