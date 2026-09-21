// 기술 설명이 카드 밖으로 넘치거나 말줄임으로 잘리는지 (일반 레이아웃 / 풀아트 레이아웃 둘 다)
import { chromium } from 'playwright';
import crypto from 'node:crypto';
const { cardStats } = await import('../src/lib/rarity.ts');
const WANT = process.argv[2] || '핑크퐁 주가 상승';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 460, height: 900 }, deviceScaleFactor: 3 });
for (const rarity of ['holo', 'galaxy', 'fullart', 'gold']) {
  let id = null; const takenAt = '2026-09-22T01:27:00+09:00';
  for (let i = 0; i < 400000 && !id; i++) { const c = crypto.randomBytes(9).toString('base64url'); if (cardStats(4, takenAt, c).moves.some((m) => m[0] === WANT)) id = c; }
  const d = Buffer.from(JSON.stringify({ id, ordinal: 4, rarity, zone: 'B', zoneName: '제5보도교', takenAt, photo: null, site: 'bukangi.com' })).toString('base64url');
  await p.goto(`http://localhost:4173/?d=${d}#/shot/${id}`); await p.waitForSelector('.shot-wrap[data-ready="1"]'); await p.waitForTimeout(300);
  const r = await p.evaluate((want) => Array.from(document.querySelectorAll('.holo-moves div')).map((row) => {
    const sp = row.querySelector('span'), nb = row.querySelector('b');
    const card = document.querySelector('.holo-inner').getBoundingClientRect(), rb = row.getBoundingClientRect();
    return { 기술: nb.textContent, 잘림: sp.scrollWidth > sp.clientWidth + 1, 넘침: rb.right > card.right + 1 || rb.left < card.left - 1,
      설명폭: sp.scrollWidth, 가용폭: sp.clientWidth };
  }).filter((x) => x.기술 === want), WANT);
  console.log(rarity.padEnd(8), JSON.stringify(r[0]));
  await p.locator('.holo-moves').screenshot({ path: `/private/tmp/claude-501/-Users-teamlab-Projects/aa3a2ba1-f333-4946-9404-5b8d01f878fb/scratchpad/ov-${rarity}.png` });
}
await b.close();
