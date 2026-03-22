'use client';

import { useEffect, useRef, useState } from 'react';

const OPTIONS = [
  { value: 100, label: '100건' },
  { value: 500, label: '500건' },
  { value: 1000, label: '1,000건' },
];

function Chevron({ open }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/**
 * 네이티브 select 대체 — sans-serif·동일 카드 스타일의 커스텀 드롭다운
 * @param {{ value: number, onChange: (n: number) => void, variant?: 'landing' | 'compact' }} props
 */
export default function ReviewLimitSelect({ value, onChange, variant = 'landing' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const selected = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];

  const triggerBase =
    variant === 'landing'
      ? 'min-h-[52px] w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-left text-[15px] font-medium text-slate-800 shadow-sm sm:min-w-[8.5rem] sm:w-auto'
      : 'min-h-11 min-w-[6.75rem] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-medium text-slate-800 shadow-sm';

  return (
    <div className="relative flex-1 sm:flex-none" ref={rootRef}>
      <button
        type="button"
        id="review-limit-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="분석할 리뷰 건수"
        title="100 / 500 / 1,000건까지 요청할 수 있습니다."
        onClick={() => setOpen((v) => !v)}
        className={`${triggerBase} flex w-full items-center justify-between gap-3 transition hover:border-slate-300 hover:bg-slate-50/80 focus:border-violet-300 focus:outline-none focus:ring-4 focus:ring-violet-500/10 ${open ? 'border-violet-300 ring-4 ring-violet-500/10' : ''}`}
      >
        <span className="tabular-nums">{selected.label}</span>
        <Chevron open={open} />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-labelledby="review-limit-trigger"
          className="absolute right-0 top-full z-[100] mt-1.5 min-w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-[0_16px_48px_-8px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.04]"
        >
          {OPTIONS.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[15px] font-medium tracking-tight text-slate-800 transition hover:bg-slate-50 sm:text-sm ${
                    active ? 'bg-violet-50/90 text-violet-900' : ''
                  }`}
                >
                  {active ? (
                    <span
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold leading-none text-white"
                      aria-hidden
                    >
                      ✓
                    </span>
                  ) : (
                    <span
                      className="h-[18px] w-[18px] shrink-0 rounded-full border-2 border-slate-200 bg-white"
                      aria-hidden
                    />
                  )}
                  <span className="tabular-nums">{opt.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
