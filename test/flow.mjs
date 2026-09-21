import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:4173/#/'); await p.waitForTimeout(1200);
await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1500);
await p.screenshot({ path: '/tmp/n-home.png', fullPage: true });
// 크롭 흐름
await p.click('.cta'); await p.waitForTimeout(700);
await p.setInputFiles('input[type=file]', '/tmp/test-shark.jpg'); await p.waitForTimeout(1200);
console.log('크롭 화면:', await p.locator('.cropbox').count());
await p.screenshot({ path: '/tmp/n-crop.png', fullPage: true });
// 확대 + 이동
await p.locator('.croprange').fill('1.6'); await p.waitForTimeout(300);
const box = await p.locator('.cropbox').boundingBox();
await p.mouse.move(box.x + box.width/2, box.y + box.height/2);
await p.mouse.down(); await p.mouse.move(box.x + box.width/2 + 40, box.y + box.height/2 + 20, {steps:8}); await p.mouse.up();
await p.waitForTimeout(300);
await p.getByRole('button', { name: '이대로' }).click(); await p.waitForTimeout(900);
console.log('크롭 후 사진:', await p.locator('.pickbox img').count(), '| 뽑기버튼:', await p.getByRole('button',{name:'카드 뽑기'}).count());
await p.getByRole('button', { name: '카드 뽑기' }).click(); await p.waitForTimeout(2200);
console.log('카드:', await p.evaluate(() => ({ hash: location.hash, holo: document.querySelectorAll('.holo').length })));
await p.screenshot({ path: '/tmp/n-card.png', fullPage: true });
// 풀아트 확인
await p.evaluate(() => { const l = JSON.parse(localStorage.getItem('bukang.submissions.v1')); l[0].rarity='fullart'; localStorage.setItem('bukang.submissions.v1', JSON.stringify(l)); });
await p.reload(); await p.waitForTimeout(2000);
await p.screenshot({ path: '/tmp/n-fullart.png', fullPage: true });
console.log('ERRORS:', errs.length?errs.join(' | '):'none');
await b.close();
