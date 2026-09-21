// 스레드 첫 게시물용 이미지 2장 (1080x1350, 4:5)
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = process.argv[2] || '.';
const two = 'data:image/webp;base64,' + fs.readFileSync('public/bukang-two.webp').toString('base64');
const smile = 'data:image/webp;base64,' + fs.readFileSync('public/bukang-smile.webp').toString('base64');
const card = fs.existsSync(process.argv[3] || '') ? 'data:image/png;base64,' + fs.readFileSync(process.argv[3]).toString('base64') : null;
const b = await chromium.launch();
const head = `<meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Jua&family=Noto+Sans+KR:wght@500;700;900&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1080px;height:1350px;overflow:hidden}body{font-family:'Noto Sans KR',sans-serif;color:#fff;position:relative;background:linear-gradient(160deg,#6fdcff 0%,#2fb5e8 40%,#0b5c8a 100%)}
.bub{position:absolute;border-radius:50%;background:rgba(255,255,255,.13)} .jua{font-family:'Jua',sans-serif}
.tag{position:absolute;left:80px;top:88px;font-size:36px;font-weight:700;background:rgba(255,255,255,.2);padding:12px 28px;border-radius:999px}
.u{position:absolute;left:80px;bottom:80px;font-size:44px;font-weight:900;letter-spacing:-.5px}</style>`;
const wait = async (p) => { await p.evaluate(() => Promise.all([document.fonts.load("120px 'Jua'"), document.fonts.load("700 40px 'Noto Sans KR'"), document.fonts.load("900 44px 'Noto Sans KR'")])); await p.waitForTimeout(400); };

// 1) 후킹: 오늘 가면 볼 수 있나?
const p1 = await b.newPage({ viewport: { width: 1080, height: 1350 } });
await p1.setContent(`${head}<body>
<div class="bub" style="width:520px;height:520px;left:-160px;top:-140px"></div><div class="bub" style="width:360px;height:360px;right:-100px;top:420px"></div>
<div class="tag">부산 북항 친수공원</div>
<div class="jua" style="position:absolute;left:80px;top:200px;font-size:132px;line-height:1.08;text-shadow:0 8px 28px rgba(0,40,70,.35)">부캉이<br>오늘 가면<br>볼 수 있나?</div>
<div style="position:absolute;left:80px;top:690px;font-size:44px;font-weight:500;line-height:1.5;opacity:.95">마지막으로 목격된 시각과 구역을<br>3초 만에 확인해요</div>
<img src="${two}" style="position:absolute;right:-30px;bottom:-40px;width:640px;height:640px;filter:drop-shadow(0 20px 34px rgba(0,30,60,.35))">
<div class="u">bukangi.com</div></body>`);
await wait(p1); await p1.screenshot({ path: `${OUT}/threads-1.jpg`, type: 'jpeg', quality: 90 });

// 2) 카드: 사진 찍으면 카드가 나온다
const p2 = await b.newPage({ viewport: { width: 1080, height: 1350 } });
await p2.setContent(`${head}<body>
<div class="bub" style="width:480px;height:480px;left:-140px;bottom:-120px"></div>
<div class="tag">사진 한 장이면 끝</div>
<div class="jua" style="position:absolute;left:80px;top:200px;font-size:104px;line-height:1.1;text-shadow:0 8px 28px rgba(0,40,70,.35)">부캉이 찍으면<br>카드가 나온다</div>
<div style="position:absolute;left:80px;top:450px;font-size:40px;font-weight:500;line-height:1.5;opacity:.95">등급 9종 · 시크릿 골드 1.5%<br>내 사진이 그대로 카드가 돼요</div>
${card ? `<img src="${card}" style="position:absolute;right:60px;bottom:40px;width:560px;transform:rotate(-6deg);filter:drop-shadow(0 26px 40px rgba(0,20,50,.45))">` : ''}
<img src="${smile}" style="position:absolute;left:60px;bottom:150px;width:300px;height:300px;filter:drop-shadow(0 16px 28px rgba(0,30,60,.35))">
<div class="u" style="bottom:70px">bukangi.com</div></body>`);
await wait(p2); await p2.waitForTimeout(500); await p2.screenshot({ path: `${OUT}/threads-2.jpg`, type: 'jpeg', quality: 90 });
await b.close();
for (const f of ['threads-1.jpg', 'threads-2.jpg']) console.log(f, fs.statSync(`${OUT}/${f}`).size);
