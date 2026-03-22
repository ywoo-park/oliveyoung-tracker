/**
 * Claude API로 리뷰 데이터를 마케팅 전략 인사이트로 해석합니다. (선택·레거시)
 * 환경변수: ANTHROPIC_API_KEY, 선택 CLAUDE_MODEL
 */

const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";

const {
  extractJsonFromText,
  INSIGHT_SYSTEM_PROMPT,
  buildUserPrompt,
  normalizeInsights,
} = require("./strategicInsightsCore");

async function generateStrategicInsights({ reviews, meta }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY가 설정되지 않았습니다. 백엔드 .env에 Claude API 키를 추가해 주세요."
    );
  }

  const userPrompt = buildUserPrompt(reviews, meta);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: 8192,
      system: INSIGHT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    let msg = raw;
    try {
      const j = JSON.parse(raw);
      msg = j.error?.message || raw;
    } catch {
      /* ignore */
    }
    throw new Error(`Claude API 오류 (${res.status}): ${msg}`);
  }

  const data = JSON.parse(raw);
  const textBlock = data.content?.find((c) => c.type === "text");
  const text = textBlock?.text || "";
  return extractJsonFromText(text);
}

module.exports = {
  generateStrategicInsights,
  normalizeInsights,
};
