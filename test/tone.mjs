// 레인보우 카드 전체를 필터 값별로 비교. 사진이 보이면서 홀로도 살아야 한다.
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = process.argv[2], ID = process.argv[3];
const card = await (await fetch(`https://api.bukangi.com/api/submissions/${ID}`)).json();
const SETS = [
  ['현재', 'brightness(.7) saturate(.5) contrast(1.75)', 'calc(.58 + var(--hyp) * .32)'],
  ['A 밝게', 'brightness(.95) saturate(.75) contrast(1.15)', 'calc(.5 + var(--hyp) * .3)'],
  ['B 더밝게+홀로↓', 'brightness(1.05) saturate(.85) contrast(1.05)', 'calc(.42 + var(--hyp) * .28)'],
  ['C 원본에가깝게', 'brightness(1.1) saturate(.95) contrast(1)', 'calc(.36 + var(--hyp) * .26)'],
];
const b = await chromium.launch();
const shots = [];
for (const [name, filt, op] of SETS) {
  const ctx = await b.newContext({ viewport: { width: 500, height: 800 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.addInitScript(([filt, op]) => {
    addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = `.holo-rainbow .holo-bleed img{filter:${filt} !important}
        .holo-rainbow .holo-bleed .fx-art{opacity:${op} !important}`;
      document.head.appendChild(s);
    });
  }, [filt, op]);
  const d = Buffer.from(JSON.stringify({ id: card.id, ordinal: card.ordinal, rarity: "rainbow", zone: card.zone, zoneName: "제5보도교", takenAt: card.takenAt, photo: card.photo, site: "bukangi.com" })).toString("base64url");
  await p.goto(`https://bukangi.com/?d=${d}#/shot/${card.id}`);
  await p.waitForSelector('.shot-wrap[data-ready="1"]', { timeout: 25000 }); await p.waitForTimeout(500);
  shots.push([name, (await p.locator('.shot-wrap').screenshot()).toString('base64')]);
  await ctx.close();
}
const q = await b.newPage({ viewport: { width: 1720, height: 640 } });
await q.setContent(`<body style="margin:0;background:#1b2430;display:flex;gap:12px;padding:14px;font-family:sans-serif">
${shots.map(([n, d]) => `<div style="flex:1"><div style="color:#fff;font-size:15px;margin-bottom:8px">${n}</div><img src="data:image/png;base64,${d}" style="width:100%"></div>`).join('')}</body>`);
await q.waitForTimeout(600); await q.screenshot({ path: `${OUT}/tone.png` });
await b.close(); console.log('비교 이미지 생성');
