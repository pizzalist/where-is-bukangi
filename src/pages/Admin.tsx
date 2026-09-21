import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Status, Submission } from "../lib/types";
import { loadSubmissions, updateSubmission, fmtTime, fmtDate } from "../lib/store";

/**
 * 드래프트 운영자 페이지. 실제 배포에서는 비밀번호 + 서버 API.
 * 자동 승격 규칙(에이전트): 서로 다른 제보의 EXIF 시각 15분 이내 + 같은 구역 사진 2장 이상 → 확인됨.
 */
export default function Admin(_: { status: Status }) {
  const [list, setList] = useState<Submission[]>(loadSubmissions());
  const pending = list.filter((s) => s.status === "pending");
  const approved = list.filter((s) => s.status === "approved");
  const rejected = list.filter((s) => s.status === "rejected");

  function approve(s: Submission) { setList(updateSubmission(s.id, { status: "approved" })); }
  function reject(s: Submission) { setList(updateSubmission(s.id, { status: "rejected" })); }

  // 자동 승격 후보: 같은 구역, 15분 이내, 사진 있음, 2건 이상
  const autoCandidates = pending.filter((a) => a.photoDataUrl && pending.some((b) => b.id !== a.id && b.photoDataUrl && b.zone === a.zone && Math.abs(new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime()) <= 15 * 60000));

  return (
    <div className="page">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 style={{ fontSize: "1.6rem", margin: "1.2rem 0 0.2rem" }}>운영</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 0, fontSize: "0.9rem" }}>카드는 이미 나갔어요. 여기서는 상황판에 올릴지만 정해요. (드래프트: 이 기기의 제보만)</p>

        <div className="stat-row">
          <div className="stat"><b>{pending.length}</b><span>대기</span></div>
          <div className="stat"><b>{approved.length}</b><span>상황판 반영</span></div>
          <div className="stat"><b>{autoCandidates.length}</b><span>자동 승격 후보</span></div>
        </div>

        <div className="section">
          <div className="section-head"><h2>상황판 반영 대기</h2><span className="more">최신순</span></div>
          <AnimatePresence>
            {pending.length === 0 && <div className="card" style={{ color: "var(--ink-3)" }}>비어 있음</div>}
            {pending.map((s) => (
              <motion.div key={s.id} className="queue-item" style={{ marginBottom: "0.5rem" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 40 }}>
                {s.photoDataUrl ? <img src={s.photoDataUrl} alt="" /> : <div style={{ width: 72, height: 72, borderRadius: 10, background: "var(--foam-2)", display: "grid", placeItems: "center", fontSize: "0.7rem", color: "var(--ink-3)" }}>링크</div>}
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {s.type === "seen" ? "목격" : "방문"} · {s.zone}구역 · <span className="mono">#{s.ordinal}</span>
                    {autoCandidates.includes(s) && <span className="pill ok" style={{ marginLeft: 6 }}>자동 승격 가능</span>}
                  </div>
                  <div className="q-meta">
                    관측 <span className="mono">{fmtDate(s.takenAt)} {fmtTime(s.takenAt)}</span> · 접수 <span className="mono">{fmtTime(s.submittedAt)}</span>
                    {s.exifGps ? " · GPS 있음" : " · GPS 없음"}
                    {s.link && <> · <a href={s.link} target="_blank" rel="noreferrer">링크</a></>}
                  </div>
                  <div className="q-actions">
                    <button className="ok" onClick={() => approve(s)}>상황판에 올리기</button>
                    <button className="no" onClick={() => reject(s)}>제외</button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="section">
          <div className="section-head"><h2>현장 관측 입력</h2></div>
          <div className="card" style={{ fontSize: "0.9rem", color: "var(--ink-2)" }}>
            "HH:MM~HH:MM 관측, 미목격" 기록은 여기서 넣어요. 드래프트에선 status.json을 직접 편집. 배포 버전에서 폼으로.
          </div>
        </div>

        {rejected.length > 0 && (
          <div className="section">
            <div className="section-head"><h2>반려 {rejected.length}</h2></div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
