import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sendPing, track } from "../lib/api";
import type { Status } from "../lib/types";

/**
 * 현장 탭. 사진 없이 "지금 보이는지"만 한 번에 알린다.
 * 탭 하나는 약한 신호라 신뢰 장치를 넷 둔다.
 *  1) 공원 안(GPS)에서만 눌린다  2) 같은 기기는 10분에 한 번
 *  3) 한 명이면 작게, 3명 이상이면 크게  4) 15분 지나면 사라진다
 * 카드도 안 나오고 타임라인에도 안 들어간다. 히어로의 "지금" 한 줄만 바꾼다.
 */
const STRONG = 3;

/** 앱 안에 내장된 브라우저인가. 여기선 위치가 막히거나 아주 느린 경우가 많다.
    UA는 앱·기기마다 달라 놓치는 경우가 있으니, 실패했을 때는 이 판정과 무관하게 같은 안내를 준다 */
function inAppBrowser() {
  const ua = navigator.userAgent || "";
  return /Instagram|FBAN|FBAV|FB_IAB|Threads|KAKAOTALK|NAVER|Daum|Line\/|; wv\)|\bwv\b/i.test(ua);
}

function once(opts: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, opts));
}

/** 권한을 사용자가 거부한 경우와, 그 밖의 이유로 못 잡은 경우를 구분해서 던진다 */
export class GeoError extends Error {
  kind: "denied" | "unavailable";
  constructor(kind: "denied" | "unavailable", message: string) { super(message); this.kind = kind; }
}

/**
 * 위치 잡기. 정밀(GPS) → 대략(기지국·와이파이) 순으로 두 번 시도한다.
 * 앱 내장 브라우저는 둘 다 실패하는 경우가 있어, 그때는 화면에서 다른 브라우저로 열도록 안내한다.
 */
async function pos(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) throw new GeoError("unavailable", "이 브라우저는 위치를 쓸 수 없어요.");
  try {
    return await once({ enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 });
  } catch (e1) {
    const a = e1 as GeolocationPositionError;
    if (a.code === a.PERMISSION_DENIED) throw new GeoError("denied", "위치 권한이 꺼져 있어요.");
    try {
      return await once({ enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
    } catch (e2) {
      const b = e2 as GeolocationPositionError;
      if (b.code === b.PERMISSION_DENIED) throw new GeoError("denied", "위치 권한이 꺼져 있어요.");
      throw new GeoError("unavailable", "위치를 확인하지 못했어요.");
    }
  }
}

export default function LiveBar({ live, onDone }: { live: Status["live"]; onDone: () => void }) {
  const [busy, setBusy] = useState<"seen" | "miss" | null>(null);
  const [fail, setFail] = useState<null | { kind: "denied" | "unavailable" | "other"; text: string }>(null);
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState<"seen" | "miss" | null>(null);

  function copyLink() {
    const url = `${location.origin}/`;
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done).catch(done);
    else {
      const t = document.createElement("textarea");
      t.value = url; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); done(); } catch { /* 수동 복사 */ }
      document.body.removeChild(t);
    }
  }

  async function tap(kind: "seen" | "miss") {
    if (busy) return;
    setBusy(kind); setFail(null);
    try {
      const p = await pos();
      await sendPing({ kind, lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy });
      setDone(kind);
      onDone();
    } catch (e) {
      if (e instanceof GeoError) { if (e.kind === "unavailable") track("geo_fail"); setFail({ kind: e.kind, text: e.message }); }
      else setFail({ kind: "other", text: e instanceof Error ? e.message : "지금은 보낼 수 없어요." });
    } finally { setBusy(null); }
  }

  const seen = live?.seen ?? 0, miss = live?.miss ?? 0;
  const strong = seen >= STRONG;

  return (
    <section className="livebar">
      <AnimatePresence>
        {live && (seen > 0 || miss > 0) && (
          <motion.div className={`live-state${strong ? " strong" : ""}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {strong
              ? <><b>지금 보이는 중</b><span>{live.windowMin}분 안에 {seen}명이 확인</span></>
              : seen > 0
                ? <><b>방금 목격 신호</b><span>{live.windowMin}분 안에 {seen}명{miss > 0 ? ` · 안 보인다는 사람 ${miss}명` : ""}</span></>
                : <><b>지금은 안 보이나 봐요</b><span>{live.windowMin}분 안에 {miss}명이 못 봤다고 했어요</span></>}
          </motion.div>
        )}
      </AnimatePresence>

      {done ? (
        <div className="live-thanks">알려줘서 고마워요. 다른 사람들 화면에 바로 반영됐어요.</div>
      ) : (
        <>
          <div className="live-q">지금 공원에서 <b>상어 부캉이</b>가 보이나요?</div>
          <div className="live-sub">공원에 계신 분만 누를 수 있어요</div>
          {inAppBrowser() && <div className="live-hint">앱 안에서 열린 화면이라 위치가 안 잡힐 수 있어요. 안 되면 사파리나 크롬으로 열어주세요.</div>}
          <div className="live-btns">
            <button className="live-yes" onClick={() => tap("seen")} disabled={!!busy}>{busy === "seen" ? "보내는 중…" : "지금 보여요"}</button>
            <button className="live-no" onClick={() => tap("miss")} disabled={!!busy}>{busy === "miss" ? "보내는 중…" : "안 보여요"}</button>
          </div>
        </>
      )}
      {fail?.kind === "other" && <div className="live-msg">{fail.text}</div>}
      {fail?.kind === "denied" && (
        <div className="live-msg">
          <b>위치 권한이 꺼져 있어요.</b>
          <p>공원에 있는 사람만 누를 수 있게 하려고 위치를 확인해요. 브라우저 주소창 왼쪽에서 위치를 허용해주세요.</p>
        </div>
      )}
      {fail?.kind === "unavailable" && (
        <div className="live-msg">
          <b>위치를 확인하지 못했어요.</b>
          <p>카톡·인스타·스레드 안에서 열린 화면은 위치를 쓸 수 없어요. 아래 버튼으로 주소를 복사한 뒤 <b>사파리나 크롬</b>에 붙여넣어 주세요.</p>
          <button className="live-copy" onClick={copyLink}>{copied ? "복사됐어요" : "bukangi.com 주소 복사"}</button>
        </div>
      )}
    </section>
  );
}
