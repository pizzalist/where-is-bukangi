// 고른 값을 어두운 사진·밝은 사진 양쪽에서, 세 등급(레인보우·풀아트·골드) 모두 확인
import { chromium } from 'playwright';
const OUT = process.argv[2];
const CARDS = [['어두운 사진', 'id0IKS95vant'], ['밝은 사진', 'u_hHqU2s6EoS']];
const CSS = `
.holo-rainbow .holo-bleed img{filter:brightness(1.06) saturate(.9) contrast(1.02) !important}
.holo-rainbow .holo-bleed .fx-art{opacity:calc(.4 + var(--hyp) * .26) !important}
.holo-fullart .holo-bleed img{filter:brightness(1.02) saturate(1.15) contrast(1.05) !important}
.holo-fullart .holo-bleed .fx-art{opacity:calc(.4 + var(--hyp) * .26) !important}
.holo-gold .holo-bleed img{filter:sepia(.55) saturate(1.5) brightness(1.06) contrast(1.05) !important}
.holo-gold .holo-bleed .fx-art{opacity:calc(.34 + var(--hyp) * .26) !important}`;
const b = await chromium.launch(); const rows = [];
for (const [label, id] of CARDS) {
  const card = await (await fetch(`https://api.bukangi.com/api/submissions/${id}`)).json();
  for (const r of ['rainbow', 'fullart', 'gold']) {
    for (const [tag, css] of [['전', ''], ['후', CSS]]) {
      const ctx = await b.newContext({ viewport: { width: 500, height: 800 }, deviceScaleFactor: 2 });
      const p = await ctx.newPage();
      if (css) await p.addInitScript((c) => addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = c; document.head.appendChild(s); }), css);
      const d = Buffer.from(JSON.stringify({ id: card.id, ordinal: card.ordinal, rarity: r, zone: card.zone, zoneName: "제5보도교", takenAt: card.takenAt, photo: card.photo, site: "bukangi.com" })).toString("base64url");
      await p.goto(`https://bukangi.com/?d=${d}#/shot/${card.id}`);
      await p.waitForSelector('.shot-wrap[data-ready="1"]', { timeout: 25000 }); await p.waitForTimeout(400);
      rows.push([`${label} · ${r} · ${tag}`, (await p.locator('.shot-wrap').screenshot()).toString('base64')]);
      await ctx.close();
    }
  }
}
const q = await b.newPage({ viewport: { width: 1740, height: 1300 } });
await q.setContent(`<body style="margin:0;background:#1b2430;display:grid;grid-template-columns:repeat(6,1fr);gap:8px;padding:12px;font-family:sans-serif">
${rows.map(([n, d]) => `<div><div style="color:#fff;font-size:12px;margin-bottom:5px">${n}</div><img src="data:image/png;base64,${d}" style="width:100%"></div>`).join('')}</body>`);
await q.waitForTimeout(600); await q.screenshot({ path: `${OUT}/tone2.png`, fullPage: true });
await b.close(); console.log('완료');
