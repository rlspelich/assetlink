import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronDown, ChevronRight, Download } from 'lucide-react';
import {
  getLettingDates,
  getLettingReport,
  getContractFilterOptions,
  type LettingContract,
  type LettingBidder,
} from '../../api/estimator';
import { downloadCSV, downloadTXT, exportCurrency } from '../../utils/export';
import { LoadingSpinner, ErrorState, EmptyState } from '../ui/states';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const fmtCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

export function LettingReport({ navigateTo }: { navigateTo: (tab: string, params: any) => void }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [county, setCounty] = useState('');
  const [district, setDistrict] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchFilters, setSearchFilters] = useState<{ county?: string; district?: string }>({});

  const { data: dates } = useQuery({
    queryKey: ['lettingDates'],
    queryFn: () => getLettingDates(200),
  });

  const { data: filterOpts } = useQuery({
    queryKey: ['contractFilterOptions'],
    queryFn: getContractFilterOptions,
  });

  const { data: report, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['lettingReport', searchDate, searchFilters],
    queryFn: () => getLettingReport(searchDate, searchFilters),
    enabled: !!searchDate,
  });

  const handleSearch = () => {
    if (!selectedDate) return;
    setSearchDate(selectedDate);
    const filters: { county?: string; district?: string } = {};
    if (county) filters.county = county;
    if (district) filters.district = district;
    setSearchFilters(filters);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="border-b bg-gray-50 px-4 py-3">
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Letting Date</label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2 py-2 text-sm border rounded-md w-56"
            >
              <option value="">Select a letting date...</option>
              {dates?.map((d) => (
                <option key={d.letting_date} value={d.letting_date}>
                  {d.letting_date} ({d.contract_count} contracts)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">County</label>
            <select
              value={county}
              onChange={(e) => {
                const val = e.target.value;
                setCounty(val);
                // Clear district if incompatible
                if (val && district && filterOpts?.county_to_districts?.[val] && !filterOpts.county_to_districts[val].includes(district)) {
                  setDistrict('');
                }
              }}
              className="px-2 py-2 text-sm border rounded-md w-40 bg-white"
            >
              <option value="">All Counties</option>
              {(district && filterOpts?.district_to_counties?.[district]
                ? filterOpts.district_to_counties[district]
                : filterOpts?.counties || []
              ).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">District</label>
            <select
              value={district}
              onChange={(e) => {
                const val = e.target.value;
                setDistrict(val);
                // Clear county if incompatible
                if (val && county && filterOpts?.district_to_counties?.[val] && !filterOpts.district_to_counties[val].includes(county)) {
                  setCounty('');
                }
              }}
              className="px-2 py-2 text-sm border rounded-md w-36 bg-white"
            >
              <option value="">All Districts</option>
              {(county && filterOpts?.county_to_districts?.[county]
                ? filterOpts.county_to_districts[county]
                : filterOpts?.districts || []
              ).map((d) => <option key={d} value={d}>District {d}</option>)}
            </select>
          </div>
          <button
            onClick={handleSearch}
            disabled={!selectedDate || isFetching}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isFetching ? 'Loading...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {!report && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Calendar size={48} className="mb-3" />
            <p className="text-lg">Letting Report</p>
            <p className="text-sm mt-1">Select a letting date and click Search to view all contracts and bidders</p>
          </div>
        )}

        {isLoading && <LoadingSpinner message="Loading letting report..." />}
        {isError && <ErrorState title="Failed to load letting report" onRetry={() => refetch()} />}

        {report && (
          <div className="max-w-6xl mx-auto space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-xs text-gray-500">Letting Date</div>
                <div className="text-lg font-bold text-gray-900">{report.letting_date}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-xs text-gray-500">Contracts</div>
                <div className="text-lg font-bold text-gray-900">{report.total_contracts}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-xs text-gray-500">Total Value</div>
                <div className="text-lg font-bold text-gray-900">{fmtCompact.format(report.total_value)}</div>
              </div>
            </div>

            {/* Export buttons */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  const rows: Record<string, unknown>[] = [];
                  report.contracts.forEach((c) => {
                    c.bidders.forEach((b) => {
                      rows.push({
                        contract_number: c.contract_number,
                        county: c.county,
                        district: c.district,
                        items: c.item_count,
                        rank: b.rank,
                        contractor: b.contractor_name,
                        total: exportCurrency(b.total),
                        is_low: b.is_low ? 'Yes' : 'No',
                        variance_from_low: b.variance_from_low != null ? exportCurrency(b.variance_from_low) : '',
                        variance_pct: b.variance_pct != null ? b.variance_pct.toFixed(1) : '',
                      });
                    });
                  });
                  downloadCSV(rows, `letting_${report.letting_date}.csv`, [
                    { key: 'contract_number', header: 'Contract #' },
                    { key: 'county', header: 'County' },
                    { key: 'district', header: 'District' },
                    { key: 'items', header: 'Items' },
                    { key: 'rank', header: 'Rank' },
                    { key: 'contractor', header: 'Contractor' },
                    { key: 'total', header: 'Total' },
                    { key: 'is_low', header: 'Low Bid' },
                    { key: 'variance_from_low', header: 'Variance $' },
                    { key: 'variance_pct', header: 'Variance %' },
                  ]);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                <Download size={12} /> Export CSV
              </button>
              <button
                onClick={() => {
                  const lines = [
                    'LETTING REPORT',
                    `Date: ${report.letting_date}`,
                    `Total Contracts: ${report.total_contracts}`,
                    `Total Value: $${exportCurrency(report.total_value)}`,
                    '',
                  ];
                  report.contracts.forEach((c) => {
                    lines.push(`Contract ${c.contract_number} — ${c.county} — Dist. ${c.district} — ${c.item_count} items`);
                    lines.push('-'.repeat(70));
                    c.bidders.forEach((b) => {
                      lines.push(`  #${b.rank}  ${b.contractor_name.padEnd(35).slice(0, 35)}  $${exportCurrency(b.total).padStart(14)}${b.is_low ? '  LOW' : ''}`);
                    });
                    lines.push('');
                  });
                  downloadTXT(lines.join('\n'), `letting_${report.letting_date}_summary.txt`);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                <Download size={12} /> Export Summary
              </button>
            </div>

            {/* Contract cards */}
            {report.contracts.length === 0 ? (
              <div className="bg-white rounded-lg shadow">
                <EmptyState
                  title="No contracts found"
                  message="No contracts match the selected letting date and filters — try a different date or clear county/district filters"
                />
              </div>
            ) : (
              <div className="space-y-2">
                {report.contracts.map((contract) => (
                  <ContractCard key={contract.contract_id} contract={contract} navigateTo={navigateTo} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ContractCard({ contract, navigateTo }: { contract: LettingContract; navigateTo: (tab: string, params: any) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
          <div>
            <div className="text-sm font-medium">
              <span
                role="link"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); navigateTo('bid-tabs', { contractId: contract.contract_id }); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); navigateTo('bid-tabs', { contractId: contract.contract_id }); } }}
                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
              >
                {contract.contract_number}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {contract.county} | Dist. {contract.district} | {contract.item_count} items | {contract.num_bidders} bidders
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-gray-900">
            {contract.low_bid_total != null ? fmt.format(contract.low_bid_total) : 'N/A'}
          </div>
          <div className="text-xs text-gray-500">{contract.low_bidder_name}</div>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-3">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-center w-12">Rank</th>
                <th className="px-3 py-2">Contractor</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Variance $</th>
                <th className="px-3 py-2 text-right">Variance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contract.bidders.map((bidder, idx) => (
                <BidderRow key={`${bidder.contractor_id_code}-${idx}`} bidder={bidder} navigateTo={navigateTo} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BidderRow({ bidder, navigateTo }: { bidder: LettingBidder; navigateTo: (tab: string, params: any) => void }) {
  return (
    <tr className={`hover:bg-gray-50 ${bidder.is_low ? 'bg-green-50' : ''}`}>
      <td className="px-3 py-2 text-center text-gray-600">{bidder.rank}</td>
      <td className="px-3 py-2 font-medium">
        {bidder.contractor_pk ? (
          <button
            onClick={() => navigateTo('contractors', { contractorPk: bidder.contractor_pk })}
            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
          >
            {bidder.contractor_name}
          </button>
        ) : (
          <span className="text-gray-900">{bidder.contractor_name}</span>
        )}
        {bidder.is_low && (
          <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-green-100 text-green-700">LOW</span>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono text-gray-900">{fmt.format(bidder.total)}</td>
      <td className="px-3 py-2 text-right font-mono text-gray-500">
        {bidder.variance_from_low != null ? fmt.format(bidder.variance_from_low) : '--'}
      </td>
      <td className="px-3 py-2 text-right text-gray-500">
        {bidder.variance_pct != null ? `+${bidder.variance_pct.toFixed(1)}%` : '--'}
      </td>
    </tr>
  );
}
