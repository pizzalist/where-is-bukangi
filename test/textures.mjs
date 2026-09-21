// styles.css의 feTurbulence SVG 텍스처를 비트맵 타일로 미리 굽는다.
// 폰(특히 사파리)에서 SVG 필터를 카드마다 3배 해상도로 다시 그리는 게 등급 페이지 버벅임의 주범.
import { chromium } from 'playwright';
import fs from 'node:fs';
const css = fs.readFileSync('src/styles.css', 'utf8');
const pick = (name) => { const m = new RegExp(`--${name}: url\\("(data:image/svg\\+xml;utf8,[^"]+)"\\)`).exec(css); if (!m) throw new Error(name + ' 없음'); return m[1]; };
const b = await chromium.launch(); const p = await b.newPage();
for (const [name, size, q] of [['glitter', 512, 0.9], ['galaxy', 400, 0.9]]) {
  const uri = pick(name);
  const out = await p.evaluate(async ([uri, size, q]) => {
    const img = new Image(); img.src = uri; await img.decode();
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    c.getContext('2d').drawImage(img, 0, 0, size, size);
    return c.toDataURL('image/webp', q);
  }, [uri, size, q]);
  const dst = `public/tx-${name}.webp`;
  fs.writeFileSync(dst, Buffer.from(out.split(',')[1], 'base64'));
  console.log(dst, size + 'x' + size, fs.statSync(dst).size, 'bytes');
}
await b.close();
