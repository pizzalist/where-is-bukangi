// 새 공유/저장 버튼 동작. 운영 DB에 카드를 만들지 않고, 기기 저장소에 가짜 카드를 넣어 UI만 확인한다.
import { chromium } from 'playwright';
const SITE = 'https://bukangi.com';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: SITE });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(SITE + '/#/'); await p.waitForTimeout(1500);
await p.evaluate(() => localStorage.setItem('bukang.submissions.v1', JSON.stringify([{ id: 'fakefakefake', type: 'seen', takenAt: '2026-09-21T20:00:00+09:00', submittedAt: '2026-09-21T20:00:00+09:00', zone: 'B', status: 'pending', ordinal: 1, rarity: 'holo' }])));
await p.goto(SITE + '/#/card/fakefakefake'); await p.waitForTimeout(2500);
console.log('버튼:', await p.locator('.share-row button').allTextContents());
console.log('공유 주소:', await p.locator('.urlbox input').inputValue());
await p.getByRole('button', { name: '공유하기' }).click(); await p.waitForTimeout(500);
console.log('공유하기(share API 없는 환경):', await p.locator('.share-row button').allTextContents(), '| 클립보드:', await p.evaluate(() => navigator.clipboard.readText()));
await p.getByRole('button', { name: '이미지 저장' }).click(); await p.waitForTimeout(4000);
console.log('없는 카드 저장 시도 → 안내:', (await p.locator('.alert').textContent())?.trim(), '| 기기 목록에서 제거:', await p.evaluate(() => JSON.parse(localStorage.getItem('bukang.submissions.v1')).length === 0));
console.log('JS 오류:', errs.length ? errs : 'none');
await b.close();
