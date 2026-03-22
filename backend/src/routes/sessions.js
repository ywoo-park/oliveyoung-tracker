/**
 * 리뷰 분석 세션 영구 저장 (PostgreSQL)
 * 프론트 히스토리 사이드바와 동일 스키마를 JSONB로 보관합니다.
 */

const express = require("express");
const { pool } = require("../db");

const router = express.Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toDto(row) {
  const ts = row.created_at;
  const iso = ts instanceof Date ? ts.toISOString() : new Date(ts).toISOString();
  return {
    id: String(row.id),
    timestamp: iso,
    productName: row.product_name,
    summary: row.summary || "",
    keywordsLine: row.keywords_line || "",
    sourceUrl: row.source_url,
    content: row.content,
  };
}

/** 목록 (최신순, 상한으로 DB 부하 방지) */
router.get("/review-sessions", async (req, res) => {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));
  const { rows } = await pool.query(
    `SELECT id, product_name, summary, keywords_line, source_url, goods_no, content, created_at, updated_at
     FROM review_analysis_sessions
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  res.json(rows.map(toDto));
});

/** 단건 생성 — 대용량 JSON (리뷰 원문 포함) 허용 */
router.post("/review-sessions", async (req, res) => {
  const { productName, summary, keywordsLine, sourceUrl, content } = req.body || {};
  if (!content || typeof content !== "object") {
    return res.status(400).json({ error: "content(분석 결과 JSON)은 필수입니다." });
  }
  if (!sourceUrl || typeof sourceUrl !== "string") {
    return res.status(400).json({ error: "sourceUrl은 필수입니다." });
  }

  const pn = String(productName || "").trim() || "리뷰 분석";
  const sm = String(summary || "").trim();
  const kw = String(keywordsLine || "").trim();
  const goodsNo = content.meta?.goodsNo != null ? String(content.meta.goodsNo) : null;

  const { rows } = await pool.query(
    `INSERT INTO review_analysis_sessions (product_name, summary, keywords_line, source_url, goods_no, content)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id, product_name, summary, keywords_line, source_url, goods_no, content, created_at, updated_at`,
    [pn, sm, kw, sourceUrl.trim(), goodsNo, JSON.stringify(content)]
  );

  res.status(201).json(toDto(rows[0]));
});

/** 표시 이름 변경 */
router.patch("/review-sessions/:id", async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: "유효하지 않은 세션 id입니다." });
  }
  const productName = String(req.body?.productName || "").trim();
  if (!productName) {
    return res.status(400).json({ error: "productName이 필요합니다." });
  }

  const { rows, rowCount } = await pool.query(
    `UPDATE review_analysis_sessions
     SET product_name = $1, updated_at = (NOW() AT TIME ZONE 'Asia/Seoul')
     WHERE id = $2::uuid
     RETURNING id, product_name, summary, keywords_line, source_url, goods_no, content, created_at, updated_at`,
    [productName, req.params.id]
  );

  if (rowCount === 0) {
    return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  }
  res.json(toDto(rows[0]));
});

/** 삭제 */
router.delete("/review-sessions/:id", async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: "유효하지 않은 세션 id입니다." });
  }
  const { rowCount } = await pool.query(`DELETE FROM review_analysis_sessions WHERE id = $1::uuid`, [
    req.params.id,
  ]);
  if (rowCount === 0) {
    return res.status(404).json({ error: "세션을 찾을 수 없습니다." });
  }
  res.status(204).end();
});

module.exports = router;
