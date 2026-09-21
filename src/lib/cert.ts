import type { CertType, ZoneCode } from "./types";
import { fmtDate, fmtTime } from "./store";

export interface CertInput {
  type: CertType;
  ordinal: number;
  takenAt: string;
  zone: ZoneCode;
  zoneName: string;
  photoDataUrl?: string;
  siteUrl: string;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/** 1080x1350 인스타 세로 카드 */
export async function drawCert(canvas: HTMLCanvasElement, input: CertInput) {
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 배경 그라데이션
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#3fc0f0"); g.addColorStop(1, "#0b5c8a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // 사진
  const px = 60, py = 60, pw = W - 120, ph = 900;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 36); ctx.clip();
  if (input.photoDataUrl) {
    try {
      const img = await loadImage(input.photoDataUrl);
      const s = Math.max(pw / img.width, ph / img.height);
      const dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
    } catch { ctx.fillStyle = "#bfe6f7"; ctx.fillRect(px, py, pw, ph); }
  } else {
    ctx.fillStyle = "#bfe6f7"; ctx.fillRect(px, py, pw, ph);
  }
  // 하단 그늘
  const sh = ctx.createLinearGradient(0, py + ph - 320, 0, py + ph);
  sh.addColorStop(0, "rgba(15,42,58,0)"); sh.addColorStop(1, "rgba(15,42,58,0.78)");
  ctx.fillStyle = sh; ctx.fillRect(px, py + ph - 320, pw, 320);
  ctx.restore();

  // 사진 위 텍스트
  ctx.fillStyle = "#fff";
  ctx.font = "500 34px 'Noto Sans KR', sans-serif";
  ctx.fillText(input.type === "seen" ? "부캉이 목격 인증" : "부캉이 방문 인증", px + 48, py + ph - 200);
  ctx.font = "400 120px 'Jua', 'Noto Sans KR', sans-serif";
  ctx.fillText(`${input.ordinal.toLocaleString()}번째`, px + 44, py + ph - 80);

  // 하단 정보
  const iy = py + ph + 60;
  ctx.fillStyle = "#fff";
  ctx.font = "600 44px 'IBM Plex Mono', monospace";
  ctx.fillText(`${fmtDate(input.takenAt)}  ${fmtTime(input.takenAt)}`, 60, iy + 40);
  ctx.font = "400 40px 'Jua', 'Noto Sans KR', sans-serif";
  ctx.fillText(`${input.zone}구역 · ${input.zoneName}`, 60, iy + 110);
  ctx.font = "500 28px 'Noto Sans KR', sans-serif";
  ctx.globalAlpha = 0.85;
  ctx.fillText("부산 북항 친수공원 · 비공식 관람 정보", 60, iy + 170);
  ctx.fillText(input.siteUrl, 60, iy + 215);
  ctx.globalAlpha = 1;

  // 우측 하단 상어 아이콘 (단순 도형)
  ctx.save();
  ctx.translate(W - 250, iy + 40);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.moveTo(0, 60); ctx.bezierCurveTo(30, 10, 120, 0, 170, 56); ctx.bezierCurveTo(120, 110, 30, 100, 0, 60); ctx.fill();
  ctx.beginPath(); ctx.moveTo(90, 26); ctx.lineTo(112, -14); ctx.lineTo(126, 30); ctx.fill();
  ctx.beginPath(); ctx.moveTo(165, 56); ctx.lineTo(205, 20); ctx.lineTo(198, 56); ctx.lineTo(205, 92); ctx.fill();
  ctx.fillStyle = "#0f2a3a"; ctx.beginPath(); ctx.arc(34, 50, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
