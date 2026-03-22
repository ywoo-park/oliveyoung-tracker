/**
 * 전략 인사이트 공통: 시스템 프롬프트, 사용자 프롬프트, JSON 정규화
 */

function buildReviewCorpus(reviews, maxChars = 45000) {
  const lines = reviews.map((t, i) => `[${i + 1}] ${String(t).slice(0, 500)}`);
  let joined = lines.join("\n");
  if (joined.length > maxChars) {
    joined = joined.slice(0, maxChars) + "\n…(이하 생략)";
  }
  return joined;
}

function extractJsonFromText(text) {
  const trimmed = (text || "").trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI 응답에서 JSON을 찾을 수 없습니다.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/** System instruction: 포지셔닝·VOC·개선안 원칙 + VDL 장표·ABM 보고서 톤 */
const INSIGHT_SYSTEM_PROMPT = `당신은 VDL 브랜드 성장을 견인하는 전문 ABM(Assistant Brand Manager)이자 전략 컨설턴트입니다. 뷰티·이커머스 실제 구매자 리뷰 원문을 읽고, 논리적 흐름이 끊기지 않는 [전략 분석 보고서] 수준의 인사이트를 JSON으로 출력합니다. 모든 본문 출력은 한국어입니다.

[분석 원칙]
1) 포지셔닝: 단순히 기능을 나열하지 말고, 경쟁 제품 대비 이 제품만이 갖는 '한 끗' 차이를 소비자 언어로 정의할 것.
2) VOC 추출: "좋아요", "나빠요" 같은 무난한 말 말고, "피부에 겉돌지 않고 쫀득하게 붙어요" 같은 날 것의 표현을 우선적으로 찾을 것. 가능하면 리뷰 번호나 문맥에 근거해 인용할 것.
3) 개선안: "품질을 높이세요" 같은 뻔한 말 대신, "퍼프의 밀도를 높여 밀착력을 보완하거나, 옐로우 베이스 비중을 높여 홍조 커버력을 강화할 것"처럼 기획자가 바로 실행 가능한 수준(제형·패키지·구성·컬러 라인·사용 가이드 등)으로 제안할 것.

[출력 톤]
- Modern & Professional: USP, 페인포인트, RTB, IMC, 온드미디어 등 실무 용어를 쓰되 감각적인 톤앤매너 유지.
- abmReport는 앞선 필드(키워드·VOC·페인)와 숫자·표현이 유기적으로 연결되게 작성할 것. 중복 문장은 피할 것.
- 반드시 요청된 JSON 스키마만 출력하고, 스키마 밖의 설명·마크다운·코드펜스는 넣지 말 것.`;

function buildUserPrompt(reviews, meta) {
  const corpus = buildReviewCorpus(reviews);
  return `아래는 한 화장품에 대한 실제 구매자 리뷰 ${reviews.length}건입니다. (상품 코드: ${meta.goodsNo || "알 수 없음"})

## 리뷰 원문
${corpus}

## 과제
리뷰에 **근거**하여 아래 구조의 JSON **만** 출력하세요. 다른 문장·마크다운·코드펜스는 넣지 마세요.
추측은 리뷰 톤·반복 언어·구체적 표현에 기반해야 합니다.

## VDL 전략 장표 섹션 (필수)
- positioningSummary: 핵심 강점 키워드(지속력, 화사함 등)와 주요 사용 맥락을 한 줄로 정의. (예: '강력 커버/지속력/수정화장 친화적인 데일리 베이스')
- painPointsTop5: 정확히 5개. 각 항목은 고객의 주요 고민(pain)과, 리뷰에서 인용한 생생한 소비자 워딩(vocQuotes는 짧은 인용 문자열 배열 1~3개).
- satisfactionFactors: 핵심 만족 요인 3~5개 — 반드시 소비자 실제 언어 톤으로 bullet 수준의 짧은 문장 배열.
- dissatisfactionFactors: 핵심 불만족 요인 3~5개 — 소비자 실제 언어로.
- improvementActions: 불만·리스크를 제품 기획 관점에서 해소하기 위한 실행안 3~5개. 각 항목은 targetIssue(어떤 불만과 연결되는지)와 productPlanningActions(제형 수정, 패키지 보완, 컬러 스펙, 용기, 사용법 가이드 등 구체적 문장).

## 기존 집행 모듈 (필수, 개수 엄수)
- painPointSolutions: 정확히 3개. rank 1,2,3. evidenceSummary에 근거. detailPageSolution, marketingMent 포함.
- sellingPoints: 정확히 2개. realVoiceQuotes는 리뷰 인용 1~2개 배열.
- metaAdCopies: 정확히 3개. headline, primaryText(메타 피드용 2~4문장), ctaHint.
- usageContext: executiveSummary, topSeasons[], topSituations[] (각 strength는 "high"|"medium"|"low", rationale 포함).
- marketingActions: 정확히 4개. number 1~4.

## ABM 전략 분석 보고서 abmReport (필수) — UI에 그대로 렌더링됨
1) reviewInsight: 긍/부정 키워드 각각 3~6개(상반된 만족·불만 축), top5Voc 정확히 5개(rank, theme, frequencyLabel은 "약 N%" 또는 "높음/중간" 등 리뷰 근거 표현, summary 한 줄), realVoices는 리뷰 인용 문자열 정확히 3개.
2) uspTop3: 정확히 3개. axis는 "제형/밀착", "지속/표현", "피부타입 최적화" 등 축 이름, headline(한 줄 USP), body(근거·RTB 2~3문장).
3) painPivot: 정확히 3개. pain(불만 정의), reviewSignal(리뷰에서 읽힌 신호), brandSolution(상세·가이드·구성 등 브랜드 솔루션).
4) marketingPriority4: 정확히 4개. pillar는 반드시 순서대로 "인플루언서/바이럴", "온드미디어/에셋", "프로모션/굿즈", "브랜딩/이미지", title(짧게), action(실행안 구체적으로).
5) creativeHooks: 정확히 3개. archetype은 "문제해결형", "감성소구형", "신뢰강조형" 순서, headline, primaryText(2~4문장).

## 스키마 (이 키 구조를 그대로 따를 것)
{
  "positioningSummary": "",
  "painPointsTop5": [{"rank":1,"pain":"","vocQuotes":[]}],
  "satisfactionFactors": [],
  "dissatisfactionFactors": [],
  "improvementActions": [{"targetIssue":"","productPlanningActions":""}],
  "painPointSolutions": [{"rank":1,"title":"","evidenceSummary":"","detailPageSolution":"","marketingMent":""}],
  "sellingPoints": [{"title":"","description":"","realVoiceQuotes":[]}],
  "metaAdCopies": [{"label":"","headline":"","primaryText":"","ctaHint":""}],
  "usageContext": {"executiveSummary":"","topSeasons":[],"topSituations":[]},
  "marketingActions": [{"number":1,"title":"","description":"","rationale":""}],
  "abmReport": {
    "reviewInsight": {
      "positiveKeywords": [],
      "negativeKeywords": [],
      "top5Voc": [{"rank":1,"theme":"","frequencyLabel":"","summary":""}],
      "realVoices": ["","",""]
    },
    "uspTop3": [{"axis":"","headline":"","body":""}],
    "painPivot": [{"pain":"","reviewSignal":"","brandSolution":""}],
    "marketingPriority4": [{"pillar":"","title":"","action":""}],
    "creativeHooks": [{"archetype":"","headline":"","primaryText":""}]
  }
}`;
}

function normalizeAbmReport(raw) {
  const empty = {
    reviewInsight: {
      positiveKeywords: [],
      negativeKeywords: [],
      top5Voc: [],
      realVoices: [],
    },
    uspTop3: [],
    painPivot: [],
    marketingPriority4: [],
    creativeHooks: [],
  };
  if (!raw || typeof raw !== "object") return empty;

  const ri = raw.reviewInsight || {};
  const top5Voc = Array.isArray(ri.top5Voc)
    ? ri.top5Voc.slice(0, 5).map((row, i) => ({
        rank: Number(row.rank) || i + 1,
        theme: String(row.theme || "").trim(),
        frequencyLabel: String(row.frequencyLabel || row.frequency || "").trim(),
        summary: String(row.summary || "").trim(),
      }))
    : [];

  const realVoices = Array.isArray(ri.realVoices)
    ? ri.realVoices.map((s) => String(s).trim()).filter(Boolean).slice(0, 5)
    : [];

  return {
    reviewInsight: {
      positiveKeywords: Array.isArray(ri.positiveKeywords)
        ? ri.positiveKeywords.map((s) => String(s).trim()).filter(Boolean)
        : [],
      negativeKeywords: Array.isArray(ri.negativeKeywords)
        ? ri.negativeKeywords.map((s) => String(s).trim()).filter(Boolean)
        : [],
      top5Voc,
      realVoices,
    },
    uspTop3: Array.isArray(raw.uspTop3)
      ? raw.uspTop3.slice(0, 3).map((row) => ({
          axis: String(row.axis || "").trim(),
          headline: String(row.headline || "").trim(),
          body: String(row.body || "").trim(),
        }))
      : [],
    painPivot: Array.isArray(raw.painPivot)
      ? raw.painPivot.slice(0, 3).map((row) => ({
          pain: String(row.pain || "").trim(),
          reviewSignal: String(row.reviewSignal || row.signal || "").trim(),
          brandSolution: String(row.brandSolution || row.solution || "").trim(),
        }))
      : [],
    marketingPriority4: Array.isArray(raw.marketingPriority4)
      ? raw.marketingPriority4.slice(0, 4).map((row) => ({
          pillar: String(row.pillar || "").trim(),
          title: String(row.title || "").trim(),
          action: String(row.action || "").trim(),
        }))
      : [],
    creativeHooks: Array.isArray(raw.creativeHooks)
      ? raw.creativeHooks.slice(0, 3).map((row) => ({
          archetype: String(row.archetype || "").trim(),
          headline: String(row.headline || "").trim(),
          primaryText: String(row.primaryText || "").trim(),
        }))
      : [],
  };
}

function normalizeInsights(parsed) {
  const defaults = {
    positioningSummary: "",
    painPointsTop5: [],
    satisfactionFactors: [],
    dissatisfactionFactors: [],
    improvementActions: [],
    painPointSolutions: [],
    sellingPoints: [],
    metaAdCopies: [],
    usageContext: {
      executiveSummary: "",
      topSeasons: [],
      topSituations: [],
    },
    marketingActions: [],
    abmReport: normalizeAbmReport(null),
  };
  if (!parsed || typeof parsed !== "object") return defaults;

  const painPointsTop5 = Array.isArray(parsed.painPointsTop5)
    ? parsed.painPointsTop5
        .slice(0, 5)
        .map((row, i) => ({
          rank: Number(row.rank) || i + 1,
          pain: String(row.pain || row.painPointLabel || row.title || "").trim(),
          vocQuotes: Array.isArray(row.vocQuotes)
            ? row.vocQuotes.map((q) => String(q).trim()).filter(Boolean)
            : row.consumerVoice
              ? [String(row.consumerVoice).trim()]
              : [],
        }))
    : [];

  const improvementActions = Array.isArray(parsed.improvementActions)
    ? parsed.improvementActions.slice(0, 8).map((row) => ({
        targetIssue: String(row.targetIssue || row.fromDissatisfaction || "").trim(),
        productPlanningActions: String(
          row.productPlanningActions || row.concreteActions || row.actions || ""
        ).trim(),
      }))
    : [];

  return {
    positioningSummary: String(parsed.positioningSummary || "").trim(),
    painPointsTop5,
    satisfactionFactors: Array.isArray(parsed.satisfactionFactors)
      ? parsed.satisfactionFactors.map((s) => String(s).trim()).filter(Boolean)
      : [],
    dissatisfactionFactors: Array.isArray(parsed.dissatisfactionFactors)
      ? parsed.dissatisfactionFactors.map((s) => String(s).trim()).filter(Boolean)
      : [],
    improvementActions,
    painPointSolutions: Array.isArray(parsed.painPointSolutions)
      ? parsed.painPointSolutions.slice(0, 5)
      : [],
    sellingPoints: Array.isArray(parsed.sellingPoints)
      ? parsed.sellingPoints.slice(0, 3)
      : [],
    metaAdCopies: Array.isArray(parsed.metaAdCopies)
      ? parsed.metaAdCopies.slice(0, 5)
      : [],
    usageContext: {
      executiveSummary:
        parsed.usageContext?.executiveSummary ||
        parsed.usageContext?.summary ||
        "",
      topSeasons: Array.isArray(parsed.usageContext?.topSeasons)
        ? parsed.usageContext.topSeasons
        : [],
      topSituations: Array.isArray(parsed.usageContext?.topSituations)
        ? parsed.usageContext.topSituations
        : [],
    },
    marketingActions: Array.isArray(parsed.marketingActions)
      ? parsed.marketingActions.slice(0, 6)
      : [],
    abmReport: normalizeAbmReport(parsed.abmReport),
  };
}

module.exports = {
  buildReviewCorpus,
  extractJsonFromText,
  normalizeInsights,
  normalizeAbmReport,
  INSIGHT_SYSTEM_PROMPT,
  buildUserPrompt,
};
