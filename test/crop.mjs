// 자르기 결과가 화면에 보이던 영역과 같은지, 검은 띠가 없는지. 가로 사진·세로 사진·드래그+확대 세 경우.
import { chromium } from 'playwright';
import fs from 'node:fs';
const B = process.argv[2] || 'http://localhost:4173';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
// 세로 테스트 이미지: 위 빨강 → 아래 파랑 그라데이션, 가운데 흰 원
const portrait = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 1000; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 1000); g.addColorStop(0, '#e33'); g.addColorStop(1, '#33e'); x.fillStyle = g; x.fillRect(0, 0, 600, 1000); x.fillStyle = '#fff'; x.beginPath(); x.arc(300, 500, 120, 0, 7); x.fill(); return c.toDataURL('image/png'); });
fs.writeFileSync('/tmp/portrait.png', Buffer.from(portrait.split(',')[1], 'base64'));

async function stats(dataUrl) {   // 출력 이미지의 양끝 5% 열 밝기, 전체 평균색
  return p.evaluate(async (u) => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
    const col = (x0, x1) => { let s = 0, n = 0; for (let y = 0; y < c.height; y += 8) for (let xx = x0; xx < x1; xx += 4) { const k = (y * c.width + xx) * 4; s += (d[k] + d[k+1] + d[k+2]) / 3; n++; } return Math.round(s / n); };
    const w5 = Math.round(c.width * 0.05); return { w: i.width, h: i.height, left: col(0, w5), right: col(c.width - w5, c.width), center: col(Math.round(c.width * 0.45), Math.round(c.width * 0.55)) }; }, dataUrl);
}
async function boxMean() {          // 자르기 상자 스크린샷의 평균 밝기 (비교용)
  const buf = await p.locator('.cropbox').screenshot(); const u = 'data:image/png;base64,' + buf.toString('base64');
  return (await stats(u));
}
async function run(file, label, act) {
  await p.goto(B + '/#/'); await p.reload(); await p.goto(B + '/#/certify'); await p.waitForTimeout(1200);   // 매번 새 상태로
  await p.setInputFiles('input[type=file]', file); await p.waitForTimeout(1500);
  if (act) await act();
  const before = await boxMean();
  await p.getByRole('button', { name: '이대로' }).click(); await p.waitForTimeout(1500);
  const out = await p.locator('.pickbox img').getAttribute('src');
  const s = await stats(out);
  const ok = s.left > 40 && s.right > 40 && Math.abs(s.center - before.center) < 30;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: 출력 ${s.w}x${s.h} | 왼끝 ${s.left} 오른끝 ${s.right} 가운데 ${s.center} | 화면 가운데 ${before.center}`);
  return ok;
}
let all = true;
all &= await run('public/sample.png', '가로(2.2:1) 기본');
all &= await run('/tmp/portrait.png', '세로(0.6:1) 기본');
all &= await run('/tmp/portrait.png', '세로 + 확대2배 + 드래그', async () => {
  await p.locator('.croprange').fill('2'); await p.waitForTimeout(200);
  const bx = await p.locator('.cropbox').boundingBox(); const cx = bx.x + bx.width / 2, cy = bx.y + bx.height / 2;
  await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + 60, cy - 90, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
});
await b.close(); console.log(all ? 'ALL PASS' : 'SOME FAIL'); process.exit(all ? 0 : 1);
