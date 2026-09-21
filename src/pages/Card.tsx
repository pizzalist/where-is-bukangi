import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Status, Submission } from "../lib/types";
import { loadSubmissions } from "../lib/store";
import { drawCert } from "../lib/cert";
import HoloCard from "../components/HoloCard";
import { RARITY_META, RARITY_ORDER } from "../lib/rarity";
import { useTiltAvailable } from "../lib/tilt";

const SITE = "bukang.kr";

export default function Card({ status, focus, onTiers }: { status: Status; focus?: string | null; onTiers?: () => void }) {
  const subs = loadSubmissions();
  const [copied, setCopied] = useState(false);
  const tilt = useTiltAvailable();
  const mine = subs;
  const initial = focus ? subs.find((s) => s.id === focus) : mine[0];
  const [sel, setSel] = useState<Submission | undefined>(initial);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [png, setPng] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(!focus);
  useEffect(() => { if (focus) { setRevealed(false); const t = setTimeout(() => setRevealed(true), 1400); return () => clearTimeout(t); } }, [focus]);
  const owned = new Set(subs.map((s) => s.rarity ?? "common"));

  useEffect(() => {
    if (!sel || !canvasRef.current) { setPng(null); return; }
    const zoneName = status.zones.find((z) => z.code === sel.zone)?.name ?? "";
    (async () => {
      try { await (document as Document & { fonts?: FontFaceSet }).fonts?.load("120px 'Jua'"); } catch { /* ignore */ }
      await drawCert(canvasRef.current!, { type: sel.type, ordinal: sel.ordinal ?? 0, takenAt: sel.takenAt, zone: sel.zone, zoneName, photoDataUrl: sel.photoDataUrl, siteUrl: SITE, rarity: sel.rarity ?? "common" });
      setPng(canvasRef.current!.toDataURL("image/png"));
    })();
  }, [sel, status.zones]);

  const cardUrl = sel ? `${location.href.split("#")[0]}#/card/${sel.id}` : "";

  function copyLink() {
    if (!cardUrl) return;
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1800); };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(cardUrl).then(done).catch(() => fallbackCopy(cardUrl, done));
    } else fallbackCopy(cardUrl, done);
  }

  function fallbackCopy(text: string, done: () => void) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch { /* 수동 복사 안내 */ }
    document.body.removeChild(ta);
  }

  async function share() {
    if (!png) return;
    const blob = await (await fetch(png)).blob();
    const file = new File([blob], "bukang-cert.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file], title: "부캉이 인증", text: `부캉이 ${sel?.type === "seen" ? "목격" : "방문"} 인증 · ${SITE}` }); return; } catch { /* fallthrough */ }
    }
    const a = document.createElement("a"); a.href = png; a.download = "bukang-cert.png"; a.click();
  }

  return (
    <div className="page">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 style={{ fontSize: "1.6rem", margin: "1.2rem 0 0.2rem" }}>내 카드</h1>
        {!sel && mine.length === 0 && (
          <div className="card">아직 카드가 없어요. 아래 "카드 뽑기"에서 사진 한 장 올려보세요.</div>
        )}
        {sel && (
          <div className="cert-wrap">
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              {sel.status === "approved" && <span className="pill ok">상황판에 반영됨</span>}
              {sel.status === "pending" && <span className="pill">상황판 반영은 운영자 확인 후</span>}
              {sel.status === "rejected" && <span className="pill auto">상황판 제외 (카드는 유효)</span>}
            </div>
            <div className={`reveal${revealed ? " on" : ""}`}>
              <div className="reveal-back"><span style={{ fontFamily: "Jua", color: "#fff", fontSize: "1.4rem" }}>뽑는 중…</span></div>
              <div className="reveal-front">
            <HoloCard id={sel.id} type={sel.type} ordinal={sel.ordinal ?? 0} takenAt={sel.takenAt} zone={sel.zone} zoneName={status.zones.find((z) => z.code === sel.zone)?.name ?? ""} photoDataUrl={sel.photoDataUrl} rarity={sel.rarity ?? "common"} interactive />
              </div>
            </div>
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={revealed ? { opacity: 1, scale: 1 } : {}} transition={{ type: "spring", stiffness: 300, damping: 18 }} style={{ textAlign: "center" }}>
              <span className={`tier-dot tier-dot-${sel.rarity ?? "common"}`} style={{ display: "inline-flex", padding: "0.4rem 0.9rem", fontSize: "1rem" }}><span>{RARITY_META[sel.rarity ?? "common"].symbol}</span>&nbsp;{RARITY_META[sel.rarity ?? "common"].label}</span>
              <div style={{ fontSize: "0.8rem", color: "var(--ink-3)", marginTop: "0.3rem" }}>손가락으로 문질러보세요{tilt && " · 폰을 기울여도 돼요"}</div>
            </motion.div>
            <canvas ref={canvasRef} className="cert-canvas" style={{ display: "none" }} />
            <div className="share-row">
              <button className="btn secondary icon-btn" onClick={copyLink} title="카드 주소 복사">
                {copied ? "복사됨" : "링크 복사"}
              </button>
              <button className="btn" onClick={share} disabled={!png}>공유 / 저장</button>
            </div>
            <div className="urlbox">
              <span className="ub-label">이 카드 주소</span>
              <input readOnly value={cardUrl} onFocus={(e) => e.currentTarget.select()} />
            </div>
          </div>
        )}
        <div className="section">
          <div className="section-head"><h2>내 컬렉션</h2><button className="more" onClick={onTiers}>등급 설명</button></div>
          <div className="tier-strip">
            {RARITY_ORDER.map((r) => (
              <button key={r} className={`tier-dot tier-dot-${r}${owned.has(r) ? "" : " off"}`} onClick={onTiers}>
                <span>{owned.has(r) ? RARITY_META[r].symbol : "?"}</span>
                <small>{RARITY_META[r].label}</small>
              </button>
            ))}
          </div>
        </div>
        {mine.length > 1 && (
          <div className="section">
            <div className="section-head"><h2>지난 카드</h2></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.5rem" }}>
              {mine.map((s) => (
                <button key={s.id} className="card" style={{ padding: 0, overflow: "hidden", aspectRatio: "4/5", border: sel?.id === s.id ? "2px solid var(--sky-deep)" : undefined }} onClick={() => setSel(s)}>
                  {s.photoDataUrl ? <img src={s.photoDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span className="mono">#{s.ordinal}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

