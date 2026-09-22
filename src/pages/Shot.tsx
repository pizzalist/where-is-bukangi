import { useEffect, useState } from "react";
import HoloCard from "../components/HoloCard";
import { fetchCard } from "../lib/api";
import type { Rarity } from "../lib/rarity";
import type { ZoneCode } from "../lib/types";

interface ShotData { id: string; ordinal: number; rarity: Rarity; zone?: ZoneCode | null; zoneName?: string; takenAt: string; photo?: string | null; site?: string }

/**
 * 서버가 카드 PNG를 만들 때 여는 화면. 카드 하나만, 투명 배경, 고정 각도.
 * 데이터는 ?d=<base64url JSON> 으로 받는다 (API 왕복 없이). 없으면 id로 서버에서 가져온다.
 * 준비가 끝나면 .shot-wrap 에 data-ready="1" 을 단다. 서버는 그걸 기다렸다가 찍는다.
 */
export default function Shot({ id }: { id?: string }) {
  const [d, setD] = useState<ShotData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("shot");
    // jpg는 투명 배경이 안 되니 카드 밖을 흰색 대신 옅은 하늘색으로 (bg=1)
    if (new URLSearchParams(location.search).get("bg") === "1") document.documentElement.classList.add("shot-bg");
    const q = new URLSearchParams(location.search).get("d");
    if (q) {
      try { setD(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(q.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))))); return; } catch { /* 아래로 */ }
    }
    if (id) fetchCard(id).then((r) => r && setD({ id: r.id, ordinal: r.ordinal, rarity: r.rarity, zone: r.zone as ZoneCode, zoneName: r.zoneName, takenAt: r.takenAt, photo: r.photo }));
    return () => document.documentElement.classList.remove("shot");
  }, [id]);

  useEffect(() => {
    if (!d) return;
    let alive = true;
    (async () => {
      const f = (document as Document & { fonts?: FontFaceSet }).fonts;
      try { await Promise.all(["900 20px 'Jua'", "700 16px 'Noto Sans KR'", "500 16px 'Noto Sans KR'", "600 14px 'IBM Plex Mono'"].map((s) => f?.load(s))); } catch { /* 폰트 없어도 찍는다 */ }
      // 사진 디코딩까지
      for (let i = 0; i < 100; i++) {
        const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(".shot-wrap img"));
        if (imgs.length && imgs.every((im) => im.complete && im.naturalWidth > 0)) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, [d]);

  if (!d) return null;
  return (
    <div className="shot-wrap" data-ready={ready ? "1" : "0"}>
      <HoloCard id={d.id} type="seen" ordinal={d.ordinal} takenAt={d.takenAt} zone={d.zone ?? undefined} zoneName={d.zoneName ?? ""} photoDataUrl={d.photo ?? undefined} rarity={d.rarity} site={d.site} fixed={{ mx: 36, my: 30 }} />
    </div>
  );
}
