import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Status, Submission } from "../lib/types";
import { loadSubmissions } from "../lib/store";
import { drawCert } from "../lib/cert";
import HoloCard from "../components/HoloCard";
import { RARITY_META } from "../lib/rarity";

const SITE = "bukang.kr";

export default function Card({ status, focus }: { status: Status; focus?: string | null }) {
  const subs = loadSubmissions();
  const mine = subs;
  const initial = focus ? subs.find((s) => s.id === focus) : mine[0];
  const [sel, setSel] = useState<Submission | undefined>(initial);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [png, setPng] = useState<string | null>(null);

  useEffect(() => {
    if (!sel || !canvasRef.current) { setPng(null); return; }
    const zoneName = status.zones.find((z) => z.code === sel.zone)?.name ?? "";
    (async () => {
      try { await (document as Document & { fonts?: FontFaceSet }).fonts?.load("120px 'Jua'"); } catch { /* ignore */ }
      await drawCert(canvasRef.current!, { type: sel.type, ordinal: sel.ordinal ?? 0, takenAt: sel.takenAt, zone: sel.zone, zoneName, photoDataUrl: sel.photoDataUrl, siteUrl: SITE, rarity: sel.rarity ?? "common" });
      setPng(canvasRef.current!.toDataURL("image/png"));
    })();
  }, [sel, status.zones]);

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
          <div className="card">아직 카드가 없어요. <a href="#/certify">인증받기</a>에서 사진 한 장 올려보세요.</div>
        )}
        {sel && (
          <div className="cert-wrap">
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              {sel.status === "approved" && <span className="pill ok">상황판에 반영됨</span>}
              {sel.status === "pending" && <span className="pill">상황판 반영은 운영자 확인 후</span>}
              {sel.status === "rejected" && <span className="pill auto">상황판 제외 (카드는 유효)</span>}
            </div>
            <HoloCard type={sel.type} ordinal={sel.ordinal ?? 0} takenAt={sel.takenAt} zone={sel.zone} zoneName={status.zones.find((z) => z.code === sel.zone)?.name ?? ""} photoDataUrl={sel.photoDataUrl} rarity={sel.rarity ?? "common"} interactive />
            <div style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--ink-2)" }}>
              <b style={{ fontFamily: "Jua" }}>{RARITY_META[sel.rarity ?? "common"].symbol} {RARITY_META[sel.rarity ?? "common"].label}</b> · 손가락으로 문지르거나 폰을 기울여봐 · <a href="#/tiers">등급 보기</a>
            </div>
            <TiltButton />
            <canvas ref={canvasRef} className="cert-canvas" style={{ display: "none" }} />
            <div className="btn-row">
              <button className="btn" onClick={share} disabled={!png}>공유 / 저장</button>
              <a className="btn secondary" href="#/certify">하나 더</a>
            </div>
            <p className="disclaimer">공유하면 이미지로 저장돼요. 홀로 효과는 이 페이지에서만 움직여요.</p>
          </div>
        )}
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

function TiltButton() {
  const D = (window as Window & { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
  if (!D?.requestPermission) return null;
  return <button className="btn secondary" onClick={() => D.requestPermission!().catch(() => null)}>기울이기 효과 켜기 (iPhone)</button>;
}
