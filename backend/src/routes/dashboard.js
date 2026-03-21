const express = require("express");
const router = express.Router();
const db = require("../db");

// 상품별 KPI 통계
router.get("/rankings/stats", (req, res) => {
  const { category = "전체" } = req.query;
  const products = db.prepare("SELECT * FROM products").all();

  const stats = products.map((p) => {
    // 역대 최고 순위 + 달성일시
    const best = db.prepare(`
      SELECT rank, crawled_at AS date
      FROM rankings
      WHERE product_id = ? AND category = ? AND rank IS NOT NULL
      ORDER BY rank ASC, crawled_at ASC
      LIMIT 1
    `).get(p.id, category);

    // 역대 최저 순위 + 달성일시
    const worst = db.prepare(`
      SELECT rank, crawled_at AS date
      FROM rankings
      WHERE product_id = ? AND category = ? AND rank IS NOT NULL
      ORDER BY rank DESC, crawled_at ASC
      LIMIT 1
    `).get(p.id, category);

    // 최근 7일 일별 최고 평균
    const avg7d = db.prepare(`
      SELECT ROUND(AVG(best_rank), 1) AS avg FROM (
        SELECT date(crawled_at) AS d, MIN(rank) AS best_rank
        FROM rankings
        WHERE product_id = ? AND category = ? AND rank IS NOT NULL
          AND date(crawled_at) >= date('now', '+9 hours', '-7 days')
        GROUP BY d
      )
    `).get(p.id, category);

    // 이전 7일 일별 최고 평균 (추세 비교용)
    const avgPrev7d = db.prepare(`
      SELECT ROUND(AVG(best_rank), 1) AS avg FROM (
        SELECT date(crawled_at) AS d, MIN(rank) AS best_rank
        FROM rankings
        WHERE product_id = ? AND category = ? AND rank IS NOT NULL
          AND date(crawled_at) >= date('now', '+9 hours', '-14 days')
          AND date(crawled_at) < date('now', '+9 hours', '-7 days')
        GROUP BY d
      )
    `).get(p.id, category);

    // 총 집계일수
    const tracked = db.prepare(`
      SELECT COUNT(DISTINCT date(crawled_at)) AS days
      FROM rankings
      WHERE product_id = ? AND category = ? AND rank IS NOT NULL
    `).get(p.id, category);

    // 가장 최근 크롤링 순위
    const latest = db.prepare(`
      SELECT rank, crawled_at
      FROM rankings
      WHERE product_id = ? AND category = ?
      ORDER BY crawled_at DESC
      LIMIT 1
    `).get(p.id, category);

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
      tracked_days: tracked?.days ?? 0,
      latest_rank: latest?.rank ?? null,
      latest_crawled_at: latest?.crawled_at ?? null,
    };
  });

  res.json(stats);
});

// 시간별 순위 (당일/특정일 차트용)
router.get("/rankings/hourly", (req, res) => {
  const { category = "전체", date } = req.query;
  const targetDate = date || new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD

  const rows = db.prepare(`
    SELECT p.id AS product_id, p.name, p.oliveyoung_id,
           strftime('%Y-%m-%d %H:00:00', r.crawled_at) AS hour,
           MIN(r.rank) AS best_rank
    FROM rankings r
    JOIN products p ON r.product_id = p.id
    WHERE r.category = ? AND date(r.crawled_at) = ?
      AND r.rank IS NOT NULL
    GROUP BY p.id, strftime('%Y-%m-%d %H:00:00', r.crawled_at)
    ORDER BY hour ASC
  `).all(category, targetDate);

  res.json(rows);
});

// 일별 최고 순위 (차트용)
router.get("/rankings/daily-best", (req, res) => {
  const { from, to, category = "전체" } = req.query;

  let query = `
    SELECT p.id AS product_id, p.name, p.oliveyoung_id,
           date(r.crawled_at) AS date, MIN(r.rank) AS best_rank,
           MIN(r.crawled_at) AS crawled_at
    FROM rankings r
    JOIN products p ON r.product_id = p.id
    WHERE r.category = ? AND r.rank IS NOT NULL
  `;
  const params = [category];

  if (from) { query += " AND date(r.crawled_at) >= ?"; params.push(from); }
  if (to)   { query += " AND date(r.crawled_at) <= ?"; params.push(to); }

  query += " GROUP BY p.id, date(r.crawled_at) ORDER BY date ASC";
  res.json(db.prepare(query).all(...params));
});

module.exports = router;
