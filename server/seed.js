/** 목 데이터 주입. 실제 사진(public/sample.png)을 여러 장 복제해 넣는다. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, PHOTOS, nextOrdinal } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "public", "sample.png");

db.exec("DELETE FROM submissions; DELETE FROM observations; DELETE FROM notices; DELETE FROM meta;");
fs.rmSync(PHOTOS, { recursive: true, force: true });
fs.mkdirSync(PHOTOS, { recursive: true });

const now = Date.now();
const iso = (minAgo) => new Date(now - minAgo * 60000).toISOString();
const d = new Date();
const dir = path.join(PHOTOS, `${d.getFullYear()}`, String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0"));
fs.mkdirSync(dir, { recursive: true });
const rel = path.relative(PHOTOS, dir);

const rows = [
  { min: 8,    zone: "B", rarity: "holo",    status: "approved" },
  { min: 42,   zone: "B", rarity: "gold",    status: "approved" },
  { min: 95,   zone: "C", rarity: "rare",    status: "approved" },
  { min: 160,  zone: "A", rarity: "rainbow", status: "approved" },
  { min: 210,  zone: "B", rarity: "common",  status: "approved" },
  { min: 300,  zone: "D", rarity: "galaxy",  status: "approved" },
  { min: 420,  zone: "B", rarity: "fullart", status: "approved" },
  { min: 12,   zone: "B", rarity: "uncommon",status: "pending"  },
  { min: 25,   zone: "C", rarity: "reverse", status: "pending"  },
];

const ins = db.prepare(`INSERT INTO submissions (id, ordinal, rarity, zone, taken_at, submitted_at, status, photo, lat, lng)
  VALUES (?,?,?,?,?,?,?,?,?,?)`);
rows.forEach((r, i) => {
  const id = `seed${String(i + 1).padStart(2, "0")}`;
  const name = path.join(rel, `${id}.png`);
  fs.copyFileSync(SRC, path.join(PHOTOS, name));
  ins.run(id, nextOrdinal(), r.rarity, r.zone, iso(r.min), iso(r.min - 1), r.status, name, 35.1144, 129.0464);
});

db.prepare(`INSERT INTO observations (kind, zone, at, note, created_at) VALUES (?,?,?,?,?)`)
  .run("miss", "B", iso(130), "20:10~20:40 관측, 미목격", new Date().toISOString());
db.prepare(`INSERT INTO observations (kind, zone, at, note, created_at) VALUES (?,?,?,?,?)`)
  .run("seen", "B", iso(70), "운영자 현장 관측", new Date().toISOString());

const n = db.prepare(`INSERT INTO notices (src, title, url, crit, created_at) VALUES (?,?,?,?,?)`);
n.run("부산해양경찰서", "북항 친수공원 상어 출현, 물가 접근 자제 당부", "https://www.newspim.com/news/view/20260918000700", 0, new Date().toISOString());
n.run("국립수산과학원", "무태상어 추정, 무리한 유도 시 공격성 가능", "https://www.etoday.co.kr/news/view/2627722", 0, new Date().toISOString());

console.log("목 데이터 주입 완료:",
  db.prepare("SELECT COUNT(*) c FROM submissions").get().c, "제보 /",
  db.prepare("SELECT COUNT(*) c FROM observations").get().c, "관측 /",
  db.prepare("SELECT COUNT(*) c FROM notices").get().c, "공지");
