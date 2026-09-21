// 실제 카드에서 기술 줄의 글자(잉크) 세로 중심을 잰다. 50%가 목표.
import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 520, height: 900 }, deviceScaleFactor: 3 });
const d = Buffer.from(JSON.stringify({ id: 'align', ordinal: 4, rarity: 'galaxy', zone: 'B', zoneName: '제5보도교', takenAt: '2026-09-22T01:21:00+09:00', photo: null, site: 'bukangi.com' })).toString('base64url');
await p.goto(`http://localhost:4173/?d=${d}#/shot/align`); await p.waitForSelector('.shot-wrap[data-ready="1"]'); await p.waitForTimeout(400);
for (const [i, row] of (await p.locator('.holo-moves div').all()).entries()) {
  const buf = await row.screenshot();
  const r = await p.evaluate(async (d64) => { const im = new Image(); im.src = 'data:image/png;base64,' + d64; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const px = x.getImageData(0, 0, c.width, c.height).data;
    const span = (X0, X1) => { let t = -1, b2 = -1; for (let y = 0; y < c.height; y++) { let hit = false; for (let xx = X0; xx < X1; xx++) { const k = (y * c.width + xx) * 4; if (px[k] < 120 && px[k+1] < 120) { hit = true; break; } } if (hit) { if (t < 0) t = y; b2 = y; } } return { top: t, bot: b2, 중심: +(((t + b2) / 2) / c.height * 100).toFixed(1) }; };
    const cut = Math.round(c.width * 0.33);
    return { h: c.height, 이름: span(8, cut), 설명: span(cut + 10, c.width - 8) };
  }, buf.toString('base64'));
  console.log(`줄${i + 1} 높이${r.h} | 이름 중심 ${r.이름.중심}% (${r.이름.top}~${r.이름.bot}) | 설명 중심 ${r.설명.중심}% (${r.설명.top}~${r.설명.bot})`);
}
await p.locator('.holo-moves').screenshot({ path: '/private/tmp/claude-501/-Users-teamlab-Projects/aa3a2ba1-f333-4946-9404-5b8d01f878fb/scratchpad/moves-zoom.png' });
await b.close();
