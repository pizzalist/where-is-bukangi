/**
 * bukangi.com 앞단. 정적 파일은 Workers가 알아서 내주고, 이 코드는 정적 파일이 아닌 경로만 받는다.
 *  /c/<카드id>  → 맥미니 API의 카드 미리보기 페이지로 넘긴다 (카톡 봇이 OG를 읽고, 사람은 앱으로 이동)
 *  그 외        → 앱(index.html)
 */
const API = "https://api.bukangi.com";
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const m = /^\/c\/([A-Za-z0-9_-]{6,32})$/.exec(u.pathname);
    if (m) {
      const r = await fetch(`${API}/c/${m[1]}`, { headers: { "user-agent": req.headers.get("user-agent") || "", "cf-connecting-ip": req.headers.get("cf-connecting-ip") || "" }, redirect: "manual", cf: { cacheTtl: 60 } });
      return new Response(r.body, { status: r.status, headers: r.headers });
    }
    return env.ASSETS.fetch(req);
  },
};
