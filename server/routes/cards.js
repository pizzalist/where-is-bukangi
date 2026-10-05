/**
 * 카드 이미지(/api/cards/:id.png|jpg)와 카드 공유 링크(/c/:id), 공개 시 미리보기 예열.
 */
import { db } from "../db.js";
import { cardPng, cardKey, CARD_SIZE } from "../cards.js";
import { SERVE_STATIC, PUBLIC_URL, SITE_URL, LOCAL_BASE } from "../config.js";
import { ZONE_NAME } from "../zones.js";
import { limiter, clientIp } from "../http/middleware.js";
import { esc } from "../http/html.js";
import { today, tally, bumpSource } from "../stats.js";

const qCardRow = db.prepare(`SELECT id, ordinal, rarity, zone, taken_at, photo FROM submissions WHERE id=?`);
const zoneLabel = (r) => (r.zone ? ZONE_NAME[r.zone] || "" : "");

/** 공개되면 링크 미리보기 이미지를 미리 구워둔다. 카톡·스레드 크롤러가 찬 상태로 기다리면 미리보기를 포기한다 */
export function warmCard(id) {
  if (!SERVE_STATIC) return;
  const r = qCardRow.get(id);
  if (!r) return;
  cardPng(r, zoneLabel(r), LOCAL_BASE, "jpg")
    .then(() => console.log(`[카드] 미리보기 예열 ${id}`))
    .catch((e) => console.warn("[카드] 예열 실패:", e.message));
}

const RARITY_LABEL = {
  common: "커먼", uncommon: "언커먼", rare: "레어", holo: "홀로", reverse: "리버스 홀로",
  galaxy: "갤럭시", fullart: "풀아트", rainbow: "레인보우", gold: "시크릿 골드",
};
const LINK_BOT = /bot|crawler|spider|facebookexternalhit|kakaotalk-scrap|Twitterbot|Slackbot|meta-externalagent/i;

/** /c/:id 응답 HTML. 줄바꿈 위치까지 분리 전 출력과 같다 */
function cardLinkPage({ title, desc, site, id, img, appUrl }) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta property="og:type" content="website"><meta property="og:site_name" content="부캉이 지금 있나">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(site)}/c/${esc(id)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:image:type" content="image/jpeg">`
    + `<meta property="og:image:width" content="${CARD_SIZE.jpg.w}">`
    + `<meta property="og:image:height" content="${CARD_SIZE.jpg.h}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(img)}">
<script>location.replace(${JSON.stringify(appUrl)})</script>
</head><body style="font-family:-apple-system,system-ui,sans-serif;padding:32px;text-align:center">`
    + `<p style="color:#567">카드를 여는 중…</p>`
    + `<a href="${esc(appUrl)}" style="display:inline-block;padding:14px 26px;background:#0b5c8a;color:#fff;`
    + `border-radius:12px;text-decoration:none;font-weight:700">${esc(title)} 보기</a></body></html>`;
}

export function mountCards(app) {
  /* ---------- 카드 PNG (저장·공유용). 화면의 홀로 카드를 서버가 그대로 찍는다 ---------- */
  app.get(/^\/api\/cards\/([A-Za-z0-9_-]{6,32})\.(png|jpg)$/,
    limiter({ windowMs: 15 * 60e3, max: 120, key: clientIp }),
    async (req, res) => {
      const fmt = req.params[1];
      const r = qCardRow.get(req.params[0]);
      if (!r) return res.status(404).json({ error: "없는 카드예요." });
      if (!SERVE_STATIC) {
        return res.status(503).json({ error: "이 서버는 카드 이미지를 만들 수 없어요 (SERVE_STATIC=0)." });
      }
      try {
        const file = await cardPng(r, zoneLabel(r), LOCAL_BASE, fmt);
        res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
        res.set("ETag", `"${cardKey(r, fmt)}"`);
        res.type(fmt === "jpg" ? "jpeg" : "png").sendFile(file);
      } catch (e) {
        if (e.message === "BUSY") {
          return res.status(503).json({ error: "지금 카드를 만드는 요청이 많아요. 잠시 뒤 다시 눌러주세요." });
        }
        console.error("[카드] 실패:", e.message);
        res.status(500).json({ error: "카드 이미지를 만들지 못했어요. 잠시 뒤 다시 눌러주세요." });
      }
    });

  /* ---------- 카드 공유 링크 /c/:id ----------
     카톡·스레드 봇이 읽는 OG 태그(이 카드 이미지)를 주고, 사람은 바로 앱의 카드 화면으로 보낸다.
     이동은 반드시 자바스크립트로만. <meta http-equiv="refresh">를 쓰면 메타(스레드·페북) 크롤러가
     그걸 따라가서 앱 첫 화면의 OG(사이트 공용 이미지)를 읽어버린다. 봇은 JS를 안 돌리니 카드 OG가 남는다. */
  app.get(/^\/c\/([A-Za-z0-9_-]{6,32})$/, limiter({ windowMs: 15 * 60e3, max: 120, key: clientIp }), (req, res) => {
    const r = qCardRow.get(req.params[0]);
    const site = SITE_URL || `${req.protocol}://${req.get("host")}`;
    if (!r) return res.redirect(302, `${site}/#/`);
    const when = new Date(r.taken_at).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const title = `부캉이 인증 카드 No.${Number(r.ordinal).toLocaleString()}`;
    const desc = `${when} ${r.zone ? ZONE_NAME[r.zone] || "" : "부산 북항 친수공원"} · ${RARITY_LABEL[r.rarity] || r.rarity}`;
    const img = `${PUBLIC_URL || site}/api/cards/${r.id}.jpg`;   // 미리보기는 가벼운 쪽
    const appUrl = `${site}/#/card/${r.id}`;
    if (!LINK_BOT.test(String(req.headers["user-agent"] || ""))) {
      tally("card_view"); try { bumpSource.run(today(), "card_link"); } catch { /* 무시 */ }
    }
    res.set("Cache-Control", "public, max-age=60, s-maxage=300");
    res.type("html").send(cardLinkPage({ title, desc, site, id: r.id, img, appUrl }));
  });
}
