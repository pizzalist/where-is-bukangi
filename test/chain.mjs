import { chromium } from 'playwright';
const B='http://localhost:8787', TOK=process.env.TOK;
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const before = await (await fetch(B+'/api/status')).json();
const beforeHall = await (await fetch(B+'/api/hall')).json();
console.log('시작 상태: 타임라인', before.timeline.length, '건 / 명예의 전당', beforeHall.length, '장');

// 1) 사용자가 제보
await p.goto(B+'/#/certify'); await p.waitForTimeout(1200);
await p.setInputFiles('input[type=file]','public/sample.png'); await p.waitForTimeout(1800);
await p.getByRole('button',{name:'이대로'}).click(); await p.waitForTimeout(800);
await p.getByRole('button',{name:'카드 뽑기'}).click(); await p.waitForTimeout(2500);
const card = await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('bukang.submissions.v1'))[0];return {id:s.id,ordinal:s.ordinal,rarity:s.rarity}});
console.log('1) 제보 완료 →', JSON.stringify(card));

// 2) 운영자 로그인 + 승인
await p.goto(B+'/#/admin'); await p.waitForTimeout(900);
await p.fill('input[type=password]', TOK);
await p.getByRole('button',{name:'들어가기'}).click(); await p.waitForTimeout(1500);
const qn = await p.locator('.queue-item').count();
console.log('2) 운영자 큐:', qn, '건');
await p.screenshot({path:'/tmp/c-admin.png', fullPage:true});
// 방금 올린 카드 찾아 공개
const idx = await p.evaluate((ord)=>{const els=[...document.querySelectorAll('.queue-item')];return els.findIndex(e=>e.textContent.includes('#'+ord))},card.ordinal);
console.log('   내 카드 위치:', idx);
await p.locator('.queue-item').nth(idx).locator('button.ok').click(); await p.waitForTimeout(1800);
console.log('   승인 후 큐:', await p.locator('.queue-item').count(), '건');

// 3) 반영 확인
const after = await (await fetch(B+'/api/status')).json();
const afterHall = await (await fetch(B+'/api/hall')).json();
const inTimeline = after.timeline.find(e=>e.ordinal===card.ordinal);
const inHall = afterHall.find(h=>h.ordinal===card.ordinal);
console.log('3) 오늘의 기록 반영:', inTimeline? `있음 (사진 ${inTimeline.photo})` : '없음');
console.log('   명예의 전당 반영:', inHall? `있음 (${inHall.rarity})` : '없음');

// 4) 화면에서도 보이나
await p.goto(B+'/#/'); await p.waitForTimeout(2000);
console.log('4) 홈 타임라인 사진 수:', await p.locator('.tl-photo').count());
await p.screenshot({path:'/tmp/c-home.png', fullPage:true});
await p.goto(B+'/#/hall'); await p.waitForTimeout(1800);
console.log('   명예의 전당 카드 수:', await p.locator('.hall-item').count());
await p.screenshot({path:'/tmp/c-hall.png', fullPage:true});
console.log('ERRORS:', errs.length?errs.join(' | '):'none');
await b.close();
