// 스레드용 실제 화면. 테스트 DB에 제보를 직접 심는다 (운영 DB 안 건드림).
// "내 카드"는 사진이 잘 보이는 갤럭시로, 기술은 밈(롯데·상어돔·핑크퐁)이 나오는 카드 id를 골라 심는다.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const OUT = process.argv[2]; const DATA = process.env.BUKANG_DATA;
const SITE = 'http://localhost:4173';
const { db, photoPath, ROOT } = await import('../server/db.js');
const { cardStats } = await import('../src/lib/rarity.ts');
const WANT = ['롯데 연승 부스터', '상어돔 기원', '핑크퐁 주가 상승', '상어야 고맙데이', '아기상어 무한재생', '실검 점령'];
const ago = (min) => new Date(Date.now() - min * 60e3).toISOString();
const day = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
fs.mkdirSync(path.join(ROOT, 'photos', day), { recursive: true });
const ins = db.prepare(`INSERT INTO submissions (id, ordinal, rarity, zone, taken_at, submitted_at, status, photo, thumb) VALUES (?,?,?,?,?,?,'approved',?,NULL)`);
function pickId(ordinal, takenAt, wantTwo) {   // 원하는 밈 기술이 나오는 id를 찾는다
  for (let i = 0; i < 20000; i++) { const id = crypto.randomBytes(9).toString('base64url'); const mv = cardStats(ordinal, takenAt, id).moves.map((m) => m[0]);
    const hit = mv.filter((m) => WANT.includes(m)).length; if (hit >= (wantTwo ? 2 : 1)) return id; }
  return crypto.randomBytes(9).toString('base64url');
}
const rows = [[1, 'galaxy', 'B', 290], [2, 'holo', 'C', 170], [3, 'reverse', 'B', 95], [4, 'galaxy', 'B', 38]];
const cards = [];
for (const [ordinal, rarity, zone, m] of rows) {
  const takenAt = ago(m); const id = pickId(ordinal, takenAt, ordinal === 4);
  const photo = `${day}/${id}.png`; fs.copyFileSync('public/sample.png', photoPath(photo));
  ins.run(id, ordinal, rarity, zone, takenAt, takenAt, photo);
  cards.push({ id, ordinal, rarity, zone, takenAt, photo: `http://localhost:8788/photos/${photo}`, moves: cardStats(ordinal, takenAt, id).moves.map((x) => x[0]) });
}
db.prepare("INSERT INTO meta(k,v) VALUES('ordinal','4') ON CONFLICT(k) DO UPDATE SET v='4'").run();
db.prepare(`INSERT INTO observations (kind, zone, at, note, created_at) VALUES ('seen','B',?, '현장 관측', ?)`).run(ago(380), ago(380));
console.log(cards.map((c) => `${c.ordinal}:${c.rarity} [${c.moves.join(' / ')}]`).join('\n'));
const mine = cards[3];

const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }); const p = await ctx.newPage();
await p.goto(SITE + '/#/'); await p.waitForTimeout(1500);
await p.evaluate((c) => localStorage.setItem('bukang.submissions.v1', JSON.stringify([{ id: c.id, type: 'seen', takenAt: c.takenAt, submittedAt: c.takenAt, zone: c.zone, photoDataUrl: c.photo, status: 'approved', ordinal: c.ordinal, rarity: c.rarity }])), mine);
await p.goto(SITE + '/#/card/' + mine.id); await p.waitForTimeout(3800);
const hb = await p.locator('.holo').first().boundingBox(); await p.mouse.move(hb.x + hb.width * 0.42, hb.y + hb.height * 0.4); await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/shot-card.png` });
await p.goto(SITE + '/#/'); await p.reload(); await p.waitForTimeout(3000);
await p.screenshot({ path: `${OUT}/shot-home.png` });
console.log('히어로:', (await p.locator('.hero .headline').textContent())?.trim(), '|', (await p.locator('.hero .sub').textContent())?.trim());
const tl = await p.locator('.section', { hasText: '오늘의 기록' }).first().boundingBox();
await p.evaluate((y) => window.scrollTo(0, y - 70), tl.y); await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/shot-timeline.png` });
await p.goto(SITE + '/#/hall'); await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}/shot-hall.png` });
await b.close(); console.log('demo shots ok');
