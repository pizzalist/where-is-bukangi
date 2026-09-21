/** 실서비스 시작 전 초기화. 목 데이터와 사진을 전부 지운다. */
import fs from "node:fs";
import { db, PHOTOS } from "./db.js";

const keepVisits = process.argv.includes("--keep-visits");
db.exec(`DELETE FROM submissions; DELETE FROM screening; DELETE FROM observations; DELETE FROM notices; DELETE FROM meta;`);
if (!keepVisits) db.exec(`DELETE FROM visits; DELETE FROM visitors;`);
fs.rmSync(PHOTOS, { recursive: true, force: true });
fs.mkdirSync(PHOTOS, { recursive: true });
db.prepare("INSERT INTO meta(k,v) VALUES('ordinal',?)").run(String(Number(process.env.START_ORDINAL || 0)));
console.log(`초기화 완료. 순번은 ${Number(process.env.START_ORDINAL || 0) + 1}번부터 시작.`);
console.log(`방문 집계 ${keepVisits ? "유지" : "삭제"}. 사진 디렉터리 비움: ${PHOTOS}`);
