import { useEffect, useRef, useState } from "react";

/**
 * 사진 영역 지정. 세로 사진도 잘리지 않게 사용자가 직접 보일 부분을 정한다.
 * 드래그로 이동, 슬라이더로 확대.
 *
 * 결과는 4:3, 긴 변 2048px. 보관용이라 카드 표시(340px)보다 훨씬 크게 남긴다.
 * WebP를 지원하면 WebP(같은 화질에 JPEG의 절반 크기), 아니면 JPEG로 떨어진다.
 */
const ASPECT = 4 / 3;
const OUT_W = 2048;
const QUALITY = 0.90;

/** WebP를 실제로 인코딩할 수 있는지 (사파리 14+ 포함 대부분 가능) */
function encode(c: HTMLCanvasElement) {
  const webp = c.toDataURL("image/webp", QUALITY);
  if (webp.startsWith("data:image/webp")) return webp;
  return c.toDataURL("image/jpeg", QUALITY);
}

export default function CropBox({ src, onDone, onCancel }: { src: string; onDone: (full: string, thumb: string) => void; onCancel: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // 박스를 꽉 채우는 최소 배율
  const box = boxRef.current?.getBoundingClientRect();
  const baseScale = nat.w && box ? Math.max(box.width / nat.w, box.height / nat.h) : 1;
  const scale = baseScale * zoom;

  function clamp(x: number, y: number, s: number) {
    const b = boxRef.current?.getBoundingClientRect();
    if (!b || !nat.w) return { x, y };
    const dw = nat.w * s, dh = nat.h * s;
    const mx = Math.max(0, (dw - b.width) / 2);
    const my = Math.max(0, (dh - b.height) / 2);
    return { x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
  }

  useEffect(() => { setOff((o) => clamp(o.x, o.y, scale)); /* eslint-disable-next-line */ }, [zoom, nat]);

  function onDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const nx = drag.current.ox + (e.clientX - drag.current.x);
    const ny = drag.current.oy + (e.clientY - drag.current.y);
    setOff(clamp(nx, ny, scale));
  }
  function onUp() { drag.current = null; }

  function apply() {
    const b = boxRef.current?.getBoundingClientRect();
    if (!b || !imgRef.current) return;
    // 화면 좌표 → 원본 좌표
    const sx = (b.width / 2 - off.x) / scale - (b.width / scale) / 2;
    const sy = (b.height / 2 - off.y) / scale - (b.height / scale) / 2;
    const sw = b.width / scale, sh = b.height / scale;
    const c = document.createElement("canvas");
    c.width = OUT_W; c.height = Math.round(OUT_W / ASPECT);
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, c.width, c.height);
    // AI 1차 심사용 작은 썸네일 (384px). 비용·속도를 위해 따로 만든다.
    const tc = document.createElement("canvas");
    tc.width = 384; tc.height = Math.round(384 / ASPECT);
    tc.getContext("2d")!.drawImage(c, 0, 0, tc.width, tc.height);
    onDone(encode(c), tc.toDataURL("image/jpeg", 0.7));
  }

  return (
    <div className="cropwrap">
      <div className="crop-head">
        <b>보일 부분을 정해주세요</b>
        <span>끌어서 옮기고, 아래로 확대</span>
      </div>
      <div ref={boxRef} className="cropbox" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <img
          ref={imgRef} src={src} alt="" draggable={false}
          onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          style={{ width: nat.w * scale, height: nat.h * scale, transform: `translate(${off.x}px, ${off.y}px)` }}
        />
        <div className="crop-grid" />
      </div>
      <input className="croprange" type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
      <div className="btn-row">
        <button className="btn secondary" onClick={onCancel}>다시 고르기</button>
        <button className="btn" onClick={apply}>이대로</button>
      </div>
    </div>
  );
}
