/**
 * 제보: 사진 업로드(POST /api/submissions)와 카드 한 장 조회(GET /api/submissions/:id).
 */
import express from "express";
import fsp from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { db, PHOTOS, photoPath, nextOrdinal } from "../db.js";
import { roll, isRevival } from "../rarity.js";
import { MAX_PHOTO, photoUrl } from "../config.js";
import { ZONE_CODES } from "../zones.js";
import { limiter, clientIp, acquire, release } from "../http/middleware.js";
import { tally } from "../stats.js";

/* ---------- 제보 ---------- */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SIG = [
  {
    ext: "webp",
    test: (b) => b.length > 12
      && b.subarray(0, 4).toString("ascii") === "RIFF"
      && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
  { ext: "jpg",  test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png",  test: (b) => b.subarray(0, 8).equals(PNG_MAGIC) },
];
const DATA_URL = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$/;
const qLastSeen = db.prepare(`SELECT taken_at FROM submissions WHERE status='approved' ORDER BY taken_at DESC LIMIT 1`);
const insSub = db.prepare(`INSERT INTO submissions
  (id, ordinal, rarity, zone, taken_at, submitted_at, status, photo, lat, lng, thumb)
  VALUES (?,?,?,?,?,?,'pending',?,?,?,?)`);
const qSub = db.prepare(
  `SELECT id, ordinal, rarity, zone, taken_at AS takenAt, status, photo FROM submissions WHERE id=?`,
);

export function mountSubmissions(app) {
  app.post("/api/submissions",
    limiter({ windowMs: 3600e3, max: 10, key: clientIp }),
    limiter({ windowMs: 60e3, max: 3, key: clientIp }),
    express.json({ limit: "5mb" }),
    async (req, res) => {
      try { await acquire(); } catch {
        return res.status(503).json({ error: "지금 사람이 몰려요. 잠시 뒤 다시 시도해주세요." });
      }
      try {
        const { photo, thumb, takenAt, zone, lat, lng } = req.body || {};
        if (typeof photo !== "string" || typeof takenAt !== "string") {
          return res.status(400).json({ error: "사진과 시각이 필요해요." });
        }

        const t = Date.parse(takenAt);
        if (!Number.isFinite(t) || t > Date.now() + 3600e3 || t < Date.now() - 30 * 864e5)
          return res.status(400).json({ error: "촬영 시각이 이상해요." });
        if (zone != null && !ZONE_CODES.has(zone)) return res.status(400).json({ error: "구역이 이상해요." });

        const m = DATA_URL.exec(photo);
        if (!m) return res.status(400).json({ error: "사진 형식을 읽지 못했어요." });
        if (m[2].length * 0.75 > MAX_PHOTO) return res.status(413).json({ error: "사진이 너무 커요." });

        const buf = Buffer.from(m[2], "base64");
        const sig = SIG.find((s) => s.test(buf));
        if (!sig) return res.status(400).json({ error: "이미지 파일이 아니에요." });   // 확장자 위조 차단

        const id = crypto.randomBytes(9).toString("base64url");                        // 추측 불가 id
        const d = new Date();
        const relDir = path.join(
          String(d.getFullYear()),
          String(d.getMonth() + 1).padStart(2, "0"),
          String(d.getDate()).padStart(2, "0"),
        );
        await fsp.mkdir(path.join(PHOTOS, relDir), { recursive: true });
        const name = path.join(relDir, `${id}.${sig.ext}`);
        await fsp.writeFile(photoPath(name), buf);

        // 심사용 썸네일 (있으면 저장. 없으면 원본으로 심사)
        let thumbName = null;
        const tm = typeof thumb === "string" && DATA_URL.exec(thumb);
        if (tm && tm[2].length * 0.75 < 400 * 1024) {
          const tbuf = Buffer.from(tm[2], "base64");
          if (SIG.find((s2) => s2.test(tbuf))) {
            thumbName = path.join(relDir, `${id}.t.${tm[1] === "jpeg" ? "jpg" : tm[1]}`);
            await fsp.writeFile(photoPath(thumbName), tbuf);
          }
        }

        const rarity = roll({ takenAt, revival: isRevival(qLastSeen.get()?.taken_at) });
        const ordinal = nextOrdinal();
        tally("report");
        insSub.run(id, ordinal, rarity, zone || null, new Date(t).toISOString(), new Date().toISOString(), name,
          Number.isFinite(lat) ? lat : null, Number.isFinite(lng) ? lng : null, thumbName);

        res.json({ id, ordinal, rarity, photo: photoUrl(name) });
      } catch (e) {
        console.error("submission 실패:", e.message);
        res.status(500).json({ error: "저장하지 못했어요." });
      } finally { release(); }
    });

  app.get("/api/submissions/:id", limiter({ windowMs: 60e3, max: 60, key: clientIp }), (req, res) => {
    const r = qSub.get(String(req.params.id).slice(0, 32));
    if (!r) return res.status(404).json({ error: "없는 카드예요." });
    res.set("Cache-Control", "public, max-age=30");
    res.json({ ...r, photo: photoUrl(r.photo) });
  });
}
