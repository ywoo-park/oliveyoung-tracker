'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function pct(part, total) {
  if (!total) return '0.0';
  return ((part / total) * 100).toFixed(1);
}

function strengthBarClass(strength) {
  if (strength === 'high') return 'bg-violet-600 w-full';
  if (strength === 'medium') return 'bg-violet-400 w-2/3';
  return 'bg-violet-200 w-1/3';
}

function strengthLabel(strength) {
  if (strength === 'high') return '높음';
  if (strength === 'medium') return '보통';
  return '낮음';
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [limit, setLimit] = useState(80);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function handleAnalyze(e) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_URL}/api/reviews/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), limit }),
      });
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `서버 응답을 해석할 수 없습니다. 백엔드가 ${API_URL} 에서 실행 중인지 확인하세요.`
        );
      }
      if (!res.ok) {
        throw new Error(data?.error || `요청 실패 (${res.status})`);
      }
      setResult(data);
    } catch (err) {
      const msg = err?.message || String(err);
      const isNetwork =
        msg === 'Failed to fetch' ||
        msg === 'Load failed' ||
        msg.includes('NetworkError') ||
        msg.includes('fetch');
      setError(
        isNetwork
          ? `연결에 실패했습니다(Load failed). ① 백엔드 실행: cd backend && npm run dev ② 프론트 .env.local 의 NEXT_PUBLIC_API_URL이 백엔드 주소와 같은지 확인 (로컬은 보통 http://localhost:4000) ③ Vercel 배포 시 Railway 등 HTTPS API 주소를 넣었는지 확인`
          : msg
      );
    } finally {
      setLoading(false);
    }
  }

  const si = result?.strategicInsights;

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50/80 via-white to-slate-50 pt-24 pb-16 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <p className="text-xs font-semibold tracking-widest text-violet-600 uppercase mb-2">
            Strategic Insight Summary
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            리뷰 기반 마케팅 전략 인사이트
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            수집 리뷰를 Google Gemini(Flash 계열)가 VDL 전략 장표 형태로 해석합니다. (키 미설정 시 무료 로컬 분석)
          </p>
        </header>

        <div className="bg-white rounded-2xl border border-violet-100 shadow-sm p-6 mb-8">
          <form onSubmit={handleAnalyze} className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="올리브영 상품 URL (goodsNo 포함)"
              className="lg:col-span-8 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
            />
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="lg:col-span-2 border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            >
              <option value={50}>50건</option>
              <option value={80}>80건</option>
              <option value={100}>100건</option>
            </select>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="lg:col-span-2 rounded-xl bg-violet-700 text-white font-bold text-sm py-3 hover:bg-violet-800 transition-colors disabled:opacity-50"
            >
              {loading ? '분석 중…' : '전략 분석 실행'}
            </button>
          </form>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 px-5 py-4 mb-8 text-sm font-medium">
            {error}
          </div>
        )}

        {result && (
          <>
            {result.strategicInsightsSource && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    result.strategicInsightsSource === 'gemini'
                      ? 'bg-sky-100 text-sky-900'
                      : result.strategicInsightsSource === 'claude'
                        ? 'bg-violet-100 text-violet-800'
                        : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {result.strategicInsightsSource === 'gemini'
                    ? 'Gemini (Google AI Studio)'
                    : result.strategicInsightsSource === 'claude'
                      ? 'Claude AI 해석 (보조 API)'
                      : result.strategicInsightsSource === 'free_fallback'
                        ? '무료 로컬 분석 (AI 실패로 대체)'
                        : '무료 로컬 분석 (API 비용 없음)'}
                </span>
                {(result.strategicInsightsSource === 'free' || result.strategicInsightsSource === 'free_fallback') && (
                  <span className="text-xs text-slate-500">
                    패턴·키워드 기반이라 Gemini 대비 단순할 수 있어요. Google AI Studio 키를 넣으면 동일 장표가 AI로 채워집니다.
                  </span>
                )}
              </div>
            )}
            {/* 요약 KPI — 보조 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <div className="rounded-2xl bg-white border border-slate-100 px-4 py-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">수집 리뷰</p>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{result.meta.collectedReviews}</p>
              </div>
              <div className="rounded-2xl bg-white border border-slate-100 px-4 py-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">긍정</p>
                <p className="text-2xl font-extrabold text-violet-700 tabular-nums">
                  {pct(result.sentimentRatio.positive, result.sentimentRatio.total)}%
                </p>
              </div>
              <div className="rounded-2xl bg-white border border-slate-100 px-4 py-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">부정</p>
                <p className="text-2xl font-extrabold text-rose-600 tabular-nums">
                  {pct(result.sentimentRatio.negative, result.sentimentRatio.total)}%
                </p>
              </div>
              <div className="rounded-2xl bg-white border border-slate-100 px-4 py-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">상품</p>
                <p className="text-xs font-mono font-semibold text-slate-700 truncate" title={result.meta.goodsNo}>
                  {result.meta.goodsNo}
                </p>
              </div>
            </div>

            {result.strategicInsightsError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 px-5 py-4 mb-8 text-sm">
                <p className="font-bold mb-1">AI 전략 인사이트를 불러오지 못했습니다</p>
                <p className="text-amber-800/90">{result.strategicInsightsError}</p>
                <p className="mt-2 text-xs text-amber-800/70">
                  백엔드 <code className="bg-amber-100 px-1 rounded">.env</code>에{' '}
                  <code className="bg-amber-100 px-1 rounded">GEMINI_API_KEY</code> (또는{' '}
                  <code className="bg-amber-100 px-1 rounded">GOOGLE_API_KEY</code>)를 넣고 서버를 재시작해 주세요. Gemini
                  실패 시에만 Claude 키가 쓰입니다.
                </p>
              </div>
            )}

            {si && (
              <>
                {/* VDL 전략 장표 — Streamlit st.info / st.warning 스타일 가이드 */}
                {(si.positioningSummary ||
                  (si.painPointsTop5 && si.painPointsTop5.length > 0) ||
                  (si.satisfactionFactors && si.satisfactionFactors.length > 0)) && (
                  <section className="mb-10">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-800 text-sm font-bold">
                        ★
                      </span>
                      <div>
                        <h2 className="text-lg font-extrabold text-slate-900">VDL 전략 장표 · 마케팅 보고서 뷰</h2>
                        <p className="text-xs text-slate-500">
                          포지셔닝·VOC·기획 개선안 — 마케터/기획자용 톤 (USPs, 페인포인트, RTB 등)
                        </p>
                      </div>
                    </div>

                    {si.positioningSummary ? (
                      <div className="mb-5 rounded-xl border-l-4 border-sky-500 bg-sky-50/90 px-4 py-3 text-sm text-sky-950 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700 mb-1">
                          포지셔닝 요약 (한 줄)
                        </p>
                        <p className="font-semibold leading-relaxed">{si.positioningSummary}</p>
                      </div>
                    ) : null}

                    {si.painPointsTop5 && si.painPointsTop5.length > 0 ? (
                      <div className="mb-5 rounded-xl border-l-4 border-sky-500 bg-sky-50/90 px-4 py-4 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700 mb-3">
                          페인포인트 Top 5 &amp; 생생 VOC
                        </p>
                        <ol className="space-y-4 list-decimal list-inside marker:font-bold marker:text-sky-700">
                          {si.painPointsTop5.map((row, idx) => (
                            <li key={idx} className="text-sm text-slate-800">
                              <span className="font-bold text-slate-900">{row.pain}</span>
                              {(row.vocQuotes || []).length > 0 && (
                                <ul className="mt-2 ml-4 space-y-1.5 border-l-2 border-sky-200 pl-3">
                                  {(row.vocQuotes || []).map((q, qi) => (
                                    <li key={qi} className="text-xs text-slate-600 italic">
                                      “{q}”
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}

                    {si.satisfactionFactors && si.satisfactionFactors.length > 0 ? (
                      <div className="mb-5 rounded-xl border-l-4 border-sky-500 bg-sky-50/90 px-4 py-3 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700 mb-2">
                          핵심 만족 요인 (소비자 언어)
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-slate-800">
                          {si.satisfactionFactors.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {si.dissatisfactionFactors && si.dissatisfactionFactors.length > 0 ? (
                      <div className="mb-5 rounded-xl border-l-4 border-amber-500 bg-amber-50/95 px-4 py-3 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800 mb-2">
                          핵심 불만족 요인 (소비자 언어)
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-amber-950">
                          {si.dissatisfactionFactors.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {si.improvementActions && si.improvementActions.length > 0 ? (
                      <div className="space-y-3 mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 px-1">
                          제품 기획 관점 개선안 (실행 가능 수준)
                        </p>
                        {si.improvementActions.map((row, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border-l-4 border-violet-500 bg-violet-50/80 px-4 py-3 text-sm shadow-sm"
                          >
                            <p className="text-xs font-bold text-violet-900 mb-1">{row.targetIssue}</p>
                            <p className="text-slate-800 leading-relaxed">{row.productPlanningActions}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </section>
                )}

                {/* 1. 페인 포인트 → 솔루션 */}
                <section className="mb-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700 text-sm font-bold">
                      1
                    </span>
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900">페인 포인트 & 상세페이지 솔루션</h2>
                      <p className="text-xs text-slate-500">부정·아쉬움 패턴 상위 3가지와 마케팅 관점 대응</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(si.painPointSolutions || []).slice(0, 3).map((p, idx) => (
                      <article
                        key={idx}
                        className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm flex flex-col"
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md">
                            TOP {p.rank ?? idx + 1}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm leading-snug mb-2">{p.title}</h3>
                        <p className="text-xs text-slate-500 leading-relaxed flex-1 mb-3 border-l-2 border-slate-200 pl-2">
                          {p.evidenceSummary}
                        </p>
                        <div className="space-y-2 mt-auto">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">상세페이지 대응</p>
                            <p className="text-xs text-slate-700 leading-relaxed">{p.detailPageSolution}</p>
                          </div>
                          <div className="rounded-xl bg-violet-50/80 p-3 border border-violet-100">
                            <p className="text-[10px] font-bold text-violet-600 uppercase mb-1">마케팅 멘트</p>
                            <p className="text-xs font-semibold text-violet-900 leading-relaxed">{p.marketingMent}</p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                {/* 2. 셀링 포인트 + 메타 카피 */}
                <section className="mb-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700 text-sm font-bold">
                      2
                    </span>
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900">핵심 셀링 포인트 & 메타 후킹 카피</h2>
                      <p className="text-xs text-slate-500">리얼 보이스를 녹인 집행용 카피 3종</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    {(si.sellingPoints || []).slice(0, 2).map((s, idx) => (
                      <article
                        key={idx}
                        className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-violet-50/40 p-5"
                      >
                        <p className="text-[10px] font-bold text-violet-600 uppercase mb-1">Selling Point {idx + 1}</p>
                        <h3 className="font-extrabold text-slate-900 mb-2">{s.title}</h3>
                        <p className="text-sm text-slate-600 mb-3">{s.description}</p>
                        <div className="rounded-xl bg-slate-900 text-white p-3">
                          <p className="text-[10px] font-bold text-violet-300 uppercase mb-1">Real Voice</p>
                          <ul className="text-xs leading-relaxed space-y-1">
                            {(s.realVoiceQuotes || []).map((q, qi) => (
                              <li key={qi} className="opacity-95">
                                “{q}”
                              </li>
                            ))}
                          </ul>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {(si.metaAdCopies || []).slice(0, 3).map((ad, idx) => (
                      <article
                        key={idx}
                        className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-white bg-violet-700 px-2 py-0.5 rounded-md">
                            {ad.label || `카피 ${idx + 1}`}
                          </span>
                        </div>
                        <p className="text-base font-extrabold text-slate-900 mb-2">{ad.headline}</p>
                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{ad.primaryText}</p>
                        {ad.ctaHint && (
                          <p className="mt-3 text-xs font-semibold text-violet-700 border-t border-violet-100 pt-3">
                            CTA · {ad.ctaHint}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                </section>

                {/* 3. 사용 맥락 */}
                <section className="mb-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700 text-sm font-bold">
                      3
                    </span>
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900">사용 맥락 · 시즌 & 상황</h2>
                      <p className="text-xs text-slate-500">언제·어떤 상황에 쓰는지 리뷰 기반 추론</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
                    <p className="text-sm text-slate-700 leading-relaxed mb-6">{si.usageContext?.executiveSummary}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase mb-3">계절 언급 강도</p>
                        <ul className="space-y-3">
                          {(si.usageContext?.topSeasons || []).map((row, i) => (
                            <li key={i}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-semibold text-slate-800">{row.name}</span>
                                <span className="text-slate-500">{strengthLabel(row.strength)}</span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${strengthBarClass(row.strength)}`} />
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1">{row.rationale}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase mb-3">사용 상황</p>
                        <ul className="space-y-3">
                          {(si.usageContext?.topSituations || []).map((row, i) => (
                            <li key={i}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-semibold text-slate-800">{row.name}</span>
                                <span className="text-slate-500">{strengthLabel(row.strength)}</span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div className={`h-full rounded-full ${strengthBarClass(row.strength)}`} />
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1">{row.rationale}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 4. 마케팅 액션 */}
                <section className="mb-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700 text-sm font-bold">
                      4
                    </span>
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900">핵심 마케팅 액션 제안</h2>
                      <p className="text-xs text-slate-500">분석을 종합한 집행 우선순위 4가지</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(si.marketingActions || []).slice(0, 4).map((a, idx) => (
                      <article
                        key={idx}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-violet-100 rounded-bl-full opacity-60" />
                        <span className="relative text-3xl font-black text-violet-200 tabular-nums">
                          {String(a.number ?? idx + 1).padStart(2, '0')}
                        </span>
                        <h3 className="relative font-bold text-slate-900 mt-1 mb-2">{a.title}</h3>
                        <p className="relative text-sm text-slate-600 leading-relaxed mb-3">{a.description}</p>
                        <p className="relative text-[11px] text-violet-700 font-medium border-t border-slate-100 pt-3">
                          제안 근거 · {a.rationale}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* 키워드만 축소 표시 */}
            {result.keywords?.length > 0 && (
              <section className="rounded-2xl border border-slate-100 bg-white/80 p-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">참고 · 리뷰 키워드 상위</p>
                <div className="flex flex-wrap gap-2">
                  {result.keywords.map((k) => (
                    <span
                      key={k.word}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                    >
                      {k.word} <span className="text-slate-400">{k.count}</span>
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
