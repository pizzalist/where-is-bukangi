// 현장 배포물: A4 포스터, 손팻말(A4 가로), 명함 크기 카드 10장 시트. 모두 PDF + 미리보기 PNG.
import { chromium } from 'playwright';
import QRCode from 'qrcode';
import fs from 'node:fs';
const OUT = process.argv[2];
// 추적 링크. 포스터·팻말과 명함을 따로 세서 어느 쪽이 먹히는지 본다
const URL = 'https://bukangi.com/?s=qr';
const URL_CARD = 'https://bukangi.com/?s=card';
const mkQR = async (u) => 'data:image/svg+xml;base64,' + Buffer.from(await QRCode.toString(u, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#0b2b40', light: '#ffffff' } })).toString('base64');
const qrData = await mkQR(URL);
const qrCard = await mkQR(URL_CARD);
const im = (f) => 'data:image/webp;base64,' + fs.readFileSync(f).toString('base64');
const two = im('public/bukang-two.webp'), one = im('public/bukang-one.webp'), smile = im('public/bukang-smile.webp');
const head = `<meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Jua&family=Noto+Sans+KR:wght@500;700;900&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box}html,body{margin:0}body{font-family:'Noto Sans KR',sans-serif;color:#0b2b40;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.jua{font-family:'Jua',sans-serif}@page{margin:0}</style>`;
const wait = async (p) => { await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500); };
const b = await chromium.launch();

// 1) A4 포스터 (세로 210x297mm)
const poster = await b.newPage({ viewport: { width: 794, height: 1123 } });
await poster.setContent(`${head}<body style="width:210mm;height:297mm;background:linear-gradient(165deg,#6fdcff 0%,#2fb5e8 45%,#0b5c8a 100%);color:#fff;position:relative;overflow:hidden">
<div style="position:absolute;left:-40mm;top:-50mm;width:130mm;height:130mm;border-radius:50%;background:rgba(255,255,255,.12)"></div>
<div style="position:absolute;left:16mm;top:16mm;font-size:6.5mm;font-weight:700;background:rgba(255,255,255,.22);padding:2.5mm 6mm;border-radius:99mm">부산 북항 친수공원</div>
<div class="jua" style="position:absolute;left:16mm;top:34mm;font-size:27mm;line-height:1.05;text-shadow:0 2mm 6mm rgba(0,40,70,.35)">부캉이<br>지금 있나?</div>
<div style="position:absolute;left:16mm;top:98mm;font-size:9mm;font-weight:500;line-height:1.5">마지막으로 본 <b>시각</b>과 <b>구역</b>이<br>바로 떠요. 3초면 확인 끝.</div>
<div style="position:absolute;left:16mm;top:132mm;width:178mm;background:#fff;border-radius:8mm;padding:8mm;display:flex;gap:8mm;align-items:center;color:#0b2b40;box-shadow:0 4mm 12mm rgba(0,20,50,.25)">
  <img src="${qrData}" style="width:62mm;height:62mm;flex:none">
  <div style="flex:1"><div class="jua" style="font-size:11mm;line-height:1.15;margin-bottom:3mm">카메라로 QR 찍기</div>
    <div style="font-size:6mm;line-height:1.45;color:#345;word-break:keep-all">부캉이 봤으면 사진 한 장 올려주세요.<br>내 사진이 <b>홀로그램 카드</b>로 나와요.<br>등급 9종, 시크릿 골드 1.5%</div>
    <div style="font-size:9mm;font-weight:900;margin-top:4mm;color:#0b5c8a">bukangi.com</div></div></div>
<div style="position:absolute;left:16mm;bottom:22mm;font-size:5.5mm;line-height:1.5;opacity:.9">시민 제보로 돌아가는 상황판이에요.<br>물가 접근 금지 등 해경·구청 안내를 꼭 따라주세요.</div>
<img src="${two}" style="position:absolute;right:-8mm;bottom:-6mm;width:96mm;filter:drop-shadow(0 4mm 8mm rgba(0,30,60,.35))">
</body>`);
await wait(poster); await poster.pdf({ path: `${OUT}/poster-a4.pdf`, format: 'A4', printBackground: true }); await poster.screenshot({ path: `${OUT}/poster-a4.png` });

// 2) 손팻말 (A4 가로, 멀리서 보이게 글자 크게)
const sign = await b.newPage({ viewport: { width: 1123, height: 794 } });
await sign.setContent(`${head}<body style="width:297mm;height:210mm;background:#fff;position:relative;overflow:hidden;display:flex;align-items:center;padding:14mm;gap:14mm">
<div style="flex:1;min-width:0"><div class="jua" style="font-size:27mm;line-height:1.08;color:#0b5c8a;white-space:nowrap">부캉이<br>지금 있나?</div>
<div style="font-size:10mm;font-weight:700;margin-top:8mm;line-height:1.4;color:#0b2b40">마지막 목격 시각·구역<br>지금 바로 확인</div>
<div style="font-size:12mm;font-weight:900;margin-top:10mm;color:#2fb5e8">bukangi.com</div>
<img src="${smile}" style="width:52mm;margin-top:6mm"></div>
<div style="flex:none;background:#0b5c8a;border-radius:10mm;padding:7mm"><img src="${qrData}" style="width:130mm;height:130mm;display:block;border-radius:5mm"></div>
</body>`);
await wait(sign); await sign.pdf({ path: `${OUT}/sign-a4-landscape.pdf`, width: '297mm', height: '210mm', printBackground: true }); await sign.screenshot({ path: `${OUT}/sign-a4.png` });

// 3) 명함 크기 카드 (90x50mm) 10장 시트. 가게 카운터·손에 쥐어주기용
const card = `<div style="width:90mm;height:50mm;border:0.3mm dashed #bcd;border-radius:3mm;display:flex;align-items:center;gap:4mm;padding:4mm;background:linear-gradient(135deg,#eaf6ff,#fff)">
  <img src="${qrCard}" style="width:38mm;height:38mm;flex:none">
  <div><div class="jua" style="font-size:8.5mm;line-height:1.1;color:#0b5c8a">부캉이<br>지금 있나?</div>
  <div style="font-size:3.6mm;color:#345;margin-top:2mm;line-height:1.4">마지막 목격 시각·구역<br>사진 올리면 홀로 카드</div>
  <div style="font-size:4.6mm;font-weight:900;margin-top:2mm;color:#0b2b40">bukangi.com</div></div>
  <img src="${one}" style="position:absolute;right:2mm;top:2mm;width:13mm"></div>`;
const cards = await b.newPage({ viewport: { width: 794, height: 1123 } });
await cards.setContent(`${head}<body style="width:210mm;height:297mm;background:#fff;padding:12mm 15mm;display:grid;grid-template-columns:90mm 90mm;grid-auto-rows:50mm;gap:4mm 0;justify-content:space-between">${Array(10).fill(card.replace('<div style="width:90mm', '<div style="position:relative;width:90mm')).join('')}</body>`);
await wait(cards); await cards.pdf({ path: `${OUT}/cards-a4.pdf`, format: 'A4', printBackground: true }); await cards.screenshot({ path: `${OUT}/cards-a4.png` });
await b.close();
for (const f of ['poster-a4.pdf', 'sign-a4-landscape.pdf', 'cards-a4.pdf']) console.log(f, Math.round(fs.statSync(`${OUT}/${f}`).size / 1024), 'KB');
