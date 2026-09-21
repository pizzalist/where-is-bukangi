// 캐릭터 가장자리 정리. 배경을 딴 흔적(흰 테두리 찌꺼기)이 남아 있어서 파란 배경 위에서 지저분해 보인다.
// 알파 마스크를 몇 픽셀 깎아(erode) 찌꺼기를 없애고, 1px 부드럽게(blur) 해서 계단 현상 없이 다시 붙인다.
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = process.argv[2] || '/tmp';
const FILES = [['bukang-one', 2], ['bukang-two', 3], ['bukang-smile', 2]];   // [파일, 깎을 px]
const b = await chromium.launch(); const p = await b.newPage();
for (const [name, erode] of FILES) {
  const src = 'data:image/webp;base64,' + fs.readFileSync(`art/${name}.orig.webp`).toString('base64');
  const out = await p.evaluate(async ([src, erode]) => {
    const img = new Image(); img.src = src; await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, W, H); const a = d.data;
    // 1) 바깥 영역: 가장자리에서 투명 픽셀을 타고 들어간 곳만. 캐릭터 안쪽의 투명 구멍(원본의 알파 노이즈)은 바깥이 아니므로 메운다
    const outside = new Uint8Array(W * H); const stack = [];
    const isT = (i) => a[i * 4 + 3] < 128;
    for (let xx = 0; xx < W; xx++) { for (const i of [xx, (H - 1) * W + xx]) if (isT(i) && !outside[i]) { outside[i] = 1; stack.push(i); } }
    for (let y = 0; y < H; y++) { for (const i of [y * W, y * W + W - 1]) if (isT(i) && !outside[i]) { outside[i] = 1; stack.push(i); } }
    while (stack.length) { const i = stack.pop(); const y = (i / W) | 0, xx = i % W;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx2 = xx + dx, ny = y + dy; if (nx2 < 0 || ny < 0 || nx2 >= W || ny >= H) continue; const j = ny * W + nx2; if (!outside[j] && isT(j)) { outside[j] = 1; stack.push(j); } } }
    const m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) m[i] = outside[i] ? 0 : 1;
    // 안쪽 구멍 메우기. 원본은 배경을 따면서 흰 부분(이빨·스카프의 다리 그림·하이라이트)까지 뚫려 있다.
    // 큰 구멍은 원래 흰색이었던 곳이라 흰색으로, 아주 작은 구멍(1~6px 노이즈)은 주변색으로 메운다
    const seen = new Uint8Array(W * H);
    for (let i0 = 0; i0 < W * H; i0++) { if (!isT(i0) || outside[i0] || seen[i0]) continue;
      const q = [i0]; seen[i0] = 1; const px = [];
      while (q.length) { const k = q.pop(); px.push(k); const y = (k / W) | 0, xx = k % W;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx2 = xx + dx, ny = y + dy; if (nx2 < 0 || ny < 0 || nx2 >= W || ny >= H) continue; const j = ny * W + nx2; if (!seen[j] && !outside[j] && isT(j)) { seen[j] = 1; q.push(j); } } }
      for (const i of px) { const y = (i / W) | 0, xx = i % W;
        if (px.length > 6) { a[i*4] = 255; a[i*4+1] = 255; a[i*4+2] = 255; }
        else { let r=0,g=0,bb=0,n=0; for (let dy=-2; dy<=2; dy++) for (let dx=-2; dx<=2; dx++) { const j=(y+dy)*W+xx+dx; if (j>=0 && j<W*H && a[j*4+3] >= 250) { r+=a[j*4]; g+=a[j*4+1]; bb+=a[j*4+2]; n++; } } if (n) { a[i*4]=r/n; a[i*4+1]=g/n; a[i*4+2]=bb/n; } }
        a[i*4+3] = 255; } }
    // 반투명(128~249) 안쪽 픽셀도 불투명으로
    for (let i = 0; i < W * H; i++) if (m[i] && a[i*4+3] < 255) a[i*4+3] = 255;
    // 2) erode: 바깥 경계만 몇 px 깎아 흰 찌꺼기 제거
    let cur = m;
    for (let k = 0; k < erode; k++) { const nx = new Uint8Array(W * H); for (let y = 1; y < H - 1; y++) for (let xx = 1; xx < W - 1; xx++) { const i = y * W + xx; nx[i] = cur[i] && cur[i-1] && cur[i+1] && cur[i-W] && cur[i+W] && cur[i-W-1] && cur[i-W+1] && cur[i+W-1] && cur[i+W+1] ? 1 : 0; } cur = nx; }
    // 3) 부드럽게: 3x3 평균으로 알파 만들기
    const al = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let xx = 1; xx < W - 1; xx++) { let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += cur[(y+dy) * W + xx + dx]; al[y * W + xx] = s / 9; }
    // 4) 적용. 가장자리 색이 흰색으로 물드는 걸 막으려고 반투명 픽셀 색은 안쪽 불투명 픽셀 색을 쓴다
    for (let y = 1; y < H - 1; y++) for (let xx = 1; xx < W - 1; xx++) { const i = y * W + xx; const v = al[i]; const k = i * 4;
      if (v <= 0) { a[k+3] = 0; continue; }
      if (v < 1 && !cur[i]) { // 바깥 반투명 픽셀: 가장 가까운 안쪽 픽셀 색으로
        let found = false; for (let r = 1; r <= 4 && !found; r++) for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) { const j = (y+dy) * W + xx + dx; if (j >= 0 && j < W*H && cur[j]) { a[k] = a[j*4]; a[k+1] = a[j*4+1]; a[k+2] = a[j*4+2]; found = true; } }
      }
      a[k+3] = Math.round(v * 255); }
    x.putImageData(d, 0, 0);
    return c.toDataURL('image/webp', 0.94);
  }, [src, erode]);
  fs.writeFileSync(`public/${name}.webp`, Buffer.from(out.split(',')[1], 'base64'));
  console.log(name, 'erode', erode, '->', fs.statSync(`public/${name}.webp`).size, 'bytes');
}
// 비교 이미지: 원본 vs 정리본 (파란 배경, 2배 확대 부분)
const before = 'data:image/webp;base64,' + fs.readFileSync('art/bukang-two.orig.webp').toString('base64');
const after = 'data:image/webp;base64,' + fs.readFileSync('public/bukang-two.webp').toString('base64');
const q = await b.newPage({ viewport: { width: 1000, height: 520 } });
await q.setContent(`<body style="margin:0;background:#2fb5e8;display:flex"><div style="width:500px;height:520px;overflow:hidden;position:relative"><img src="${before}" style="position:absolute;left:-60px;top:-120px;width:1000px"></div><div style="width:500px;height:520px;overflow:hidden;position:relative;border-left:3px solid #fff"><img src="${after}" style="position:absolute;left:-60px;top:-120px;width:1000px"></div></body>`);
await q.waitForTimeout(300); await q.screenshot({ path: `${OUT}/edge-compare.png` }); await b.close(); console.log('compare ok');
