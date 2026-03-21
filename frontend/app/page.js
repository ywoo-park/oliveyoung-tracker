'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function pct(part, total) {
  if (!total) return '0.0';
  return ((part / total) * 100).toFixed(1);
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
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '리뷰 분석 요청에 실패했습니다.');
      }
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pt-24 pb-16 px-4 sm:px-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">실시간 리뷰 분석</h1>
      <p className="text-sm text-gray-500 mb-6">
        올리브영 상품 URL을 넣으면 최신 리뷰 50~100개를 수집해 상세페이지/광고 기획 인사이트를 추출합니다.
      </p>

      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <form onSubmit={handleAnalyze} className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000176322"
            className="lg:col-span-9 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/50"
          />
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="lg:col-span-1 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/50"
          >
            <option value={50}>50개</option>
            <option value={80}>80개</option>
            <option value={100}>100개</option>
          </select>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="lg:col-span-2 bg-[#6366F1] text-white font-bold px-5 py-3 rounded-xl text-sm hover:bg-[#4F46E5] transition-colors disabled:opacity-50"
          >
            {loading ? '분석 중...' : '리뷰 분석 시작'}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 rounded-2xl px-5 py-4 mb-6 text-sm font-medium">
          {error}
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-400 mb-1">수집 리뷰 수</p>
              <p className="text-3xl font-extrabold text-gray-900">{result.meta.collectedReviews}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-400 mb-1">긍정 비율</p>
              <p className="text-3xl font-extrabold text-[#6366F1]">
                {pct(result.sentimentRatio.positive, result.sentimentRatio.total)}%
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-400 mb-1">부정 비율</p>
              <p className="text-3xl font-extrabold text-red-500">
                {pct(result.sentimentRatio.negative, result.sentimentRatio.total)}%
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-400 mb-1">중립 비율</p>
              <p className="text-3xl font-extrabold text-gray-700">
                {pct(result.sentimentRatio.neutral, result.sentimentRatio.total)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <section className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-base font-extrabold text-gray-900 mb-3">소비자 리얼 보이스 (긍정)</h2>
              <ul className="space-y-2 text-sm text-gray-700">
                {result.consumerVoices.length === 0 && <li>추출된 항목이 없습니다.</li>}
                {result.consumerVoices.map((v, idx) => (
                  <li key={`${v}-${idx}`} className="bg-[#6366F1]/5 rounded-xl px-3 py-2">
                    "{v}"
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-base font-extrabold text-gray-900 mb-3">제품 개선 포인트 (부정)</h2>
              <ul className="space-y-2 text-sm text-gray-700">
                {result.painPoints.length === 0 && <li>추출된 항목이 없습니다.</li>}
                {result.painPoints.map((v, idx) => (
                  <li key={`${v}-${idx}`} className="bg-red-50 rounded-xl px-3 py-2">
                    {v}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-base font-extrabold text-gray-900 mb-3">핵심 키워드 (상위 20)</h2>
              <div className="flex flex-wrap gap-2">
                {result.keywords.slice(0, 20).map((k) => (
                  <span
                    key={k.word}
                    className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700"
                  >
                    {k.word} ({k.count})
                  </span>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-base font-extrabold text-gray-900 mb-3">AI 광고 카피 3종</h2>
              <ul className="space-y-2 text-sm text-gray-700">
                {result.adCopies.map((copy, idx) => (
                  <li key={idx} className="bg-gray-50 rounded-xl px-3 py-2">
                    {copy}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="bg-white rounded-2xl p-6 shadow-sm mt-4">
            <h2 className="text-base font-extrabold text-gray-900 mb-3">상세페이지 구조 제안</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
              {result.pageStructureSuggestion.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
