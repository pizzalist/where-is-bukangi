// 글자가 실제로 찍힌 세로 범위(잉크)를 재서 두 폰트의 시각적 중심이 맞는지 본다
import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1000, height: 400 }, deviceScaleFactor: 2 });
await p.setContent(`<meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Jua&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
<style>body{margin:0;background:#fff}
.row{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center;padding:9px 18px;border-radius:18px;background:#e8eef4;margin:20px;font-size:30px;line-height:1.3}
b{font-family:'Jua',sans-serif;font-size:37px;white-space:nowrap}
span{font-family:'Noto Sans KR',sans-serif;opacity:.8}</style>
<div class="row"><b id="nb" style="transform:translateY(1.35px)">롯데 연승 부스터</b><span id="sp" style="display:inline-block;transform:translateY(-0.5px)">롯데를 강제로 연승시킨다</span></div>`);
await p.evaluate(() => Promise.all([document.fonts.load("37px 'Jua'"), document.fonts.load("30px 'Noto Sans KR'")]));
await p.waitForTimeout(400);
const geo = await p.evaluate(() => { const r = document.querySelector('.row').getBoundingClientRect(); const n = document.getElementById('nb').getBoundingClientRect(); const s = document.getElementById('sp').getBoundingClientRect(); return { row: [r.top, r.bottom], nb: [n.top, n.bottom], sp: [s.top, s.bottom] }; });
const buf = await p.locator('.row').screenshot();
const ink = await p.evaluate(async (d) => { const i = new Image(); i.src = 'data:image/png;base64,' + d; await i.decode();
  const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0);
  const px = x.getImageData(0, 0, c.width, c.height).data;
  const dark = (X0, X1) => { let top = -1, bot = -1; for (let y = 0; y < c.height; y++) { let hit = false; for (let xx = X0; xx < X1; xx++) { const k = (y * c.width + xx) * 4; if (px[k] < 110 && px[k+1] < 110) { hit = true; break; } } if (hit) { if (top < 0) top = y; bot = y; } } return [top, bot, ((top + bot) / 2 / c.height * 100).toFixed(1)]; };
  const half = Math.round(c.width * 0.30);
  return { 전체높이: c.height, 이름잉크: dark(30, half), 설명잉크: dark(half + 20, c.width - 30) };
}, buf.toString('base64'));
console.log(JSON.stringify(ink));
await p.locator('.row').screenshot({ path: `${process.env.OUT || 'test-output'}/ink.png` });
await b.close();
