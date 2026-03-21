const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbPath = process.env.DB_PATH || "/app/data/tracker.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    oliveyoung_id TEXT NOT NULL UNIQUE,
    image_url TEXT,
    price INTEGER,
    sale_price INTEGER,
    created_at TEXT DEFAULT (datetime('now', '+9 hours'))
  );

  CREATE TABLE IF NOT EXISTS rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    rank INTEGER,
    crawled_at TEXT DEFAULT (datetime('now', '+9 hours')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );
`);

// 기존 DB 마이그레이션
for (const col of ["image_url TEXT", "price INTEGER", "sale_price INTEGER"]) {
  try {
    db.exec(`ALTER TABLE products ADD COLUMN ${col}`);
  } catch (_) {}
}

module.exports = db;
