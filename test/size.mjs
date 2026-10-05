import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('http://localhost:4173/#/certify'); await p.waitForTimeout(1200);
await p.setInputFiles('input[type=file]', 'public/sample.png');
await p.waitForTimeout(1800);
await p.getByRole('button', { name: '이대로' }).click(); await p.waitForTimeout(1200);
const info = await p.evaluate(() => {
  const img = document.querySelector('.pickbox img');
  const d = img.src;
  return { type: d.slice(5, d.indexOf(';')), kb: Math.round(d.length * 0.75 / 1024) };
});
console.log('크롭 결과:', JSON.stringify(info));
// 같은 캔버스를 여러 포맷으로 비교
const cmp = await p.evaluate(async () => {
  const img = new Image(); img.src = document.querySelector('.pickbox img').src;
  await img.decode();
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1536;
  c.getContext('2d').drawImage(img, 0, 0, 2048, 1536);
  const kb = (d) => Math.round(d.length * 0.75 / 1024);
  return {
    'JPEG q0.86': kb(c.toDataURL('image/jpeg', 0.86)),
    'WebP q0.86': kb(c.toDataURL('image/webp', 0.86)),
    'WebP q0.92': kb(c.toDataURL('image/webp', 0.92)),
    'PNG(무손실)': kb(c.toDataURL('image/png')),
  };
});
console.log('2048px 포맷별 크기(KB):', JSON.stringify(cmp, null, 0));
await b.close();
