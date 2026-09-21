// 등급 9종 페이지 성능 측정. CPU 4배 느리게 해서 폰 흉내.
import { chromium } from 'playwright';
const B = process.argv[2] || 'http://localhost:8787';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.goto(B + '/#/'); await p.waitForTimeout(800);
const t0 = Date.now();
await p.goto(B + '/#/tiers');
await p.waitForFunction(() => document.querySelectorAll('.holo').length >= 9);
const tRender = Date.now() - t0;
await p.waitForTimeout(500);
const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
const longTasks = await p.evaluate(() => new Promise((res) => { const arr = []; new PerformanceObserver((l) => arr.push(...l.getEntries().map((e) => Math.round(e.duration)))).observe({ type: 'longtask', buffered: true }); setTimeout(() => res(arr), 1500); }));
// 스크롤 중 프레임
const scrollFps = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; window.scrollBy(0, 12); if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
console.log(JSON.stringify({ renderMs: tRender, idleFps: Math.round(fps), scrollFps: Math.round(scrollFps), longTasks: longTasks.slice(0, 10) }));
await b.close();
