import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getContractorVsMarket } from '../../../api/estimator';
import { LoadingSpinner, ErrorState, EmptyState } from '../../ui/states';
import { fmt } from './profile-tabs';
import type { EstimatorNavParams } from '../../../routes/estimator-page';

export function VsMarketTab({ pk, dateParams, navigateTo }: { pk: string; dateParams: { min_date?: string; max_date?: string }; navigateTo: (tab: string, params: EstimatorNavParams) => void }) {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vsMarket', pk, page, dateParams],
    queryFn: () => getContractorVsMarket(pk, { page, page_size: 50, ...dateParams }),
    staleTime: 5 * 60 * 1000,
  });

  const totalPages = data ? Math.ceil(data.total / 50) : 0;

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorState title="Failed to load market comparison" onRetry={() => refetch()} />;
  if (!data || data.items.length === 0) return (
    <EmptyState
      title="No item-level comparison data"
      message="Not enough shared pay items to compare against the market — try expanding the date range"
    />
  );

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-medium text-gray-700">vs Market — Item-Level Price Comparison</h3>
        <p className="text-xs text-gray-400 mt-0.5">How {data.contractor_name}'s prices compare to the overall market on individual pay items</p>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase sticky top-0">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2 text-right">Contractor Avg</th>
              <th className="px-3 py-2 text-right">Market Avg</th>
              <th className="px-3 py-2 text-right">Variance</th>
              <th className="px-3 py-2 text-right">Contractor Samples</th>
              <th className="px-3 py-2 text-right">Market Samples</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.items.map((item) => {
              const varianceColor = item.variance_pct > 5
                ? 'text-red-600'
                : item.variance_pct < -5
                  ? 'text-green-600'
                  : 'text-gray-600';
              return (
                <tr key={item.pay_item_code} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">
                      <button
                        onClick={() => navigateTo('pi-detail', { payItemCode: item.pay_item_code })}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        {item.pay_item_code}
                      </button>
                    </td>
                  <td className="px-3 py-2 text-gray-900 truncate max-w-[250px]">{item.description}</td>
                  <td className="px-3 py-2 text-gray-500">{item.unit}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-900">{fmt.format(item.contractor_avg_price)}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">{fmt.format(item.market_avg_price)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${varianceColor}`}>
                    {item.variance_pct > 0 ? '+' : ''}{item.variance_pct.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500">{item.contractor_samples}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{item.market_samples}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-gray-500">
          <span>{data.total.toLocaleString()} items — Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={14} /></button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
