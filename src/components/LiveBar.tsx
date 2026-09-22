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

function pos(): Promise<GeolocationPosition> {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("이 브라우저는 위치를 쓸 수 없어요."));
    navigator.geolocation.getCurrentPosition(res, (e) => {
      rej(new Error(e.code === e.PERMISSION_DENIED
        ? "위치 권한이 필요해요. 공원에 있는 사람만 누를 수 있게 하려고요."
        : "위치를 못 잡았어요. 하늘이 보이는 곳에서 다시 눌러주세요."));
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });
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
      await sendPing({ kind, lat: p.coords.latitude, lng: p.coords.longitude });
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
