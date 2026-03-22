/**
 * Claude API 없이 로컬에서 전략 인사이트 형태의 결과를 생성합니다. (비용 0)
 * 키워드·패턴 매칭 + 템플릿 기반이라 Claude 대비 해석 깊이는 낮을 수 있습니다.
 */

const { normalizeInsights, normalizeAbmReport } = require("./strategicInsightsCore");

function buildFreeAbmReport({
  reviews,
  positive,
  negative,
  keywords,
  painPointsTop5,
  sellScores,
  painPointSolutions,
  marketingActions,
  metaAdCopies,
}) {
  const total = reviews.length || 1;
  const posN = positive.length;
  const negN = negative.length;
  const neuN = Math.max(0, total - posN - negN);
  const topKw = (keywords || []).slice(0, 12);
  const sumKw = topKw.reduce((s, k) => s + k.count, 0) || 1;

  const positiveKeywords = topKw.slice(0, 5).map((k) => k.word);
  const negativeKeywords = (painPointsTop5 || [])
    .slice(0, 5)
    .map((p) => p.pain)
    .filter(Boolean);

  const top5Voc = topKw.slice(0, 5).map((k, i) => ({
    rank: i + 1,
    theme: k.word,
    frequencyLabel: `약 ${Math.round((k.count / sumKw) * 100)}% (키워드 상대빈도)`,
    summary: `전체 리뷰 토큰에서 반복적으로 포착된 특징입니다. (무료 로컬 추정)`,
  }));

  const posPool = positive.length ? positive : reviews;
  const realVoices = [];
  const sorted = [...posPool].sort((a, b) => a.length - b.length);
  for (const r of sorted) {
    if (r && r.length >= 15 && r.length <= 180) {
      realVoices.push(r.replace(/\s+/g, " ").trim());
    }
    if (realVoices.length >= 3) break;
  }
  while (realVoices.length < 3) {
    realVoices.push("리뷰에서 유사한 표현이 반복됩니다. (인용 샘플 부족 시 로컬 플레이스홀더)");
    if (realVoices.length >= 3) break;
  }

  const axisLabels = ["제형/밀착", "지속/표현", "피부 타입·루틴 최적화"];
  const uspTop3 = [0, 1, 2].map((i) => {
    const th = sellScores[i] || sellScores[0];
    return {
      axis: axisLabels[i] || `USP ${i + 1}`,
      headline: th?.title || "핵심 만족 테마",
      body: `${th?.desc || "긍정 톤 리뷰 패턴 기반."} 리뷰 키워드 매칭으로 도출된 로컬 요약이며, AI 분석 시 더 정교해집니다.`,
    };
  });

  const painPivot = (painPointSolutions || []).slice(0, 3).map((p) => ({
    pain: p.title,
    reviewSignal: p.evidenceSummary,
    brandSolution: p.detailPageSolution,
  }));

  const pillars = ["인플루언서/바이럴", "온드미디어/에셋", "프로모션/굿즈", "브랜딩/이미지"];
  const marketingPriority4 = pillars.map((pillar, i) => {
    const m = marketingActions[i] || marketingActions[0];
    return {
      pillar,
      title: m?.title || `우선 과제 ${i + 1}`,
      action: m?.description || m?.rationale || "",
    };
  });

  const archetypes = ["문제해결형", "감성소구형", "신뢰강조형"];
  const creativeHooks = archetypes.map((archetype, i) => {
    const ad = metaAdCopies[i] || metaAdCopies[0];
    return {
      archetype,
      headline: ad?.headline || "",
      primaryText: ad?.primaryText || "",
    };
  });

  return normalizeAbmReport({
    reviewInsight: {
      positiveKeywords,
      negativeKeywords: negativeKeywords.length ? negativeKeywords : ["(부정 키워드 매칭 약함)", "개인차·기대치", "사용 환경"],
      top5Voc,
      realVoices: realVoices.slice(0, 3),
    },
    uspTop3,
    painPivot,
    marketingPriority4,
    creativeHooks,
  });
}

