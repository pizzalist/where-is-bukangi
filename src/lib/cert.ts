import type { CertType, ZoneCode } from "./types";
import { fmtDate, fmtTime } from "./store";
import { RARITY_META, type Rarity } from "./rarity";

export interface CertInput {
  type: CertType;
  ordinal: number;
  takenAt: string;
  zone?: ZoneCode;
  zoneName?: string;
  photoDataUrl?: string;
  siteUrl: string;
  rarity?: Rarity;
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

/** 귀여운 부캉이 스티커. (x,y)는 몸통 왼쪽 끝, s는 스케일 */
function drawShark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  // 흰 테두리(스티커 느낌)
  ctx.lineJoin = "round"; ctx.lineWidth = 14; ctx.strokeStyle = "#fff";
  const body = () => { ctx.beginPath(); ctx.moveTo(0, 60); ctx.bezierCurveTo(30, 5, 130, -5, 185, 58); ctx.bezierCurveTo(130, 115, 30, 110, 0, 60); ctx.closePath(); };
  const fin = () => { ctx.beginPath(); ctx.moveTo(88, 22); ctx.lineTo(112, -22); ctx.lineTo(130, 28); ctx.closePath(); };
  const tail = () => { ctx.beginPath(); ctx.moveTo(180, 58); ctx.lineTo(228, 18); ctx.lineTo(218, 58); ctx.lineTo(228, 98); ctx.closePath(); };
  const pfin = () => { ctx.beginPath(); ctx.moveTo(70, 82); ctx.lineTo(56, 112); ctx.lineTo(96, 92); ctx.closePath(); };
  for (const f of [tail, fin, pfin, body]) { f(); ctx.stroke(); }
  ctx.fillStyle = "#8fd3f1"; tail(); ctx.fill(); fin(); ctx.fill(); pfin(); ctx.fill();
  ctx.fillStyle = "#a9def7"; body(); ctx.fill();
  // 배
  ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.beginPath(); ctx.moveTo(16, 66); ctx.bezierCurveTo(50, 92, 120, 94, 170, 64); ctx.bezierCurveTo(120, 84, 50, 84, 16, 66); ctx.fill();
  // 눈
  ctx.fillStyle = "#0f2a3a"; ctx.beginPath(); ctx.arc(44, 52, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(47, 49, 3.2, 0, Math.PI * 2); ctx.fill();
  // 볼터치
  ctx.fillStyle = "rgba(255,120,140,0.55)"; ctx.beginPath(); ctx.ellipse(30, 68, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  // 입
  ctx.strokeStyle = "#0f2a3a"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(22, 70); ctx.quadraticCurveTo(34, 80, 48, 70); ctx.stroke();
  // 아가미
  ctx.strokeStyle = "#7fc6ea"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(70, 46); ctx.quadraticCurveTo(74, 56, 70, 66); ctx.moveTo(78, 44); ctx.quadraticCurveTo(83, 56, 78, 70); ctx.stroke();
  ctx.restore();
}

function drawBubbles(ctx: CanvasRenderingContext2D) {
  const pts = [[80, 120, 9], [180, 60, 5], [980, 90, 12], [1020, 200, 6], [60, 1240, 7], [140, 1300, 11], [960, 1280, 8], [1030, 1200, 5], [520, 40, 4]];
  for (const [x, y, r] of pts) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.stroke();
  }
}

function drawWaves(ctx: CanvasRenderingContext2D, W: number, y: number, color: string, amp = 10) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, y);
  for (let x = 0; x <= W; x += 10) ctx.lineTo(x, y + Math.sin(x / 60) * amp);
  ctx.lineTo(W, y + 400); ctx.lineTo(0, y + 400); ctx.closePath(); ctx.fill();
}

function drawStamp(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.14);
  ctx.font = "400 40px 'Jua', 'Noto Sans KR', sans-serif";
  const w = ctx.measureText(text).width + 56;
  roundRect(ctx, -w / 2, -34, w, 68, 34);
  ctx.fillStyle = "#fff"; ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = color; ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 0, 2);
  ctx.restore();
}

