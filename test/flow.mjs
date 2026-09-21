import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:4173/#/'); await p.waitForTimeout(1200);
await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1200);
const st = async t => console.log(t, await p.evaluate(() => ({ hash: location.hash, holo: document.querySelectorAll('.holo').length, root: document.getElementById('root').innerHTML.length })));
// 홈 CTA → 뽑기
await p.click('.cta'); await p.waitForTimeout(800); await st('CTA→certify');
// 전부 보기 → 뒤로
await p.click('.tp-more'); await p.waitForTimeout(900); await st('tiers');
console.log('뒤로 버튼:', await p.locator('.backlink').count(), '| 하단 CTA:', await p.getByRole('button',{name:'카드 뽑으러 가기'}).count());
await p.click('.backlink'); await p.waitForTimeout(800); await st('뒤로→certify');
// 뽑기 3회
for (let i=1;i<=3;i++){
  await p.click('.nav a[href="#/certify"]'); await p.waitForTimeout(700);
  await p.setInputFiles('input[type=file]','/tmp/test-shark.jpg'); await p.waitForTimeout(1400);
  const c = await p.getByRole('button',{name:'카드 뽑기'}).count();
  if(!c){console.log(`뽑기${i}: 버튼없음`);break;}
  await p.getByRole('button',{name:'카드 뽑기'}).click(); await p.waitForTimeout(2000); await st(`뽑기${i}`);
}
console.log('기울이기 안내 노출:', await p.evaluate(() => (document.body.innerText.includes('기울여도') ? 'yes' : 'no')));
console.log('컬렉션 보유:', await p.evaluate(() => document.querySelectorAll('.tier-dot:not(.off)').length));
console.log('ERRORS:', errs.length?errs.join(' | '):'none');
await b.close();
