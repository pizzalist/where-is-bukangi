/**
 * 부캉이 API 서버. 조립만 한다: 미들웨어·라우트 등록 순서가 곧 요청 처리 순서다.
 * 실제 처리는 config / http/* / stats / status / routes/* 에 있다.
 */
import express from "express";
import { PHOTOS } from "./db.js";
import { startScreener } from "./screener.js";
import { PORT, HOST, ADMIN_TOKEN, SERVE_STATIC } from "./config.js";
import { securityHeaders, cors, errorHandler } from "./http/middleware.js";
import { invalidateStatus, invalidateHall } from "./status.js";
import { mountPhotos, mountBoard, mountHealth } from "./routes/public.js";
import { mountTracking } from "./routes/tracking.js";
import { mountSubmissions } from "./routes/submissions.js";
import { mountCards } from "./routes/cards.js";
import { mountAdmin } from "./routes/admin.js";
import { mountActionLinks } from "./routes/actions.js";
import { mountStatic } from "./routes/static.js";

if (!ADMIN_TOKEN) { console.error("ADMIN_TOKEN 환경변수가 필요합니다."); process.exit(1); }
if (ADMIN_TOKEN.length < 24) console.warn("경고: ADMIN_TOKEN이 짧습니다. 32자 이상 무작위 문자열을 쓰세요.");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // Cloudflare 뒤

app.use(securityHeaders);
app.use(cors);
mountPhotos(app);        // /photos
mountTracking(app);      // POST /api/visit, /api/event, /api/ping
mountBoard(app);         // GET /api/status, /api/hall
mountSubmissions(app);   // POST /api/submissions, GET /api/submissions/:id
mountCards(app);         // /api/cards/:id.(png|jpg), /c/:id
mountAdmin(app);         // /api/admin/*
mountActionLinks(app);   // /r/:id/:action/:sig
mountHealth(app);        // /healthz
mountStatic(app);        // dist 또는 404
app.use(errorHandler);

startScreener(() => { invalidateStatus(); invalidateHall(); });

const server = app.listen(PORT, HOST, () =>
  console.log(`부캉이 서버 http://${HOST}:${PORT}  데이터=${PHOTOS}  정적서빙=${SERVE_STATIC ? "on" : "off"}`));
server.headersTimeout = 20000;
server.requestTimeout = 30000;
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { server.close(() => process.exit(0)); });
