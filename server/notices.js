/**
 * 안전·공지 기본값 주입. 자동 파싱은 아직 없다 (SCREENING.md / OPS.md 참고).
 * 같은 제목이 이미 있으면 건너뛰니 여러 번 실행해도 된다.
 *   node server/notices.js
 */
import { db } from "./db.js";

const DEFAULTS = [
  { src: "부산해양경찰서", title: "북항 친수공원 상어 출현, 물가 접근 자제 당부", url: "https://www.newspim.com/news/view/20260918000700", crit: 0 },
  { src: "국립수산과학원", title: "무태상어 추정, 무리한 유도 시 공격성 가능", url: "https://www.etoday.co.kr/news/view/2627722", crit: 0 },
];

const exists = db.prepare("SELECT 1 FROM notices WHERE title=?");
const ins = db.prepare("INSERT INTO notices (src, title, url, crit, created_at) VALUES (?,?,?,?,?)");
let added = 0;
for (const n of DEFAULTS) {
  if (exists.get(n.title)) continue;
  ins.run(n.src, n.title, n.url, n.crit, new Date().toISOString());
  added++;
}
console.log(`공지 ${added}건 추가 (현재 ${db.prepare("SELECT COUNT(*) c FROM notices").get().c}건)`);
