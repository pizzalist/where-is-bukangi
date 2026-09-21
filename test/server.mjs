import { chromium } from 'playwright';
const B = 'http://localhost:8787';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(B + '/#/'); await p.waitForTimeout(1500);
await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1800);
console.log('타임라인 사진 수:', await p.locator('.tl-photo').count());
console.log('히어로:', (await p.locator('.hero .headline').textContent())?.trim(), '|', (await p.locator('.hero .sub').textContent())?.trim());
await p.screenshot({ path: '/tmp/s-home.png', fullPage: true });
// 명예의 전당
await p.locator('.section-head button', { hasText: '명예의 전당' }).click(); await p.waitForTimeout(1500);
console.log('명예의 전당 카드:', await p.locator('.hall-item').count());
await p.screenshot({ path: '/tmp/s-hall.png', fullPage: true });
// 실제 제출
await p.goto(B + '/#/certify'); await p.waitForTimeout(1200);
await p.setInputFiles('input[type=file]', 'public/sample.png'); await p.waitForTimeout(1800);
await p.getByRole('button', { name: '이대로' }).click(); await p.waitForTimeout(900);
await p.getByRole('button', { name: '카드 뽑기' }).click(); await p.waitForTimeout(3000);
const card = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('bukang.submissions.v1'))[0]; return { id: s.id, ordinal: s.ordinal, rarity: s.rarity }; });
console.log('서버가 발급한 카드:', JSON.stringify(card));
await p.screenshot({ path: '/tmp/s-card.png', fullPage: true });
console.log('ERRORS:', errs.length?errs.join(' | '):'none');
await b.close();
