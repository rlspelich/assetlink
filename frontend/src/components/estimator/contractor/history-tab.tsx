import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getBiddingHistory } from '../../../api/estimator';
import { InlineLoading, InlineError, EmptyState } from '../../ui/states';
import { fmt } from './profile-tabs';
import type { EstimatorNavParams } from '../../../routes/estimator-page';

export function HistoryTab({ pk, dateParams, navigateTo }: { pk: string; dateParams: { min_date?: string; max_date?: string }; navigateTo: (tab: string, params: EstimatorNavParams) => void }) {
  const [page, setPage] = useState(1);
  const [winsOnly, setWinsOnly] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['biddingHistory', pk, page, winsOnly, dateParams],
    queryFn: () => getBiddingHistory(pk, { page, page_size: 25, wins_only: winsOnly || undefined, ...dateParams }),
  });

  const totalPages = data ? Math.ceil(data.total / 25) : 0;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-medium text-gray-700">Bidding History</h3>
        <label className="flex items-center gap-2 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={winsOnly}
            onChange={(e) => { setWinsOnly(e.target.checked); setPage(1); }}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Wins only
        </label>
      </div>
      {isLoading ? (
        <InlineLoading />
      ) : isError ? (
        <InlineError message="Failed to load history" onRetry={() => refetch()} />
      ) : !data || data.entries.length === 0 ? (
        <EmptyState
          title="No bidding history"
          message="No bids found for this contractor in the selected date range"
        />
      ) : (
        <>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Contract</th>
                  <th className="px-3 py-2">County</th>
                  <th className="px-3 py-2 text-right">Rank</th>
                  <th className="px-3 py-2 text-right">Bidders</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-center">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.entries.map((e) => (
                  <tr key={e.bid_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-600">{e.letting_date}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => navigateTo('bid-tabs', { contractId: e.contract_id })}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        {e.contract_number}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => navigateTo('bid-tabs', { county: e.county })}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        {e.county}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">{e.rank}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{e.num_bidders}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-900">{fmt.format(e.total)}</td>
                    <td className="px-3 py-2 text-center">
                      {e.is_bad ? (
                        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">Bad</span>
                      ) : e.is_low ? (
                        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Won</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">#{e.rank}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-gray-500">
              <span>{data.total.toLocaleString()} entries — Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page" className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={14} /></button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} aria-label="Next page" className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
