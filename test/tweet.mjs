// 트위터/X용 합성 이미지 (1600x900). 실제 두 화면을 폰 목업으로 나란히.
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = process.argv[2], CARD_ID = process.argv[3] || 'cjNYW0pOu--U';
const SITE = 'https://bukangi.com';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 820 }, deviceScaleFactor: 3, locale: 'ko-KR' });
const p = await ctx.newPage();

// 1) 홈
await p.goto(SITE + '/#/'); await p.waitForTimeout(4000);
const home = (await p.screenshot()).toString('base64');

// 2) 내 카드 (카드 하나를 기기에 심어서 실제 화면 그대로)
const card = await (await fetch(`https://api.bukangi.com/api/submissions/${CARD_ID}`)).json();
await p.evaluate((c) => localStorage.setItem("bukang.submissions.v1", JSON.stringify([{
  id: c.id, type: "seen", takenAt: c.takenAt, submittedAt: c.takenAt, zone: c.zone,
  photoDataUrl: c.photo, status: c.status, ordinal: c.ordinal, rarity: c.rarity,
}])), card);
await p.goto(SITE + '/#/card/' + CARD_ID); await p.waitForTimeout(4200);
const hb = await p.locator('.holo').first().boundingBox();
await p.mouse.move(hb.x + hb.width * 0.42, hb.y + hb.height * 0.4); await p.waitForTimeout(500);
const mine = (await p.screenshot()).toString('base64');
await ctx.close();

const mascot = 'data:image/webp;base64,' + fs.readFileSync('public/bukang-one.webp').toString('base64');
const shot = (d, rot, left, top) => `<div class="phone" style="left:${left}px;top:${top}px;transform:rotate(${rot}deg)"><img src="data:image/png;base64,${d}"></div>`;

const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
await page.setContent(`<meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Jua&family=Noto+Sans+KR:wght@500;700;900&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1600px;height:900px;overflow:hidden}
body{font-family:'Noto Sans KR',sans-serif;color:#fff;background:linear-gradient(135deg,#6fdcff 0%,#2fb5e8 42%,#0b5c8a 100%);position:relative}
.bub{position:absolute;border-radius:50%;background:rgba(255,255,255,.11)}
.jua{font-family:'Jua',sans-serif}
.tag{position:absolute;left:74px;top:96px;font-size:26px;font-weight:700;background:rgba(255,255,255,.22);padding:10px 24px;border-radius:999px}
h1{position:absolute;left:74px;top:158px;font-size:82px;line-height:1.08;margin:0;text-shadow:0 8px 26px rgba(0,40,70,.35)}
.desc{position:absolute;left:76px;top:392px;font-size:29px;font-weight:500;line-height:1.62;opacity:.96}
.u{position:absolute;left:74px;bottom:70px;font-size:36px;font-weight:900}
.phone{position:absolute;width:330px;border-radius:42px;border:10px solid #0b2b40;overflow:hidden;box-shadow:0 26px 54px rgba(0,20,50,.45);background:#eef6fb}
.phone img{width:100%;display:block}
.cap{position:absolute;font-size:22px;font-weight:700;background:rgba(11,43,64,.55);padding:8px 20px;border-radius:999px;white-space:nowrap}
</style><body>
<div class="bub" style="width:520px;height:520px;left:-180px;top:-170px"></div>
<div class="bub" style="width:280px;height:280px;left:260px;bottom:-120px"></div>
<div class="tag">부산 북항 친수공원</div>
<h1 class="jua">부캉이<br>지금 있나?</h1>
<div class="desc">마지막 목격 시각·구역이 바로 뜨고<br>사진 올리면 내 사진이 홀로 카드로</div>
<img src="${mascot}" style="position:absolute;left:92px;bottom:140px;width:140px;filter:drop-shadow(0 12px 20px rgba(0,30,60,.3))">
<div class="u">bukangi.com</div>
${shot(home, -3, 620, 86)}
${shot(mine, 4, 1010, 130)}
<div class="cap" style="left:648px;top:790px">지금 있나 확인</div>
<div class="cap" style="left:1052px;top:836px">내 사진이 카드로</div>
</body>`);
await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/tweet.jpg`, type: 'jpeg', quality: 92 });
await b.close();
console.log('tweet.jpg', fs.statSync(`${OUT}/tweet.jpg`).size, 'bytes');
