/**
 * 올리브영 리뷰 분석 세션 — 브라우저 localStorage 영속화
 * 스키마 버전을 키에 포함해 이후 마이그레이션에 대비합니다.
 */

export const ANALYSIS_SESSIONS_KEY = 'oy-review-analysis-sessions-v1';

/**
 * @typedef {Object} AnalysisSession
 * @property {string} id
 * @property {string} timestamp ISO 8601
 * @property {string} productName 목록·검색용 표시명 (사용자 변경 가능)
 * @property {string} summary 한 줄 요약 (히스토리 부제)
 * @property {string} keywordsLine 핵심 키워드 표시용 문자열
 * @property {Object} content /api/reviews/analyze 전체 응답 JSON
 * @property {string} sourceUrl 분석에 사용한 상품 URL
 */

/**
 * @returns {AnalysisSession[]}
 */
export function loadSessions() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ANALYSIS_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {AnalysisSession[]} sessions
 */
export function saveSessions(sessions) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ANALYSIS_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.warn('[analysisHistory] localStorage 저장 실패 (용량 초과 등)', e);
  }
}

/**
 * API 응답에서 히스토리 카드용 메타를 추출합니다.
 * @param {string} sourceUrl
 * @param {Object} apiResult
 * @returns {Omit<AnalysisSession, 'id'|'timestamp'>}
 */
export function deriveSessionFields(sourceUrl, apiResult) {
  const si = apiResult?.strategicInsights || {};
  const goodsNo = apiResult?.meta?.goodsNo || '';
  const keywords = apiResult?.keywords || [];

  const registered = String(apiResult?.meta?.productName || '').trim();
  const exec =
    String(si.usageContext?.executiveSummary || si.abmReport?.reviewInsight?.top5Voc?.[0]?.summary || '').trim();
  const positioning = String(si.positioningSummary || '').trim();

  /** 카드 제목: 백엔드가 넘긴 올리브영 등록 상품명 우선 (AI positioning 요약은 부제·요약으로만 사용) */
  const productName =
    registered.length > 0
      ? registered.length > 58
        ? `${registered.slice(0, 56)}…`
        : registered
      : goodsNo
        ? `올리브영 상품 ${goodsNo}`
        : '리뷰 분석';

  const keywordsLine = keywords
    .slice(0, 4)
    .map((k) => k.word)
    .filter(Boolean)
    .join(' · ');

  const summary =
    exec.length > 0
      ? exec.length > 72
        ? `${exec.slice(0, 70)}…`
        : exec
      : positioning.length > 0
        ? positioning.length > 72
          ? `${positioning.slice(0, 70)}…`
          : positioning
        : keywordsLine || `리뷰 ${apiResult?.meta?.collectedReviews ?? 0}건 분석`;

  return {
    productName,
    summary,
    keywordsLine,
    content: apiResult,
    sourceUrl,
  };
}

/**
 * 분석 완료 시 새 세션을 만들고 저장합니다.
 * @param {string} sourceUrl
 * @param {Object} apiResult
 * @param {AnalysisSession[]} currentSessions
 * @returns {{ sessions: AnalysisSession[], newId: string }}
 */
export function appendSessionFromApi(sourceUrl, apiResult, currentSessions) {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const derived = deriveSessionFields(sourceUrl, apiResult);
  /** @type {AnalysisSession} */
  const session = {
    id,
    timestamp: new Date().toISOString(),
    ...derived,
  };

  const next = [session, ...currentSessions.filter((s) => s.id !== id)];
  saveSessions(next);
  return { sessions: next, newId: id };
}

/**
 * @param {string} id
 * @param {string} newName
 * @param {AnalysisSession[]} currentSessions
 */
export function renameSession(id, newName, currentSessions) {
  const trimmed = String(newName || '').trim();
  if (!trimmed) return currentSessions;
  const next = currentSessions.map((s) =>
    s.id === id ? { ...s, productName: trimmed } : s
  );
  saveSessions(next);
  return next;
}

/**
 * @param {string} id
 * @param {AnalysisSession[]} currentSessions
 */
export function deleteSession(id, currentSessions) {
  const next = currentSessions.filter((s) => s.id !== id);
  saveSessions(next);
  return next;
}

/**
 * @param {string} q
 * @param {AnalysisSession[]} sessions
 */
export function filterSessionsByQuery(q, sessions) {
  const needle = String(q || '')
    .trim()
    .toLowerCase();
  if (!needle) return sessions;
  return sessions.filter((s) => {
    const hay = `${s.productName} ${s.summary} ${s.keywordsLine} ${s.sourceUrl}`.toLowerCase();
    return hay.includes(needle);
  });
}

/**
 * @param {string} iso
 * @returns {string} 예: 2026. 3. 22.
 */
export function formatSessionDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}
