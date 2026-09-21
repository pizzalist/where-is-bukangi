// 스레드용 실제 화면: 제보가 올라온 상태의 홈·기록·카드·명예의 전당 (테스트 서버, 운영 DB 안 건드림)
import { chromium } from 'playwright';
import fs from 'node:fs';
const SITE = 'http://localhost:4173', API = 'http://localhost:8788', TOK = 'testtoken_testtoken_testtoken_1234', OUT = process.argv[2];
const ORDER = ['common', 'uncommon', 'rare', 'holo', 'reverse', 'galaxy', 'fullart', 'rainbow', 'gold'];
const ago = (min) => new Date(Date.now() - min * 60e3).toISOString();
const png = 'data:image/png;base64,' + fs.readFileSync('public/sample.png').toString('base64');
const H = { Authorization: 'Bearer ' + TOK, 'content-type': 'application/json' };
// 최근 몇 시간 동안 제보 6건 + 현장 관측 1건
const cards = [];
for (const [m, z] of [[35, 'B'], [80, 'B'], [125, 'C'], [170, 'B'], [230, 'D'], [290, 'C']]) {
  const r = await (await fetch(API + '/api/submissions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ photo: png, takenAt: ago(m), zone: z }) })).json();
  if (!r.id) { console.log('제보 실패', r); continue; }
  await fetch(`${API}/api/admin/${r.id}/approve`, { method: 'POST', headers: H, body: JSON.stringify({ zone: z }) });
  cards.push({ ...r, takenAt: ago(m), zone: z });
}
await fetch(API + '/api/admin/observation', { method: 'POST', headers: H, body: JSON.stringify({ kind: 'seen', zone: 'B', at: ago(350), note: '현장 관측' }) });
console.log('카드:', cards.map((c) => `${c.ordinal}:${c.rarity}`).join(' '));
const best = cards.slice().sort((a, b) => ORDER.indexOf(b.rarity) - ORDER.indexOf(a.rarity))[0];
await new Promise((r) => setTimeout(r, 6000));

const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }); const p = await ctx.newPage();
await p.goto(SITE + '/#/'); await p.waitForTimeout(1500);
// 제일 좋은 카드를 "내 카드"로 심는다
await p.evaluate((c) => localStorage.setItem('bukang.submissions.v1', JSON.stringify([{ id: c.id, type: 'seen', takenAt: c.takenAt, submittedAt: c.takenAt, zone: c.zone, photoDataUrl: c.photo, status: 'approved', ordinal: c.ordinal, rarity: c.rarity }])), best);
await p.goto(SITE + '/#/card/' + best.id); await p.waitForTimeout(3800);
await p.mouse.move(120, 330); await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/shot-card.png` });
console.log('카드 화면:', best.ordinal, best.rarity, '| 제목:', (await p.locator('h1').first().textContent())?.trim());
await p.goto(SITE + '/#/'); await p.reload(); await p.waitForTimeout(3000);
await p.screenshot({ path: `${OUT}/shot-home.png` });
console.log('히어로:', (await p.locator('.hero .headline').textContent())?.trim(), '|', (await p.locator('.hero .sub').textContent())?.trim());
const tl = await p.locator('.section', { hasText: '오늘의 기록' }).first().boundingBox();
await p.evaluate((y) => window.scrollTo(0, y - 70), tl.y); await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/shot-timeline.png` });
await p.goto(SITE + '/#/hall'); await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}/shot-hall.png` });
await b.close(); console.log('demo shots ok');