const PAIN_THEMES = [
  {
    id: "trouble",
    keys: ["트러블", "뾰루지", "여드름", "자극", "따가", "알러지", "붉"],
    title: "피부 자극·트러블 우려",
    detailPage:
      "성분·피부 자극 테스트 결과를 상단에 배치하고, 민감 피부 사용 팁(소량 테스트) 섹션을 추가합니다. '개인차가 있을 수 있음'을 명확히 안내합니다.",
    ment: "첫 사용 전 팔 안쪽 테스트로 나만의 맞춤 케어를 시작해 보세요.",
  },
  {
    id: "dry",
    keys: ["건조", "들뜸", "각질", "당김", "보습", "촉촉하지"],
    title: "건조함·들뜸·각질 부각",
    detailPage:
      "추천 베이스 루틴(토너·크림 순서) 그래픽과 '건성은 소량 레이어링' 가이드를 넣고, 계절별 사용 팁을 Q&A 형태로 제공합니다.",
    ment: "기초만 잡아주면 밀착이 달라진다는 점을 루틴 콘텐츠로 풀어드립니다.",
  },
  {
    id: "color",
    keys: ["어둡", "밝", "컬러", "호수", "색상", "다크닝", "어두워"],
    title: "컬러·톤 불만족",
    detailPage:
      "톤별 비교 컷·한 단계 밝은/어두운 선택 가이드·라이브 색상 비교 영상을 배치하고, 혼합 사용 팁을 제시합니다.",
    ment: "내 피부톤에 맞는 한 컬러는 비교 가이드에서 바로 확인하세요.",
  },
  {
    id: "lasting",
    keys: ["지속", "무너짐", "유분", "번들", "지워", "오래"],
    title: "지속력·유분·무너짐",
    detailPage:
      "픽싱/프라이머 궁합, 계절별 유지력, 수정 화장 방법을 스텝 이미지로 정리합니다.",
    ment: "바쁜 하루, 수정 한 번으로도 깔끔함을 유지하는 법을 상세페이지에서 안내합니다.",
  },
  {
    id: "scent",
    keys: ["향", "냄새", "향료"],
    title: "향에 대한 호불호",
    detailPage:
      "향의 강도·지속 시간을 솔직히 표기하고, 무향 선호 고객을 위한 대체 라인이나 사용 시점 안내를 넣습니다.",
    ment: "은은한 사용감을 선호한다면 발림 직후 향의 변화를 먼저 확인해 보세요.",
  },
  {
    id: "price",
    keys: ["비싸", "가격", "가성비", "용량"],
    title: "가격·가성비 인식",
    detailPage:
      "1회 사용량당 단가, 기획 구성 대비 혜택, 멤버십·쿠폰 적용 시나리오를 표로 제시합니다.",
    ment: "기획 세트 기준으로 보면 체감 가격은 이렇게 달라집니다.",
  },
  {
    id: "texture",
    keys: ["무겁", "두껍", "밀림", "끈적", "발림"],
    title: "제형·발림감(무겁다/밀린다)",
    detailPage:
      "얇게 펴 바르는 도구 추천(퍼프/브러시), 레이어링 순서, 계절별 추천량을 영상·GIF로 보여줍니다.",
    ment: "한 번에 많이 바르기보다 얇게 여러 번이 더 자연스러워요.",
  },
];

const SELLING_THEMES = [
  {
    keys: ["커버", "잡티", "모공", "피부표현", "깔끔"],
    title: "커버력·피부 표현",
    desc: "리뷰에서 피부 결·잡티 커버에 대한 만족 언급이 두드러질 때",
  },
  {
    keys: ["지속", "오래", "무너지", "밀착", "픽싱"],
    title: "지속력·밀착",
    desc: "시간이 지나도 유지된다는 체감이 반복될 때",
  },
  {
    keys: ["촉촉", "보습", "건조하지", "수분"],
    title: "촉촉함·보습감",
    desc: "건성도 쓸 만하다는 표현이 많을 때",
  },
  {
    keys: ["발림", "얇게", "자연", "산뜻", "가볍"],
    title: "발림성·가벼운 마무리",
    desc: "발라졌을 때 무겁지 않다는 언급이 많을 때",
  },
  {
    keys: ["재구매", "인생", "추천", "만족"],
    title: "재구매·추천 의향",
    desc: "충성도·입소문 키워드가 강할 때",
  },
];

const SEASON_KEYS = [
  { name: "여름", keys: ["여름", "더울", "땀", "유분", "무더위"] },
  { name: "겨울", keys: ["겨울", "건조한 날", "추울"] },
  { name: "봄/가을", keys: ["봄", "가을", "환절"] },
  { name: "연중", keys: ["사계절", "항상", "매일", "데일리", "평소"] },
];

const SITUATION_KEYS = [
  { name: "데일리·매일", keys: ["데일리", "매일", "평소", "출근", "학교"] },
  { name: "수정 화장", keys: ["수정", "덧발", "퍼프", "촉촉할 때"] },
  { name: "특별한 날·외출", keys: ["외출", "약속", "데이트", "행사"] },
  { name: "여행", keys: ["여행", "기내", "호텔"] },
];

