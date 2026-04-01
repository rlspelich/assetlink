import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { listContractors } from '../../api/estimator';
import { InlineLoading, InlineError, EmptyState } from '../ui/states';
import type { EstimatorNavParams } from '../../routes/estimator-page';
import { ContractorProfilePanel, type ProfileTab } from './contractor/profile-tabs';

let _contractorSearchTimer: ReturnType<typeof setTimeout>;

export function ContractorSearch({ navigateTo, navParams }: {
  navigateTo: (tab: string, params: EstimatorNavParams) => void;
  navParams: EstimatorNavParams;
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedPk, setSelectedPk] = useState<string | null>(navParams?.contractorPk || null);
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview');

  // Auto-select contractor from navParams
  useEffect(() => {
    if (navParams?.contractorPk) {
      setSelectedPk(navParams.contractorPk);
      setProfileTab('overview');
    }
  }, [navParams?.contractorPk]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
    clearTimeout(_contractorSearchTimer);
    _contractorSearchTimer = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['contractors', debouncedSearch, page],
    queryFn: () => listContractors({ search: debouncedSearch || undefined, page, page_size: 25 }),
  });

  const totalPages = data ? Math.ceil(data.total / 25) : 0;

  return (
    <div className="flex h-full">
      {/* Left panel — contractor list */}
      <div className="w-[420px] flex flex-col border-r bg-white">
        <div className="p-3 border-b">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search contractors by name..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-9 w-full pl-9 pr-3 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {data && (
            <div className="mt-1 text-xs text-gray-500">
              {data.total.toLocaleString()} contractors
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading && <InlineLoading />}
          {isError && <InlineError message="Failed to load contractors" onRetry={() => refetch()} />}
          {data && data.contractors.length === 0 && (
            <EmptyState
              title="No contractors found"
              message="Try a different name or clear the search to browse all contractors"
            />
          )}
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase sticky top-0">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 text-right">Bids</th>
                <th className="px-3 py-2 text-right">Wins</th>
                <th className="px-3 py-2 text-right">Win %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.contractors.map((c) => {
                const winRate = c.bid_count > 0 ? (c.win_count / c.bid_count) * 100 : 0;
                return (
                  <tr
                    key={c.contractor_pk}
                    onClick={() => { setSelectedPk(c.contractor_pk); setProfileTab('overview'); }}
                    className={`cursor-pointer hover:bg-blue-50 ${
                      selectedPk === c.contractor_pk ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-gray-900 truncate max-w-[200px]">{c.name}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{c.bid_count}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{c.win_count}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{winRate.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-gray-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                aria-label="Previous page"
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                aria-label="Next page"
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — contractor profile */}
      <div className="flex-1 overflow-auto bg-gray-50">
        {!selectedPk ? (
          <EmptyState
            icon={<Users size={40} className="text-gray-300" />}
            title="Select a contractor"
            message="Choose a contractor from the list to view their profile, bidding history, and price analysis"
          />
        ) : (
          <ContractorProfilePanel pk={selectedPk} activeTab={profileTab} onTabChange={setProfileTab} navigateTo={navigateTo} />
        )}
      </div>
    </div>
  );
}
