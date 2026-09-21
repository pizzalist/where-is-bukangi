// 인스타그램 캐러셀 4장 (1080x1350)
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = process.argv[2], CARD = process.argv[3], HOME = process.argv[4];
const im = (f, t = 'webp') => `data:image/${t};base64,` + fs.readFileSync(f).toString('base64');
const two = im('public/bukang-two.webp'), one = im('public/bukang-one.webp'), smile = im('public/bukang-smile.webp');
const card = im(CARD, 'png'), home = im(HOME, 'png');
const b = await chromium.launch();
const head = `<meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Jua&family=Noto+Sans+KR:wght@500;700;900&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1080px;height:1350px;overflow:hidden}body{font-family:'Noto Sans KR',sans-serif;color:#fff;position:relative;background:linear-gradient(160deg,#6fdcff 0%,#2fb5e8 40%,#0b5c8a 100%)}
.bub{position:absolute;border-radius:50%;background:rgba(255,255,255,.13)} .jua{font-family:'Jua',sans-serif}
.tag{position:absolute;left:80px;top:88px;font-size:34px;font-weight:700;background:rgba(255,255,255,.2);padding:12px 28px;border-radius:999px}
.u{position:absolute;left:80px;bottom:80px;font-size:44px;font-weight:900}
.pg{position:absolute;right:80px;bottom:88px;font-size:30px;opacity:.7;font-weight:700}
.phone{position:absolute;left:50%;transform:translateX(-50%);bottom:-60px;width:640px;border-radius:64px;border:14px solid #0b2b40;overflow:hidden;box-shadow:0 30px 60px rgba(0,20,50,.45);background:#eef6fb}
.phone img{width:100%;display:block}</style>`;
const wait = async (p) => { await p.evaluate(() => Promise.all([document.fonts.load("120px 'Jua'"), document.fonts.load("700 40px 'Noto Sans KR'"), document.fonts.load("900 44px 'Noto Sans KR'")])); await p.waitForTimeout(500); };
const slides = [
`<div class="bub" style="width:520px;height:520px;left:-160px;top:-140px"></div>
<div class="tag">부산 북항 친수공원</div>
<div class="jua" style="position:absolute;left:80px;top:200px;font-size:124px;line-height:1.08;text-shadow:0 8px 28px rgba(0,40,70,.35)">부산 북항에<br>상어가<br>산다</div>
<div style="position:absolute;left:80px;top:650px;font-size:44px;font-weight:500;line-height:1.5;opacity:.95">사흘 만에 3만 명이 다녀갔어요.<br>근데 오늘 가면 볼 수 있을까?</div>
<img src="${two}" style="position:absolute;right:-30px;bottom:-40px;width:640px;filter:drop-shadow(0 20px 34px rgba(0,30,60,.35))">
<div class="u">bukangi.com</div><div class="pg">1 / 4</div>`,
`<div class="tag">3초면 확인 끝</div>
<div class="jua" style="position:absolute;left:80px;top:190px;font-size:92px;line-height:1.12;text-shadow:0 8px 28px rgba(0,40,70,.35)">마지막으로 본<br>시각과 구역이<br>바로 떠요</div>
<div class="phone"><img src="${home}"></div>
<div class="pg">2 / 4</div>`,
`<div class="bub" style="width:480px;height:480px;left:-140px;bottom:-120px"></div>
<div class="tag">사진 한 장이면 끝</div>
<div class="jua" style="position:absolute;left:80px;top:190px;font-size:96px;line-height:1.1;text-shadow:0 8px 28px rgba(0,40,70,.35)">부캉이 찍으면<br>카드가 나와요</div>
<div style="position:absolute;left:80px;top:430px;font-size:40px;font-weight:500;line-height:1.5;opacity:.95">내 사진이 그대로 홀로그램 카드로.<br>등급 9종, 시크릿 골드는 1.5%</div>
<img src="${card}" style="position:absolute;right:60px;bottom:40px;width:560px;transform:rotate(-6deg);filter:drop-shadow(0 26px 40px rgba(0,20,50,.45))">
<img src="${smile}" style="position:absolute;left:60px;bottom:150px;width:300px;filter:drop-shadow(0 16px 28px rgba(0,30,60,.35))">
<div class="pg">3 / 4</div>`,
`<div class="bub" style="width:600px;height:600px;right:-200px;top:-200px"></div>
<div class="jua" style="position:absolute;left:80px;top:220px;font-size:96px;line-height:1.12;text-shadow:0 8px 28px rgba(0,40,70,.35)">봤으면<br>올려주세요</div>
<div style="position:absolute;left:80px;top:480px;font-size:42px;font-weight:500;line-height:1.55;opacity:.95">내 카드가 곧 제보예요.<br>시각과 구역이 쌓여서<br>다음 사람이 "지금 있나"를 알아요.</div>
<img src="${one}" style="position:absolute;right:40px;bottom:200px;width:520px;filter:drop-shadow(0 20px 34px rgba(0,30,60,.35))">
<div style="position:absolute;left:80px;bottom:150px;font-size:56px;font-weight:900;background:#fff;color:#0b5c8a;padding:22px 44px;border-radius:999px;box-shadow:0 12px 30px rgba(0,20,50,.3)">bukangi.com</div>
<div class="pg">4 / 4</div>`];
for (let i = 0; i < slides.length; i++) { const p = await b.newPage({ viewport: { width: 1080, height: 1350 } }); await p.setContent(`${head}<body>${slides[i]}</body>`); await wait(p); await p.screenshot({ path: `${OUT}/insta-${i + 1}.jpg`, type: 'jpeg', quality: 90 }); }
await b.close(); console.log('insta ok');
