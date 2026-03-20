'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#111111', '#4F7BF7', '#FF5C5C', '#FF9500', '#9747FF', '#00C896', '#F72585'];

function formatTime(value, mode) {
  if (!value) return '';
  if (mode === 'hourly') return value.slice(11, 16); // "09:00"
  return value.slice(5).replace('-', '/');           // "01/15"
}

function CustomTooltip({ active, payload, label, mode }) {
  if (!active || !payload?.length) return null;

  const display = mode === 'hourly'
    ? label.slice(0, 16).replace('T', ' ')  // "2024-01-15 09:00"
    : label.slice(0, 10);                    // "2024-01-15"

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-3 text-sm min-w-[160px]">
      <p className="font-bold text-gray-700 mb-2 tabular-nums">{display}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-500 truncate max-w-[120px] text-xs">{entry.dataKey}</span>
          <span className="font-extrabold text-gray-900 ml-auto pl-2 tabular-nums">
            {entry.value != null ? `${entry.value}위` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RankChart({ data, products, mode = 'daily' }) {
  if (!data.length || !products.length) return null;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={(v) => formatTime(v, mode)}
          tick={{ fontSize: 11, fill: '#AAAAAA' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          reversed
          domain={[1, (dataMax) => dataMax + 5]}
          tick={{ fontSize: 11, fill: '#AAAAAA' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}위`}
          width={48}
        />
        <Tooltip content={<CustomTooltip mode={mode} />} />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
        />
        {products.map((name, i) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={mode === 'hourly' ? { r: 3, strokeWidth: 0 } : false}
            connectNulls={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
