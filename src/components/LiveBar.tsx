import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sendPing } from "../lib/api";
import type { Status } from "../lib/types";

/**
 * 현장 탭. 사진 없이 "지금 보이는지"만 한 번에 알린다.
 * 탭 하나는 약한 신호라 신뢰 장치를 넷 둔다.
 *  1) 공원 안(GPS)에서만 눌린다  2) 같은 기기는 10분에 한 번
 *  3) 한 명이면 작게, 3명 이상이면 크게  4) 15분 지나면 사라진다
 * 카드도 안 나오고 타임라인에도 안 들어간다. 히어로의 "지금" 한 줄만 바꾼다.
 */
const STRONG = 3;

/** 스레드·인스타 인앱 브라우저인가. 이 안에서는 위치가 막히거나 아주 느린 경우가 많다 */
function inAppBrowser() {
  const ua = navigator.userAgent || "";
  return /Instagram|FBAN|FBAV|FB_IAB|Threads|KAKAOTALK|NAVER\(inapp|Line\//i.test(ua);
}

function once(opts: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, opts));
}

/**
 * 위치 잡기. 인앱 브라우저(스레드·인스타·카톡)는 GPS를 못 쓰거나 아주 느려서
 * 정밀 → 대략 순으로 두 번 시도한다. 대략 위치는 오차가 크니 오차값을 같이 서버에 보낸다.
 */
async function pos(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) throw new Error("이 브라우저는 위치를 쓸 수 없어요. 사파리나 크롬으로 열어주세요.");
  try {
    return await once({ enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
  } catch (e1) {
    const err = e1 as GeolocationPositionError;
    if (err.code === err.PERMISSION_DENIED) {
      throw new Error(inAppBrowser()
        ? "위치 권한이 막혀 있어요. 오른쪽 위 ··· 에서 사파리/크롬으로 열면 됩니다."
        : "위치 권한이 필요해요. 공원에 있는 사람만 누를 수 있게 하려고요.");
    }
    // 정밀 실패 → 기지국·와이파이 기반으로 한 번 더 (느슨하게, 길게)
    try {
      return await once({ enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 });
    } catch (e2) {
      const err2 = e2 as GeolocationPositionError;
      if (err2.code === err2.PERMISSION_DENIED) {
        throw new Error("위치 권한이 필요해요. 공원에 있는 사람만 누를 수 있게 하려고요.");
      }
      throw new Error(inAppBrowser()
        ? "앱 안 브라우저라 위치를 못 잡았어요. 오른쪽 위 ··· 에서 사파리/크롬으로 열어주세요."
        : "위치를 못 잡았어요. 하늘이 보이는 곳에서 잠시 뒤 다시 눌러주세요.");
    }
  }
}

export default function LiveBar({ live, onDone }: { live: Status["live"]; onDone: () => void }) {
  const [busy, setBusy] = useState<"seen" | "miss" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<"seen" | "miss" | null>(null);

  async function tap(kind: "seen" | "miss") {
    if (busy) return;
    setBusy(kind); setMsg(null);
    try {
      const p = await pos();
      await sendPing({ kind, lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy });
      setDone(kind);
      onDone();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "지금은 보낼 수 없어요.");
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
          <div className="live-q">지금 공원에 있다면 알려주세요</div>
          {inAppBrowser() && <div className="live-hint">앱 안에서 열면 위치를 못 잡을 수 있어요. 안 되면 사파리나 크롬으로 열어주세요.</div>}
          <div className="live-btns">
            <button className="live-yes" onClick={() => tap("seen")} disabled={!!busy}>{busy === "seen" ? "보내는 중…" : "지금 보여요"}</button>
            <button className="live-no" onClick={() => tap("miss")} disabled={!!busy}>{busy === "miss" ? "보내는 중…" : "안 보여요"}</button>
          </div>
        </>
      )}
      {msg && <div className="live-msg">{msg}</div>}
    </section>
  );
}
