'use client';

import { useMemo, useState } from 'react';
import { filterSessionsByQuery, formatSessionDate } from '../lib/analysisHistory';

/**
 * 왼쪽 고정 히스토리 사이드바 (데스크톱) + 모바일 드로어
 * VDL 톤: 다크 슬레이트 배경, 바이올렛 액센트
 */
export default function AnalysisSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onNewAnalysis,
  mobileOpen,
  onMobileClose,
  /** '서버 DB 저장' | '이 브라우저만' 등 안내 문구 */
  storageHint = null,
}) {
  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');

  const filtered = useMemo(() => filterSessionsByQuery(search, sessions), [search, sessions]);

  function startRename(e, s) {
    e.stopPropagation();
    setRenamingId(s.id);
    setRenameDraft(s.productName);
  }

  async function commitRename(e, id) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    await Promise.resolve(onRenameSession(id, renameDraft));
    setRenamingId(null);
    setRenameDraft('');
  }

  const sidebarInner = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-200">
      {/* 상단 브랜딩 + 새 분석 */}
      <div className="border-b border-slate-800/90 px-5 pb-5 pt-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300/90 mb-1">VDL Insight</p>
        <p className="text-sm font-semibold text-white tracking-tight mb-4">분석 히스토리</p>
        <button
          type="button"
          onClick={() => {
            onNewAnalysis();
            onMobileClose?.();
          }}
          className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 active:scale-[0.98]"
        >
          + 새 분석 시작
        </button>
      </div>

      {/* 제품명 검색 */}
      <div className="px-4 py-4">
        <label className="sr-only" htmlFor="history-search">
          제품명 검색
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>
          <input
            id="history-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제품명·키워드 검색"
            className="w-full rounded-lg border border-slate-700/80 bg-slate-800/60 py-2.5 pl-9 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
          />
        </div>
      </div>

      {/* 세션 리스트 */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-6" aria-label="저장된 분석 목록">
        {filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs leading-relaxed text-slate-500">
            {sessions.length === 0
              ? '완료된 분석이 여기에 쌓입니다.'
              : '검색 결과가 없습니다.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((s) => {
              const active = s.id === activeSessionId;
              return (
                <li key={s.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelectSession(s);
                      onMobileClose?.();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectSession(s);
                        onMobileClose?.();
                      }
                    }}
                    className={[
                      'group relative rounded-xl border border-transparent px-3 py-3 text-left transition-all duration-200',
                      active
                        ? 'border-violet-500/40 bg-violet-950/55 shadow-inner shadow-black/20'
                        : 'hover:border-slate-700/80 hover:bg-slate-800/50',
                    ].join(' ')}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-violet-400"
                        aria-hidden
                      />
                    )}
                    <div className="flex items-start justify-between gap-2 pl-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                          {formatSessionDate(s.timestamp)}
                        </p>
                        {renamingId === s.id ? (
                          <form
                            className="mt-1"
                            onSubmit={(e) => commitRename(e, s.id)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              autoFocus
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              className="w-full rounded border border-violet-500/50 bg-slate-950 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                            />
                            <div className="mt-1 flex gap-1">
                              <button
                                type="submit"
                                className="rounded bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white"
                              >
                                저장
                              </button>
                              <button
                                type="button"
                                className="rounded bg-slate-700 px-2 py-0.5 text-[10px] text-slate-200"
                                onClick={() => setRenamingId(null)}
                              >
                                취소
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-white">
                              {s.productName}
                            </p>
                            {s.keywordsLine ? (
                              <p className="mt-1 line-clamp-1 text-[11px] text-violet-300/90">{s.keywordsLine}</p>
                            ) : null}
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">{s.summary}</p>
                          </>
                        )}
                      </div>
                      {renamingId !== s.id && (
                        <div className="flex shrink-0 flex-col gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                          <button
                            type="button"
                            title="이름 변경"
                            onClick={(e) => startRename(e, s)}
                            className="rounded-md p-1 text-slate-400 hover:bg-slate-700 hover:text-violet-200"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            title="삭제"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSession(s.id);
                            }}
                            className="rounded-md p-1 text-slate-400 hover:bg-rose-950/50 hover:text-rose-300"
                          >
                            <span className="sr-only">삭제</span>
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
      {storageHint ? (
        <p className="mt-auto border-t border-slate-800/80 px-4 py-3 text-[10px] leading-relaxed text-slate-500">
          {storageHint}
        </p>
      ) : null}
    </div>
  );

  return (
    <>
      {/* 데스크톱: 고정 260px */}
      <aside
        className="fixed left-0 top-0 z-30 hidden h-screen w-[260px] border-r border-slate-800 lg:block"
        aria-label="분석 히스토리 사이드바"
      >
        {sidebarInner}
      </aside>

      {/* 모바일: 오버레이 + 드로어 */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="히스토리 메뉴">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={onMobileClose}
            aria-label="닫기"
          />
          <div className="absolute left-0 top-0 h-full w-[min(260px,88vw)] shadow-2xl shadow-black/50">
            {sidebarInner}
          </div>
        </div>
      ) : null}
    </>
  );
}
