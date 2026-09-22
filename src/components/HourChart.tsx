import { useEffect, useState } from "react";
import { adminApi, type HourRow } from "../lib/admin";

/**
 * 시간대별 추이. 외부 차트 라이브러리 없이 SVG 막대로 그린다.
 * 방문(순방문)·페이지뷰·제보·현장 탭을 같은 시간축에 놓고 언제 사람이 오는지 본다.
 */
type Key = "uniq" | "view" | "report" | "ping" | "share";
const SERIES: { key: Key; label: string; color: string }[] = [
  { key: "uniq", label: "순방문", color: "#2fb5e8" },
  { key: "view", label: "페이지뷰", color: "#9fd8ef" },
  { key: "report", label: "사진 제보", color: "#0b5c8a" },
  { key: "ping", label: "현장 탭", color: "#f0a33c" },
  { key: "share", label: "공유·저장", color: "#7b61ff" },
];
const val = (r: HourRow, k: Key) => (k === "ping" ? r.ping_seen + r.ping_miss : k === "share" ? r.share + r.save : r[k]);
const hh = (h: string) => Number(h.slice(11, 13));

export default function HourChart() {
  const [rows, setRows] = useState<HourRow[] | null>(null);
  const [since, setSince] = useState<string | null>(null);
  const [hours, setHours] = useState(24);
  const [key, setKey] = useState<Key>("uniq");
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    adminApi.hourly(hours).then((r) => { if (!alive) return; setRows(r.rows); setSince(r.since); }).catch(() => alive && setErr("불러오지 못했어요"));
    return () => { alive = false; };
  }, [hours]);

  if (err) return <div className="alert warn">{err}</div>;
  if (!rows) return <div className="card" style={{ color: "var(--ink-3)" }}>불러오는 중</div>;

  const max = Math.max(1, ...rows.map((r) => val(r, key)));
  const total = rows.reduce((a, r) => a + val(r, key), 0);
  const peak = rows.reduce((a, r) => (val(r, key) > val(a, key) ? r : a), rows[0]);
  const s = SERIES.find((x) => x.key === key)!;
  const W = 100, H = 34, bw = W / rows.length;

  return (
    <div className="hourchart">
      <div className="hc-head">
        <div className="hc-tabs">
          {SERIES.map((x) => (
            <button key={x.key} className={`hc-tab${key === x.key ? " on" : ""}`} onClick={() => setKey(x.key)}>
              <i style={{ background: x.color }} />{x.label}
            </button>
          ))}
        </div>
        <select className="hc-range" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
          <option value={24}>24시간</option>
          <option value={48}>2일</option>
          <option value={72}>3일</option>
          <option value={168}>7일</option>
        </select>
      </div>

      <div className="hc-sum">
        합계 <b>{total.toLocaleString()}</b>
        {total > 0 && <> · 가장 많던 시각 <b>{hh(peak.hour)}시</b> ({val(peak, key).toLocaleString()})</>}
      </div>
      {since && rows[0].hour < since && (
        <div className="hc-note">시간별 집계는 {since.slice(5, 10).replace("-", "/")} {hh(since)}시부터예요. 그 전 기록은 하루 단위로만 남아 있어요.</div>
      )}

      <svg className="hc-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="시간대별 추이">
        {rows.map((r, i) => {
          const v = val(r, key), h = (v / max) * (H - 4);
          return <rect key={r.hour} x={i * bw + bw * 0.12} y={H - h} width={bw * 0.76} height={Math.max(v > 0 ? 0.7 : 0, h)}
            rx={bw * 0.2} fill={s.color} opacity={v > 0 ? 1 : 0.18} />;
        })}
      </svg>

      <div className="hc-axis">
        {rows.map((r, i) => {
          const step = rows.length > 48 ? 12 : rows.length > 24 ? 6 : 3;
          return <span key={r.hour} style={{ width: `${bw}%` }}>{i % step === 0 ? hh(r.hour) : ""}</span>;
        })}
      </div>

      <details className="hc-table">
        <summary>시간별 숫자 보기</summary>
        <table>
          <thead><tr><th>시각</th><th>순방문</th><th>페이지뷰</th><th>제보</th><th>탭(보임/안보임)</th><th>공유/저장</th><th>카드링크</th></tr></thead>
          <tbody>
            {[...rows].reverse().filter((r) => r.view + r.report + r.ping_seen + r.ping_miss + r.share + r.save + r.card_view > 0).map((r) => (
              <tr key={r.hour}>
                <td className="mono">{r.hour.slice(5, 10)} {String(hh(r.hour)).padStart(2, "0")}시</td>
                <td className="mono">{r.uniq}</td><td className="mono">{r.view}</td><td className="mono">{r.report}</td>
                <td className="mono">{r.ping_seen}/{r.ping_miss}</td>
                <td className="mono">{r.share}/{r.save}</td>
                <td className="mono">{r.card_view}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
