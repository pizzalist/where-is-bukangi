// 운영 사이트의 새 버전 감지가 실제로 도는지. 1) version.json을 주기적으로 묻는가 2) 다른 빌드가 오면 새로고침하는가
import { chromium } from 'playwright';
const SITE = 'https://bukangi.com';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
let checks = 0, fake = false, reloads = 0;
await p.route('**/version.json*', async (route) => { checks++; if (fake) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: 'FAKE-NEW' }) }); route.continue(); });
p.on('load', () => reloads++);
await p.goto(SITE + '/#/'); await p.waitForTimeout(8000);
console.log('시작 8초 안 version.json 조회:', checks, '| 페이지 빌드:', await p.evaluate(() => document.querySelector('script[src*=app-]')?.getAttribute('src')));
await p.waitForTimeout(65000);
console.log('73초 시점 조회 누적:', checks);
fake = true; const r0 = reloads;
await p.waitForTimeout(65000);
console.log('가짜 새 빌드 응답 후 65초: 조회', checks, '| 새로고침 발생:', reloads - r0 > 0);
await b.close();
