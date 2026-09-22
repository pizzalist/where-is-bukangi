// 링크 미리보기 크롤러 흉내. meta refresh를 따라가는 봇(메타 계열)까지 포함해 카드 OG가 남는지 본다.
const URLS = process.argv.slice(2);
const BOTS = [
  ['스레드·페북', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
  ['메타 에이전트', 'meta-externalagent/1.1'],
  ['카카오톡', 'kakaotalk-scrap/1.0'],
  ['트위터', 'Twitterbot/1.0'],
  ['슬랙', 'Slackbot-LinkExpanding 1.0'],
];
const pick = (html, prop) => (new RegExp(`<meta property="${prop}" content="([^"]*)"`).exec(html) || [])[1];
let fail = 0;
for (const u of URLS) {
  console.log('\n' + u);
  for (const [name, ua] of BOTS) {
    let html = await (await fetch(u, { headers: { 'user-agent': ua, accept: 'text/html,application/xhtml+xml,*/*;q=0.8' }, redirect: 'follow' })).text();
    // meta refresh를 따라가는 크롤러 흉내 (메타 계열이 이렇게 한다)
    const mr = /http-equiv="refresh"[^>]*url=([^"']+)/i.exec(html);
    let followed = '';
    if (mr) { followed = ' → refresh 따라감'; html = await (await fetch(mr[1].trim(), { headers: { 'user-agent': ua } })).text(); }
    const t = pick(html, 'og:title'), img = pick(html, 'og:image');
    const ok = /인증 카드 No\./.test(t || '') && /\/api\/cards\//.test(img || '');
    if (!ok) fail++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name.padEnd(8)} ${t}${followed}`);
  }
}
console.log(fail ? `\n${fail}건 실패` : '\n전부 카드 미리보기');
process.exit(fail ? 1 : 0);
