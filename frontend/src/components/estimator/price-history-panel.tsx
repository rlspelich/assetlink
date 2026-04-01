import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { getAwardPriceHistory, getPriceStats, type PayItem } from '../../api/estimator';
import { PriceHistoryChart } from './price-history-chart';
import { InlineLoading } from '../ui/states';
import type { PricingOptions } from '../../routes/estimator-page';

interface Props {
  payItem: PayItem | null;
  options?: PricingOptions;
}

function formatPrice(value: number | string | null | undefined) {
  if (value == null) return '—';
  const n = Number(value);
  if (isNaN(n)) return '—';
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export function PriceHistoryPanel({ payItem, options }: Props) {
  const code = payItem?.code || '';
  const adjustInflation = options?.adjustInflation ?? true;
  const targetState = options?.targetState ?? 'IL';

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['awardPriceHistory', code],
    queryFn: () => getAwardPriceHistory(code, { limit: 5000 }),
    enabled: !!code,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['priceStats', code, adjustInflation, targetState],
    queryFn: () => getPriceStats(code, {
      years_back: 10,
      adjust_inflation: adjustInflation,
      target_state: targetState,
    }),
    enabled: !!code,
  });

  if (!payItem) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-400">
        <div className="text-center">
          <BarChart3 size={48} className="mx-auto mb-3 text-gray-300" />
          <p>Select a pay item to view price history</p>
        </div>
      </div>
    );
  }

  const isLoading = historyLoading || statsLoading;
  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="text-lg font-bold text-gray-900">{payItem.description}</div>
        <div className="flex gap-4 mt-1 text-xs text-gray-500">
          <span className="font-mono text-gray-400">{payItem.code}</span>
          <span>Unit: <strong>{payItem.unit}</strong></span>
        </div>
        <div className="flex gap-2 mt-2">
          {adjustInflation && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
              Inflation Adjusted
            </span>
          )}
          {targetState !== 'IL' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
              Regional: {targetState}
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <InlineLoading message="Loading price data..." />
      ) : (
        <>
          {/* Stats cards */}
          {stats && stats.data_points > 0 && (
            <div className="p-4 border-b">
              <div className="grid grid-cols-4 gap-3">
                <StatCard
                  label="Weighted Avg"
                  value={formatPrice(stats.weighted_avg)}
                  sublabel={`/${payItem.unit}`}
                  color="text-green-700"
                  bgColor="bg-green-50"
                />
                <StatCard
                  label="Median"
                  value={formatPrice(stats.median)}
                  sublabel={`/${payItem.unit}`}
                  color="text-blue-700"
                  bgColor="bg-blue-50"
                />
                <StatCard
                  label="Range (P25–P75)"
                  value={`${formatPrice(stats.p25)} – ${formatPrice(stats.p75)}`}
                  sublabel="interquartile"
                  color="text-purple-700"
                  bgColor="bg-purple-50"
                />
                <StatCard
                  label="Data Points"
                  value={stats.data_points.toLocaleString()}
                  sublabel={stats.earliest_date && stats.latest_date
                    ? `${new Date(stats.earliest_date).getFullYear()}–${new Date(stats.latest_date).getFullYear()}`
                    : ''}
                  color="text-gray-700"
                  bgColor="bg-gray-50"
                />
              </div>
            </div>
          )}

          {/* Chart */}
          <div className="p-4 border-b">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Price History
            </div>
            <PriceHistoryChart
              dataPoints={history?.data_points || []}
              stats={stats}
              unit={payItem.unit}
            />
          </div>

          {/* Price distribution */}
          {stats && stats.data_points > 0 && (
            <div className="p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Price Distribution
              </div>
              <div className="space-y-2 text-xs">
                <DistRow label="P10 (Low)" value={formatPrice(stats.p10)} pct={10} />
                <DistRow label="P25" value={formatPrice(stats.p25)} pct={25} />
                <DistRow label="P50 (Median)" value={formatPrice(stats.p50)} pct={50} />
                <DistRow label="P75" value={formatPrice(stats.p75)} pct={75} />
                <DistRow label="P90 (High)" value={formatPrice(stats.p90)} pct={90} />
                <div className="flex justify-between pt-2 border-t text-gray-500">
                  <span>Min: {formatPrice(stats.min_price)}</span>
                  <span>Max: {formatPrice(stats.max_price)}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sublabel, color, bgColor }: {
  label: string; value: string; sublabel: string; color: string; bgColor: string;
}) {
  return (
    <div className={`${bgColor} rounded-lg p-3`}>
      <div className="text-[10px] font-medium text-gray-500 uppercase">{label}</div>
      <div className={`text-base font-bold ${color} mt-0.5`}>{value}</div>
      <div className="text-[10px] text-gray-400">{sublabel}</div>
    </div>
  );
}

function DistRow({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-gray-500">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-400 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-20 text-right font-mono">{value}</span>
    </div>
  );
}
