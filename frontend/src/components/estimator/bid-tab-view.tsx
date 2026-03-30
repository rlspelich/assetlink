import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import {
  listContracts,
  getBidTab,
  getCategoryBreakdown,
} from '../../api/estimator';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const fmtCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

export function BidTabView() {
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col">
      {selectedContractId ? (
        <BidTabDetail contractId={selectedContractId} onBack={() => setSelectedContractId(null)} />
      ) : (
        <ContractList onSelect={setSelectedContractId} />
      )}
    </div>
  );
}

// ============================================================
// Contract List
// ============================================================

function ContractList({ onSelect }: { onSelect: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [county, setCounty] = useState('');
  const [district, setDistrict] = useState('');
  const [page, setPage] = useState(1);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
    clearTimeout((window as any).__contractSearchTimer);
    (window as any).__contractSearchTimer = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', debouncedSearch, county, district, page],
    queryFn: () => listContracts({
      search: debouncedSearch || undefined,
      county: county || undefined,
      district: district || undefined,
      page,
      page_size: 25,
    }),
  });

  const totalPages = data ? Math.ceil(data.total / 25) : 0;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Filters */}
      <div className="p-3 border-b space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by contract number..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="County filter..."
            value={county}
            onChange={(e) => { setCounty(e.target.value); setPage(1); }}
            className="flex-1 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="District filter..."
            value={district}
            onChange={(e) => { setDistrict(e.target.value); setPage(1); }}
            className="flex-1 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {data && (
          <div className="text-xs text-gray-500">{data.total.toLocaleString()} contracts</div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading && (
          <div className="flex items-center justify-center p-8 text-gray-400">Loading...</div>
        )}
        {data && data.contracts.length === 0 && (
          <div className="p-4 text-sm text-gray-400">No contracts found.</div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase sticky top-0">
            <tr>
              <th className="px-3 py-2">Contract #</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">County</th>
              <th className="px-3 py-2">District</th>
              <th className="px-3 py-2 text-right">Items</th>
              <th className="px-3 py-2 text-right">Bidders</th>
              <th className="px-3 py-2 text-right">Low Bid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data?.contracts.map((c) => (
              <tr
                key={c.contract_id}
                onClick={() => onSelect(c.contract_id)}
                className="cursor-pointer hover:bg-blue-50"
              >
                <td className="px-3 py-2 font-medium text-blue-600">{c.number}</td>
                <td className="px-3 py-2 text-gray-600">{c.letting_date}</td>
                <td className="px-3 py-2 text-gray-600">{c.county}</td>
                <td className="px-3 py-2 text-gray-600">{c.district}</td>
                <td className="px-3 py-2 text-right text-gray-600">{c.item_count}</td>
                <td className="px-3 py-2 text-right text-gray-600">{c.bid_count}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-900">
                  {c.low_bid_total != null ? fmtCompact.format(c.low_bid_total) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-gray-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={14} /></button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Bid Tab Detail
// ============================================================

function BidTabDetail({ contractId, onBack }: { contractId: string; onBack: () => void }) {
  const { data: bidTab, isLoading } = useQuery({
    queryKey: ['bidTab', contractId],
    queryFn: () => getBidTab(contractId),
  });

  const { data: breakdown } = useQuery({
    queryKey: ['categoryBreakdown', contractId],
    queryFn: () => getCategoryBreakdown(contractId),
    enabled: !!bidTab,
  });

  if (isLoading || !bidTab) {
    return <div className="flex items-center justify-center p-8 text-gray-400">Loading bid tab...</div>;
  }

  const sortedBidders = [...bidTab.bidders].sort((a, b) => a.rank - b.rank);

  return (
    <div className="flex flex-col h-full overflow-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-2">
          <ArrowLeft size={14} /> Back to contracts
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Contract {bidTab.contract_number}</h2>
            <p className="text-sm text-gray-500">
              {bidTab.letting_date} &middot; {bidTab.county} &middot; District {bidTab.district} &middot; {bidTab.bidders.length} bidders &middot; {bidTab.total_items} items
            </p>
          </div>
        </div>

        {/* Bidder summary row */}
        <div className="mt-3 flex gap-2 flex-wrap">
          {sortedBidders.map((b) => (
            <div
              key={b.contractor_pk}
              className={`px-3 py-2 rounded-md text-xs ${
                b.is_low
                  ? 'bg-green-50 border border-green-200'
                  : b.is_bad
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="font-medium text-gray-900 truncate max-w-[180px]">
                #{b.rank} {b.contractor_name}
              </div>
              <div className={`font-mono ${b.is_low ? 'text-green-700 font-bold' : b.is_bad ? 'text-red-600' : 'text-gray-600'}`}>
                {fmt.format(b.total)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Line item matrix */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-medium text-gray-700">Line Items</h3>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase sticky top-0">
                <tr>
                  <th className="px-3 py-2 whitespace-nowrap">Code</th>
                  <th className="px-3 py-2 whitespace-nowrap">Description</th>
                  <th className="px-3 py-2 whitespace-nowrap">Unit</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Qty</th>
                  {sortedBidders.map((b) => (
                    <th key={b.contractor_pk} className="px-3 py-2 text-right whitespace-nowrap">
                      <span className={`${b.is_low ? 'text-green-600' : ''}`}>
                        #{b.rank} {b.contractor_name.length > 12 ? b.contractor_name.slice(0, 12) + '...' : b.contractor_name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bidTab.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-mono text-gray-700 whitespace-nowrap">{item.pay_item_code}</td>
                    <td className="px-3 py-1.5 text-gray-900 max-w-[200px] truncate">{item.abbreviation}</td>
                    <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{item.unit}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-600">{item.quantity.toLocaleString()}</td>
                    {sortedBidders.map((b) => {
                      const price = item.prices[b.contractor_pk];
                      const isLow = price != null && item.low_price != null && price === item.low_price;
                      const isHigh = price != null && item.high_price != null && price === item.high_price;
                      return (
                        <td
                          key={b.contractor_pk}
                          className={`px-3 py-1.5 text-right font-mono whitespace-nowrap ${
                            isLow
                              ? 'text-green-700 bg-green-50 font-medium'
                              : isHigh
                                ? 'text-red-600 bg-red-50'
                                : 'text-gray-700'
                          }`}
                        >
                          {price != null ? fmt.format(price) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Category breakdown */}
        {breakdown && breakdown.breakdown.length > 0 && (
          <div className="bg-white rounded-lg shadow mt-4">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-medium text-gray-700">Category Breakdown</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Low bidder: {breakdown.contractor_name} &middot; Total: {fmt.format(breakdown.grand_total)}
              </p>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <tr>
                    <th className="px-3 py-2">Division</th>
                    <th className="px-3 py-2 text-right">Items</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2">% of Contract</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {breakdown.breakdown.map((cat) => {
                    const maxPct = Math.max(...breakdown.breakdown.map((b) => b.pct_of_contract), 1);
                    const barWidth = (cat.pct_of_contract / maxPct) * 100;
                    return (
                      <tr key={cat.division} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900 max-w-[250px] truncate">{cat.division}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{cat.item_count}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900">{fmt.format(cat.total)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[120px]">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-12 text-right">{cat.pct_of_contract.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
