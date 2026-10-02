import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Status, Event, ZoneCode } from "../lib/types";
import { ageMinutes, fmtAge, fmtTime, fmtWhen, isToday } from "../lib/store";
const TWO = `${import.meta.env.BASE_URL}bukang-two.webp`;
import ZoneMap from "../components/ZoneMap";
import LiveBar from "../components/LiveBar";
import { RARITY_ORDER, RARITY_META } from "../lib/rarity";
import { ZONES, ZONE_BY_CODE, naverDirections, naverPlace, PARK } from "../lib/zones";
import { gaEnabled } from "../lib/ga";

type HeroState = "seen" | "miss" | "none" | "crit";

function deriveHero(s: Status, now: number): { state: HeroState; headline: string; sub: string; ageMin: number } {
  if (s.control) return { state: "crit", headline: "출입통제 중", sub: s.control.title, ageMin: 0 };
  if (!s.last) return { state: "none", headline: "아직 제보가 없어요", sub: "부캉이를 봤다면 사진 한 장 올려주세요. 첫 주인공이 돼요", ageMin: 0 };
  const a = ageMinutes(s.last.at, now);
  if (s.last.kind === "miss") return { state: "miss", headline: `${fmtWhen(s.last.at)} 관측 · 못 봄`, sub: `${ZONE_BY_CODE[s.last.zone]?.full ?? ""} · ${s.last.note ?? ""}`, ageMin: a };
  // 큰 글씨는 "언제 나왔나". 근거(사진 인증·현장 관측)와 구역은 바로 아래 줄에.
  // 시간이 오래 지나도 "미확인"으로 바꾸지 않는다. 얼마나 됐는지는 옆 배지로 알린다
  const via = s.last.source === "ping" ? "현장 제보" : s.last.source === "observation" || !s.last.photo ? "현장 관측" : "사진 인증";
  const where = s.last.zone ? ZONE_BY_CODE[s.last.zone]?.full ?? "" : "북항 친수공원";   // 탭은 GPS로 보도교까지는 못 가른다
  return { state: "seen", headline: `${fmtWhen(s.last.at)} 출몰`, sub: `${via} · ${where}`, ageMin: a };
}

/** 지금 몇 명이 보인다/안 보인다고 했는지. 히어로 안에 한 줄로 */
function liveLine(live: Status["live"]): { text: string; tone: "yes" | "no" } | null {
  if (!live) return null;
  const { seen, miss, windowMin } = live;
  if (seen > 0) return { text: `지금 ${seen}명이 보인다고 했어요${miss > 0 ? ` · 못 봤다는 사람 ${miss}명` : ""}`, tone: "yes" };
  if (miss > 0) return { text: `최근 ${windowMin}분 안에 ${miss}명이 못 봤다고 했어요`, tone: "no" };
  return null;
}

const TIER_LABEL = { confirmed: "확인됨", est: "SNS 추정", auto: "미확인" } as const;
const TIER_CLASS = { confirmed: "ok", est: "est", auto: "auto" } as const;

