import { useQuery } from '@tanstack/react-query';
import { DollarSign } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { getPriceTendencies } from '../../../api/estimator';
import { LoadingSpinner, ErrorState, EmptyState } from '../../ui/states';
import { fmt } from './profile-tabs';

export function PricesTab({ pk, dateParams }: { pk: string; dateParams: { min_date?: string; max_date?: string } }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['priceTendencies', pk, dateParams],
    queryFn: () => getPriceTendencies(pk, dateParams),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorState title="Failed to load price data" onRetry={() => refetch()} />;
  if (!data || data.tendencies.length === 0) return (
    <EmptyState
      icon={<DollarSign size={40} className="text-gray-300" />}
      title="No price tendency data"
      message="Not enough bid data to calculate price tendencies — try expanding the date range or selecting a contractor with more bids"
    />
  );

  const chartData = data.tendencies.slice(0, 15).map((t) => ({
    name: t.division.length > 30 ? t.division.slice(0, 30) + '...' : t.division,
    variance: Number(t.variance_pct.toFixed(1)),
  }));

  return (
    <div className="space-y-4">
      {/* Diverging bar chart */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-1">Price Variance vs Market</h3>
        <p className="text-xs text-gray-400 mb-3">Green = cheaper than market, Red = more expensive</p>
        <div style={{ height: Math.max(200, chartData.length * 28) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={chartData} margin={{ top: 0, right: 30, bottom: 0, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
              <YAxis type="category" dataKey="name" width={220} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value: number | string | ReadonlyArray<number | string> | undefined) => `${Number(value) > 0 ? '+' : ''}${value}%`} />
              <Bar dataKey="variance" name="Variance %" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.variance < -5 ? '#22c55e' : entry.variance > 5 ? '#ef4444' : '#9ca3af'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-medium text-gray-700">Price Tendencies vs Market Average</h3>
          <p className="text-xs text-gray-400 mt-0.5">How {data.contractor_name}'s pricing compares to overall market averages by division</p>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2">Division</th>
                <th className="px-3 py-2 text-right">Contractor Avg</th>
                <th className="px-3 py-2 text-right">Market Avg</th>
                <th className="px-3 py-2 text-right">Variance</th>
                <th className="px-3 py-2 text-right">Samples</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.tendencies.map((t) => {
                const varianceColor = t.variance_pct > 5
                  ? 'text-red-600'
                  : t.variance_pct < -5
                    ? 'text-green-600'
                    : 'text-gray-600';
                return (
                  <tr key={t.division} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900 max-w-[250px] truncate">{t.division}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-900">{fmt.format(t.contractor_avg_price)}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-600">{fmt.format(t.market_avg_price)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${varianceColor}`}>
                      {t.variance_pct > 0 ? '+' : ''}{t.variance_pct.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">{t.contractor_sample_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
