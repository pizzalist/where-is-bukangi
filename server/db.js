import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const ROOT = process.env.BUKANG_DATA || path.join(process.env.HOME, "bukang");
export const PHOTOS = path.join(ROOT, "photos");
fs.mkdirSync(PHOTOS, { recursive: true });

export const db = new Database(path.join(ROOT, "bukang.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  ordinal INTEGER NOT NULL,
  rarity TEXT NOT NULL,
  zone TEXT,
  taken_at TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  photo TEXT,
  lat REAL, lng REAL,
  thumb TEXT
);
CREATE INDEX IF NOT EXISTS idx_sub_status ON submissions(status, taken_at DESC);

-- AI 1차 심사 결과
CREATE TABLE IF NOT EXISTS screening (
  id TEXT PRIMARY KEY,
  verdict TEXT NOT NULL,      -- pass | reject | unsure | error
  shark INTEGER, person INTEGER, confidence REAL,
  reason TEXT, engine TEXT, ms INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,            -- seen | miss
  zone TEXT,
  at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_obs_at ON observations(at DESC);

CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  src TEXT NOT NULL, title TEXT NOT NULL, url TEXT, crit INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);

-- 방문 집계. 개인 식별 없이 일별 카운트만 남긴다 (IP는 해시해서 순방문자만 센다)
CREATE TABLE IF NOT EXISTS visits (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,          -- view | uniq
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind)
);

-- 시간별 순방문 판별용 해시. 일 단위(visitors)와 따로 둔다.
-- "그 시간에 온 사람 수"를 세야 해서, 하루 단위 첫 방문 기준으로는 시간별 값이 안 나온다.
CREATE TABLE IF NOT EXISTS visitors_hourly (
  hour TEXT NOT NULL,
  h TEXT NOT NULL,
  PRIMARY KEY (hour, h)
);

-- 시간대별 집계. 어드민 그래프용. 한국 시간 기준 "YYYY-MM-DDTHH" 키.
-- kind: view(페이지뷰) uniq(순방문) report(사진 제보) ping_seen ping_miss card(공개된 카드)
CREATE TABLE IF NOT EXISTS stats_hourly (
  hour TEXT NOT NULL,
  kind TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (hour, kind)
);

-- 현장 탭("보여요"/"안 보여요"). 지금 상태 표시에만 쓰고 오래된 건 지운다.
-- 위치가 공원 안일 때만 들어오고, 같은 기기는 일정 시간에 한 번만.
CREATE TABLE IF NOT EXISTS pings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,          -- seen | miss
  zone TEXT,
  h TEXT NOT NULL,             -- 기기 해시(IP+브라우저). 원본은 저장하지 않는다
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ping_at ON pings(at DESC);

-- 순방문 판별용 해시. 원본 IP는 저장하지 않으며 7일 뒤 지운다.
CREATE TABLE IF NOT EXISTS visitors (
  day TEXT NOT NULL,
  h TEXT NOT NULL,
  PRIMARY KEY (day, h)
);
`);

export function nextOrdinal() {
  const row = db.prepare("SELECT v FROM meta WHERE k='ordinal'").get();
  const n = (row ? Number(row.v) : 0) + 1;   // 첫 카드가 No.1
  db.prepare("INSERT INTO meta(k,v) VALUES('ordinal',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").run(String(n));
  return n;
}

export function photoPath(name) { return path.join(PHOTOS, name); }

// 기존 DB에 thumb 컬럼이 없으면 추가
try { db.prepare("SELECT thumb FROM submissions LIMIT 1").get(); }
catch { db.exec("ALTER TABLE submissions ADD COLUMN thumb TEXT"); }