export default function Home({ status, onDraw, onHall, onRefresh }: { status: Status; onDraw?: () => void; onHall?: () => void; onRefresh?: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const hero = useMemo(() => deriveHero(status, now), [status, now]);
  const live = useMemo(() => liveLine(status.live), [status.live]);
  const hotZone = hero.state === "seen" ? status.last!.zone : null;
  const [pick, setPick] = useState<ZoneCode | null>(null);
  const [allLog, setAllLog] = useState(false);       // 최근 기록 더보기
  const [allNotice, setAllNotice] = useState(false); // 공지 더보기
  const LOG_N = 6, NOTICE_N = 2;
  const shownLog = allLog ? status.timeline : status.timeline.slice(0, LOG_N);
  const shownNotice = allNotice ? status.notices : status.notices.slice(0, NOTICE_N);

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
          
          <span className="pill">갱신 <span className="age">{fmtAge(ageMinutes(status.updatedAt, now))}</span></span>
        </div>
        {live && <div className={`hero-live ${live.tone}`}>{live.text}</div>}
        {!live && hero.state === "seen" && hero.ageMin > 120 && (
          <p className="hero-ask">이 화면은 여러분의 제보로만 갱신돼요. 지금 상태를 알려주세요.</p>
        )}
        <img className="shark" src={TWO} alt="" width={150} height={150} />
      </motion.section>

      <LiveBar onDone={() => onRefresh?.()} />

      <button className="cta" onClick={onDraw}>
        <div>
          <b>부캉이 찍었나?</b>
          <small>사진 올려 제보하고 인증 카드 뽑기</small>
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
                  <span className="mono">{fmtWhen(e.at)}</span> · {e.kind === "miss" ? "미목격" : "목격"} · {TIER_LABEL[e.tier]}
                </div>
              ))}
              {!(byZone[pick]?.length) && <div style={{ fontSize: "0.88rem", color: "var(--ink-3)" }}>기록 없음</div>}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>최근 기록</h2>
          <button className="more" onClick={onHall}>명예의 전당 ›</button>
        </div>
        {status.timeline.length === 0 && (
          <div className="card" style={{ color: "var(--ink-3)" }}>아직 기록이 없어요. 부캉이를 봤다면 사진 한 장 올려주세요. 첫 기록의 주인공이 돼요.</div>
        )}
        <ul className="timeline">
          {shownLog.map((e, i) => (
            <motion.li
              key={i}
              className={`tl-item ${e.tier} ${e.kind}`}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            >
              <span className="time">{isToday(e.at) ? fmtTime(e.at) : fmtWhen(e.at)}</span>
              {e.photo ? <img className="tl-photo" src={e.photo} alt="" loading="lazy" /> : <span className="tl-nophoto" />}
              <span className="body">
                {e.kind === "miss" ? "관측했지만 못 봄" : `${ZONE_BY_CODE[e.zone]?.name ?? e.zone}에서 목격`}
                <small>{e.note}</small>
              </span>
              <span className={`pill ${TIER_CLASS[e.tier]}`}>{TIER_LABEL[e.tier]}</span>
            </motion.li>
          ))}
        </ul>
        {!allLog && status.timeline.length > LOG_N && (
          <button className="fold" onClick={() => setAllLog(true)}>이전 기록 {status.timeline.length - LOG_N}개 더보기</button>
        )}
      </section>

      {status.stats && (
        <section className="section">
          <div className="statbar">
            <div><b>{status.stats.visitsToday.toLocaleString()}</b><span>오늘 방문</span></div>
            <div><b>{status.stats.reportsToday.toLocaleString()}</b><span>오늘 제보</span></div>
            <div><b>{status.stats.approvedTotal.toLocaleString()}</b><span>공개된 카드</span></div>
            <div><b>{status.stats.visitsTotal.toLocaleString()}</b><span>누적 방문</span></div>
          </div>
        </section>
      )}

      {status.notices.length > 0 && (
      <section className="section">
        <div className="section-head">
          <h2>안전 · 공지</h2>
        </div>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {shownNotice.map((n, i) => (
            <a key={i} className={`notice${n.crit ? " crit" : ""}`} href={n.url} target="_blank" rel="noreferrer">
              <div>
                <div className="src">{n.src}</div>
                <div className="t">{n.title}</div>
              </div>
            </a>
          ))}
        </div>
        {!allNotice && status.notices.length > NOTICE_N && (
          <button className="fold" onClick={() => setAllNotice(true)}>공지 {status.notices.length - NOTICE_N}개 더보기</button>
        )}
      </section>
      )}

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
                <div className="t">저녁 6시 ~ 아침 6시는 수로 주변 출입 통제</div>
                <div className="src">공원은 05:00~24:00 · 부산시설공단 운영 · 주소 {PARK.address}</div>
              </div>
            </div>
          </div>
        </div>

      <p className="disclaimer">시민 제보로 운영하는 상황판이에요. 물가 접근 금지 등 해경·구청 안내를 따르세요. 마지막 목격 이후 시간이 지났다고 지금 없는 건 아니에요.{gaEnabled() && " 방문 통계를 위해 구글 애널리틱스 쿠키를 써요. 브라우저에서 쿠키를 막으면 수집되지 않아요."}</p>
      <p className="contact">
        Created by <a href="mailto:letgoofthepizza@gmail.com">letgoofthepizza@gmail.com</a>
        {" · "}<a href="https://www.threads.com/@where_is_bukangi" target="_blank" rel="noopener noreferrer">스레드</a>
        {" · "}<a href="https://www.instagram.com/where_is_bukangi" target="_blank" rel="noopener noreferrer">인스타</a>
        <br /><span style={{ opacity: 0.55 }}>v.{__BUILD__.slice(4, 13)}</span>
      </p>
    </div>
  );
}
