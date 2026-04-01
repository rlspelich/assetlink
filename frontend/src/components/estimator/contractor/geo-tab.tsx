import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { getGeoFootprint } from '../../../api/estimator';
import { LoadingSpinner, ErrorState, EmptyState } from '../../ui/states';
import { fmtCompact } from './profile-tabs';

export function GeoTab({ pk, dateParams }: { pk: string; dateParams: { min_date?: string; max_date?: string } }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['geoFootprint', pk, dateParams],
    queryFn: () => getGeoFootprint(pk, dateParams),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorState title="Failed to load geographic data" onRetry={() => refetch()} />;
  if (!data) return null;

  const top10Counties = data.by_county.slice(0, 10).map((e) => ({
    name: e.name.length > 18 ? e.name.slice(0, 18) + '...' : e.name,
    wins: e.win_count,
    losses: e.bid_count - e.win_count,
  }));

  return (
    <div className="space-y-4">
      {/* County chart */}
      {top10Counties.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Top 10 Counties by Bid Count</h3>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={top10Counties} margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="wins" stackId="a" fill="#22c55e" name="Wins" />
                <Bar dataKey="losses" stackId="a" fill="#d1d5db" name="Losses" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <GeoTable title="By County" entries={data.by_county} />
        <GeoTable title="By District" entries={data.by_district} />
      </div>
    </div>
  );
}

export function GeoTable({ title, entries }: { title: string; entries: { name: string; bid_count: number; win_count: number; win_rate: number; total_volume: number }[] }) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      </div>
      {entries.length === 0 ? (
        <EmptyState title="No data" message="No geographic data available for this date range" />
      ) : (
        <div className="overflow-auto max-h-[400px]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase sticky top-0">
              <tr>
                <th className="px-3 py-2">{title === 'By County' ? 'County' : 'District'}</th>
                <th className="px-3 py-2 text-right">Bids</th>
                <th className="px-3 py-2 text-right">Wins</th>
                <th className="px-3 py-2 text-right">Win %</th>
                <th className="px-3 py-2 text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => (
                <tr key={e.name} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{e.name}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{e.bid_count}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{e.win_count}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{e.win_rate.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">{fmtCompact.format(e.total_volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
