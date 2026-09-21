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
  lat REAL, lng REAL
);
CREATE INDEX IF NOT EXISTS idx_sub_status ON submissions(status, taken_at DESC);

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
`);

export function nextOrdinal() {
  const row = db.prepare("SELECT v FROM meta WHERE k='ordinal'").get();
  const n = (row ? Number(row.v) : 1204) + 1;
  db.prepare("INSERT INTO meta(k,v) VALUES('ordinal',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").run(String(n));
  return n;
}

export function photoPath(name) { return path.join(PHOTOS, name); }
