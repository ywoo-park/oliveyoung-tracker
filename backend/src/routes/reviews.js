const express = require("express");
const { crawlLatestReviewsByProductUrl } = require("../crawler");

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

function rankMentions(reviews, lexicon) {
  const scored = reviews
    .map((text) => {
      const score = lexicon.reduce((acc, word) => acc + ((text.includes(word) ? 1 : 0)), 0);
      return { text, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length);
  return scored.map((x) => x.text);
}

function buildAdCopies(consumerVoices, painPoints) {
  const positives = consumerVoices.slice(0, 3);
  const negatives = painPoints.slice(0, 2);
  return [
    `"${
      positives[0] || "한 번 써보면 다시 찾게 되는"
    }" - 실제 리뷰 기반으로 만든 신뢰형 카피`,
    `"${
      positives[1] || "바르자마자 느껴지는 사용감"
    }" - 사용 순간 가치를 강조하는 체감형 카피`,
    `"${
      negatives[0] || "불편함을 줄이고 핵심 효능은 살린"
    }" - 불만 포인트를 개선하는 문제해결형 카피`,
  ];
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

    const consumerVoices = rankMentions(positive, POSITIVE_WORDS).slice(0, 8);
    const painPoints = rankMentions(negative, NEGATIVE_WORDS).slice(0, 8);
    const keywords = topKeywords(scraped.reviews, 35);
    const adCopies = buildAdCopies(consumerVoices, painPoints);

    res.json({
      meta: {
        goodsNo: scraped.goodsNo,
        sourceUrl: scraped.sourceUrl,
        collectedReviews: scraped.count,
        requestedLimit: safeLimit,
      },
      sentimentRatio: {
        positive: positive.length,
        negative: negative.length,
        neutral: neutral.length,
        total: scraped.reviews.length,
      },
      keywords,
      consumerVoices,
      painPoints,
      pageStructureSuggestion: [
        "1) 히어로 섹션: 소비자 리얼 보이스 1문장 + 핵심 효능",
        "2) 효능 근거 섹션: 리뷰 키워드 상위 5개 중심 장점 설명",
        "3) 사용감/성분 섹션: 발림, 향, 지속력 등 체감 요소 정리",
        "4) 개선 포인트 대응 섹션: 부정 리뷰 Pain Point 선제 해소",
        "5) CTA 섹션: 재구매/추천 리뷰 인용 문구로 구매 유도",
      ],
      adCopies,
      sampleReviews: scraped.reviews.slice(0, 10),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "리뷰 분석 중 오류가 발생했습니다." });
  }
});

module.exports = router;
