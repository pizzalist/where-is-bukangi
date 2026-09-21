import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ZoneCode } from "../lib/types";
import { fmtDate, fmtTime } from "../lib/store";
import { RARITY_META } from "../lib/rarity";
import { ZONES } from "../lib/zones";
import { adminApi, getToken, setToken, type QueueItem } from "../lib/admin";

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Admin() {
  const [token, setTok] = useState(getToken());
  const [authed, setAuthed] = useState(false);
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [zoneOf, setZoneOf] = useState<Record<string, ZoneCode>>({});

  const load = useCallback(async () => {
    try {
      const q = await adminApi.queue();
      setQueue(q); setAuthed(true); setErr("");
    } catch (e) {
      if ((e as Error).message === "UNAUTHORIZED") { setAuthed(false); setErr("토큰이 맞지 않아요."); }
      else setErr("서버에 닿지 않아요. 로컬 서버가 떠 있는지 확인해주세요.");
      setQueue(null);
    }
  }, []);

  useEffect(() => { if (getToken()) load(); }, [load]);

  async function decide(it: QueueItem, action: "approve" | "reject") {
    setBusy(it.id);
    try {
      await adminApi.decide(it.id, action, zoneOf[it.id] ?? it.zone ?? undefined);
      setQueue((q) => (q ? q.filter((x) => x.id !== it.id) : q));
    } catch { setErr("처리하지 못했어요."); }
    setBusy(null);
  }

  if (!authed) {
    return (
      <div className="page">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ paddingTop: "2.5rem", display: "grid", gap: "0.8rem" }}>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>운영자</h1>
          <p style={{ color: "var(--ink-2)", margin: 0, fontSize: "0.9rem" }}>운영자 토큰을 넣어주세요. 이 기기에만 저장돼요.</p>
          <input className="pickrow" style={{ padding: "0.8rem 1rem", borderRadius: 14, border: "1.5px solid var(--line)" }}
            type="password" placeholder="ADMIN_TOKEN" value={token}
            onChange={(e) => setTok(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setToken(token), load())} />
          <button className="btn" onClick={() => { setToken(token); load(); }}>들어가기</button>
          {err && <div className="alert warn">{err}</div>}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="page">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="section-head" style={{ marginTop: "1.2rem" }}>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>운영</h1>
          <button className="more" onClick={() => { setToken(""); setAuthed(false); setTok(""); }}>나가기</button>
        </div>
        <p style={{ color: "var(--ink-2)", marginTop: 0, fontSize: "0.88rem" }}>
          승인하면 <b>오늘의 기록</b>과 <b>명예의 전당</b>에 바로 올라가요. 사람이 찍힌 사진은 반려해주세요.
        </p>
        {err && <div className="alert warn">{err}</div>}

        <div className="stat-row">
          <div className="stat"><b>{queue?.length ?? "–"}</b><span>승인 대기</span></div>
          <button className="stat" onClick={load}><b>↻</b><span>새로고침</span></button>
        </div>

        <ObservationForm onDone={load} />

        <div className="section">
          <div className="section-head"><h2>승인 대기</h2></div>
          {queue === null && <div className="card" style={{ color: "var(--ink-3)" }}>불러오는 중</div>}
          {queue?.length === 0 && <div className="card" style={{ color: "var(--ink-3)" }}>비어 있음</div>}
          <AnimatePresence>
            {queue?.map((it) => (
              <motion.div key={it.id} className="queue-item" style={{ marginBottom: "0.5rem" }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 40 }}>
                {it.photo ? <a href={it.photo} target="_blank" rel="noreferrer"><img src={it.photo} alt="" /></a>
                  : <div style={{ width: 72, height: 72, borderRadius: 10, background: "var(--foam-2)" }} />}
                <div>
                  <div style={{ fontWeight: 700 }}>
                    <span className="mono">#{it.ordinal}</span> · {RARITY_META[it.rarity].label}
                  </div>
                  <div className="q-meta">
                    촬영 <span className="mono">{fmtDate(it.takenAt)} {fmtTime(it.takenAt)}</span>
                    {it.lat ? " · GPS 있음" : " · GPS 없음"}
                  </div>
                  <div className="q-actions">
                    <select value={zoneOf[it.id] ?? it.zone ?? ""} onChange={(e) => setZoneOf((z) => ({ ...z, [it.id]: e.target.value as ZoneCode }))}>
                      <option value="">구역 없음</option>
                      {ZONES.map((z) => <option key={z.code} value={z.code}>{z.code} {z.name}</option>)}
                    </select>
                    <button className="ok" disabled={busy === it.id} onClick={() => decide(it, "approve")}>공개</button>
                    <button className="no" disabled={busy === it.id} onClick={() => decide(it, "reject")}>반려</button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function ObservationForm({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState<"seen" | "miss">("seen");
  const [zone, setZone] = useState<ZoneCode | "">("B");
  const [at, setAt] = useState(toLocalInput(new Date()));
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  async function submit() {
    try {
      await adminApi.observation({ kind, zone: zone || null, at: new Date(at).toISOString(), note: note || (kind === "miss" ? "현장 관측, 미목격" : "운영자 현장 관측") });
      setMsg("올렸어요"); setNote(""); onDone(); setTimeout(() => setMsg(""), 1800);
    } catch { setMsg("실패했어요"); }
  }

  return (
    <div className="section">
      <div className="section-head"><h2>현장 관측 입력</h2></div>
      <div className="card" style={{ display: "grid", gap: "0.5rem" }}>
        <div className="seg">
          <button className={kind === "seen" ? "on" : ""} onClick={() => setKind("seen")}>봤음</button>
          <button className={kind === "miss" ? "on" : ""} onClick={() => setKind("miss")}>못 봄</button>
        </div>
        <label className="pickrow"><span className="pl">시각</span>
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></label>
        <label className="pickrow"><span className="pl">구역</span>
          <select value={zone} onChange={(e) => setZone(e.target.value as ZoneCode | "")}>
            <option value="">없음</option>
            {ZONES.map((z) => <option key={z.code} value={z.code}>{z.code} {z.name}</option>)}
          </select></label>
        <label className="pickrow"><span className="pl">메모</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "miss" ? "20:10~20:40 관측, 미목격" : "운영자 현장 관측"} /></label>
        <button className="btn" onClick={submit}>기록 올리기</button>
        {msg && <div className="alert ok">{msg}</div>}
      </div>
    </div>
  );
}
