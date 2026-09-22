// 현장 탭 화면 확인. 위치를 공원으로 고정하고 약/강 두 상태를 캡처한다.
import { chromium } from 'playwright';
const SITE = process.argv[2] || 'https://admin.bukangi.com', OUT = process.argv[3];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
  geolocation: { latitude: 35.1144, longitude: 129.0464 }, permissions: ['geolocation'], locale: 'ko-KR' });
await ctx.grantPermissions(['geolocation'], { origin: SITE });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
await p.goto(SITE + '/#/'); await p.waitForTimeout(3000);
console.log('탭 버튼:', await p.locator('.live-btns button').allTextContents());
console.log('현재 상태줄:', (await p.locator('.live-state').allTextContents()).join(' / ') || '없음');
await p.screenshot({ path: `${OUT}/live-1.png`, clip: { x: 0, y: 0, width: 390, height: 560 } });
// 눌러보기 (쿨다운이면 안내 문구가 떠야 한다)
await p.locator('.live-yes').click(); await p.waitForTimeout(3500);
console.log('누른 뒤:', (await p.locator('.live-thanks, .live-msg').allTextContents()).join(' | '));
await p.screenshot({ path: `${OUT}/live-2.png`, clip: { x: 0, y: 0, width: 390, height: 560 } });
console.log('JS 오류:', errs.length ? errs : 'none');
await b.close();
