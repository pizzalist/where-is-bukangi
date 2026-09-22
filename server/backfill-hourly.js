/**
 * 시간별 집계 소급 채우기. 제보·공개 카드·관측은 타임스탬프가 남아 있어 복원할 수 있다.
 * 방문은 날짜 단위로만 저장돼 있어 복원이 안 된다 (오늘부터 시간별로 쌓인다).
 *   node server/backfill-hourly.js
 */
import { db } from "./db.js";

const hourKey = (at) => new Date(new Date(at).getTime() + 9 * 3600e3).toISOString().slice(0, 13);
const bump = db.prepare(`INSERT INTO stats_hourly (hour, kind, n) VALUES (?,?,?) ON CONFLICT(hour,kind) DO UPDATE SET n = excluded.n`);
const count = {};
for (const r of db.prepare("SELECT submitted_at, status FROM submissions").all()) {
  const h = hourKey(r.submitted_at);
  (count[h] ||= {}).report = ((count[h] || {}).report || 0) + 1;
  if (r.status === "approved") count[h].card = (count[h].card || 0) + 1;
}
let n = 0;
for (const [h, kinds] of Object.entries(count)) for (const [k, v] of Object.entries(kinds)) { bump.run(h, k, v); n++; }
console.log(`소급 반영 ${n}건 (제보·공개 카드). 방문은 오늘부터 시간별로 쌓입니다.`);
