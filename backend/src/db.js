const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      oliveyoung_id TEXT NOT NULL UNIQUE,
      image_url TEXT,
      price INTEGER,
      sale_price INTEGER,
      created_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Seoul')
    );

    CREATE TABLE IF NOT EXISTS rankings (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      rank INTEGER,
      crawled_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Seoul')
    );
  `);
}

module.exports = { pool, initDb };
