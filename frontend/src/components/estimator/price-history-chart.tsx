import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { AwardPricePoint, PriceStats } from '../../api/estimator';

interface Props {
  dataPoints: AwardPricePoint[];
  stats?: PriceStats | null;
  unit: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
}

function formatPrice(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

export function PriceHistoryChart({ dataPoints, stats, unit }: Props) {
  if (!dataPoints.length) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-gray-400">
        No price data available
      </div>
    );
  }

  // Transform for recharts: x = timestamp, y = price (ensure numeric)
  const chartData = dataPoints.map((p) => ({
    x: new Date(p.letting_date).getTime(),
    y: Number(p.unit_price),
    date: p.letting_date,
    contract: p.contract_number,
    county: p.county,
    district: p.district,
    quantity: Number(p.quantity),
  })).filter((d) => !isNaN(d.y) && d.y > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border shadow-lg rounded-lg p-3 text-xs">
        <div className="font-semibold">{formatPrice(d.y)}/{unit}</div>
        <div className="text-gray-500 mt-1">
          Date: {new Date(d.date).toLocaleDateString()}<br />
          Contract: {d.contract}<br />
          County: {d.county} | Dist: {d.district}<br />
          Qty: {Number(d.quantity).toLocaleString()} {unit}
        </div>
      </div>
    );
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="x"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(ts) => formatDate(new Date(ts).toISOString())}
            tick={{ fontSize: 10 }}
            name="Date"
          />
          <YAxis
            dataKey="y"
            type="number"
            tickFormatter={(v) => formatPrice(v)}
            tick={{ fontSize: 10 }}
            name="Price"
          />
          <Tooltip content={<CustomTooltip />} />
          {stats && !isNaN(Number(stats.p50)) && Number(stats.p50) > 0 && (
            <ReferenceLine
              y={Number(stats.p50)}
              stroke="#3b82f6"
              strokeDasharray="5 5"
            />
          )}
          {stats && !isNaN(Number(stats.weighted_avg)) && Number(stats.weighted_avg) > 0 && (
            <ReferenceLine
              y={Number(stats.weighted_avg)}
              stroke="#10b981"
              strokeDasharray="3 3"
            />
          )}
          <Scatter data={chartData} fill="#6366f1" fillOpacity={0.5} r={3} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
