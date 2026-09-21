// 운영 주소에서 실제 흐름 확인. 사진 제보 → 카드 발급 → 운영자 공개 → 상황판 반영.
import { chromium } from 'playwright';
const SITE = 'https://bukangi.com', API = 'https://api.bukangi.com', ADMIN = 'https://admin.bukangi.com';
const TOK = process.env.ADMIN_TOKEN;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const failed = []; p.on('requestfailed', (r) => failed.push(r.url() + ' ' + r.failure()?.errorText));

await p.goto(SITE + '/#/'); await p.waitForTimeout(2500);
console.log('히어로:', (await p.locator('.hero .headline').textContent())?.trim());
console.log('데모배너:', await p.locator('.demo-banner').count());
console.log('공지:', await p.locator('.notice').count(), '| 방문수 표시:', await p.locator('.statbar').count());

await p.goto(SITE + '/#/certify'); await p.waitForTimeout(1500);
await p.setInputFiles('input[type=file]', 'public/sample.png'); await p.waitForTimeout(2000);
await p.getByRole('button', { name: '이대로' }).click(); await p.waitForTimeout(800);
await p.getByRole('button', { name: '카드 뽑기' }).click(); await p.waitForTimeout(5000);
const card = await p.evaluate(() => JSON.parse(localStorage.getItem('bukang.submissions.v1') || '[]')[0]);
console.log('발급 카드:', card && { id: card.id, ordinal: card.ordinal, rarity: card.rarity });
if (!card?.id) { console.log('FAIL: 카드 미발급'); process.exit(1); }

// 카드 하단 주소
await p.goto(SITE + '/#/card/' + card.id); await p.waitForTimeout(2500);
console.log('카드 하단 주소:', (await p.locator('.holo-site').first().textContent())?.trim());
await p.screenshot({ path: '/tmp/prod-card.png' });

// 운영자 공개
const q = await (await fetch(ADMIN + '/api/admin/queue', { headers: { Authorization: 'Bearer ' + TOK } })).json();
console.log('운영자 큐:', q.length, '| 사진:', q[0]?.photo);
const ok = await (await fetch(`${ADMIN}/api/admin/${card.id}/approve`, { method: 'POST', headers: { Authorization: 'Bearer ' + TOK, 'content-type': 'application/json' }, body: JSON.stringify({ zone: 'B' }) })).json();
console.log('공개 처리:', ok);

await new Promise((r) => setTimeout(r, 11000));   // status 캐시 10초
const st = await (await fetch(API + '/api/status', { headers: { 'cache-control': 'no-cache' } })).json();
const row = st.timeline.find((e) => e.ordinal === card.ordinal);
console.log('상황판 반영:', !!row, '| 사진:', row?.photo);
const hall = await (await fetch(API + '/api/hall')).json();
console.log('명예의 전당:', hall.length, '| 첫 사진:', hall[0]?.photo);
if (row?.photo) console.log('사진 응답:', (await fetch(row.photo)).status);

console.log('JS 오류:', errs.length ? errs : 'none');
console.log('실패 요청:', failed.length ? failed.slice(0, 3) : 'none');
await b.close();
