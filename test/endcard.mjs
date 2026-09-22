/**
 * 릴스 마지막에 붙이는 CTA 클립 (1080x1920, 9:16).
 * 캐릭터가 통통 튀고 주소가 나타난다. CapCut에서 영상 끝에 이어 붙이면 된다.
 *   node test/endcard.mjs <출력폴더> [초]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const OUT = process.argv[2], SEC = Number(process.argv[3] || 3);
const FPS = 30, TOTAL = Math.round(SEC * FPS);
const frames = path.join(OUT, 'ef');
fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
const im = (f) => 'data:image/webp;base64,' + fs.readFileSync(f).toString('base64');
const two = im('public/bukang-two.webp');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await p.setContent(`<meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Jua&family=Noto+Sans+KR:wght@700;900&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1080px;height:1920px;overflow:hidden}
body{font-family:'Noto Sans KR',sans-serif;color:#fff;background:linear-gradient(170deg,#6fdcff 0%,#2fb5e8 45%,#0b5c8a 100%);position:relative}
.bub{position:absolute;border-radius:50%;background:rgba(255,255,255,.12)}
.jua{font-family:'Jua',sans-serif}
#t1{position:absolute;left:0;right:0;top:420px;text-align:center;font-size:104px;line-height:1.15;text-shadow:0 10px 30px rgba(0,40,70,.4)}
#t2{position:absolute;left:0;right:0;top:700px;text-align:center;font-size:46px;font-weight:700;opacity:.95;line-height:1.5}
#sh{position:absolute;left:50%;top:880px;width:560px;transform:translateX(-50%);filter:drop-shadow(0 24px 40px rgba(0,30,60,.4))}
#u{position:absolute;left:50%;bottom:330px;transform:translateX(-50%);font-size:70px;font-weight:900;background:#fff;color:#0b5c8a;padding:26px 62px;border-radius:999px;box-shadow:0 18px 40px rgba(0,20,50,.35);white-space:nowrap}
</style><body>
<div class="bub" style="width:640px;height:640px;left:-220px;top:-200px"></div>
<div class="bub" style="width:420px;height:420px;right:-160px;bottom:220px"></div>
<div id="t1" class="jua">부캉이<br>지금 있나?</div>
<div id="t2">마지막 목격 시각·구역<br>지금 바로 확인</div>
<img id="sh" src="${two}">
<div id="u">bukangi.com</div>
</body>`);
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(600);

for (let i = 0; i < TOTAL; i++) {
  const t = i / TOTAL;
  await p.evaluate(([t]) => {
    const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    const s = (el, a, b) => { const e = document.getElementById(el); e.style.opacity = String(ease(a)); e.style.transform = (e.id === 'sh' || e.id === 'u' ? 'translateX(-50%) ' : '') + `translateY(${(1 - ease(a)) * 40}px)` + (b ? ` scale(${b})` : ''); };
    s('t1', t / 0.18);
    s('t2', (t - 0.12) / 0.18);
    // 캐릭터는 통통 튄다
    const bob = Math.sin(t * Math.PI * 4) * 14;
    const shEl = document.getElementById('sh');
    shEl.style.opacity = String(ease((t - 0.2) / 0.2));
    shEl.style.transform = `translateX(-50%) translateY(${(1 - ease((t - 0.2) / 0.2)) * 60 + bob}px)`;
    s('u', (t - 0.42) / 0.2, 1 + Math.max(0, 0.06 - Math.abs(t - 0.52) * 0.5));
  }, [t]);
  await p.screenshot({ path: path.join(frames, `f${String(i).padStart(4, '0')}.png`), animations: 'disabled' });
}
await b.close();
const mp4 = path.join(OUT, 'endcard.mp4');
execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(frames, 'f%04d.png'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4], { stdio: 'ignore' });
fs.rmSync(frames, { recursive: true, force: true });
console.log('endcard.mp4', Math.round(fs.statSync(mp4).size / 1024) + 'KB', `${SEC}초 1080x1920`);
