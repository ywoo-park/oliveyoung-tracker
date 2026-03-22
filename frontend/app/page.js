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

/** 장표형 슬라이드 블록 — 좌측 액센트 + 헤더/본문 분리 */
function ReportSection({ emoji, title, subtitle, children }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_12px_40px_-8px_rgba(15,23,42,0.1)] ring-1 ring-mood-feather/[0.06] sm:rounded-3xl">
      <div
        className="absolute bottom-0 left-0 top-0 w-1 bg-gradient-to-b from-mood-oasis via-mood-oasisHover to-mood-celery sm:w-1.5"
        aria-hidden
      />
      <div className="pl-4 sm:pl-5">
        <header className="border-b border-slate-100 bg-gradient-to-r from-slate-50/90 to-white px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            <span
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-md shadow-slate-200/80 ring-1 ring-slate-200/80 sm:h-14 sm:w-14 sm:text-[1.65rem]"
              aria-hidden
            >
              {emoji}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-pretty text-lg font-bold leading-snug tracking-tight text-mood-feather sm:text-xl lg:text-2xl">
                {title}
              </h3>
              {subtitle ? (
                <p className="mt-2.5 max-w-3xl text-sm font-medium leading-relaxed text-slate-600 sm:text-[15px] sm:leading-7">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
        </header>
        <div className="px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </div>
    </section>
  );
}

/** 보고서 내 표 공통 래퍼 (가독성: 여백·라운드·얕은 깊이) */
function ReportTableWrap({ children, className = '' }) {
  return (
    <div
      className={`overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${className}`}
    >
      {children}
    </div>
  );
}

