/**
 * 카드 리빌 영상. 뒷면 → 뒤집기 → 자동 문지르기(홀로가 흐르는 것)를 녹화한다.
 * 프레임을 직접 찍어 붙인다 (브라우저 녹화보다 매끄럽고 mp4로 바로 뽑을 수 있다).
 *   node test/video.mjs <출력폴더> <카드id> [초]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const OUT = process.argv[2], ID = process.argv[3], SEC = Number(process.argv[4] || 4);
const FPS = 30, W = 560, H = 820;
const SITE = process.env.SITE || 'https://admin.bukangi.com';
const frames = path.join(OUT, 'frames');
fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });

const card = await (await fetch(`https://api.bukangi.com/api/submissions/${ID}`)).json();
const d = Buffer.from(JSON.stringify({
  id: card.id, ordinal: card.ordinal, rarity: card.rarity, zone: card.zone,
  zoneName: "제5보도교", takenAt: card.takenAt, photo: card.photo, site: "bukangi.com",
})).toString('base64url');

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, locale: 'ko-KR' });
const p = await ctx.newPage();
// 시간을 우리가 제어한다. 실제 대기 대신 프레임마다 시계를 앞으로 돌려 매끄럽게 찍는다
await p.clock.install();
// 한 바퀴를 프레임 수에 정확히 맞춘다. 반올림으로 어긋나면 반복할 때 튄다
const TOTAL = Math.round(SEC * FPS);
await p.goto(`${SITE}/?d=${d}&video=1#/shot/${card.id}`);
// 준비될 때까지 조금씩만 돌린다. 한 번에 많이 돌리면 뒤집기가 녹화 전에 끝나버린다
for (let i = 0; i < 100; i++) {
  if (await p.locator('.shot-wrap[data-ready="1"]').count()) break;
  await p.clock.runFor(120);
}
await p.waitForSelector('.shot-wrap[data-ready="1"]', { timeout: 30000 });

const wrap = p.locator('.shot-video-wrap');   // 여백 없이 카드 영역만
/** HoloCard의 setPos와 같은 계산. 프레임마다 직접 넣어 한 바퀴를 정확히 맞춘다 */
async function setAngle(mx, my) {
  await p.evaluate(([mx, my]) => {
    const el = document.querySelector('.holo'); if (!el) return;
    const rx = ((my - 50) / 50) * -13, ry = ((mx - 50) / 50) * 13;
    const hyp = Math.min(1, Math.hypot(mx - 50, my - 50) / 50);
    el.style.setProperty('--mx', mx + '%'); el.style.setProperty('--my', my + '%');
    el.style.setProperty('--rx', rx + 'deg'); el.style.setProperty('--ry', ry + 'deg');
    el.style.setProperty('--posx', (50 + (mx - 50) / 1.5) + '%');
    el.style.setProperty('--posy', (50 + (my - 50) / 1.5) + '%');
    el.style.setProperty('--hyp', String(hyp));
  }, [mx, my]);
}
for (let i = 0; i < TOTAL; i++) {
  const th = (i / TOTAL) * Math.PI * 2;                 // 정확히 한 바퀴
  await setAngle(50 + Math.cos(th) * 34, 50 + Math.sin(th) * 27);
  await wrap.screenshot({ path: path.join(frames, `f${String(i).padStart(4, '0')}.png`), animations: 'disabled' });
}
await b.close();

const mp4 = path.join(OUT, `card-${card.ordinal}.mp4`), gif = path.join(OUT, `card-${card.ordinal}.gif`);
// 트위터·인스타가 바로 받는 형식 (h264/yuv420p, 짝수 해상도)
execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(frames, 'f%04d.png'),
  '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4],
  { stdio: 'ignore' });
// 미리보기용 gif (작게)
execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(frames, 'f%04d.png'),
  '-vf', 'fps=18,scale=340:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0', gif],
  { stdio: 'ignore' });
fs.rmSync(frames, { recursive: true, force: true });
console.log(`${path.basename(mp4)} ${Math.round(fs.statSync(mp4).size / 1024)}KB | ${path.basename(gif)} ${Math.round(fs.statSync(gif).size / 1024)}KB`);
