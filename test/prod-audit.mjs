// 운영 사이트 읽기 전용 점검. 제보를 만들지 않는다.
import { chromium } from 'playwright';
const SITE = 'https://bukangi.com';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const bad = []; p.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('version.json')) bad.push(r.status() + ' ' + r.url().slice(0, 80)); });
await p.goto(SITE + '/#/'); await p.waitForTimeout(3000);
console.log('번들:', await p.evaluate(() => document.querySelector('script[src*=app-]')?.getAttribute('src')));
console.log('홈 로고:', await p.locator('.brand-logo').count(), '| 히어로:', (await p.locator('.hero .headline').textContent())?.trim(), '| 공지:', await p.locator('.notice').count() - 3, '| 통계바:', await p.locator('.statbar').count());
for (const [r, sel, name] of [['certify', 'input[type=file]', '카드뽑기 파일입력'], ['tiers', '.holo', '등급 카드'], ['hall', '.page', '명예의 전당'], ['card', '.page', '내 카드']]) {
  await p.goto(`${SITE}/#/${r}`); await p.waitForTimeout(2000);
  console.log(`${name}:`, await p.locator(sel).count(), r === 'card' ? '| 문구: ' + (await p.locator('.card').first().textContent())?.trim().slice(0, 30) : '');
}
await p.goto('https://admin.bukangi.com/#/admin'); await p.waitForTimeout(2500);
console.log('운영자 페이지 입력창:', await p.locator('input').count());
console.log('JS 오류:', errs.length ? errs : 'none'); console.log('4xx/5xx:', bad.length ? bad : 'none');
await b.close();
