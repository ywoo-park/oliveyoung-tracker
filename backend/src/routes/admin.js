const express = require("express");
const router = express.Router();
const db = require("../db");
const { crawlProductDetail } = require("../crawler");

router.get("/products", (req, res) => {
  const products = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
  res.json(products);
});

router.post("/products", async (req, res) => {
  const { oliveyoung_id } = req.body;
  if (!oliveyoung_id) {
    return res.status(400).json({ error: "oliveyoung_id는 필수입니다." });
  }

  try {
    // 일단 코드로 임시 등록
    const result = db
      .prepare("INSERT INTO products (name, oliveyoung_id) VALUES (?, ?)")
      .run(oliveyoung_id, oliveyoung_id);
    const id = result.lastInsertRowid;
    res.json({ id, oliveyoung_id, name: oliveyoung_id });

    // 비동기로 상품 상세 정보 크롤링 후 업데이트
    crawlProductDetail(oliveyoung_id).then((detail) => {
      db.prepare(
        "UPDATE products SET name=?, image_url=?, price=?, sale_price=? WHERE id=?"
      ).run(detail.name, detail.image_url, detail.price, detail.sale_price, id);
    }).catch((err) => {
      console.error("[Admin] 상품 정보 크롤링 실패:", err.message);
    });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "이미 등록된 상품 코드입니다." });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete("/products/:id", (req, res) => {
  db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