/** 1080x1350 인스타 세로 카드. 귀엽고 공유되게. */
export async function drawCert(canvas: HTMLCanvasElement, input: CertInput) {
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const accent = "#ff6b57";

  // 배경
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#5fcdf6"); g.addColorStop(0.55, "#2fb5e8"); g.addColorStop(1, "#0b5c8a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawBubbles(ctx);
  drawWaves(ctx, W, 1010, "rgba(255,255,255,0.10)", 14);
  drawWaves(ctx, W, 1050, "rgba(11,92,138,0.35)", 10);

  // 상단 문구
  ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.font = "400 58px 'Jua', 'Noto Sans KR', sans-serif";
  ctx.fillText("부캉이 봤다!!", 70, 118);
  ctx.font = "500 28px 'Noto Sans KR', sans-serif"; ctx.globalAlpha = 0.9;
  ctx.fillText("부산 북항 친수공원", 72, 160); ctx.globalAlpha = 1;

  // 폴라로이드 사진 프레임 (살짝 기울임)
  const px = 90, py = 200, pw = 900, ph = 720;
  ctx.save();
  ctx.translate(px + pw / 2, py + ph / 2); ctx.rotate(-0.02); ctx.translate(-(px + pw / 2), -(py + ph / 2));
  ctx.shadowColor = "rgba(11,92,138,0.35)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
  roundRect(ctx, px - 22, py - 22, pw + 44, ph + 44, 34); ctx.fillStyle = "#fff"; ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.save(); roundRect(ctx, px, py, pw, ph, 22); ctx.clip();
  if (input.photoDataUrl) {
    try {
      const img = await loadImage(input.photoDataUrl);
      const s = Math.max(pw / img.width, ph / img.height);
      const dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
    } catch { ctx.fillStyle = "#bfe6f7"; ctx.fillRect(px, py, pw, ph); }
  } else { ctx.fillStyle = "#bfe6f7"; ctx.fillRect(px, py, pw, ph); }
  ctx.restore();
  ctx.restore();

  // 등급 프레임 + 정적 홀로 띠 (PNG는 움직이지 않으므로 고정 각도)
  const rar = input.rarity ?? "common";
  const rm = RARITY_META[rar];
  ctx.save(); ctx.lineWidth = 16; ctx.strokeStyle = rm.frame2; roundRect(ctx, px - 22, py - 22, pw + 44, ph + 44, 34); ctx.stroke(); ctx.restore();
  const group = rar === "common" || rar === "uncommon" ? "none" : rar === "rare" ? "silver" : rar === "gold" ? "gold" : "rainbow";
  if (group !== "none") {
    ctx.save(); roundRect(ctx, px - 22, py - 22, pw + 44, ph + 44, 34); ctx.clip();
    const hg = ctx.createLinearGradient(px, py, px + pw, py + ph);
    if (group === "rainbow") ["#ff7773", "#ffed5f", "#a8ff5f", "#83fff7", "#7894ff", "#d875ff"].forEach((c, i) => hg.addColorStop(0.1 + i * 0.14, c));
    else if (group === "gold") { hg.addColorStop(0.15, "#7a5a00"); hg.addColorStop(0.4, "#ffe27a"); hg.addColorStop(0.6, "#b8860b"); hg.addColorStop(0.85, "#fff2b0"); }
    else { hg.addColorStop(0.25, "#dfe9f5"); hg.addColorStop(0.5, "#ffffff"); hg.addColorStop(0.75, "#9cc8ff"); }
    hg.addColorStop(0, "rgba(255,255,255,0)"); hg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalAlpha = rar === "rainbow" || rar === "gold" ? 0.55 : rar === "holo" || rar === "galaxy" || rar === "fullart" ? 0.4 : 0.35;
    ctx.globalCompositeOperation = group === "gold" ? "overlay" : "screen";
    ctx.fillStyle = hg; ctx.fillRect(px - 22, py - 22, pw + 44, ph + 44); ctx.restore();
  }
  // 도장
  drawStamp(ctx, 880, 232, "부캉이 인증", accent);
  drawStamp(ctx, 210, 232, `${rm.symbol} ${rm.label}`, group === "none" ? "#0b5c8a" : group === "silver" ? "#5b7fa6" : group === "gold" ? "#a67c00" : "#ff5fa2");

  // 부캉이 스티커 (사진 오른쪽 아래에 겹치게)
  drawShark(ctx, 700, 830, 1.35, -0.12);

  // 말풍선
  ctx.save();
  const bx = 96, by = 880, bw = 300, bh = 78;
  roundRect(ctx, bx, by, bw, bh, 39); ctx.fillStyle = "#fff"; ctx.fill();
  ctx.beginPath(); ctx.moveTo(bx + 60, by + bh); ctx.lineTo(bx + 80, by + bh + 24); ctx.lineTo(bx + 100, by + bh); ctx.fill();
  ctx.fillStyle = "#0f2a3a"; ctx.font = "400 34px 'Jua', 'Noto Sans KR', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("진짜 봤음 ㄹㅇ", bx + bw / 2, by + bh / 2 + 2);
  ctx.restore();

  // 순번
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#fff";
  ctx.font = "400 150px 'Jua', 'Noto Sans KR', sans-serif";
  ctx.shadowColor = "rgba(11,92,138,0.5)"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 6;
  ctx.fillText(`${input.ordinal.toLocaleString()}`, 70, 1160);
  ctx.shadowColor = "transparent";
  const nw = ctx.measureText(`${input.ordinal.toLocaleString()}`).width;
  ctx.font = "400 56px 'Jua', 'Noto Sans KR', sans-serif";
  ctx.fillText("번째 인증", 70 + nw + 18, 1160);

  // 시각·구역
  ctx.font = "600 38px 'IBM Plex Mono', monospace";
  ctx.fillText(`${fmtDate(input.takenAt)} ${fmtTime(input.takenAt)}`, 72, 1228);
  ctx.font = "400 36px 'Jua', 'Noto Sans KR', sans-serif";
  ctx.fillText(input.zone ? `${input.zoneName}` : "위치 미확인", 72, 1280);

  // 우하단 사이트·해시태그
  ctx.textAlign = "right";
  ctx.font = "700 30px 'Noto Sans KR', sans-serif"; ctx.fillText(input.siteUrl, W - 70, 1232);
  ctx.font = "500 26px 'Noto Sans KR', sans-serif"; ctx.globalAlpha = 0.85;
  ctx.fillText("#부캉이 #북항상어 #부산", W - 70, 1278); ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}
