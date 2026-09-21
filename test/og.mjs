// 링크 미리보기 이미지(og.png 1200x630)와 홈화면 아이콘(apple-touch-icon.png 180x180)을 굽는다.
import { chromium } from 'playwright';
import fs from 'node:fs';
const two = 'data:image/webp;base64,' + fs.readFileSync('public/bukang-two.webp').toString('base64');
const one = 'data:image/webp;base64,' + fs.readFileSync('public/bukang-one.webp').toString('base64');
const b = await chromium.launch();
const og = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await og.setContent(`<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Jua&family=Noto+Sans+KR:wght@500;700&display=swap" rel="stylesheet">
<style>
html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{background:linear-gradient(135deg,#5fd4ff 0%,#2fb5e8 45%,#0b5c8a 100%);font-family:'Noto Sans KR',sans-serif;color:#fff;position:relative}
.bub{position:absolute;border-radius:50%;background:rgba(255,255,255,.14)}
.t{position:absolute;left:84px;top:160px}
h1{font-family:'Jua',sans-serif;font-size:86px;white-space:nowrap;line-height:1.05;margin:0;text-shadow:0 6px 24px rgba(0,40,70,.35)}
p{font-size:40px;font-weight:500;margin:22px 0 0;opacity:.95}
.u{position:absolute;left:84px;bottom:64px;font-size:34px;font-weight:700;background:rgba(255,255,255,.18);padding:10px 26px;border-radius:999px}
img{position:absolute;right:16px;bottom:-24px;width:500px;height:500px;filter:drop-shadow(0 18px 30px rgba(0,30,60,.35))}
</style></head><body>
<div class="bub" style="width:420px;height:420px;left:-120px;top:-160px"></div>
<div class="bub" style="width:260px;height:260px;left:520px;top:470px"></div>
<div class="t"><h1>부캉이 지금 있나</h1><p>부산 북항 친수공원 상어 상황판</p></div>
<div class="u">bukangi.com</div>
<img src="${two}">
</body></html>`, { waitUntil: 'load' });
await og.evaluate(() => Promise.all([document.fonts.load("86px 'Jua'"), document.fonts.load("500 40px 'Noto Sans KR'"), document.fonts.load("700 34px 'Noto Sans KR'")]));
await og.waitForTimeout(300);
await og.screenshot({ path: 'public/og.jpg', type: 'jpeg', quality: 88 });
const ic = await b.newPage({ viewport: { width: 180, height: 180 }, deviceScaleFactor: 1 });
await ic.setContent(`<body style="margin:0;width:180px;height:180px;background:linear-gradient(135deg,#5fd4ff,#2fb5e8);display:grid;place-items:center"><img src="${one}" style="width:150px;height:150px"></body>`);
await ic.waitForTimeout(100);
await ic.screenshot({ path: 'public/apple-touch-icon.png', type: 'png' });
await b.close();
for (const f of ['public/og.jpg', 'public/apple-touch-icon.png']) console.log(f, fs.statSync(f).size, 'bytes');
