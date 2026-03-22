'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AnalysisSidebar from '../components/AnalysisSidebar';
import {
  appendSessionFromApi,
  deleteSession as deleteSessionStorage,
  deriveSessionFields,
  loadSessions,
  renameSession as renameSessionStorage,
} from '../lib/analysisHistory';
import {
  createReviewSession,
  deleteReviewSession,
  fetchReviewSessions,
  patchReviewSessionName,
} from '../lib/reviewSessionsApi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function pct(part, total) {
  if (!total) return '0.0';
  return ((part / total) * 100).toFixed(1);
}

function ReportDivider() {
  return <hr className="my-8 border-0 border-t border-slate-200" />;
}

function AbmStrategicReport({ abm, sentimentRatio, keywords }) {
  if (!abm?.reviewInsight?.top5Voc?.length && !abm?.uspTop3?.length) return null;
  const ri = abm.reviewInsight || {};
  const total = sentimentRatio?.total || 0;

  return (
    <article className="mb-10 rounded-3xl border border-slate-200/80 bg-white shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-violet-50/40 px-6 sm:px-10 py-6">
        <p className="text-[10px] font-bold tracking-[0.2em] text-violet-600 uppercase mb-1">
          VDL · ABM Strategic Report
        </p>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          전략 분석 보고서
        </h2>
        <p className="text-xs text-slate-500 mt-2 max-w-2xl leading-relaxed">
          Modern &amp; Professional — 데이터 기반 현상 분석부터 크리에이티브 훅까지 논리적 흐름으로 정리했습니다.
        </p>
      </div>

      <div className="px-6 sm:px-10 py-8 text-slate-800">
        {/* 1️⃣ Review Insight */}
        <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            1️⃣
          </span>
          [Review Insight] 현상 분석 (Data Driven)
        </h3>
        <p className="text-xs text-slate-500 mb-4">긍·부정 비율, 핵심 키워드, Top 5 VOC, Real Voice</p>

        <div className="overflow-x-auto rounded-xl border border-slate-200 mb-4">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200">구분</th>
                <th className="px-4 py-3 border-b border-slate-200">비율</th>
                <th className="px-4 py-3 border-b border-slate-200">해석</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-3 font-semibold text-violet-700">긍정</td>
                <td className="px-4 py-3 tabular-nums font-bold">{pct(sentimentRatio?.positive, total)}%</td>
                <td className="px-4 py-3 text-slate-600 text-xs">만족·재구매·추천 톤 비중</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-rose-700">부정</td>
                <td className="px-4 py-3 tabular-nums font-bold">{pct(sentimentRatio?.negative, total)}%</td>
                <td className="px-4 py-3 text-slate-600 text-xs">아쉬움·불만 키워드 비중</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-slate-600">중립</td>
                <td className="px-4 py-3 tabular-nums font-bold">{pct(sentimentRatio?.neutral, total)}%</td>
                <td className="px-4 py-3 text-slate-600 text-xs">사용 맥락·묘사 위주</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
            <p className="text-[10px] font-bold text-violet-700 uppercase mb-2">만족 축 키워드</p>
            <p className="text-sm leading-relaxed">
              {(ri.positiveKeywords?.length
                ? ri.positiveKeywords
                : (keywords || []).slice(0, 6).map((k) => k.word)
              ).map((k, i, arr) => (
                <span key={`${k}-${i}`}>
                  {i > 0 ? ', ' : ''}
                  <strong className="text-slate-900">{k}</strong>
                </span>
              ))}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4 bg-amber-50/40">
            <p className="text-[10px] font-bold text-amber-800 uppercase mb-2">불만·리스크 축 키워드</p>
            <p className="text-sm leading-relaxed text-slate-800">
              {(ri.negativeKeywords || []).map((k, i, arr) => (
                <span key={`${k}-${i}`}>
                  {i > 0 ? ', ' : ''}
                  <strong>{k}</strong>
                </span>
              ))}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 mb-4">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200">#</th>
                <th className="px-4 py-3 border-b border-slate-200">VOC 테마</th>
                <th className="px-4 py-3 border-b border-slate-200">빈도·강도</th>
                <th className="px-4 py-3 border-b border-slate-200">요약</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(ri.top5Voc || []).map((row) => (
                <tr key={row.rank}>
                  <td className="px-4 py-3 font-bold text-violet-600 tabular-nums">{row.rank}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.theme}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{row.frequencyLabel}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{row.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Real Voice</p>
        <div className="space-y-2">
          {(ri.realVoices || []).map((q, i) => (
            <blockquote
              key={i}
              className="border-l-4 border-violet-400 bg-violet-50/50 pl-4 py-3 pr-3 text-sm text-slate-700 italic rounded-r-lg"
            >
              &ldquo;{q}&rdquo;
            </blockquote>
          ))}
        </div>

        <ReportDivider />

        {/* 2️⃣ USP */}
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            2️⃣
          </span>
          [Core Selling Points] 핵심 셀링 포인트 (USP TOP 3)
        </h3>
        <ol className="space-y-4 list-none counter-reset-none">
          {(abm.uspTop3 || []).map((u, idx) => (
            <li
              key={idx}
              className="rounded-xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/30 p-5 shadow-sm"
            >
              <p className="text-[10px] font-bold text-violet-600 uppercase mb-1">
                Point {idx + 1}: {u.axis}
              </p>
              <p className="font-extrabold text-slate-900 mb-2">{u.headline}</p>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{u.body}</p>
            </li>
          ))}
        </ol>

        <ReportDivider />

        {/* 3️⃣ Pain Pivot */}
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            3️⃣
          </span>
          [Strategic Solution] 페인포인트 대응 (Problem Solving)
        </h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200">Pain</th>
                <th className="px-4 py-3 border-b border-slate-200">Review signal</th>
                <th className="px-4 py-3 border-b border-slate-200">Brand solution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(abm.painPivot || []).map((row, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-semibold text-slate-900 align-top">{row.pain}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 align-top">{row.reviewSignal}</td>
                  <td className="px-4 py-3 text-xs text-slate-700 align-top leading-relaxed">{row.brandSolution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ReportDivider />

        {/* 4️⃣ Marketing */}
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            4️⃣
          </span>
          [Marketing Action] 핵심 액션 제안 (Priority TOP 4)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(abm.marketingPriority4 || []).map((m, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm relative overflow-hidden"
            >
              <span className="absolute top-3 right-4 text-3xl font-black text-slate-100 tabular-nums">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <p className="text-[10px] font-bold text-violet-600 uppercase mb-2">{m.pillar}</p>
              <p className="font-bold text-slate-900 mb-2">{m.title}</p>
              <p className="text-sm text-slate-600 leading-relaxed">{m.action}</p>
            </div>
          ))}
        </div>

        <ReportDivider />

        {/* 5️⃣ Creative */}
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            5️⃣
          </span>
          [Creative Copy] 매체별 후킹 문구
        </h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold text-slate-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200 w-32">유형</th>
                <th className="px-4 py-3 border-b border-slate-200">Headline</th>
                <th className="px-4 py-3 border-b border-slate-200">Primary text</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(abm.creativeHooks || []).map((c, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-bold text-violet-700 align-top whitespace-nowrap">{c.archetype}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900 align-top">{c.headline}</td>
                  <td className="px-4 py-3 text-slate-600 align-top leading-relaxed whitespace-pre-wrap">
                    {c.primaryText}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('ai');
  /** @type {import('../lib/analysisHistory').AnalysisSession[]} */
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  /** loading | remote(DB) | local(localStorage) */
  const [historyBackend, setHistoryBackend] = useState('loading');
  const historyModeRef = useRef('loading');

  useEffect(() => {
    let cancelled = false;
    historyModeRef.current = 'loading';
    (async () => {
      try {
        const list = await fetchReviewSessions(API_URL);
        if (cancelled) return;
        setSessions(Array.isArray(list) ? list : []);
        historyModeRef.current = 'remote';
        setHistoryBackend('remote');
      } catch {
        if (cancelled) return;
        setSessions(loadSessions());
        historyModeRef.current = 'local';
        setHistoryBackend('local');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectSession = useCallback((session) => {
    setResult(session.content);
    setActiveSessionId(session.id);
    setActiveTab('ai');
    setError(null);
    if (session.sourceUrl) setUrl(session.sourceUrl);
  }, []);

  const handleDeleteSession = useCallback(async (id) => {
    if (historyModeRef.current === 'remote') {
      try {
        await deleteReviewSession(API_URL, id);
      } catch (e) {
        console.warn('[history] 서버 삭제 실패', e);
        return;
      }
    }
    setSessions((prev) => {
      if (historyModeRef.current === 'local') {
        return deleteSessionStorage(id, prev);
      }
      return prev.filter((s) => s.id !== id);
    });
    setActiveSessionId((cur) => {
      if (cur === id) {
        setResult(null);
        return null;
      }
      return cur;
    });
  }, []);

  const handleRenameSession = useCallback(async (id, newName) => {
    const trimmed = String(newName || '').trim();
    if (!trimmed) return;
    if (historyModeRef.current === 'remote') {
      try {
        await patchReviewSessionName(API_URL, id, trimmed);
      } catch (e) {
        console.warn('[history] 서버 이름 변경 실패', e);
        return;
      }
    }
    setSessions((prev) => {
      if (historyModeRef.current === 'local') {
        return renameSessionStorage(id, trimmed, prev);
      }
      return prev.map((s) => (s.id === id ? { ...s, productName: trimmed } : s));
    });
  }, []);

  const handleNewAnalysis = useCallback(() => {
    setResult(null);
    setActiveSessionId(null);
    setError(null);
    setActiveTab('ai');
  }, []);

  async function handleAnalyze(e) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setActiveTab('ai');
    setActiveSessionId(null);

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
      const trimmedUrl = url.trim();
      const derived = deriveSessionFields(trimmedUrl, data);

      if (historyModeRef.current === 'remote') {
        try {
          const created = await createReviewSession(API_URL, {
            productName: derived.productName,
            summary: derived.summary,
            keywordsLine: derived.keywordsLine,
            sourceUrl: derived.sourceUrl,
            content: derived.content,
          });
          setSessions((prev) => [created, ...prev]);
          setActiveSessionId(created.id);
        } catch (e) {
          console.warn('[history] 서버 저장 실패, 이 분석만 브라우저에 저장합니다.', e);
          let newSessionId = null;
          setSessions((prev) => {
            const { sessions: next, newId } = appendSessionFromApi(trimmedUrl, data, prev);
            newSessionId = newId;
            return next;
          });
          if (newSessionId) setActiveSessionId(newSessionId);
        }
      } else {
        let newSessionId = null;
        setSessions((prev) => {
          const { sessions: next, newId } = appendSessionFromApi(trimmedUrl, data, prev);
          newSessionId = newId;
          return next;
        });
        if (newSessionId) setActiveSessionId(newSessionId);
      }
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

  const hasComparison = Boolean(result?.freeStrategicInsights);
  const si = hasComparison && activeTab === 'free'
    ? result.freeStrategicInsights
    : result?.strategicInsights;

  const historyStorageHint =
    historyBackend === 'remote'
      ? '히스토리는 서버 DB(PostgreSQL)에 저장됩니다.'
      : historyBackend === 'local'
        ? 'DB 미연결: 이 브라우저(localStorage)에만 저장됩니다. backend/.env의 DATABASE_URL을 확인하세요.'
        : '히스토리를 불러오는 중…';

  return (
    <>
      <AnalysisSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onNewAnalysis={handleNewAnalysis}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        storageHint={historyStorageHint}
      />

      {/* 모바일: 햄버거 — 히스토리 드로어 열기 */}
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        className="fixed left-3 top-3 z-40 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-700 shadow-md backdrop-blur lg:hidden"
        aria-label="분석 히스토리 열기"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <main className="min-h-screen bg-gradient-to-b from-violet-50/80 via-white to-slate-50 pb-16 pl-0 pt-16 lg:pl-[260px] lg:pt-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
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
              title="100 / 500 / 1000건까지 요청할 수 있습니다. 많을수록 수집·AI 분석에 시간이 더 걸립니다."
            >
              <option value={100}>100건</option>
              <option value={500}>500건</option>
              <option value={1000}>1,000건</option>
            </select>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="lg:col-span-2 rounded-xl bg-violet-700 text-white font-bold text-sm py-3 hover:bg-violet-800 transition-colors disabled:opacity-50"
            >
              {loading ? '분석 중…' : '전략 분석 실행'}
            </button>
          </form>
          <p className="mt-3 text-xs text-slate-500">
            리뷰 500·1,000건은 수집에 수 분이 걸릴 수 있습니다. 전체 등록 리뷰(예: 1만 걸음)를 한 번에 가져오지는 않고, 여기서 선택한 건수만 샘플링합니다.
          </p>
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

            {hasComparison && (
              <div className="mb-6 flex gap-1 border-b border-slate-200">
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === 'ai'
                      ? 'border-violet-600 text-violet-700'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {result.strategicInsightsSource === 'gemini' ? 'Gemini' : 'Claude'} 분석
                </button>
                <button
                  onClick={() => setActiveTab('free')}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === 'free'
                      ? 'border-violet-600 text-violet-700'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  무료 분석
                </button>
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

            {si?.abmReport && (
              <AbmStrategicReport
                abm={si.abmReport}
                sentimentRatio={result.sentimentRatio}
                keywords={result.keywords}
              />
            )}

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
          </>
        )}
        </div>
      </main>
    </>
  );
}
