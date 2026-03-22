/**
 * Google AI Studio (Gemini) API
 * 환경변수: GEMINI_API_KEY 또는 GOOGLE_API_KEY, 선택 GEMINI_MODEL
 * 기본 모델: gemini-2.5-flash (1.5 시리즈는 API에서 단계적으로 제거되어 404가 날 수 있음)
 */

const {
  extractJsonFromText,
  INSIGHT_SYSTEM_PROMPT,
  buildUserPrompt,
} = require("./strategicInsightsCore");

/** 우선 시도 순서 — 앞 모델이 404/미지원이면 다음으로 */
const MODEL_FALLBACK_CHAIN = [
  process.env.GEMINI_MODEL,
  "gemini-1.5-flash-002",
  "gemini-1.5-flash-001",
  "gemini-1.5-flash-8b",
].filter(Boolean);

function uniqueModels(list) {
  return [...new Set(list.map((m) => String(m).trim()).filter(Boolean))];
}

function parseGeminiResponse(raw, modelTried) {
  const data = JSON.parse(raw);
  const cand = data.candidates?.[0];
  if (!cand) {
    throw new Error(
      `Gemini 응답에 candidates가 없습니다. (모델: ${modelTried}) API 키·할당량·차단 여부를 확인하세요.`
    );
  }
  const text = cand.content?.parts?.map((p) => p.text || "").join("") || "";

  try {
    const trimmed = text.trim();
    if (trimmed.startsWith("{")) {
      return JSON.parse(trimmed);
    }
  } catch {
    /* fall through */
  }

  return extractJsonFromText(text);
}

async function callGenerateContent(apiKey, modelId, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelId
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  return { res, raw, modelId };
}

async function generateGeminiStrategicInsights({ reviews, meta }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY(또는 GOOGLE_API_KEY)가 설정되지 않았습니다. Google AI Studio에서 발급한 키를 backend/.env에 추가해 주세요."
    );
  }

  const userPrompt = buildUserPrompt(reviews, meta);

  const body = {
    systemInstruction: {
      parts: [{ text: INSIGHT_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  };

  const modelsToTry = uniqueModels(MODEL_FALLBACK_CHAIN);
  const errors = [];

  for (const modelId of modelsToTry) {
    try {
      const { res, raw, modelId: tried } = await callGenerateContent(apiKey, modelId, body);

      if (!res.ok) {
        let msg = raw;
        try {
          const j = JSON.parse(raw);
          msg = j.error?.message || JSON.stringify(j.error) || raw;
        } catch {
          /* ignore */
        }
        const isModelNotFound = res.status === 404 || /not found|is not supported/i.test(msg);
        errors.push(`${tried} (${res.status}): ${msg}`);
        if (isModelNotFound) continue;
        throw new Error(`Gemini API 오류 (${res.status}): ${msg}`);
      }

      return parseGeminiResponse(raw, tried);
    } catch (err) {
      if (err.message && err.message.startsWith("Gemini API 오류")) throw err;
      errors.push(`${modelId}: ${err.message || err}`);
    }
  }

  throw new Error(
    `사용 가능한 Gemini 모델을 찾지 못했습니다. 시도: ${modelsToTry.join(", ")}\n` +
      errors.map((e) => `· ${e}`).join("\n") +
      "\n→ Google AI Studio / ai.google.dev 모델 목록에서 지원되는 Flash 모델 ID를 GEMINI_MODEL에 지정해 보세요."
  );
}

module.exports = {
  generateGeminiStrategicInsights,
  DEFAULT_MODEL: "gemini-2.5-flash",
};
