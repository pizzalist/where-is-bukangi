/**
 * 앱 정적 파일(개발용). 운영(SERVE_STATIC=0)에서는 나머지 요청을 JSON 404로 끝낸다.
 */
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { DIST, SERVE_STATIC } from "../config.js";

/* ---------- 정적 (개발용) ---------- */
export function mountStatic(app) {
  if (SERVE_STATIC && fs.existsSync(DIST)) {
    // index.html과 version.json은 캐시하지 않는다. admin.bukangi.com이 검수본이라 즉시 반영돼야 한다.
    // 자산은 파일명에 해시가 있어 오래 캐시해도 안전하다.
    app.use(express.static(DIST, {
      index: "index.html",
      setHeaders: (res, p) => res.set(
        "Cache-Control",
        /index\.html$|version\.json$/.test(p) ? "no-store" : "public, max-age=604800, immutable",
      ),
    }));
    app.get(/.*/, (_req, res) => res.sendFile(path.join(DIST, "index.html")));
  } else {
    app.use((_req, res) => res.status(404).json({ error: "not found" }));
  }
}
