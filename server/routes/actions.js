/**
 * 디스코드 알림의 서명 링크(/r/:id/:action/:sig)로 폰에서 공개·반려·뒤집기.
 */
import { db } from "../db.js";
import { verify as verifyAction } from "../notify.js";
import { limiter, clientIp } from "../http/middleware.js";
import { esc } from "../http/html.js";
import { invalidateStatus, invalidateHall } from "../status.js";

/* ---------- 디스코드 서명 링크로 공개/반려 ----------
   GET  /r/:id/:action/:sig → 확인 화면 (링크 미리보기 봇이 열어도 아무 일 없음)
   POST /r/:id/:action/:sig → 실제 처리. approve/reject는 pending일 때만 통한다
   undo: AI가 자동 공개·반려했고 사람이 아직 손대지 않았을 때만 반대로 뒤집는다 */
const qPendingOne = db.prepare(`SELECT id, ordinal, zone, photo, thumb, status FROM submissions WHERE id=?`);
const qAiVerdict = db.prepare(`SELECT verdict FROM screening WHERE id=?`);
/** undo 가능 여부: AI 결정(pass→approved, reject→rejected)과 현재 상태가 같을 때만. 뒤집을 상태를 돌려준다 */
function undoTarget(r) {
  const v = qAiVerdict.get(r.id)?.verdict;
  if (v === "pass" && r.status === "approved") return "rejected";
  if (v === "reject" && r.status === "rejected") return "approved";
  return null;
}
const KO = { approved: "공개", rejected: "반려", pending: "대기" };
const ACTIONS = ["approve", "reject", "undo"];
function actionPage(title, body) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;background:#f4f6f8;margin:0;padding:24px;color:#111}
.box{max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,.08)}
img{width:100%;border-radius:12px;display:block;margin:12px 0}h1{font-size:1.2rem;margin:0 0 6px}p{color:#555;margin:6px 0}
button{width:100%;padding:14px;border:0;border-radius:12px;font-size:1.05rem;font-weight:700;color:#fff;margin-top:12px}
.ok{background:#1a7f37}.no{background:#b42318}.muted{color:#888;font-size:.9rem}</style>
<div class="box">${body}</div>`;
}
const badLinkPage = () => actionPage("없는 링크", "<h1>없는 링크예요</h1>");
const noSubmissionPage = () => actionPage("없는 제보", "<h1>없는 제보예요</h1>");
const doneAlreadyPage = (r) => actionPage("이미 처리됨",
  `<h1>이미 처리된 제보예요</h1><p>현재 상태: ${esc(r.status === "approved" ? "공개" : "반려")}</p>`);
const cannotUndoBody = (r) => `<h1>이미 사람이 처리한 제보예요</h1><p>현재 상태: ${esc(KO[r.status] || r.status)}</p>`;

export function mountActionLinks(app) {
  const actionLimiter = limiter({ windowMs: 15 * 60e3, max: 60, key: clientIp });

  app.get("/r/:id/:action/:sig", actionLimiter, (req, res) => {
    const { id, action, sig } = req.params;
    res.set("Cache-Control", "no-store");
    if (!ACTIONS.includes(action) || !verifyAction(id, action, sig)) return res.status(404).send(badLinkPage());
    const r = qPendingOne.get(String(id).slice(0, 32));
    if (!r) return res.status(404).send(noSubmissionPage());
    if (action === "undo") {
      const to = undoTarget(r);
      if (!to) {
        return res.send(actionPage("뒤집을 수 없음",
          `${cannotUndoBody(r)}<p class="muted">AI가 자동 처리한 그대로일 때만 뒤집을 수 있어요.</p>`));
      }
      const img = r.thumb || r.photo;
      return res.send(actionPage(`No.${r.ordinal} 뒤집기`,
        `<h1>No.${esc(r.ordinal)} · AI가 자동 ${esc(KO[r.status])}했어요</h1>
       ${img ? `<img src="/photos/${esc(img)}" alt="">` : ""}
       <form method="post"><button class="${to === "approved" ? "ok" : "no"}">${
         to === "approved" ? "✅ 공개로 바꿀게요" : "❌ 반려로 바꿀게요"
       }</button></form>
       <p class="muted">AI 결정이 그대로일 때만 동작해요.</p>`));
    }
    if (r.status !== "pending") return res.send(doneAlreadyPage(r));
    const img = r.thumb || r.photo;
    res.send(actionPage(`No.${r.ordinal} ${action === "approve" ? "공개" : "반려"}`,
      `<h1>No.${esc(r.ordinal)} · ${r.zone ? esc(r.zone) + " 구역" : "구역 없음"}</h1>
     ${img ? `<img src="/photos/${esc(img)}" alt="">` : ""}
     <form method="post"><button class="${action === "approve" ? "ok" : "no"}">${
       action === "approve" ? "✅ 공개할게요" : "❌ 반려할게요"
     }</button></form>
     <p class="muted">이 링크는 이 제보가 대기 중일 때만 동작해요.</p>`));
  });

  app.post("/r/:id/:action/:sig", actionLimiter, (req, res) => {
    const { id, action, sig } = req.params;
    res.set("Cache-Control", "no-store");
    if (!ACTIONS.includes(action) || !verifyAction(id, action, sig)) return res.status(404).send(badLinkPage());
    const r = qPendingOne.get(String(id).slice(0, 32));
    if (!r) return res.status(404).send(noSubmissionPage());
    if (action === "undo") {
      const to = undoTarget(r);
      if (!to) return res.send(actionPage("뒤집을 수 없음", cannotUndoBody(r)));
      const u = db.prepare(`UPDATE submissions SET status=? WHERE id=? AND status=?`).run(to, r.id, r.status);
      invalidateStatus(); invalidateHall();
      return res.send(actionPage("완료",
        `<h1>${to === "approved" ? "공개로 바꿨어요 ✅" : "반려로 바꿨어요 ❌"}</h1>`
        + `<p>No.${esc(r.ordinal)}${u.changes ? "" : " (그 사이 상태가 바뀌어 적용하지 않았어요)"}</p>`));
    }
    if (r.status !== "pending") return res.send(doneAlreadyPage(r));
    const u = db.prepare(`UPDATE submissions SET status=? WHERE id=? AND status='pending'`)
      .run(action === "approve" ? "approved" : "rejected", r.id);
    invalidateStatus(); invalidateHall();
    res.send(actionPage("완료",
      `<h1>${action === "approve" ? "공개했어요 ✅" : "반려했어요 ❌"}</h1>`
      + `<p>No.${esc(r.ordinal)}${u.changes ? "" : " (이미 처리돼 있었어요)"}</p>`));
  });
}
