'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AnalysisSidebar from '../components/AnalysisSidebar';
import ReviewLimitSelect from '../components/ReviewLimitSelect';
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

  /** 결과 없을 때: ChatGPT 스타일 가운데 랜딩 */
  const isLanding = !result;

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

      <main
        className={[
          'min-h-[100dvh] pl-0 transition-[padding] duration-300',
          'bg-[#f4f4f5] bg-gradient-to-b from-[#f4f4f5] via-[#fafafa] to-[#ececf0]',
          'lg:pl-[260px]',
          isLanding
            ? 'flex flex-col justify-center pb-12 pt-20 lg:min-h-screen lg:py-0 lg:pt-0'
            : 'pb-16 pt-20 lg:pt-24',
        ].join(' ')}
      >
        <div
          className={[
            'mx-auto w-full px-4 sm:px-6',
            isLanding ? 'max-w-[42rem] flex flex-col items-center' : 'max-w-5xl',
          ].join(' ')}
        >
          {isLanding ? (
            <>
              <header className="mb-10 text-center sm:mb-12">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-600/90">
                  Strategic Insight
                </p>
                <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl sm:leading-tight">
                  리뷰 기반 마케팅 전략 인사이트
                </h1>
                <p className="mx-auto mt-5 max-w-md text-pretty text-[15px] leading-relaxed text-slate-500">
                  올리브영 상품 URL만 입력하면 리뷰를 수집하고, Gemini가 VDL 전략 장표 형태로 해석합니다.
                  <span className="mt-1 block text-sm text-slate-400">API 키가 없으면 무료 로컬 분석으로 동작합니다.</span>
                </p>
              </header>

              <div className="w-full rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-3 shadow-[0_24px_64px_-12px_rgba(15,23,42,0.12)] backdrop-blur-md sm:p-4">
                <form onSubmit={handleAnalyze} className="flex flex-col gap-3">
                  <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="올리브영 상품 URL을 입력하세요"
                      className="min-h-[52px] w-full flex-1 rounded-2xl border border-slate-200/90 bg-slate-50/80 px-5 py-3.5 text-[15px] text-slate-800 shadow-inner shadow-slate-200/20 placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-500/10"
                    />
                    <div className="flex shrink-0 gap-2 sm:w-auto">
                      <ReviewLimitSelect value={limit} onChange={setLimit} variant="landing" />
                      <button
                        type="submit"
                        disabled={loading || !url.trim()}
                        className="min-h-[52px] rounded-2xl bg-slate-900 px-6 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {loading ? '분석 중…' : '실행'}
                      </button>
                    </div>
                  </div>
                  <p className="px-1 text-center text-[12px] leading-relaxed text-slate-400 sm:text-left">
                    500·1,000건은 수 분 걸릴 수 있습니다. 선택한 건수만 샘플링합니다.
                  </p>
                </form>
              </div>

              {error ? (
                <div className="mt-8 w-full max-w-xl rounded-2xl border border-red-200/80 bg-red-50/90 px-5 py-4 text-center text-sm font-medium text-red-700">
                  {error}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <header className="mb-6">
                <p className="text-xs font-semibold tracking-widest text-violet-600 uppercase mb-1">
                  Strategic Insight Summary
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  리뷰 기반 마케팅 전략 인사이트
                </h1>
              </header>

              <div className="mb-8 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm backdrop-blur-sm">
                <form onSubmit={handleAnalyze} className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="올리브영 상품 URL"
                    className="min-h-11 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                  <div className="flex gap-2 shrink-0">
                    <ReviewLimitSelect value={limit} onChange={setLimit} variant="compact" />
                    <button
                      type="submit"
                      disabled={loading || !url.trim()}
                      className="min-h-11 rounded-xl bg-violet-700 px-5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
                    >
                      {loading ? '분석 중…' : '다시 분석'}
                    </button>
                  </div>
                </form>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 px-5 py-4 mb-8 text-sm font-medium">
                  {error}
                </div>
              ) : null}
            </>
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
