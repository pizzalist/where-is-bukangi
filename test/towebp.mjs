import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, src, dst, q='0.88', maxW='1600'] = process.argv;
const b = await chromium.launch(); const p = await b.newPage();
const data = 'data:image/png;base64,' + fs.readFileSync(src).toString('base64');
const out = await p.evaluate(async ([data, q, maxW]) => {
  const img = new Image(); img.src = data; await img.decode();
  const s = Math.min(1, maxW / img.width); const c = document.createElement('canvas');
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return [c.width, c.height, c.toDataURL('image/webp', q)];
}, [data, Number(q), Number(maxW)]);
fs.writeFileSync(dst, Buffer.from(out[2].split(',')[1], 'base64'));
console.log(src, '->', dst, out[0]+'x'+out[1], fs.statSync(dst).size, 'bytes');
await b.close();
