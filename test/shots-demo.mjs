// 스레드용 실제 화면: 제보가 올라온 상태의 홈·기록·카드·명예의 전당
import { chromium } from 'playwright';
const SITE = 'http://localhost:4173', API = 'http://localhost:8788', TOK = 'testtoken_testtoken_testtoken_1234', OUT = process.argv[2];
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }); const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message)); p.on('response', (r) => { if (r.url().includes('/api/')) console.log('RESP', r.status(), r.request().method(), r.url().slice(0, 60)); });
const iso = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };
// 카드 1: UI로 (자르기 포함) → 내 카드 화면
await p.goto(SITE + '/#/certify'); await p.waitForTimeout(1500);
await p.setInputFiles('input[type=file]', 'public/sample.png'); await p.waitForTimeout(1800);
await p.getByRole('button', { name: '이대로' }).click(); await p.waitForTimeout(800);
await p.locator('.pm-chip', { hasText: '제5보도교' }).click();
await p.getByRole('button', { name: '카드 뽑기' }).click(); await p.waitForTimeout(4000);
console.log('버튼:', await p.locator('button').allTextContents().then(a => a.slice(0, 6)), '| 경고:', await p.locator('.alert').allTextContents());
const mine = await p.evaluate(() => JSON.parse(localStorage.getItem('bukang.submissions.v1'))[0]);
console.log('카드1', mine.id, mine.ordinal, mine.rarity);
// 카드 2: API로 (다른 시각·구역)
const png = 'data:image/png;base64,' + (await import('node:fs')).readFileSync('public/sample.png').toString('base64');
const c2 = await (await fetch(API + '/api/submissions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ photo: png, thumb: mine.photoDataUrl ? undefined : undefined, takenAt: iso(17, 5), zone: 'C' }) })).json();
console.log('카드2', c2.id, c2.ordinal, c2.rarity);
for (const [id, zone] of [[mine.id, 'B'], [c2.id, 'C']]) await fetch(`${API}/api/admin/${id}/approve`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOK, 'content-type': 'application/json' }, body: JSON.stringify({ zone }) });
await fetch(API + '/api/admin/observation', { method: 'POST', headers: { Authorization: 'Bearer ' + TOK, 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'seen', zone: 'B', at: iso(15, 30), note: '현장 관측' }) });
await p.waitForTimeout(6000);   // status 캐시
// 내 카드 화면 (리빌 끝난 뒤)
await p.goto(SITE + '/#/'); await p.waitForTimeout(500); await p.goto(SITE + '/#/card/' + mine.id); await p.waitForTimeout(3500);
await p.mouse.move(150, 350); await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/shot-card.png` });
// 홈 (히어로에 목격)
await p.goto(SITE + '/#/'); await p.reload(); await p.waitForTimeout(3000);
await p.screenshot({ path: `${OUT}/shot-home.png` });
console.log('히어로:', (await p.locator('.hero .headline').textContent())?.trim());
// 오늘의 기록 섹션
const tl = await p.locator('.section', { hasText: '오늘의 기록' }).first().boundingBox();
await p.evaluate((y) => window.scrollTo(0, y - 60), tl.y); await p.waitForTimeout(600);
await p.screenshot({ path: `${OUT}/shot-timeline.png` });
// 명예의 전당
await p.goto(SITE + '/#/hall'); await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}/shot-hall.png` });
await b.close(); console.log('demo shots ok');
