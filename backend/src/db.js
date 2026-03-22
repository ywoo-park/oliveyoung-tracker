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

    /* 리뷰 전략 분석 히스토리 (프론트 사이드바 — PostgreSQL JSONB) */
    CREATE TABLE IF NOT EXISTS review_analysis_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_name TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      keywords_line TEXT NOT NULL DEFAULT '',
      source_url TEXT NOT NULL,
      goods_no TEXT,
      content JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Seoul'),
      updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Seoul')
    );

    CREATE INDEX IF NOT EXISTS idx_review_sessions_created
      ON review_analysis_sessions (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_review_sessions_goods_no
      ON review_analysis_sessions (goods_no);
  `);
}

module.exports = { pool, initDb };
