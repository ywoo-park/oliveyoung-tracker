const express = require("express");
const { crawlLatestReviewsByProductUrl } = require("../crawler");
const { normalizeInsights } = require("../strategicInsightsCore");
const { generateStrategicInsights: generateClaudeStrategicInsights } = require("../claudeInsights");
const { generateGeminiStrategicInsights } = require("../geminiInsights");
const { generateFreeStrategicInsights } = require("../freeInsights");

const router = express.Router();

const POSITIVE_WORDS = [
  "좋아요", "좋다", "촉촉", "흡수", "산뜻", "재구매", "추천", "순함", "만족",
  "가성비", "발림", "광채", "보습", "짱", "최고", "잘맞", "인생템", "부드럽",
];

const NEGATIVE_WORDS = [
  "별로", "아쉽", "자극", "따가", "트러블", "건조", "끈적", "무겁", "냄새", "향",
  "비싸", "각질", "답답", "화끈", "불편", "번들", "지워짐", "붉", "실망",
];

const STOPWORDS = new Set([
  "정말", "진짜", "너무", "조금", "그냥", "이번", "항상", "처음", "사용", "구매",
  "제품", "올리브영", "느낌", "정도", "있어요", "좋아요", "같아요", "입니다", "합니다",
]);

function tokenize(text) {
  const clean = (text || "")
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.split(" ").filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

function classifySentiment(text) {
  const lower = (text || "").toLowerCase();
  let score = 0;
  POSITIVE_WORDS.forEach((w) => {
    if (lower.includes(w)) score += 1;
  });
  NEGATIVE_WORDS.forEach((w) => {
    if (lower.includes(w)) score -= 1;
  });
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

function topKeywords(reviews, limit = 30) {
  const counter = new Map();
  reviews.forEach((r) => {
    tokenize(r).forEach((token) => {
      counter.set(token, (counter.get(token) || 0) + 1);
    });
  });
  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

router.post("/reviews/analyze", async (req, res) => {
  const { url, limit = 80 } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: "올리브영 상품 URL은 필수입니다." });
  }

  const safeLimit = Math.max(50, Math.min(Number(limit) || 80, 100));

  try {
    const scraped = await crawlLatestReviewsByProductUrl(url, safeLimit);
    const sentiments = scraped.reviews.map((text) => ({ text, sentiment: classifySentiment(text) }));

    const positive = sentiments.filter((x) => x.sentiment === "positive").map((x) => x.text);
    const negative = sentiments.filter((x) => x.sentiment === "negative").map((x) => x.text);
    const neutral = sentiments.filter((x) => x.sentiment === "neutral").map((x) => x.text);
    const keywords = topKeywords(scraped.reviews, 25);

    const insightInput = {
      reviews: scraped.reviews,
      positive,
      negative,
      keywords,
    };

    const freeInsights = generateFreeStrategicInsights(insightInput);
    let strategicInsights = freeInsights;
    let strategicInsightsSource = "free";
    let strategicInsightsError = null;
    let freeStrategicInsights = null;

    const useFreeOnly = String(process.env.USE_FREE_INSIGHTS_ONLY || "").toLowerCase() === "true";
    const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY);

    const aiPayload = {
      reviews: scraped.reviews,
      meta: { goodsNo: scraped.goodsNo, count: scraped.count },
    };

    if (!useFreeOnly && hasGemini) {
      try {
        const raw = await generateGeminiStrategicInsights(aiPayload);
        strategicInsights = normalizeInsights(raw);
        strategicInsightsSource = "gemini";
        freeStrategicInsights = freeInsights;
      } catch (geminiErr) {
        const geminiMsg = geminiErr.message || String(geminiErr);
        console.error("[reviews/analyze] Gemini 실패:", geminiMsg);
        if (hasClaude) {
          try {
            const raw = await generateClaudeStrategicInsights(aiPayload);
            strategicInsights = normalizeInsights(raw);
            strategicInsightsSource = "claude";
            freeStrategicInsights = freeInsights;
          } catch (claudeErr) {
            strategicInsightsError = `Gemini: ${geminiMsg} · Claude: ${claudeErr.message || claudeErr}`;
            strategicInsightsSource = "free_fallback";
            console.error("[reviews/analyze] Claude도 실패, 무료 로컬 사용:", claudeErr);
          }
        } else {
          strategicInsightsError = geminiMsg;
          strategicInsightsSource = "free_fallback";
        }
      }
    } else if (!useFreeOnly && hasClaude) {
      try {
        const raw = await generateClaudeStrategicInsights(aiPayload);
        strategicInsights = normalizeInsights(raw);
        strategicInsightsSource = "claude";
        freeStrategicInsights = freeInsights;
      } catch (aiErr) {
        strategicInsightsError = aiErr.message || String(aiErr);
        strategicInsightsSource = "free_fallback";
        console.error("[reviews/analyze] Claude 실패, 무료 로컬 인사이트 사용:", strategicInsightsError);
      }
    }

    res.json({
      meta: {
        goodsNo: scraped.goodsNo,
        sourceUrl: scraped.sourceUrl,
        collectedReviews: scraped.count,
        requestedLimit: safeLimit,
      },
      strategicInsights,
      strategicInsightsSource,
      strategicInsightsError,
      freeStrategicInsights,
      sentimentRatio: {
        positive: positive.length,
        negative: negative.length,
        neutral: neutral.length,
        total: scraped.reviews.length,
      },
      keywords: keywords.slice(0, 12),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "리뷰 분석 중 오류가 발생했습니다." });
  }
});

module.exports = router;
