/**
 * 공개 읽기 라우트: 사진 파일, 상황판, 명예의 전당, 상태 점검.
 */
import express from "express";
import { PHOTOS } from "../db.js";
import { cardStats } from "../cards.js";
import { statusBody, hallBody } from "../status.js";
import { uploadLoad } from "../http/middleware.js";

/* ---------- 공개: 사진 ---------- */
export function mountPhotos(app) {
  app.use("/photos", express.static(PHOTOS, {
    maxAge: "30d", immutable: true, index: false, dotfiles: "deny", fallthrough: false,
  }), (err, _req, res, _next) => {
    // 경로 탈출·없는 파일은 404로 통일 (500으로 내부 사정을 흘리지 않는다)
    res.status(err?.status === 404 ? 404 : 404).json({ error: "없는 사진이에요." });
  });
}

/* ---------- 공개: 상황판·명예의 전당 ---------- */
export function mountBoard(app) {
  app.get("/api/status", (req, res) => {
    const { body, etag } = statusBody();
    res.set("Cache-Control", "public, max-age=10, s-maxage=10, stale-while-revalidate=30");
    res.set("ETag", etag);
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    res.type("application/json").send(body);
  });

  app.get("/api/hall", (_req, res) => {
    const body = hallBody();
    res.set("Cache-Control", "public, max-age=30, s-maxage=30");
    res.type("application/json").send(body);
  });
}

/* ---------- 상태 점검 ---------- */
export function mountHealth(app) {
  app.get("/healthz", (_req, res) => res.json({ ok: true, ...uploadLoad(), cards: cardStats() }));
}
