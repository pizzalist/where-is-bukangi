import { useEffect, useState } from "react";
import { adminApi, type Breakdown as B } from "../lib/admin";

/** 유입 경로와 화면별 조회. 어디서 오는지 알아야 어디에 힘을 쓸지 정할 수 있다 */
const SRC_LABEL: Record<string, string> = {
  threads: "스레드", instagram: "인스타", kakao: "카카오", facebook: "페이스북",
  naver: "네이버", google: "구글", youtube: "유튜브", twitter: "엑스(트위터)",
  card_link: "카드 링크", direct: "직접·QR", internal: "사이트 내부", other: "기타",
};
const ROUTE_LABEL: Record<string, string> = {
  home: "지금(홈)", certify: "제보하기", card: "내 카드", hall: "명예의 전당", tiers: "등급 설명", admin: "운영", shot: "카드 렌더", other: "기타",
};

function Bars({ rows, labels }: { rows: { k: string; n: number }[]; labels: Record<string, string> }) {
  const total = rows.reduce((a, r) => a + r.n, 0);
  if (!total) return <div className="bd-empty">아직 기록이 없어요</div>;
  return (
    <div className="bd-list">
      {rows.map((r) => (
        <div key={r.k} className="bd-row">
          <span className="bd-name">{labels[r.k] ?? r.k}</span>
          <span className="bd-bar"><i style={{ width: `${(r.n / rows[0].n) * 100}%` }} /></span>
          <span className="bd-n mono">{r.n.toLocaleString()}</span>
          <span className="bd-pct">{Math.round((r.n / total) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function Breakdown() {
  const [d, setD] = useState<B | null>(null);
  const [days, setDays] = useState(1);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    adminApi.breakdown(days).then((r) => alive && setD(r)).catch(() => alive && setErr("불러오지 못했어요"));
    return () => { alive = false; };
  }, [days]);

  if (err) return <div className="alert warn">{err}</div>;
  if (!d) return <div className="card" style={{ color: "var(--ink-3)" }}>불러오는 중</div>;

  return (
    <div className="hourchart">
      <div className="hc-head">
        <b style={{ fontSize: "0.9rem" }}>유입 경로</b>
        <select className="hc-range" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={1}>오늘</option><option value={3}>3일</option><option value={7}>7일</option><option value={30}>30일</option>
        </select>
      </div>
      <Bars rows={d.sources.map((s) => ({ k: s.src, n: s.n }))} labels={SRC_LABEL} />
      <div className="hc-head" style={{ marginTop: "1rem" }}><b style={{ fontSize: "0.9rem" }}>화면별 첫 진입</b></div>
      <Bars rows={d.routes.map((r) => ({ k: r.route, n: r.n }))} labels={ROUTE_LABEL} />
    </div>
  );
}
