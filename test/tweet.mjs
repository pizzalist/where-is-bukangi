// 트위터/X용 합성 이미지 (1600x900). 왼쪽 실제 화면, 오른쪽 카드.
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = process.argv[2], CARD_ID = process.argv[3] || 'LSMcG61JmAhk';
const b = await chromium.launch();

// 1) 실제 홈 화면 (폰 크기, 스크롤 최상단)
const ph = await b.newPage({ viewport: { width: 390, height: 820 }, deviceScaleFactor: 3 });
await ph.goto('https://bukangi.com/#/'); await ph.waitForTimeout(4000);
const shot = (await ph.screenshot()).toString('base64');
await ph.close();

// 2) 카드 (서버가 그린 고해상도 PNG)
const card = (await (await fetch(`https://api.bukangi.com/api/cards/${CARD_ID}.png`)).arrayBuffer());
const cardB64 = Buffer.from(card).toString('base64');
const mascot = 'data:image/webp;base64,' + fs.readFileSync('public/bukang-one.webp').toString('base64');

const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.setContent(`<meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Jua&family=Noto+Sans+KR:wght@500;700;900&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1600px;height:900px;overflow:hidden}
body{font-family:'Noto Sans KR',sans-serif;color:#fff;background:linear-gradient(135deg,#6fdcff 0%,#2fb5e8 42%,#0b5c8a 100%);position:relative}
.bub{position:absolute;border-radius:50%;background:rgba(255,255,255,.11)}
.jua{font-family:'Jua',sans-serif}
.tag{position:absolute;left:78px;top:92px;font-size:27px;font-weight:700;background:rgba(255,255,255,.22);padding:11px 26px;border-radius:999px}
h1{position:absolute;left:78px;top:158px;font-size:88px;line-height:1.08;margin:0;text-shadow:0 8px 26px rgba(0,40,70,.35)}
.desc{position:absolute;left:80px;top:400px;font-size:31px;font-weight:500;line-height:1.6;opacity:.96}
.u{position:absolute;left:78px;bottom:74px;font-size:38px;font-weight:900}
.phone{position:absolute;left:640px;top:96px;width:352px;border-radius:44px;border:11px solid #0b2b40;overflow:hidden;box-shadow:0 26px 54px rgba(0,20,50,.45);background:#eef6fb;transform:rotate(-3deg)}
.phone img{width:100%;display:block}
.card{position:absolute;right:66px;top:130px;width:400px;transform:rotate(5deg);filter:drop-shadow(0 26px 46px rgba(0,20,50,.5))}
</style><body>
<div class="bub" style="width:520px;height:520px;left:-170px;top:-160px"></div>
<div class="bub" style="width:300px;height:300px;left:300px;bottom:-110px"></div>
<div class="tag">부산 북항 친수공원</div>
<h1 class="jua">부캉이<br>지금 있나?</h1>
<div class="desc">마지막 목격 시각·구역이 바로 뜨고<br>사진 올리면 내 사진이 홀로 카드로</div>
<img class="mascot" src="${mascot}" style="position:absolute;left:96px;bottom:150px;width:150px;filter:drop-shadow(0 12px 20px rgba(0,30,60,.3))">
<div class="u">bukangi.com</div>
<div class="phone"><img src="data:image/png;base64,${shot}"></div>
<img class="card" src="data:image/png;base64,${cardB64}">
</body>`);
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/tweet.jpg`, type: 'jpeg', quality: 92 });
await b.close();
console.log('tweet.jpg', fs.statSync(`${OUT}/tweet.jpg`).size, 'bytes');
