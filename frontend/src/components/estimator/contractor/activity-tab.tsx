import { useQuery } from '@tanstack/react-query';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ComposedChart, Bar, Line,
} from 'recharts';
import { getActivityTrend } from '../../../api/estimator';
import { LoadingSpinner, ErrorState, EmptyState } from '../../ui/states';
import { fmtCompact } from './profile-tabs';

export function ActivityTab({ pk, dateParams }: { pk: string; dateParams: { min_date?: string; max_date?: string } }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['activityTrend', pk, dateParams],
    queryFn: () => getActivityTrend(pk, dateParams),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorState title="Failed to load activity data" onRetry={() => refetch()} />;
  if (!data || data.trend.length === 0) return (
    <EmptyState
      title="No activity data"
      message="No bidding activity found for this contractor in the selected date range"
    />
  );

  const chartData = data.trend.map((t) => ({
    year: String(t.year),
    bid_count: t.bid_count,
    win_count: t.win_count,
    win_rate: t.bid_count > 0 ? Number(((t.win_count / t.bid_count) * 100).toFixed(1)) : 0,
    total_bid_volume: t.total_bid_volume,
  }));

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-medium text-gray-700">Year-over-Year Activity</h3>
      </div>
      <div className="p-4" style={{ height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
            <Tooltip formatter={(value: number | string | ReadonlyArray<number | string> | undefined, name: string | number | undefined) =>
              name === 'Win Rate %' ? `${value}%` : value
            } />
            <Bar yAxisId="left" dataKey="bid_count" fill="#3b82f6" name="Bids" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="win_rate" stroke="#22c55e" strokeWidth={2} name="Win Rate %" dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {/* Data table */}
      <div className="overflow-auto border-t">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2">Year</th>
              <th className="px-3 py-2 text-right">Bids</th>
              <th className="px-3 py-2 text-right">Wins</th>
              <th className="px-3 py-2 text-right">Win %</th>
              <th className="px-3 py-2 text-right">Total Volume</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.trend.map((t) => {
              const winRate = t.bid_count > 0 ? (t.win_count / t.bid_count) * 100 : 0;
              return (
                <tr key={t.year} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{t.year}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{t.bid_count}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{t.win_count}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{winRate.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">{fmtCompact.format(t.total_bid_volume)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
