/** 부하 테스트: 읽기(상황판) + 쓰기(사진 업로드) */
const B = "http://localhost:8787";
const TOK = process.env.TOK || "";

function pct(a, p) { return a[Math.min(a.length - 1, Math.floor(a.length * p))]; }
async function run(name, n, conc, fn) {
  const lat = []; let ok = 0, fail = {}; const t0 = Date.now();
  let i = 0;
  await Promise.all(Array.from({ length: conc }, async () => {
    while (i < n) {
      const k = i++; const s = Date.now();
      try { const c = await fn(k); if (c < 400) ok++; else fail[c] = (fail[c] || 0) + 1; }
      catch (e) { fail[e.message?.slice(0, 20) || "ERR"] = (fail[e.message?.slice(0, 20) || "ERR"] || 0) + 1; }
      lat.push(Date.now() - s);
    }
  }));
  const el = (Date.now() - t0) / 1000; lat.sort((a, b) => a - b);
  console.log(`${name.padEnd(22)} ${n}건/동시${String(conc).padEnd(4)} ${el.toFixed(2)}s  ${Math.round(n / el)}rps  p50=${pct(lat,.5)}ms p95=${pct(lat,.95)}ms p99=${pct(lat,.99)}ms  성공=${ok}  ${Object.keys(fail).length ? JSON.stringify(fail) : ""}`);
  return { rps: Math.round(n / el), p95: pct(lat, .95), ok, fail };
}

// 1x1 WebP
const TINY = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
// 70KB 정도로 부풀린 유효 WebP (실제 앱 출력 크기)
const buf = Buffer.from(TINY.split(",")[1], "base64");
const big = Buffer.concat([buf, Buffer.alloc(70 * 1024)]);
const PHOTO = "data:image/webp;base64," + big.toString("base64");

console.log("— 읽기 경로 (Cloudflare 캐시 없이 원본 직격) —");
await run("GET /api/status", 3000, 200, (k) => fetch(`${B}/api/status`, { headers: { "cf-connecting-ip": `10.0.${k % 250}.${k % 250}` } }).then(r => r.status));
await run("GET /api/hall", 2000, 200, (k) => fetch(`${B}/api/hall`, { headers: { "cf-connecting-ip": `10.1.${k % 250}.${k % 250}` } }).then(r => r.status));
await run("GET /photos/*", 2000, 200, (k) => fetch(`${B}/photos/2026/09/21/seed01.png`, { headers: { "cf-connecting-ip": `10.2.${k % 250}.${k % 250}` } }).then(r => r.status));

console.log("\n— 쓰기 경로 (사진 70KB 업로드) —");
await run("POST /api/submissions", 300, 50, (k) => fetch(`${B}/api/submissions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "cf-connecting-ip": `10.9.${Math.floor(k/3) % 250}.${k % 250}` },
  body: JSON.stringify({ photo: PHOTO, takenAt: new Date().toISOString(), zone: "B" }),
}).then(r => r.status));

console.log("\n— 운영자 —");
if (TOK) await run("GET /api/admin/queue", 100, 10, () => fetch(`${B}/api/admin/queue`, { headers: { Authorization: `Bearer ${TOK}`, "cf-connecting-ip": "10.5.0.1" } }).then(r => r.status));
console.log("\n헬스:", await (await fetch(`${B}/healthz`)).text());
