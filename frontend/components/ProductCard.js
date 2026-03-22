function getRankBadgeStyle(rank) {
  if (!rank) return 'bg-gray-100 text-gray-400';
  if (rank <= 5) return 'bg-mood-oasis text-mood-feather';
  if (rank <= 20) return 'bg-mood-celery/70 text-mood-feather';
  if (rank <= 50) return 'bg-gray-100 text-gray-700';
  return 'bg-red-50 text-red-400';
}

function formatCrawledAt(crawledAt) {
  if (!crawledAt) return null;
  // "2024-01-15 09:00:00" → "01/15 09:00"
  const [datePart, timePart] = crawledAt.split(' ');
  if (!datePart) return null;
  const [, month, day] = datePart.split('-');
  const time = timePart?.slice(0, 5) ?? '';
  return `${month}/${day} ${time}`;
}

export default function ProductCard({ product }) {
  const {
    name, image_url, price, sale_price,
    best_rank, best_rank_date, avg_rank_7d, avg_rank_prev_7d, tracked_days,
    latest_rank, latest_crawled_at,
  } = product;

  const trend = (avg_rank_prev_7d && avg_rank_7d)
    ? Number((avg_rank_prev_7d - avg_rank_7d).toFixed(1))
    : null;

  const discountRate = (price && sale_price && price > sale_price)
    ? Math.round((1 - sale_price / price) * 100)
    : null;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
      {/* 상품 정보 */}
      <div className="flex items-start gap-3">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-gray-50"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-gray-100 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{name}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {sale_price ? (
              <span className="text-sm font-bold text-gray-900">
                {sale_price.toLocaleString()}원
              </span>
            ) : null}
            {discountRate ? (
              <span className="rounded-md bg-mood-celery px-1.5 py-0.5 text-xs font-bold text-mood-feather">
                {discountRate}%
              </span>
            ) : null}
            {price && sale_price && price !== sale_price ? (
              <span className="text-xs text-gray-400 line-through">
                {price.toLocaleString()}원
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* 현재 순위 + 트렌드 */}
      <div className="flex items-center gap-3">
        <div className={`rounded-xl px-4 py-2.5 ${getRankBadgeStyle(latest_rank)}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60 mb-0.5">
            현재 순위
          </p>
          <p className="text-2xl font-extrabold leading-none tabular-nums">
            {latest_rank ? `#${latest_rank}` : '—'}
          </p>
          {latest_crawled_at && (
            <p className="text-[10px] opacity-50 mt-1 tabular-nums">
              {formatCrawledAt(latest_crawled_at)}
            </p>
          )}
        </div>
        {trend !== null && (
          <div className={`text-sm font-bold ${
            trend > 0 ? 'text-emerald-500' : trend < 0 ? 'text-red-400' : 'text-gray-400'
          }`}>
            <span>
              {trend > 0 ? `▲ ${trend}` : trend < 0 ? `▼ ${Math.abs(trend)}` : '→'}
            </span>
            <p className="text-[11px] font-normal text-gray-400 mt-0.5">7일 전 대비</p>
          </div>
        )}
      </div>

      {/* 통계 그리드 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-gray-400 font-medium mb-1">최고 순위</p>
          <p className="text-sm font-extrabold text-gray-900 tabular-nums">
            {best_rank ? `#${best_rank}` : '—'}
          </p>
          {best_rank_date && (
            <p className="text-[10px] text-gray-400 tabular-nums mt-0.5">
              {formatCrawledAt(best_rank_date)}
            </p>
          )}
        </div>
        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-gray-400 font-medium mb-1">7일 평균</p>
          <p className="text-sm font-extrabold text-gray-900 tabular-nums">
            {avg_rank_7d ? `${avg_rank_7d}위` : '—'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-gray-400 font-medium mb-1">추적 일수</p>
          <p className="text-sm font-extrabold text-gray-900 tabular-nums">
            {tracked_days}일
          </p>
        </div>
      </div>
    </div>
  );
}
