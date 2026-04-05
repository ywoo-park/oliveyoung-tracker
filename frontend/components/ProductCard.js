function getRankStyle(rank) {
  if (!rank) return { badge: 'bg-gray-100', rank: 'text-gray-300', label: 'text-gray-300' };
  if (rank <= 5)  return { badge: 'bg-mood-oasis',    rank: 'text-mood-feather', label: 'text-mood-feather/60' };
  if (rank <= 20) return { badge: 'bg-emerald-50',    rank: 'text-emerald-700',  label: 'text-emerald-400' };
  if (rank <= 50) return { badge: 'bg-gray-50',       rank: 'text-gray-700',     label: 'text-gray-400' };
  return           { badge: 'bg-red-50',              rank: 'text-red-400',      label: 'text-red-300' };
}

function Delta({ delta, label }) {
  if (delta === null) return (
    <div className="text-center">
      <p className="text-lg font-extrabold tabular-nums text-gray-300">—</p>
      <p className="text-[10px] text-gray-300 mt-1">{label}</p>
    </div>
  );
  const color = delta > 0 ? 'text-emerald-500' : delta < 0 ? 'text-red-400' : 'text-gray-400';
  const symbol = delta > 0 ? `▲${delta}` : delta < 0 ? `▼${Math.abs(delta)}` : '→';
  return (
    <div className="text-center">
      <p className={`text-lg font-extrabold tabular-nums leading-none ${color}`}>{symbol}</p>
      <p className="text-[10px] text-gray-400 mt-1">{label}</p>
    </div>
  );
}

export default function ProductCard({ product, selected, onClick }) {
  const { name, image_url, oliveyoung_id, latest_rank, latest_crawled_at, prev_day_rank, prev_hour_rank } = product;

  const dayDelta  = (latest_rank != null && prev_day_rank != null)  ? prev_day_rank  - latest_rank : null;
  const hourDelta = (latest_rank != null && prev_hour_rank != null) ? prev_hour_rank - latest_rank : null;

  const style = getRankStyle(latest_rank);
  const oliveyoungUrl = `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${oliveyoung_id}`;

  const crawledTime = latest_crawled_at?.split(' ')[1]?.slice(0, 5) ?? null;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 shadow-sm transition-all cursor-pointer flex flex-col gap-4
        ${selected ? 'ring-2 ring-mood-oasis shadow-md' : 'hover:shadow-md'}`}
    >
      {/* 상품 정보 */}
      <div className="flex items-center gap-3">
        {image_url ? (
          <img src={image_url} alt={name} className="w-11 h-11 rounded-xl object-cover flex-shrink-0 bg-gray-50" />
        ) : (
          <div className="w-11 h-11 rounded-xl bg-gray-100 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <a
            href={oliveyoungUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 hover:underline underline-offset-2"
          >
            {name}
          </a>
        </div>
      </div>

      {/* 현재 순위 */}
      <div className={`rounded-xl px-5 py-4 ${style.badge} text-center`}>
        <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${style.label}`}>현재 순위</p>
        <p className={`text-5xl font-extrabold tabular-nums leading-none ${style.rank}`}>
          {latest_rank ? `#${latest_rank}` : '—'}
        </p>
        {crawledTime && (
          <p className={`text-[10px] mt-2 tabular-nums ${style.label}`}>{crawledTime} 기준</p>
        )}
      </div>

      {/* 전일 대비 / 1시간 전 대비 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 rounded-xl py-3">
          <Delta delta={dayDelta} label="어제 대비" />
        </div>
        <div className="bg-gray-50 rounded-xl py-3">
          <Delta delta={hourDelta} label="1시간 전" />
        </div>
      </div>
    </div>
  );
}