function AbmStrategicReport({ abm, sentimentRatio, keywords }) {
  if (!abm?.reviewInsight?.top5Voc?.length && !abm?.uspTop3?.length) return null;
  const ri = abm.reviewInsight || {};
  const total = sentimentRatio?.total || 0;

  return (
    <article className="mb-10 overflow-hidden rounded-3xl border border-mood-feather/10 bg-mood-ice/80 shadow-[0_24px_60px_-12px_rgba(8,20,18,0.12)] ring-1 ring-mood-feather/[0.06]">
      {/* 표지 슬라이드 — 밝은 톤 */}
      <div className="relative border-b border-mood-oasis/55 bg-gradient-to-br from-mood-ice via-mood-oasis/30 to-mood-celery/20 px-6 py-7 text-mood-feather sm:px-10 sm:py-8">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-mood-oasis/50 blur-3xl sm:h-48 sm:w-48"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-6 left-1/4 h-24 w-56 rounded-full bg-mood-oasis/25 blur-3xl sm:h-28 sm:w-64"
          aria-hidden
        />
        <p className="relative text-[10px] font-bold uppercase tracking-[0.26em] text-mood-feather sm:text-[11px]">
          BM · Strategic Report
        </p>
        <h2 className="relative mt-2 text-xl font-bold tracking-tight text-mood-feather sm:text-2xl lg:text-3xl">
          전략 분석 보고서
        </h2>
        <div
          className="relative mt-4 h-px max-w-md bg-gradient-to-r from-mood-oasis/70 via-slate-300/50 to-transparent sm:mt-5"
          aria-hidden
        />
      </div>

      <div className="space-y-6 px-4 py-8 text-slate-800 sm:space-y-8 sm:px-6 sm:py-10 lg:px-8">
        <ReportSection
          emoji="1️⃣"
          title="[Review Insight] 현상 분석"
          subtitle="긍·부정 비율, 핵심 키워드, Top 5 VOC, Real Voice"
        >
        <ReportTableWrap className="mb-5">
          <table className="min-w-full text-sm">
            <thead className="bg-mood-oasis text-left text-xs font-bold uppercase tracking-wider text-mood-feather">
              <tr>
                <th className="px-5 py-3.5 sm:px-6">구분</th>
                <th className="px-5 py-3.5 sm:px-6">비율</th>
                <th className="px-5 py-3.5 sm:px-6">해석</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              <tr className="transition-colors even:bg-slate-50/60 hover:bg-mood-celery/30">
                <td className="px-5 py-4 font-semibold text-mood-feather sm:px-6">긍정</td>
                <td className="px-5 py-4 tabular-nums text-base font-bold text-mood-feather sm:px-6">
                  {pct(sentimentRatio?.positive, total)}%
                </td>
                <td className="px-5 py-4 text-slate-600 sm:px-6 sm:text-sm sm:leading-6">만족·재구매·추천 톤 비중</td>
              </tr>
              <tr className="transition-colors even:bg-slate-50/60 hover:bg-rose-50/30">
                <td className="px-5 py-4 font-semibold text-rose-700 sm:px-6">부정</td>
                <td className="px-5 py-4 tabular-nums text-base font-bold text-mood-feather sm:px-6">
                  {pct(sentimentRatio?.negative, total)}%
                </td>
                <td className="px-5 py-4 text-slate-600 sm:px-6 sm:text-sm sm:leading-6">아쉬움·불만 키워드 비중</td>
              </tr>
              <tr className="transition-colors even:bg-slate-50/60 hover:bg-slate-50/80">
                <td className="px-5 py-4 font-semibold text-slate-700 sm:px-6">중립</td>
                <td className="px-5 py-4 tabular-nums text-base font-bold text-mood-feather sm:px-6">
                  {pct(sentimentRatio?.neutral, total)}%
                </td>
                <td className="px-5 py-4 text-slate-600 sm:px-6 sm:text-sm sm:leading-6">사용 맥락·묘사 위주</td>
              </tr>
            </tbody>
          </table>
        </ReportTableWrap>

        <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white to-mood-celery/30 p-5 shadow-sm sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-wide text-mood-feather">만족 축 키워드</p>
            <p className="mt-3 text-[15px] leading-7 text-slate-800">
              {(ri.positiveKeywords?.length
                ? ri.positiveKeywords
                : (keywords || []).slice(0, 6).map((k) => k.word)
              ).map((k, i, arr) => (
                <span key={`${k}-${i}`}>
                  {i > 0 ? ', ' : ''}
                  <strong className="text-mood-feather">{k}</strong>
                </span>
              ))}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/90 to-white p-5 shadow-sm sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900">불만·리스크 축 키워드</p>
            <p className="mt-3 text-[15px] leading-7 text-slate-800">
              {(ri.negativeKeywords || []).map((k, i, arr) => (
                <span key={`${k}-${i}`}>
                  {i > 0 ? ', ' : ''}
                  <strong>{k}</strong>
                </span>
              ))}
            </p>
          </div>
        </div>

        <ReportTableWrap className="mb-6">
          <table className="w-full min-w-full table-fixed text-sm">
            <colgroup>
              <col className="w-11 sm:w-12" />
              <col className="w-[33%]" />
              <col className="w-[13%] sm:w-[12%]" />
              <col />
            </colgroup>
            <thead className="bg-mood-oasis text-left text-xs font-bold uppercase tracking-wider text-mood-feather">
              <tr>
                <th className="px-4 py-3.5 sm:px-5">#</th>
                <th className="px-4 py-3.5 sm:px-5">VOC 테마</th>
                <th className="px-4 py-3.5 sm:px-5">빈도·강도</th>
                <th className="px-4 py-3.5 sm:px-5">요약</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {(ri.top5Voc || []).map((row) => {
                const pctNum = Number(row.frequencyPct);
                const hasPct = Number.isFinite(pctNum) && pctNum >= 0 && pctNum <= 100;
                return (
                <tr key={row.rank} className="transition-colors even:bg-slate-50/60 hover:bg-mood-celery/25">
                  <td className="px-4 py-4 align-top font-bold tabular-nums text-mood-feather sm:px-5">{row.rank}</td>
                  <td className="min-w-0 px-4 py-4 align-top font-semibold text-mood-feather sm:px-5 sm:text-[15px] sm:leading-snug">
                    <span className="block text-pretty">{row.theme}</span>
                  </td>
                  <td className="min-w-0 px-4 py-4 align-top sm:px-5 sm:text-sm sm:leading-6">
                    {hasPct ? (
                      <span className="inline-flex flex-col gap-0.5">
                        <span className="font-semibold tabular-nums text-mood-feather">
                          {Math.round(pctNum)}%
                        </span>
                        {row.frequencyLabel &&
                        !String(row.frequencyLabel).includes(String(Math.round(pctNum))) ? (
                          <span className="text-xs font-medium text-slate-500">{row.frequencyLabel}</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-slate-600">{row.frequencyLabel || '—'}</span>
                    )}
                  </td>
                  <td className="min-w-0 px-4 py-4 align-top text-slate-600 sm:px-5 sm:text-sm sm:leading-6">
                    {row.summary}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </ReportTableWrap>

        <div className="mb-3 flex items-center gap-2">
          <span className="h-px flex-1 max-w-12 bg-slate-300" aria-hidden />
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Real Voice</p>
          <span className="h-px flex-1 bg-slate-200" aria-hidden />
        </div>
        <div className="space-y-3">
          {(ri.realVoices || []).map((q, i) => (
            <blockquote
              key={i}
              className="rounded-r-2xl border border-slate-200/70 border-l-4 border-l-mood-oasis bg-gradient-to-r from-mood-oasis/25 to-white py-4 pl-5 pr-5 text-[15px] italic leading-7 text-slate-700 shadow-sm sm:pl-6 sm:pr-6"
            >
              &ldquo;{q}&rdquo;
            </blockquote>
          ))}
        </div>
        </ReportSection>

        <ReportSection emoji="2️⃣" title="[USP Top 3] 핵심 셀링 포인트">
        <ol className="list-none space-y-5 counter-reset-none">
          {(abm.uspTop3 || []).map((u, idx) => (
            <li
              key={idx}
              className="relative overflow-hidden rounded-2xl border border-mood-oasis/45 bg-gradient-to-br from-white via-mood-ice to-mood-celery/35 p-5 shadow-md shadow-mood-feather/10 ring-1 ring-mood-feather/[0.05] sm:p-6"
            >
              <div className="absolute right-4 top-4 font-mono text-4xl font-black tabular-nums text-mood-celery/70 sm:text-5xl">
                {String(idx + 1).padStart(2, '0')}
              </div>
              <p className="relative text-[11px] font-bold uppercase tracking-wide text-mood-feather">
                Point {idx + 1}: {u.axis}
              </p>
              <p className="relative mt-2 max-w-[90%] text-lg font-bold leading-snug text-mood-feather sm:text-xl">
                {u.headline}
              </p>
              <p className="relative mt-4 text-[15px] leading-7 text-slate-600 whitespace-pre-wrap">{u.body}</p>
            </li>
          ))}
        </ol>
        </ReportSection>

        <ReportSection emoji="3️⃣" title="[Problem Solving] 페인포인트 대응">
        <ReportTableWrap>
          <table className="min-w-full text-sm">
            <thead className="bg-mood-oasis text-left text-xs font-bold uppercase tracking-wider text-mood-feather">
              <tr>
                <th className="min-w-[132px] px-4 py-3.5 sm:min-w-[168px] sm:px-5 lg:min-w-[192px]">
                  Pain
                </th>
                <th className="px-4 py-3.5 sm:px-5">Review signal</th>
                <th className="px-4 py-3.5 sm:px-5">Brand solution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {(abm.painPivot || []).map((row, i) => (
                <tr key={i} className="transition-colors even:bg-slate-50/60 hover:bg-slate-50/90">
                  <td className="min-w-[132px] px-4 py-4 align-top font-semibold text-mood-feather sm:min-w-[168px] sm:px-5 sm:text-[15px] sm:leading-snug lg:min-w-[192px]">
                    {row.pain}
                  </td>
                  <td className="px-4 py-4 align-top text-slate-600 sm:px-5 sm:text-sm sm:leading-6">{row.reviewSignal}</td>
                  <td className="px-4 py-4 align-top text-slate-700 sm:px-5 sm:text-sm sm:leading-6">{row.brandSolution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportTableWrap>
        </ReportSection>

        <ReportSection emoji="4️⃣" title="[Marketing Action] 핵심 액션 제안">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {(abm.marketingPriority4 || []).map((m, idx) => (
            <div
              key={idx}
              className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-md shadow-mood-feather/10 ring-1 ring-mood-feather/[0.05] sm:p-6"
            >
              <span className="absolute right-3 top-3 font-mono text-5xl font-black tabular-nums text-slate-100 sm:right-4 sm:top-4 sm:text-6xl">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <p className="relative text-[11px] font-bold uppercase tracking-wide text-mood-feather">{m.pillar}</p>
              <p className="relative mt-2 max-w-[85%] text-base font-bold leading-snug text-mood-feather sm:text-lg">{m.title}</p>
              <p className="relative mt-3 text-[15px] leading-7 text-slate-600">{m.action}</p>
            </div>
          ))}
        </div>
        </ReportSection>

        <ReportSection
          emoji="5️⃣"
          title="[Creative Copy] 매체별 후킹 문구"
          subtitle={
            abm.creativeCopy?.intro?.trim() ||
            '2단계 USP를 기반으로, 실제 광고 클릭률(CTR)을 극대화할 수 있는 유형별 카피를 제안합니다.'
          }
        >
          <div className="space-y-6 sm:space-y-8">
            {(abm.creativeCopy?.types?.length
              ? abm.creativeCopy.types
              : (abm.creativeHooks || []).map((c, i) => ({
                  letter: ['A', 'B', 'C'][i],
                  label: c.archetype || `유형 ${i + 1}`,
                  appeal: '',
                  headlines: [c.headline || '', '', ''],
                  primaryText: c.primaryText || '',
                }))
            ).map((block, idx) => (
              <div
                key={`${block.letter}-${idx}`}
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/40 shadow-md shadow-mood-feather/10 ring-1 ring-mood-feather/[0.05] sm:rounded-3xl"
              >
                <div className="border-b border-mood-oasis/45 bg-mood-celery/25 px-5 py-4 sm:px-6 sm:py-5">
                  <h4 className="text-pretty text-base font-bold leading-snug text-mood-feather sm:text-lg">
                    <span className="text-mood-feather">Type {block.letter}.</span>{' '}
                    {block.label}
                  </h4>
                </div>
                <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
                  {block.appeal ? (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">소구점</p>
                      <p className="mt-2 text-[15px] leading-7 text-slate-800">{block.appeal}</p>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Headline (3개)</p>
                    <ol className="mt-3 list-decimal space-y-3 pl-5 text-[15px] font-semibold leading-snug text-mood-feather marker:font-bold marker:text-mood-feather sm:leading-6">
                      {[...(block.headlines || []), '', '', ''].slice(0, 3).map((line, j) => (
                        <li key={j} className="pl-1">
                          {line ? (
                            <span className="whitespace-pre-wrap">{line}</span>
                          ) : (
                            <span className="font-normal text-slate-400">(카피 생성 중)</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="border-t border-slate-200/80 pt-5">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Primary Text</p>
                    <p className="mt-2 text-[15px] leading-7 text-slate-600 whitespace-pre-wrap">
                      {block.primaryText?.trim() || (
                        <span className="text-slate-400">위 헤드라인 중 하나를 선택해 보완하는 짧고 강렬한 설명을 채워 주세요.</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-amber-300/50 bg-gradient-to-br from-amber-50 via-white to-amber-50/30 p-5 shadow-md shadow-amber-900/[0.06] sm:p-7">
            <p className="text-base font-bold text-amber-950">💡 카피 작성 가이드라인</p>
            <ul className="mt-4 list-none space-y-3 border-t border-amber-200/60 pt-4 text-[15px] leading-7 text-amber-950/95">
              {(abm.creativeCopy?.guidelineBullets?.length
                ? abm.creativeCopy.guidelineBullets
                : [
                    '의문문이나 반전: "아직도 수정 화장하세요?" 같은 의문문이나, "파운데이션인 줄 알았는데 스킨케어네요" 같은 반전 구조를 활용하세요.',
                    "숫자 활용: '8시간 유지', '99% 만족' 등 구체적인 숫자를 넣어 신뢰도를 높이세요.",
                    'BM 톤앤매너: 세련되고 시크한 느낌을 위해 과도한 이모지 사용은 자제하고, 문장의 호흡을 짧게 끊어 임팩트를 주세요.',
                  ]
              ).map((line, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                    aria-hidden
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </ReportSection>
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
          'bg-mood-ice bg-gradient-to-b from-mood-ice via-white to-mood-celery/15',
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
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-mood-oasis">
                  Strategic Insight
                </p>
                <h1 className="text-balance text-3xl font-semibold tracking-tight text-mood-feather sm:text-4xl sm:leading-tight">
                  리뷰 기반 마케팅 전략 인사이트
                </h1>
                <p className="mx-auto mt-5 max-w-md text-pretty text-[15px] leading-relaxed text-slate-500">
                  올리브영 상품 URL만 입력하면 리뷰를 수집하고,
                  <br />
                  Gemini가 BM 전략 장표 형태로 해석합니다.
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
                      className="min-h-[52px] w-full flex-1 rounded-2xl border border-slate-200/90 bg-slate-50/80 px-5 py-3.5 text-[15px] text-slate-800 shadow-inner shadow-slate-200/20 placeholder:text-slate-400 focus:border-mood-oasis focus:bg-white focus:outline-none focus:ring-4 focus:ring-mood-oasis/25"
                    />
                    <div className="flex shrink-0 gap-2 sm:w-auto">
                      <ReviewLimitSelect value={limit} onChange={setLimit} variant="landing" />
                      <button
                        type="submit"
                        disabled={loading || !url.trim()}
                        className="min-h-[52px] rounded-2xl bg-mood-oasis px-6 text-sm font-semibold text-mood-feather shadow-lg shadow-mood-oasis/35 transition hover:bg-mood-oasisHover disabled:cursor-not-allowed disabled:opacity-40"
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
                <p className="text-xs font-semibold tracking-widest text-mood-feather uppercase mb-1">
                  Strategic Insight Summary
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-mood-feather tracking-tight">
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
                    className="min-h-11 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-mood-oasis focus:outline-none focus:ring-2 focus:ring-mood-oasis/30"
                  />
                  <div className="flex gap-2 shrink-0">
                    <ReviewLimitSelect value={limit} onChange={setLimit} variant="compact" />
                    <button
                      type="submit"
                      disabled={loading || !url.trim()}
                      className="min-h-11 rounded-xl bg-mood-oasis px-5 text-sm font-semibold text-mood-feather hover:bg-mood-oasisHover disabled:opacity-50"
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
            {/* URL 입력란 바로 아래: 어떤 제품 분석인지 썸네일 + 공식 상품명 */}
            <div className="mb-6 flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm backdrop-blur-sm sm:gap-5 sm:p-5">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 sm:h-[7.25rem] sm:w-[7.25rem]">
                {result.meta?.productImageUrl ? (
                  <img
                    src={result.meta.productImageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] font-medium leading-tight text-slate-400">
                    썸네일
                    <br />
                    없음
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-pretty text-base font-extrabold leading-snug text-mood-feather sm:text-lg">
                  {String(result.meta?.productName || '')
                    .trim()
                    .replace(/\s*\|\s*올리브영.*$/i, '') ||
                    (result.meta?.goodsNo
                      ? `올리브영 상품 ${result.meta.goodsNo}`
                      : '상품명을 불러오지 못했습니다')}
                </h2>
              </div>
            </div>

            {result.strategicInsightsSource && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    result.strategicInsightsSource === 'gemini'
                      ? 'bg-mood-oasis/50 text-mood-feather'
                      : result.strategicInsightsSource === 'claude'
                        ? 'bg-mood-celery/55 text-mood-feather'
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
                      ? 'border-mood-feather text-mood-feather'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {result.strategicInsightsSource === 'gemini' ? 'Gemini' : 'Claude'} 분석
                </button>
                <button
                  onClick={() => setActiveTab('free')}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === 'free'
                      ? 'border-mood-feather text-mood-feather'
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
                <p className="text-2xl font-extrabold text-mood-feather tabular-nums">{result.meta.collectedReviews}</p>
              </div>
              <div className="rounded-2xl bg-white border border-slate-100 px-4 py-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">긍정</p>
                <p className="text-2xl font-extrabold text-mood-feather tabular-nums">
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
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">상품 코드</p>
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
