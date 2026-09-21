// 공유 링크로 들어온 남의 카드가 보이는지, 저장 버튼이 서버 PNG(화면 그대로)를 내려주는지.
import { chromium } from 'playwright';
const ID = process.argv[2]; const SITE = 'https://bukangi.com';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });   // 새 기기 = localStorage 없음
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const cardReq = []; p.on('response', (r) => { if (r.url().includes('/api/cards/')) cardReq.push(r.status() + ' ' + r.headers()['content-type'] + ' ' + r.url()); });
await p.goto(`${SITE}/#/card/${ID}`); await p.waitForTimeout(3500);
console.log('제목:', (await p.locator('h1').first().textContent())?.trim());
console.log('카드 표시:', await p.locator('.holo').count(), '| 사진 src:', (await p.locator('.holo img').first().getAttribute('src'))?.slice(0, 60));
console.log('하단 주소:', (await p.locator('.holo-site').first().textContent())?.trim());
const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.getByRole('button', { name: /공유 \/ 저장|카드 만드는 중/ }).click()]);
const path = await dl.path();
const { statSync } = await import('node:fs');
console.log('내려받은 파일:', dl.suggestedFilename(), statSync(path).size, 'bytes');
console.log('카드 PNG 요청:', cardReq);
// 파일이 진짜 홀로 카드인지: 크기 확인
const { execSync } = await import('node:child_process');
console.log('이미지:', execSync(`file "${path}"`).toString().trim().split(': ')[1]);
await p.goto(SITE + '/#/'); await p.waitForTimeout(2500);
console.log('홈 로고:', await p.locator('.brand-logo').count(), '| 히어로:', (await p.locator('.hero .headline').textContent())?.trim());
console.log('JS 오류:', errs.length ? errs : 'none');
await b.close();