function countKeyHits(text, keys) {
  const t = (text || "").toLowerCase();
  let n = 0;
  keys.forEach((k) => {
    if (t.includes(k.toLowerCase())) n += 1;
  });
  return n;
}

function scoreReviewsForTheme(reviews, keys) {
  let score = 0;
  const samples = [];
  reviews.forEach((r) => {
    const h = countKeyHits(r, keys);
    if (h > 0) {
      score += h;
      if (samples.length < 3 && r.length <= 220) samples.push(r.slice(0, 180));
      else if (samples.length < 3) samples.push(r.slice(0, 180) + "…");
    }
  });
  return { score, samples };
}

function pickQuote(reviews, preferShort = true) {
  const sorted = [...reviews].sort((a, b) => a.length - b.length);
  const r = sorted.find((x) => x.length >= 12 && x.length <= 120) || sorted[0];
  if (!r) return "리뷰에서 유사 표현이 반복됩니다.";
  const q = r.replace(/\s+/g, " ").trim();
  return q.length > 100 ? `${q.slice(0, 97)}…` : q;
}

function strengthFromRank(rank, total) {
  if (total <= 0) return "low";
  if (rank === 0) return "high";
  if (rank === 1) return "medium";
  return "low";
}

/**
 * @param {{ reviews: string[], positive: string[], negative: string[], keywords: {word:string,count:number}[] }} input
 */
