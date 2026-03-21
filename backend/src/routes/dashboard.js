const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// 상품별 KPI 통계
router.get("/rankings/stats", async (req, res) => {
  const { category = "전체" } = req.query;
  const { rows: products } = await pool.query("SELECT * FROM products");

  const stats = await Promise.all(products.map(async (p) => {
    const { rows: [best] } = await pool.query(`
      SELECT rank, to_char(crawled_at, 'YYYY-MM-DD HH24:MI:SS') AS date
      FROM rankings
      WHERE product_id = $1 AND category = $2 AND rank IS NOT NULL
      ORDER BY rank ASC, crawled_at ASC
      LIMIT 1
    `, [p.id, category]);

    const { rows: [worst] } = await pool.query(`
      SELECT rank, to_char(crawled_at, 'YYYY-MM-DD HH24:MI:SS') AS date
      FROM rankings
      WHERE product_id = $1 AND category = $2 AND rank IS NOT NULL
      ORDER BY rank DESC, crawled_at ASC
      LIMIT 1
    `, [p.id, category]);

    const { rows: [avg7d] } = await pool.query(`
      SELECT ROUND(AVG(best_rank)::numeric, 1) AS avg FROM (
        SELECT crawled_at::date AS d, MIN(rank) AS best_rank
        FROM rankings
        WHERE product_id = $1 AND category = $2 AND rank IS NOT NULL
          AND crawled_at::date >= (NOW() AT TIME ZONE 'Asia/Seoul' - INTERVAL '7 days')::date
        GROUP BY d
      ) t
    `, [p.id, category]);

    const { rows: [avgPrev7d] } = await pool.query(`
      SELECT ROUND(AVG(best_rank)::numeric, 1) AS avg FROM (
        SELECT crawled_at::date AS d, MIN(rank) AS best_rank
        FROM rankings
        WHERE product_id = $1 AND category = $2 AND rank IS NOT NULL
          AND crawled_at::date >= (NOW() AT TIME ZONE 'Asia/Seoul' - INTERVAL '14 days')::date
          AND crawled_at::date < (NOW() AT TIME ZONE 'Asia/Seoul' - INTERVAL '7 days')::date
        GROUP BY d
      ) t
    `, [p.id, category]);

    const { rows: [tracked] } = await pool.query(`
      SELECT COUNT(DISTINCT crawled_at::date) AS days
      FROM rankings
      WHERE product_id = $1 AND category = $2 AND rank IS NOT NULL
    `, [p.id, category]);

    const { rows: [latest] } = await pool.query(`
      SELECT rank, to_char(crawled_at, 'YYYY-MM-DD HH24:MI:SS') AS crawled_at
      FROM rankings
      WHERE product_id = $1 AND category = $2
      ORDER BY crawled_at DESC
      LIMIT 1
    `, [p.id, category]);

    return {
      id: p.id,
      name: p.name,
      oliveyoung_id: p.oliveyoung_id,
      image_url: p.image_url,
      price: p.price,
      sale_price: p.sale_price,
      best_rank: best?.rank ?? null,
      best_rank_date: best?.date ?? null,
      worst_rank: worst?.rank ?? null,
      worst_rank_date: worst?.date ?? null,
      avg_rank_7d: avg7d?.avg ?? null,
      avg_rank_prev_7d: avgPrev7d?.avg ?? null,
      tracked_days: parseInt(tracked?.days ?? 0),
      latest_rank: latest?.rank ?? null,
      latest_crawled_at: latest?.crawled_at ?? null,
    };
  }));

  res.json(stats);
});

// 시간별 순위 (당일/특정일 차트용)
router.get("/rankings/hourly", async (req, res) => {
  const { category = "전체", date } = req.query;
  const targetDate = date || new Date().toLocaleDateString("sv-SE");

  const { rows } = await pool.query(`
    SELECT p.id AS product_id, p.name, p.oliveyoung_id,
           to_char(date_trunc('hour', r.crawled_at), 'YYYY-MM-DD HH24:00:00') AS hour,
           MIN(r.rank) AS best_rank
    FROM rankings r
    JOIN products p ON r.product_id = p.id
    WHERE r.category = $1 AND r.crawled_at::date = $2
      AND r.rank IS NOT NULL
    GROUP BY p.id, p.name, p.oliveyoung_id, date_trunc('hour', r.crawled_at)
    ORDER BY hour ASC
  `, [category, targetDate]);

  res.json(rows);
});

// 일별 최고 순위 (차트용)
router.get("/rankings/daily-best", async (req, res) => {
  const { from, to, category = "전체" } = req.query;

  let query = `
    SELECT p.id AS product_id, p.name, p.oliveyoung_id,
           to_char(r.crawled_at::date, 'YYYY-MM-DD') AS date,
           MIN(r.rank) AS best_rank,
           to_char(MIN(r.crawled_at), 'YYYY-MM-DD HH24:MI:SS') AS crawled_at
    FROM rankings r
    JOIN products p ON r.product_id = p.id
    WHERE r.category = $1 AND r.rank IS NOT NULL
  `;
  const params = [category];

  if (from) { query += ` AND r.crawled_at::date >= $${params.length + 1}`; params.push(from); }
  if (to)   { query += ` AND r.crawled_at::date <= $${params.length + 1}`; params.push(to); }

  query += " GROUP BY p.id, p.name, p.oliveyoung_id, r.crawled_at::date ORDER BY date ASC";

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

module.exports = router;
