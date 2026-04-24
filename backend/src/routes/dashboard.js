const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// 상품별 KPI 통계
router.get("/rankings/stats", async (req, res) => {
  const { category = "전체" } = req.query;
  const { rows: products } = await pool.query("SELECT * FROM products");

  const stats = await Promise.all(products.map(async (p) => {
    const [
      { rows: [latest] },
      { rows: [prevDay] },
      { rows: [prevHour] },
    ] = await Promise.all([
      // 현재 순위: 가장 최근 시간대의 MIN(rank)
      pool.query(`
        SELECT MIN(rank) AS rank,
               to_char(MIN(crawled_at) AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') AS crawled_at
        FROM rankings
        WHERE product_id = $1 AND category = $2 AND rank IS NOT NULL
          AND date_trunc('hour', crawled_at AT TIME ZONE 'Asia/Seoul') = (
            SELECT date_trunc('hour', crawled_at AT TIME ZONE 'Asia/Seoul')
            FROM rankings
            WHERE product_id = $1 AND category = $2 AND rank IS NOT NULL
            ORDER BY crawled_at DESC LIMIT 1
          )
      `, [p.id, category]),

      // 어제 대비: 어제 같은 시간대 MIN(rank)
      pool.query(`
        SELECT MIN(rank) AS rank
        FROM rankings
        WHERE product_id = $1 AND category = $2 AND rank IS NOT NULL
          AND date_trunc('hour', crawled_at AT TIME ZONE 'Asia/Seoul') = (
            SELECT date_trunc('hour', crawled_at AT TIME ZONE 'Asia/Seoul') - INTERVAL '1 day'
            FROM rankings
            WHERE product_id = $1 AND category = $2 AND rank IS NOT NULL
            ORDER BY crawled_at DESC LIMIT 1
          )
      `, [p.id, category]),

      // 1시간 전: 최신 시간대 직전 시간대의 MIN(rank)
      pool.query(`
        SELECT MIN(rank) AS rank
        FROM rankings
        WHERE product_id = $1 AND category = $2 AND rank IS NOT NULL
          AND date_trunc('hour', crawled_at AT TIME ZONE 'Asia/Seoul') = (
            SELECT date_trunc('hour', crawled_at AT TIME ZONE 'Asia/Seoul') - INTERVAL '1 hour'
            FROM rankings
            WHERE product_id = $1 AND category = $2 AND rank IS NOT NULL
            ORDER BY crawled_at DESC LIMIT 1
          )
      `, [p.id, category]),
    ]);

    return {
      id: p.id,
      name: p.name,
      oliveyoung_id: p.oliveyoung_id,
      image_url: p.image_url,
      latest_rank: latest?.rank ?? null,
      latest_crawled_at: latest?.crawled_at ?? null,
      prev_day_rank: prevDay?.rank ?? null,
      prev_hour_rank: prevHour?.rank ?? null,
    };
  }));

  res.json(stats);
});

// 시간별 순위 (당일/특정일 차트용)
router.get("/rankings/hourly", async (req, res) => {
  const { category = "전체", date } = req.query;
  const targetDate = date || new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 10);

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