function buildFreeStrategicPayload(input) {
  const { reviews, positive, negative, keywords } = input;
  const topKw = (keywords || []).slice(0, 8).map((k) => k.word);

  const painScores = PAIN_THEMES.map((th) => {
    const { score, samples } = scoreReviewsForTheme(negative.length ? negative : reviews, th.keys);
    return { ...th, score, samples };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const painPointSolutions = [];
  const used = new Set();
  for (let i = 0; i < 3; i += 1) {
    const th = painScores[i];
    if (th) {
      used.add(th.id);
      painPointSolutions.push({
        rank: i + 1,
        title: th.title,
        evidenceSummary: `부정·아쉬움 톤의 리뷰에서 "${th.keys.slice(0, 3).join('", "')}" 등 관련 표현이 반복적으로 등장합니다.`,
        detailPageSolution: th.detailPage,
        marketingMent: th.ment,
      });
    }
  }
  let fallbackIdx = 0;
  const fallbacks = [
    {
      title: "기대치와 실제 사용감의 차이",
      evidenceSummary: "극단적 부정 키워드는 적으나, 사용 전 기대와 다른 점을 언급하는 리뷰가 있을 수 있습니다.",
      detailPage:
        "공식 컬러 가이드·용량·사용량 기준을 명확히 하고, 체험단/실측 컷으로 기대치를 맞춥니다.",
      ment: "상세 스펙과 실사용 컷을 먼저 확인하고 선택해 보세요.",
    },
    {
      title: "개인 피부 타입에 따른 차이",
      evidenceSummary: "동일 제품이라도 피부 타입에 따라 체감이 달라질 수 있다는 패턴이 흔합니다.",
      detailPage:
        "피부 타입별 추천 루틴(지성/복합/건성) 탭을 나누어 상세페이지에 배치합니다.",
      ment: "내 피부 타입에 맞는 사용법만 골라 보세요.",
    },
    {
      title: "증정·구성에 대한 기대",
      evidenceSummary: "본품 외 구성품·기획 세트에 대한 언급이 리뷰에 섞여 있을 수 있습니다.",
      detailPage:
        "기획 구성 도식, 증정품 이미지·용도 설명을 한눈에 보이게 정리합니다.",
      ment: "이번 기획에 들어 있는 구성을 먼저 확인해 보세요.",
    },
  ];
  while (painPointSolutions.length < 3) {
    const f = fallbacks[fallbackIdx % fallbacks.length];
    fallbackIdx += 1;
    painPointSolutions.push({
      rank: painPointSolutions.length + 1,
      title: f.title,
      evidenceSummary: f.evidenceSummary,
      detailPageSolution: f.detailPage,
      marketingMent: f.ment,
    });
  }

  const sellScores = SELLING_THEMES.map((th) => {
    const { score } = scoreReviewsForTheme(positive.length ? positive : reviews, th.keys);
    return { ...th, score };
  })
    .sort((a, b) => b.score - a.score);

  const sellingPoints = [];
  for (let i = 0; i < 2; i += 1) {
    const th = sellScores[i] || SELLING_THEMES[i];
    const quotes = [];
    const pool = positive.length ? positive : reviews;
    for (const r of pool) {
      if (th.keys.some((k) => r.includes(k)) && r.length >= 15) {
        quotes.push(pickQuote([r]));
        if (quotes.length >= 2) break;
      }
    }
    if (quotes.length === 0) quotes.push(pickQuote(pool));
    sellingPoints.push({
      title: th.title,
      description: th.desc,
      realVoiceQuotes: quotes.slice(0, 2),
    });
  }

  const kwPhrase = topKw.length ? topKw.slice(0, 4).join(", ") : "핵심 만족 포인트";

  const metaAdCopies = [
    {
      label: "체감형 후킹",
      headline: `${kwPhrase} — 리뷰가 말하는 그 사용감`,
      primaryText: `실제 구매자들이 남긴 표현을 바탕으로, "${pickQuote(positive.length ? positive : reviews)}" 같은 체감을 전면에 내세워 보세요. 피드에서 한 줄로 궁금증을 유발한 뒤, 상세페이지에서 근거(리뷰 키워드)를 보여주는 구조가 효과적입니다.`,
      ctaHint: "지금 리뷰 속 베스트 표현 확인하기",
    },
    {
      label: "신뢰형 후킹",
      headline: "재구매·추천 언급이 이어지는 이유",
      primaryText: `같은 고민을 가진 사람들이 선택한 이유를 숫자와 키워드로 압축해 전달하세요. "${topKw[0] || "만족"}" 등 반복 언급을 헤드라인 근거로 쓰고, UGC 스타일 카피로 신뢰를 보강합니다.`,
      ctaHint: "리뷰 하이라이트 보러 가기",
    },
    {
      label: "문제해결형 후킹",
      headline: "아쉬웠던 점, 미리 알고 쓰면 달라집니다",
      primaryText: `가장 많이 지적되는 사용 이슈를 솔직히 짚고, 올바른 사용법·궁합으로 해소할 수 있음을 짧게 안내하는 카피입니다. 상세페이지의 '자주 묻는 질문'과 광고 랜딩을 연결하면 전환에 도움이 됩니다.`,
      ctaHint: "맞는 사용법 가이드 보기",
    },
  ];

  const seasonRows = SEASON_KEYS.map((s) => {
    let c = 0;
    reviews.forEach((r) => {
      c += countKeyHits(r, s.keys);
    });
    return { ...s, c };
  }).sort((a, b) => b.c - a.c);

  const sitRows = SITUATION_KEYS.map((s) => {
    let c = 0;
    reviews.forEach((r) => {
      c += countKeyHits(r, s.keys);
    });
    return { ...s, c };
  }).sort((a, b) => b.c - a.c);

  const maxS = Math.max(seasonRows[0]?.c || 0, 1);
  const maxT = Math.max(sitRows[0]?.c || 0, 1);

  const topSeasons = seasonRows.slice(0, 4).map((row, idx) => ({
    name: row.name,
    strength: row.c === 0 ? "low" : strengthFromRank(idx, seasonRows.length),
    rationale:
      row.c > 0
        ? `리뷰 본문에서 관련 표현이 상대적으로 ${row.c}회 수준으로 포착되었습니다. (키워드 매칭 기준)`
        : "해당 시즌 키워드 직접 언급은 적습니다. 다른 맥락 위주로 쓰일 수 있습니다.",
  }));

  const topSituations = sitRows.slice(0, 4).map((row, idx) => ({
    name: row.name,
    strength: row.c === 0 ? "low" : strengthFromRank(idx, sitRows.length),
    rationale:
      row.c > 0
        ? `"${row.keys[0]}" 등 맥락 키워드가 리뷰에 ${row.c}회 수준 등장했습니다.`
        : "직접적인 상황 언급은 적을 수 있습니다.",
  }));

  const executiveSummary = `수집된 ${reviews.length}건 기준, 시즌 키워드는 「${seasonRows[0].name}」 관련 언급이 상대적으로 두드러지고, 사용 상황으로는 「${sitRows[0].name}」 맥락이 가장 많이 포착되었습니다. (무료 로컬 분석: 키워드 매칭·추정이며, Gemini 등 AI 해석보다 단순할 수 있습니다.)`;

  const painPointsTop5 = [];
  for (let i = 0; i < 5; i += 1) {
    const th = painScores[i];
    if (th) {
      const quotes = (th.samples || []).slice(0, 3).filter(Boolean);
      painPointsTop5.push({
        rank: i + 1,
        pain: th.title,
        vocQuotes:
          quotes.length > 0
            ? quotes
            : [
                pickQuote(negative.length ? negative : reviews),
              ],
      });
    } else {
      const f = fallbacks[(i - painScores.length) % fallbacks.length];
      painPointsTop5.push({
        rank: i + 1,
        pain: f.title,
        vocQuotes: [f.evidenceSummary.slice(0, 120) + (f.evidenceSummary.length > 120 ? "…" : "")],
      });
    }
  }

  const satisfactionFactors = [];
  const posPool = positive.length ? positive : reviews;
  for (const r of posPool) {
    if (r.length >= 20 && r.length <= 200) {
      satisfactionFactors.push(r.replace(/\s+/g, " ").trim());
    }
    if (satisfactionFactors.length >= 4) break;
  }
  while (satisfactionFactors.length < 3) {
    satisfactionFactors.push(
      `긍정 톤 리뷰에서 "${topKw[0] || "만족"}" 관련 표현이 반복적으로 포착됩니다. (무료 로컬 분석)`
    );
    break;
  }

  const dissatisfactionFactors = [];
  const negPool = negative.length ? negative : [];
  for (const r of negPool) {
    if (r.length >= 20 && r.length <= 200) {
      dissatisfactionFactors.push(r.replace(/\s+/g, " ").trim());
    }
    if (dissatisfactionFactors.length >= 4) break;
  }
  while (dissatisfactionFactors.length < 3) {
    dissatisfactionFactors.push(
      painPointSolutions[0]
        ? `일부 리뷰에서 「${painPointSolutions[0].title}」 맥락의 아쉬움이 언급됩니다. (키워드 매칭 추정)`
        : "극단적 부정 표현은 적을 수 있으나, 기대와 다른 체감 언급을 점검하세요."
    );
    break;
  }

  const improvementActions = painPointSolutions.slice(0, 4).map((p) => ({
    targetIssue: p.title,
    productPlanningActions: p.detailPageSolution,
  }));

  const positioningSummary = `${kwPhrase} 중심의 사용 맥락에서 「${sellScores[0]?.title || "핵심 만족"}」이 두드러지며, ${seasonRows[0].name}·${sitRows[0].name} 니즈와 맞닿는 제품으로 읽힙니다. (무료 로컬 요약)`;

  const marketingActions = [
    {
      number: 1,
      title: "시즌·상황에 맞는 메시지 우선순위 재정렬",
      description: `광고·상세 상단 카피에서 「${seasonRows[0].name}」·「${sitRows[0].name}」 조합을 먼저 테스트해 보세요. 리뷰 언어와 맞닿는 헤드라인 A/B를 2종 준비합니다.`,
      rationale: `시즌/상황 키워드 빈도 상위: ${seasonRows[0].name}, ${sitRows[0].name}.`,
    },
    {
      number: 2,
      title: "페인 포인트 선제 Q&A 블록",
      description: `상세페이지에 「${painPointSolutions[0].title}」 등 상위 우려 3가지를 질문 형태로 배치하고, 공식 답변·사용 팁으로 연결합니다.`,
      rationale: "로컬 분석에서 추출한 우려 테마 상위 항목 기반.",
    },
    {
      number: 3,
      title: "셀링 포인트 UGC 스니펫",
      description: `「${sellingPoints[0].title}」「${sellingPoints[1].title}」를 축으로 숏폼·카드뉴스 소재를 제작하고, 리뷰 인용문을 자막으로 활용합니다.`,
      rationale: "긍정 리뷰 키워드 매칭 상위 테마.",
    },
    {
      number: 4,
      title: "키워드 기반 검색·성과 측정",
      description: `메타·검색 광고에 ${topKw.slice(0, 5).join(", ") || "핵심 키워드"}를 확장 키워드로 넣고, 랜딩은 리뷰 하이라이트 모듈과 연동합니다.`,
      rationale: "전체 리뷰에서 빈도 높은 단어 상위 목록.",
    },
  ];

  const abmReport = buildFreeAbmReport({
    reviews,
    positive,
    negative,
    keywords,
    painPointsTop5,
    sellScores,
    painPointSolutions,
    marketingActions,
    metaAdCopies,
  });

  return {
    positioningSummary,
    painPointsTop5,
    satisfactionFactors,
    dissatisfactionFactors,
    improvementActions,
    painPointSolutions,
    sellingPoints,
    metaAdCopies,
    usageContext: {
      executiveSummary,
      topSeasons,
      topSituations,
    },
    marketingActions,
    abmReport,
  };
}

function generateFreeStrategicInsights(input) {
  const payload = buildFreeStrategicPayload(input);
  return normalizeInsights(payload);
}

module.exports = {
  generateFreeStrategicInsights,
  buildFreeStrategicPayload,
};
