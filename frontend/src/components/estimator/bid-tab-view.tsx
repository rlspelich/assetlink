import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, ArrowLeft, Download } from 'lucide-react';
import {
  listContracts,
  getBidTab,
  getCategoryBreakdown,
  getContractFilterOptions,
} from '../../api/estimator';
import { downloadCSV, exportCurrency } from '../../utils/export';
import { LoadingSpinner, ErrorState } from '../ui/states';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const fmtCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

export function BidTabView({ navParams, navigateTo }: { navParams: any; navigateTo?: (tab: string, params: any) => void }) {
  const [selectedContractId, setSelectedContractId] = useState<string | null>(navParams?.contractId || null);
  const [cameFromTab] = useState<string | null>(navParams?.sourceTab || null);

  // Auto-open contract from navParams
  useEffect(() => {
    if (navParams?.contractId) {
      setSelectedContractId(navParams.contractId);
    }
  }, [navParams?.contractId]);

  const handleBack = () => {
    // If we drilled in from another tab, go back there
    if (cameFromTab && navigateTo) {
      navigateTo(cameFromTab, {});
    } else {
      setSelectedContractId(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {selectedContractId ? (
        <BidTabDetail contractId={selectedContractId} onBack={handleBack} navigateTo={navigateTo} cameFromTab={cameFromTab} />
      ) : (
        <ContractList onSelect={setSelectedContractId} initialCounty={navParams?.county} />
      )}
    </div>
  );
}

// ============================================================
// Contract List
// ============================================================

function ContractList({ onSelect, initialCounty }: { onSelect: (id: string) => void; initialCounty?: string }) {
  const defaultMinDate = `${new Date().getFullYear() - 5}-01-01`;

  // Filter state (what the user is editing)
  const [search, setSearch] = useState('');
  const [county, setCounty] = useState(initialCounty || '');
  const [district, setDistrict] = useState('');
  const [minDate, setMinDate] = useState(defaultMinDate);
  const [maxDate, setMaxDate] = useState('');
  const [municipality, setMunicipality] = useState('');

  // Applied filters (what the query actually uses — only updated on Search click)
  const [appliedFilters, setAppliedFilters] = useState<{
    search: string; county: string; district: string;
    minDate: string; maxDate: string; municipality: string;
  }>(initialCounty
    ? { search: '', county: initialCounty, district: '', minDate: defaultMinDate, maxDate: '', municipality: '' }
    : { search: '', county: '', district: '', minDate: '', maxDate: '', municipality: '' }
  );
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(!!initialCounty);

  // Load filter options (counties, districts, mappings)
  const { data: filterOpts } = useQuery({
    queryKey: ['contractFilterOptions'],
    queryFn: getContractFilterOptions,
    staleTime: 5 * 60 * 1000,
  });

  // Dependent dropdown logic
  const availableCounties = district && filterOpts?.district_to_counties?.[district]
    ? filterOpts.district_to_counties[district]
    : filterOpts?.counties || [];

  const availableDistricts = county && filterOpts?.county_to_districts?.[county]
    ? filterOpts.county_to_districts[county]
    : filterOpts?.districts || [];

  // Reset county if it's not valid for the selected district (and vice versa)
  const handleCountyChange = (val: string) => {
    setCounty(val);
    if (val && district && filterOpts?.county_to_districts?.[val] && !filterOpts.county_to_districts[val].includes(district)) {
      setDistrict('');
    }
  };
  const handleDistrictChange = (val: string) => {
    setDistrict(val);
    if (val && county && filterOpts?.district_to_counties?.[val] && !filterOpts.district_to_counties[val].includes(county)) {
      setCounty('');
    }
  };

  // Execute search
  const executeSearch = () => {
    setAppliedFilters({ search, county, district, minDate, maxDate, municipality });
    setPage(1);
    setHasSearched(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') executeSearch();
  };

  // Only query when user has clicked Search
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['contracts', appliedFilters, page],
    queryFn: () => listContracts({
      search: appliedFilters.search || undefined,
      county: appliedFilters.county || undefined,
      district: appliedFilters.district || undefined,
      min_date: appliedFilters.minDate || undefined,
      max_date: appliedFilters.maxDate || undefined,
      municipality: appliedFilters.municipality || undefined,
      page,
      page_size: 25,
    }),
    enabled: hasSearched,
  });

  const totalPages = data ? Math.ceil(data.total / 25) : 0;

  const clearFilters = () => {
    setSearch(''); setCounty(''); setDistrict('');
    setMinDate(defaultMinDate); setMaxDate(''); setMunicipality('');
    setAppliedFilters({ search: '', county: '', district: '', minDate: '', maxDate: '', municipality: '' });
    setPage(1);
    setHasSearched(false);
  };

  const hasFilters = county || district || minDate || maxDate || municipality || search;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Filters */}
      <div className="p-3 border-b space-y-2" onKeyDown={handleKeyDown}>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by contract number, county, or municipality..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={county}
            onChange={(e) => handleCountyChange(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Counties</option>
            {availableCounties.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={district}
            onChange={(e) => handleDistrictChange(e.target.value)}
            className="w-32 px-3 py-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Districts</option>
            {availableDistricts.map((d) => (
              <option key={d} value={d}>District {d}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-1.5">
            <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
            <input
              type="date"
              value={minDate}
              min={filterOpts?.min_date || undefined}
              max={maxDate || filterOpts?.max_date || undefined}
              onChange={(e) => setMinDate(e.target.value)}
              className="flex-1 px-2 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1 flex items-center gap-1.5">
            <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
            <input
              type="date"
              value={maxDate}
              min={minDate || filterOpts?.min_date || undefined}
              max={filterOpts?.max_date || undefined}
              onChange={(e) => setMaxDate(e.target.value)}
              className="flex-1 px-2 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <input
            type="text"
            placeholder="Municipality..."
            value={municipality}
            onChange={(e) => setMunicipality(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={executeSearch}
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Search
          </button>
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500">
              {hasSearched && data ? `${data.total.toLocaleString()} contracts found` : ''}
              {filterOpts && !hasSearched ? `${filterOpts.min_date?.slice(0,4)}–${filterOpts.max_date?.slice(0,4)} · Set filters and click Search` : ''}
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-800">
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {!hasSearched && (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400">
            <Search size={40} className="mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">Search IDOT Bid Tabulations</p>
            <p className="text-xs mt-1">Select a county, district, date range, or enter a contract number, then click Search.</p>
          </div>
        )}
        {hasSearched && isLoading && <LoadingSpinner />}
        {hasSearched && isError && <ErrorState title="Failed to load contracts" onRetry={() => refetch()} />}
        {hasSearched && data && data.contracts.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-gray-400">
            <p className="text-sm">No contracts found matching your filters.</p>
            <p className="text-xs mt-1">Try broadening your search criteria.</p>
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase sticky top-0">
            <tr>
              <th className="px-3 py-2">Contract #</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">County</th>
              <th className="px-3 py-2">Dist.</th>
              <th className="px-3 py-2">Municipality</th>
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
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{c.letting_date}</td>
                <td className="px-3 py-2 text-gray-600">{c.county}</td>
                <td className="px-3 py-2 text-gray-600 text-center">{c.district}</td>
                <td className="px-3 py-2 text-gray-600 max-w-[150px] truncate">{c.municipality || '-'}</td>
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

const TAB_LABELS: Record<string, string> = {
  'pay-items': 'Pay Item Search',
  'estimates': 'Estimate Builder',
  'contractors': 'Contractors',
  'head-to-head': 'Head-to-Head',
  'bid-tabs': 'Bid Tabs',
  'market-analysis': 'Market Analysis',
  'letting-report': 'Letting Report',
  'pi-detail': 'Bid Price Search',
};

function BidTabDetail({ contractId, onBack, navigateTo, cameFromTab }: { contractId: string; onBack: () => void; navigateTo?: (tab: string, params: any) => void; cameFromTab?: string | null }) {
  const { data: bidTab, isLoading, isError, refetch } = useQuery({
    queryKey: ['bidTab', contractId],
    queryFn: () => getBidTab(contractId),
  });

  const { data: breakdown } = useQuery({
    queryKey: ['categoryBreakdown', contractId],
    queryFn: () => getCategoryBreakdown(contractId),
    enabled: !!bidTab,
  });

  if (isLoading || !bidTab) {
    return <LoadingSpinner message="Loading bid tab..." />;
  }
  if (isError) {
    return <ErrorState title="Failed to load bid tab" onRetry={() => refetch()} />;
  }

  const sortedBidders = [...bidTab.bidders].sort((a, b) => a.rank - b.rank);

  return (
    <div className="flex flex-col h-full overflow-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-2">
          <ArrowLeft size={14} /> {cameFromTab ? `Back to ${TAB_LABELS[cameFromTab] || cameFromTab}` : 'Back to contracts'}
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Contract {bidTab.contract_number}</h2>
            <p className="text-sm text-gray-500">
              {bidTab.letting_date} &middot; {bidTab.county} &middot; District {bidTab.district} &middot; {bidTab.bidders.length} bidders &middot; {bidTab.total_items} items
            </p>
          </div>
          <button
            onClick={() => {
              const bidderCols = sortedBidders.map((b) => ({
                key: `bidder_${b.contractor_pk}`,
                header: `#${b.rank} ${b.contractor_name}`,
              }));
              const rows = bidTab.items.map((item) => {
                const row: Record<string, unknown> = {
                  code: item.pay_item_code,
                  description: item.abbreviation,
                  unit: item.unit,
                  qty: item.quantity,
                };
                sortedBidders.forEach((b) => {
                  const price = item.prices[b.contractor_pk];
                  row[`bidder_${b.contractor_pk}`] = price != null ? exportCurrency(price) : '';
                });
                return row;
              });
              downloadCSV(rows, `bidtab_${bidTab.contract_number}.csv`, [
                { key: 'code', header: 'Pay Item Code' },
                { key: 'description', header: 'Description' },
                { key: 'unit', header: 'Unit' },
                { key: 'qty', header: 'Qty' },
                ...bidderCols,
              ]);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            <Download size={12} /> Export CSV
          </button>
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
                #{b.rank}{' '}
                {navigateTo ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigateTo('contractors', { contractorPk: b.contractor_pk }); }}
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {b.contractor_name}
                  </button>
                ) : b.contractor_name}
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
