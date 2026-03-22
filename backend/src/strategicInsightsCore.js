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
  const maxChars =
    meta?.maxCorpusChars != null
      ? Math.min(250_000, Math.max(20_000, Number(meta.maxCorpusChars)))
      : Math.min(200_000, 45_000 + reviews.length * 350);
  const corpus = buildReviewCorpus(reviews, maxChars);
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
1) reviewInsight: 긍/부정 키워드 각각 3~6개(상반된 만족·불만 축), top5Voc 정확히 5개(rank, theme, **frequencyPct 필수**: 1~100 정수로 분석 리뷰 코퍼스에서 해당 VOC 테마가 차지하는 대략적 언급·반복 비중%, frequencyLabel은 "높음/중간/낮음" 등 짧은 강도 표현(선택, UI 보조), summary 한 줄), realVoices는 리뷰 인용 문자열 정확히 3개.
2) uspTop3: 정확히 3개. axis는 "제형/밀착", "지속/표현", "피부타입 최적화" 등 축 이름, headline(한 줄 USP), body(근거·RTB 2~3문장).
3) painPivot: 정확히 3개. pain(불만 정의), reviewSignal(리뷰에서 읽힌 신호), brandSolution(상세·가이드·구성 등 브랜드 솔루션).
4) marketingPriority4: 정확히 4개. pillar는 반드시 순서대로 "인플루언서/바이럴", "온드미디어/에셋", "프로모션/굿즈", "브랜딩/이미지", title(짧게), action(실행안 구체적으로).
5) creativeCopy: 매체별 후킹 문구(Headline TOP 3). intro는 2단계 USP·CTR 관점을 한 줄로(2~3문장). types는 정확히 3개, 순서 A→B→C.
   - types[].letter는 "A","B","C" 고정 순서.
   - types[].label: A는 "문제해결형 (Problem/Solution)", B는 "감성/경험 소구형 (Emotional/Lifestyle)", C는 "신뢰/성과 강조형 (Authority/Social Proof)" 형식으로.
   - types[].appeal: 해당 유형의 소구점(불만·감성·신뢰 등)을 1문단으로, 리뷰 VOC와 USP와 연결.
   - types[].headlines: 정확히 3개 문자열. 광고 헤드라인 후보(따옴표 포함 가능).
   - types[].primaryText: 위 헤드라인 중 하나를 보완하는 메인 카피 2~4문장.
   - guidelineBullets: 정확히 3개 문자열 — (1) 의문문·반전 구조 활용 (2) 구체적 숫자·근거로 신뢰 (3) VDL 톤앤매너(세련·시크, 이모지 과다 자제, 짧은 호흡).

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
    "creativeCopy": {
      "intro": "",
      "types": [
        {"letter":"A","label":"문제해결형 (Problem/Solution)","appeal":"","headlines":["","",""],"primaryText":""},
        {"letter":"B","label":"감성/경험 소구형 (Emotional/Lifestyle)","appeal":"","headlines":["","",""],"primaryText":""},
        {"letter":"C","label":"신뢰/성과 강조형 (Authority/Social Proof)","appeal":"","headlines":["","",""],"primaryText":""}
      ],
      "guidelineBullets": ["","",""]
    }
  }
}`;
}

const DEFAULT_CREATIVE_GUIDELINES = [
  '의문문이나 반전: "아직도 수정 화장하세요?" 같은 의문문이나, "파운데이션인 줄 알았는데 스킨케어네요" 같은 반전 구조를 활용하세요.',
  "숫자 활용: '8시간 유지', '99% 만족' 등 구체적인 숫자를 넣어 신뢰도를 높이세요.",
  "VDL 톤앤매너: 세련되고 시크한 느낌을 위해 과도한 이모지 사용은 자제하고, 문장의 호흡을 짧게 끊어 임팩트를 주세요.",
];

const CREATIVE_TYPE_DEFAULTS = [
  { letter: "A", label: "문제해결형 (Problem/Solution)" },
  { letter: "B", label: "감성/경험 소구형 (Emotional/Lifestyle)" },
  { letter: "C", label: "신뢰/성과 강조형 (Authority/Social Proof)" },
];

function archetypeToShortLabel(archetype) {
  const a = String(archetype || "").trim();
  if (a.includes("문제") || a.includes("Problem")) return "문제해결형";
  if (a.includes("감성") || a.includes("Emotional") || a.includes("라이프")) return "감성소구형";
  if (a.includes("신뢰") || a.includes("Authority") || a.includes("성과")) return "신뢰강조형";
  return a || "유형";
}

function normalizeCreativeCopy(raw) {
  const padHeadlines = (arr) => {
    const h = Array.isArray(arr)
      ? arr.map((s) => String(s).trim()).slice(0, 3)
      : [];
    while (h.length < 3) h.push("");
    return h;
  };

  const cc = raw && typeof raw === "object" ? raw.creativeCopy : null;
  if (cc && typeof cc === "object" && Array.isArray(cc.types) && cc.types.length > 0) {
    const types = CREATIVE_TYPE_DEFAULTS.map((def, i) => {
      const t = cc.types[i] || {};
      const headlines = padHeadlines(t.headlines);
      return {
        letter: String(t.letter || def.letter).toUpperCase().slice(0, 1) || def.letter,
        label: String(t.label || def.label).trim() || def.label,
        appeal: String(t.appeal || t.sellingAngle || "").trim(),
        headlines: headlines,
        primaryText: String(t.primaryText || "").trim(),
      };
    });
    const guidelineBullets = Array.isArray(cc.guidelineBullets)
      ? cc.guidelineBullets.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
      : [];
    const gl =
      guidelineBullets.length >= 3
        ? guidelineBullets.slice(0, 3)
        : [...DEFAULT_CREATIVE_GUIDELINES];
    return {
      intro: String(cc.intro || cc.subtitle || "").trim(),
      types,
      guidelineBullets: gl,
    };
  }

  /** 레거시 creativeHooks → 신규 구조 */
  const hooks = Array.isArray(raw?.creativeHooks) ? raw.creativeHooks : [];
  const shortArchetypes = ["문제해결형", "감성소구형", "신뢰강조형"];
  const types = CREATIVE_TYPE_DEFAULTS.map((def, i) => {
    const row = hooks[i] || {};
    const h1 = String(row.headline || "").trim();
    const h2 = String(row.headline2 || "").trim();
    const h3 = String(row.headline3 || "").trim();
    const headlines = padHeadlines(
      h2 || h3 ? [h1, h2, h3] : h1 ? [h1] : []
    );
    return {
      letter: def.letter,
      label: def.label,
      appeal: String(row.appeal || "").trim(),
      headlines,
      primaryText: String(row.primaryText || "").trim(),
    };
  });
  return {
    intro: "",
    types,
    guidelineBullets: [...DEFAULT_CREATIVE_GUIDELINES],
  };
}

function deriveCreativeHooksFromCopy(creativeCopy) {
  const shortArchetypes = ["문제해결형", "감성소구형", "신뢰강조형"];
  return (creativeCopy.types || []).slice(0, 3).map((t, i) => {
    const parts = (t.headlines || []).map((x) => String(x).trim()).filter(Boolean);
    return {
      archetype: shortArchetypes[i] || archetypeToShortLabel(t.label),
      headline: parts[0] || "",
      primaryText: t.primaryText || "",
    };
  });
}

function deriveFrequencyPct(row) {
  const raw = row?.frequencyPct ?? row?.frequency_pct ?? row?.frequencyPercent;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0 && n <= 100) return Math.round(n);
  const label = String(row?.frequencyLabel || row?.frequency || "");
  const m = label.match(/(\d{1,3})\s*%/);
  if (m) return Math.min(100, Math.max(0, parseInt(m[1], 10)));
  return null;
}

function normalizeAbmReport(raw) {
  const emptyRi = {
    positiveKeywords: [],
    negativeKeywords: [],
    top5Voc: [],
    realVoices: [],
  };
  const emptyCopy = normalizeCreativeCopy(null);
  const empty = {
    reviewInsight: emptyRi,
    uspTop3: [],
    painPivot: [],
    marketingPriority4: [],
    creativeCopy: emptyCopy,
    creativeHooks: deriveCreativeHooksFromCopy(emptyCopy),
  };
  if (!raw || typeof raw !== "object") return empty;

  const ri = raw.reviewInsight || {};
  const top5Voc = Array.isArray(ri.top5Voc)
    ? ri.top5Voc.slice(0, 5).map((row, i) => {
        const frequencyPct = deriveFrequencyPct(row);
        return {
          rank: Number(row.rank) || i + 1,
          theme: String(row.theme || "").trim(),
          frequencyPct,
          frequencyLabel: String(row.frequencyLabel || row.frequency || "").trim(),
          summary: String(row.summary || "").trim(),
        };
      })
    : [];

  const realVoices = Array.isArray(ri.realVoices)
    ? ri.realVoices.map((s) => String(s).trim()).filter(Boolean).slice(0, 5)
    : [];

  const creativeCopy = normalizeCreativeCopy(raw);

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
    creativeCopy,
    creativeHooks: deriveCreativeHooksFromCopy(creativeCopy),
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
