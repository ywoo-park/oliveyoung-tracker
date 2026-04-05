'use client';

import { useState, useEffect, useCallback } from 'react';
import ProductCard from '@/components/ProductCard';
import RankChart from '@/components/RankChart';

const CATEGORIES = ['전체', '메이크업'];
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function toLocalDate(date = new Date()) {
  return date.toLocaleDateString('sv-SE');
}

function daysAgo(n) {
  return toLocalDate(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

const PRESETS = [
  { label: '오늘',  mode: 'hourly', getParams: () => ({ date: toLocalDate() }) },
  { label: '어제',  mode: 'hourly', getParams: () => ({ date: daysAgo(1) }) },
  { label: '7일',   mode: 'daily',  getParams: () => ({ from: daysAgo(7),  to: toLocalDate() }) },
  { label: '30일',  mode: 'daily',  getParams: () => ({ from: daysAgo(30), to: toLocalDate() }) },
];

function transformChartData(data, mode, selectedProduct) {
  const timeKey = mode === 'hourly' ? 'hour' : 'date';
  const timeSet = new Set(data.map((d) => d[timeKey]));
  const times = [...timeSet].sort();

  const productMap = {};
  data.forEach((d) => {
    if (!productMap[d.product_id]) {
      productMap[d.product_id] = { name: d.name, data: {} };
    }
    productMap[d.product_id].data[d[timeKey]] = d.best_rank;
  });

  const chartData = times.map((t) => {
    const point = { time: t };
    Object.values(productMap).forEach((p) => {
      point[p.name] = p.data[t] ?? null;
    });
    return point;
  });

  const productNames = Object.values(productMap).map((p) => p.name);
  return { chartData, productNames };
}

function SummaryBanner({ stats, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl px-6 py-5 shadow-sm animate-pulse h-20" />
        ))}
      </div>
    );
  }

  const rising   = stats.filter((p) => p.prev_hour_rank != null && p.latest_rank != null && p.prev_hour_rank > p.latest_rank).length;
  const falling  = stats.filter((p) => p.prev_hour_rank != null && p.latest_rank != null && p.prev_hour_rank < p.latest_rank).length;
  const outOfRank = stats.filter((p) => p.latest_rank == null).length;
  const lastCrawledAt = stats.map((p) => p.latest_crawled_at).filter(Boolean).sort().at(-1);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div className="rounded-2xl bg-mood-oasis px-6 py-5 shadow-md shadow-mood-oasis/35">
        <p className="text-sm font-semibold text-mood-feather/70 mb-1">트래킹 상품</p>
        <p className="text-3xl font-extrabold tabular-nums text-mood-feather">
          {stats.length}<span className="ml-1 text-base font-semibold">개</span>
        </p>
      </div>
      <div className="bg-emerald-50 rounded-2xl px-6 py-5 shadow-sm">
        <p className="text-sm font-semibold text-emerald-500/70 mb-1">상승 중</p>
        <p className="text-3xl font-extrabold tabular-nums text-emerald-600">
          {rising}<span className="ml-1 text-base font-semibold">개</span>
        </p>
      </div>
      <div className="bg-red-50 rounded-2xl px-6 py-5 shadow-sm">
        <p className="text-sm font-semibold text-red-400/70 mb-1">하락 중</p>
        <p className="text-3xl font-extrabold tabular-nums text-red-500">
          {falling}<span className="ml-1 text-base font-semibold">개</span>
        </p>
      </div>
      <div className="bg-white rounded-2xl px-6 py-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-400 mb-1">마지막 크롤링</p>
        <p className="text-sm font-bold text-gray-900 tabular-nums">
          {lastCrawledAt ? lastCrawledAt.slice(0, 16) : '—'}
        </p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm animate-pulse flex flex-col gap-4">
      {/* 이미지 + 이름 */}
      <div className="flex gap-3">
        <div className="w-11 h-11 rounded-xl bg-gray-100 flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3.5 bg-gray-100 rounded-lg w-3/4" />
          <div className="h-3 bg-gray-100 rounded-lg w-1/2" />
        </div>
      </div>
      {/* 순위 배지 */}
      <div className="h-24 bg-gray-100 rounded-xl" />
      {/* 어제 대비 / 1시간 전 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="h-14 bg-gray-100 rounded-xl" />
        <div className="h-14 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [category, setCategory] = useState('전체');
  const [preset, setPreset] = useState(PRESETS[0]);
  const [stats, setStats] = useState([]);
  const [chartRaw, setChartRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = preset.getParams();
    const cat = encodeURIComponent(category);

    const chartUrl = preset.mode === 'hourly'
      ? `${API_URL}/api/rankings/hourly?category=${cat}&date=${params.date}`
      : `${API_URL}/api/rankings/daily-best?category=${cat}&from=${params.from}&to=${params.to}`;

    try {
      const [statsData, chartData] = await Promise.all([
        fetch(`${API_URL}/api/rankings/stats?category=${cat}`).then((r) => r.json()),
        fetch(chartUrl).then((r) => r.json()),
      ]);
      setStats(Array.isArray(statsData) ? statsData : []);
      setChartRaw(Array.isArray(chartData) ? chartData : []);
    } catch {
      setError('데이터를 불러오지 못했습니다. 백엔드 서버가 실행 중인지 확인하세요.');
    } finally {
      setLoading(false);
    }
  }, [category, preset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCardClick = (productId) => {
    setSelectedProductId((prev) => prev === productId ? null : productId);
  };

  // 선택된 상품 기준으로 차트 데이터 필터링
  const filteredChartRaw = selectedProductId
    ? chartRaw.filter((d) => d.product_id === selectedProductId)
    : chartRaw;

  const { chartData, productNames } = transformChartData(filteredChartRaw, preset.mode, selectedProductId);

  return (
    <main className="pt-24 pb-16 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* 요약 배너 */}
      <SummaryBanner stats={stats} loading={loading} />

      {/* 카테고리 필터 */}
      <div className="bg-white rounded-2xl px-5 py-4 mb-6 shadow-sm flex gap-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              category === cat
                ? 'bg-mood-oasis text-mood-feather shadow-sm shadow-mood-oasis/25'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 text-red-500 rounded-2xl px-5 py-4 mb-6 text-sm font-medium">
          {error}
        </div>
      )}

      {/* 상품 카드 */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : stats.length === 0 ? (
        <div className="bg-white rounded-2xl p-14 text-center mb-6 shadow-sm">
          <p className="text-gray-400 font-medium">등록된 상품이 없습니다.</p>
          <a href="/admin" className="mt-3 inline-block text-sm font-semibold text-gray-900 underline underline-offset-4">
            어드민에서 상품 등록하기
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {stats.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              selected={selectedProductId === product.id}
              onClick={() => handleCardClick(product.id)}
            />
          ))}
        </div>
      )}

      {/* 차트 */}
      {!loading && stats.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-extrabold text-gray-900">순위 추이</h2>
              {selectedProductId && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {stats.find((p) => p.id === selectedProductId)?.name} ·{' '}
                  <button onClick={() => setSelectedProductId(null)} className="underline underline-offset-2 hover:text-gray-600">
                    전체 보기
                  </button>
                </p>
              )}
              {!selectedProductId && (
                <p className="text-xs text-gray-400 mt-0.5">카드 클릭 시 해당 상품만 표시</p>
              )}
            </div>
            {/* 기간 필터 — 차트 우측 */}
            <div className="flex gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setPreset(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    preset.label === p.label
                      ? 'bg-mood-celery text-mood-feather shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-5">낮을수록 높은 순위</p>
          {chartData.length > 0 ? (
            <RankChart data={chartData} products={productNames} mode={preset.mode} />
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
              선택한 기간에 수집된 데이터가 없습니다.
            </div>
          )}
        </div>
      )}
    </main>
  );
}
