/**
 * 백엔드 PostgreSQL에 리뷰 분석 히스토리를 저장/조회합니다.
 * DB를 쓸 수 없으면 page에서 localStorage 경로로 폴백합니다.
 */

/**
 * @param {string} apiBase 예: http://localhost:4000
 * @returns {Promise<import('./analysisHistory').AnalysisSession[]>}
 */
export async function fetchReviewSessions(apiBase) {
  const r = await fetch(`${apiBase}/api/review-sessions`, { method: 'GET' });
  if (!r.ok) {
    const err = new Error(`review-sessions ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

/**
 * @param {string} apiBase
 * @param {import('./analysisHistory').AnalysisSession} sessionShape productName, summary, keywordsLine, sourceUrl, content
 */
export async function createReviewSession(apiBase, sessionShape) {
  const r = await fetch(`${apiBase}/api/review-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productName: sessionShape.productName,
      summary: sessionShape.summary,
      keywordsLine: sessionShape.keywordsLine,
      sourceUrl: sessionShape.sourceUrl,
      content: sessionShape.content,
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    let msg = t;
    try {
      msg = JSON.parse(t).error || t;
    } catch {
      /* ignore */
    }
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

/**
 * @param {string} apiBase
 * @param {string} id UUID
 * @param {string} productName
 */
export async function patchReviewSessionName(apiBase, id, productName) {
  const r = await fetch(`${apiBase}/api/review-sessions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productName }),
  });
  if (!r.ok) {
    const t = await r.text();
    let msg = t;
    try {
      msg = JSON.parse(t).error || t;
    } catch {
      /* ignore */
    }
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

/**
 * @param {string} apiBase
 * @param {string} id UUID
 */
export async function deleteReviewSession(apiBase, id) {
  const r = await fetch(`${apiBase}/api/review-sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (r.status === 204) return;
  if (!r.ok) {
    const t = await r.text();
    let msg = t;
    try {
      msg = JSON.parse(t).error || t;
    } catch {
      /* ignore */
    }
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
}
