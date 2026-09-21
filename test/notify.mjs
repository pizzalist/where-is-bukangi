// 디스코드 알림 + 서명 링크 흐름. 진짜 디스코드 대신 로컬 가짜 웹훅으로 받는다.
// 서버가 localhost:8787에 떠 있어야 하고 ADMIN_TOKEN이 같아야 한다.
import http from 'node:http';
import fs from 'node:fs';
const TOKEN = process.env.ADMIN_TOKEN; if (!TOKEN) throw new Error('ADMIN_TOKEN 필요');
const B = 'http://localhost:8787';

// 1) 가짜 웹훅
let got = null;
const mock = http.createServer((req, res) => { const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => { got = { ct: req.headers['content-type'], body: Buffer.concat(chunks) }; res.writeHead(204); res.end(); }); });
await new Promise((r) => mock.listen(8799, r));
process.env.DISCORD_WEBHOOK = 'http://localhost:8799/hook';
process.env.PUBLIC_URL = B;
process.env.SITE_URL = 'http://localhost:8787';
process.env.BUKANG_DATA = process.env.BUKANG_DATA || '/tmp/bukang-data';
const { notifyVerdict, sign } = await import('../server/notify.js');

// 2) 대기 제보 하나 만들기
const png = 'data:image/png;base64,' + fs.readFileSync('public/sample.png').toString('base64');
const sub = await (await fetch(B + '/api/submissions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ photo: png, thumb: png, takenAt: new Date(Date.now() - 60000).toISOString(), zone: 'B' }) })).json();
console.log('제보:', sub.id, 'No.' + sub.ordinal, sub.rarity);

// 3) 알림 보내기
const { db } = await import('../server/db.js');
const row = db.prepare('SELECT id, ordinal, zone, taken_at, rarity, photo, thumb FROM submissions WHERE id=?').get(sub.id);
const ok = await notifyVerdict(row, 'unsure', { photo: true, shark: null, person: false, confidence: 0.55, reason: '물결 때문에 상어인지 확실하지 않음' });
console.log('알림 전송:', ok, '| content-type:', got?.ct?.split(';')[0], '| 크기:', got?.body.length);
const body = got.body.toString('latin1');
const hasFile = body.includes('name="files[0]"') && body.includes('filename="thumb.');
const pj = /name="payload_json"\r\n\r\n([\s\S]*?)\r\n--/.exec(body)?.[1];
const payload = JSON.parse(Buffer.from(pj, 'latin1').toString('utf8'));
const emb = payload.embeds[0];
console.log('첨부 파일:', hasFile, '| 제목:', emb.title, '| 이미지:', emb.image?.url);
const approve = /\((http[^)]+\/approve\/[^)]+)\)/.exec(emb.description)?.[1];
const reject = /\((http[^)]+\/reject\/[^)]+)\)/.exec(emb.description)?.[1];
console.log('링크:', approve, reject);
if (!approve || !reject || !hasFile) { console.error('FAIL: 메시지 구성'); process.exit(1); }

// 4) 위조 링크는 404
const fake = approve.replace(/[^/]+$/, 'x'.repeat(22));
console.log('위조 서명 GET:', (await fetch(fake)).status);
// 5) GET은 확인 화면만 (상태 안 바뀜)
const g = await fetch(approve); const gt = await g.text();
const st1 = (await (await fetch(B + '/api/submissions/' + sub.id)).json()).status;
console.log('GET 확인화면:', g.status, gt.includes('<form method="post">'), '| 상태 그대로:', st1);
// 6) POST로 공개
const po = await fetch(approve, { method: 'POST' }); const pt = await po.text();
const st2 = (await (await fetch(B + '/api/submissions/' + sub.id)).json()).status;
console.log('POST 공개:', po.status, pt.includes('공개했어요'), '| 상태:', st2);
// 7) 다시 누르면 이미 처리됨, 반려 링크도 이제 안 통함
const again = await (await fetch(reject, { method: 'POST' })).text();
console.log('반려 재시도:', again.includes('이미 처리된'));
// 8) 상황판에 바로 반영
const s = await (await fetch(B + '/api/status', { cache: 'no-store' })).json();
const inTl = s.timeline.some((e) => e.ordinal === sub.ordinal);
console.log('타임라인 반영:', inTl, '| 사진 경로:', s.timeline.find((e) => e.ordinal === sub.ordinal)?.photo);
mock.close();
const pass = st1 === 'pending' && st2 === 'approved' && inTl && again.includes('이미 처리된');
console.log(pass ? 'PASS' : 'FAIL'); process.exit(pass ? 0 : 1);
