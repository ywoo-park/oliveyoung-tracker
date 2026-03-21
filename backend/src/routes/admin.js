const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const { crawlProductDetail } = require("../crawler");

router.get("/products", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM products ORDER BY created_at DESC");
  res.json(rows);
});

router.post("/products", async (req, res) => {
  const { oliveyoung_id } = req.body;
  if (!oliveyoung_id) {
    return res.status(400).json({ error: "oliveyoung_id는 필수입니다." });
  }

  try {
    const { rows } = await pool.query(
      "INSERT INTO products (name, oliveyoung_id) VALUES ($1, $2) RETURNING id",
      [oliveyoung_id, oliveyoung_id]
    );
    const id = rows[0].id;
    res.json({ id, oliveyoung_id, name: oliveyoung_id });

    crawlProductDetail(oliveyoung_id).then((detail) => {
      pool.query(
        "UPDATE products SET name=$1, image_url=$2, price=$3, sale_price=$4 WHERE id=$5",
        [detail.name, detail.image_url, detail.price, detail.sale_price, id]
      );
    }).catch((err) => {
      console.error("[Admin] 상품 정보 크롤링 실패:", err.message);
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "이미 등록된 상품 코드입니다." });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete("/products/:id", async (req, res) => {
  await pool.query("DELETE FROM products WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

router.delete("/rankings/all", async (req, res) => {
  const { rows } = await pool.query("SELECT COUNT(*) AS count FROM rankings");
  await pool.query("DELETE FROM rankings");
  res.json({ deleted: parseInt(rows[0].count) });
});

module.exports = router;
