import { chromium } from 'playwright';
const SITE = 'https://bukangi.com'; const OUT = process.env.OUT || 'test-output';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
for (const r of ['', 'certify', 'hall', 'tiers']) { await p.goto(`${SITE}/#/${r}`); await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}/s-${r || 'home'}.png`, fullPage: true }); }
await p.goto(`${SITE}/#/certify`); await p.waitForTimeout(1500);
await p.setInputFiles('input[type=file]', 'public/sample.png'); await p.waitForTimeout(2000);
await p.screenshot({ path: `${OUT}/s-certify-2.png`, fullPage: true });
await p.getByRole('button', { name: '이대로' }).click(); await p.waitForTimeout(800);
await p.screenshot({ path: `${OUT}/s-certify-3.png`, fullPage: true });
await b.close(); console.log('shots ok');
