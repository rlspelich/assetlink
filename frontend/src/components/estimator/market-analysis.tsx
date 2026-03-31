import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, DollarSign, Users, BarChart3, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  getMarketAnalysis,
  getContractFilterOptions,
  type MarketPlayer,
} from '../../api/estimator';
import { downloadCSV, downloadTXT, exportCurrency, exportPct } from '../../utils/export';
import { LoadingSpinner, ErrorState } from '../ui/states';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const fmtCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

export function MarketAnalysis({ navigateTo }: { navigateTo: (tab: string, params: any) => void }) {
  const [county, setCounty] = useState('');
  const [district, setDistrict] = useState('');
  const [minDate, setMinDate] = useState(`${new Date().getFullYear() - 5}-01-01`);
  const [maxDate, setMaxDate] = useState('');
  const [minSize, setMinSize] = useState('');
  const [maxSize, setMaxSize] = useState('');
  const [searchParams, setSearchParams] = useState<Record<string, string | number | undefined>>({});

  const { data: filterOpts } = useQuery({
    queryKey: ['contractFilterOptions'],
    queryFn: getContractFilterOptions,
  });

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['marketAnalysis', searchParams],
    queryFn: () => getMarketAnalysis({
      county: searchParams.county as string | undefined,
      district: searchParams.district as string | undefined,
      min_date: searchParams.min_date as string | undefined,
      max_date: searchParams.max_date as string | undefined,
      min_project_size: searchParams.min_project_size as number | undefined,
      max_project_size: searchParams.max_project_size as number | undefined,
      limit: 100,
    }),
    enabled: Object.keys(searchParams).length > 0,
  });

  const handleSearch = () => {
    const params: Record<string, string | number | undefined> = {};
    if (county) params.county = county;
    if (district) params.district = district;
    if (minDate) params.min_date = minDate;
    if (maxDate) params.max_date = maxDate;
    if (minSize) params.min_project_size = Number(minSize);
    if (maxSize) params.max_project_size = Number(maxSize);
    // Always set at least one key so query is enabled
    if (Object.keys(params).length === 0) params._all = 'true';
    setSearchParams(params);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="border-b bg-gray-50 px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">County</label>
            <select
              value={county}
              onChange={(e) => {
                const val = e.target.value;
                setCounty(val);
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
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">From Date</label>
            <input type="date" value={minDate} onChange={(e) => setMinDate(e.target.value)} className="px-2 py-2 text-sm border rounded-md" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">To Date</label>
            <input type="date" value={maxDate} onChange={(e) => setMaxDate(e.target.value)} className="px-2 py-2 text-sm border rounded-md" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Min Project $</label>
            <input type="number" value={minSize} onChange={(e) => setMinSize(e.target.value)} placeholder="0" className="px-2 py-2 text-sm border rounded-md w-28" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Max Project $</label>
            <input type="number" value={maxSize} onChange={(e) => setMaxSize(e.target.value)} placeholder="No limit" className="px-2 py-2 text-sm border rounded-md w-28" />
          </div>
          <button
            onClick={handleSearch}
            disabled={isFetching}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isFetching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {!data && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Search size={48} className="mb-3" />
            <p className="text-lg">Market Analysis</p>
            <p className="text-sm mt-1">Set filters and click Search to see who the players are</p>
          </div>
        )}

        {isLoading && <LoadingSpinner message="Analyzing market..." />}
        {isError && <ErrorState title="Failed to load market data" onRetry={() => refetch()} />}

        {data && (
          <div className="space-y-4 max-w-7xl mx-auto">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={16} className="text-emerald-500" />
                  <span className="text-xs text-gray-500">Total Market Value</span>
                </div>
                <div className="text-xl font-bold text-gray-900">{fmtCompact.format(data.total_market_value)}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 size={16} className="text-blue-500" />
                  <span className="text-xs text-gray-500">Total Contracts</span>
                </div>
                <div className="text-xl font-bold text-gray-900">{data.total_contracts.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users size={16} className="text-indigo-500" />
                  <span className="text-xs text-gray-500">Total Bidders</span>
                </div>
                <div className="text-xl font-bold text-gray-900">{data.total_bidders.toLocaleString()}</div>
              </div>
            </div>

            {/* Top 10 chart */}
            {data.players.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Top 10 by $ Won</h3>
                <div style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={data.players.slice(0, 10).map((p) => ({
                        name: p.contractor_name.length > 25 ? p.contractor_name.slice(0, 25) + '...' : p.contractor_name,
                        total_low: p.total_low,
                      }))}
                      margin={{ top: 0, right: 20, bottom: 0, left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v: number) => fmtCompact.format(v)} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
                      { /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ }
                      <Tooltip formatter={(value: any) => fmt.format(Number(value))} />
                      <Bar dataKey="total_low" fill="#3b82f6" name="$ Won" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Results table */}
            <div className="bg-white rounded-lg shadow">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="text-sm font-medium text-gray-700">Market Players ({data.players.length})</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      downloadCSV(
                        data.players.map((p) => ({
                          rank: p.rank,
                          contractor: p.contractor_name,
                          jobs_bid: p.jobs_bid,
                          jobs_won: p.jobs_won,
                          win_rate_pct: p.win_rate.toFixed(1),
                          dollar_won: exportCurrency(p.total_low),
                          dollar_total_bid: exportCurrency(p.total_bid),
                          capture_pct: p.dollar_capture_pct.toFixed(1),
                          left_on_table_pct: p.pct_left_on_table.toFixed(1),
                        })),
                        'market_analysis.csv',
                        [
                          { key: 'rank', header: 'Rank' },
                          { key: 'contractor', header: 'Contractor' },
                          { key: 'jobs_bid', header: 'Jobs Bid' },
                          { key: 'jobs_won', header: 'Jobs Won' },
                          { key: 'win_rate_pct', header: 'Win Rate %' },
                          { key: 'dollar_won', header: '$ Won' },
                          { key: 'dollar_total_bid', header: '$ Total Bid' },
                          { key: 'capture_pct', header: 'Capture %' },
                          { key: 'left_on_table_pct', header: 'Left on Table %' },
                        ],
                      );
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    <Download size={12} /> Export CSV
                  </button>
                  <button
                    onClick={() => {
                      const filters = searchParams;
                      const filterLines = [
                        filters.county ? `County: ${filters.county}` : null,
                        filters.district ? `District: ${filters.district}` : null,
                        filters.min_date ? `From: ${filters.min_date}` : null,
                        filters.max_date ? `To: ${filters.max_date}` : null,
                        filters.min_project_size ? `Min Project $: ${filters.min_project_size}` : null,
                        filters.max_project_size ? `Max Project $: ${filters.max_project_size}` : null,
                      ].filter(Boolean);
                      const lines = [
                        'MARKET ANALYSIS REPORT',
                        `Date: ${new Date().toISOString().slice(0, 10)}`,
                        `Filters: ${filterLines.length > 0 ? filterLines.join(', ') : 'None'}`,
                        `Total Market: $${exportCurrency(data.total_market_value)}`,
                        `Total Contracts: ${data.total_contracts.toLocaleString()}`,
                        `Total Bidders: ${data.total_bidders.toLocaleString()}`,
                        '',
                        'Rank  Contractor                          Jobs Won  $ Won              Capture%',
                        '-'.repeat(85),
                        ...data.players.map((p) =>
                          `${String(p.rank).padStart(4)}  ${p.contractor_name.padEnd(36).slice(0, 36)}${String(p.jobs_won).padStart(8)}  $${exportCurrency(p.total_low).padStart(16)}  ${exportPct(p.dollar_capture_pct).padStart(8)}`
                        ),
                      ];
                      downloadTXT(lines.join('\n'), 'market_analysis_summary.txt');
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    <Download size={12} /> Export Summary
                  </button>
                </div>
              </div>
              {data.players.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No players found for these filters.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-center w-12">#</th>
                        <th className="px-3 py-2">Contractor</th>
                        <th className="px-3 py-2 text-right">Jobs Bid</th>
                        <th className="px-3 py-2 text-right">Jobs Won</th>
                        <th className="px-3 py-2 text-right">Win Rate</th>
                        <th className="px-3 py-2 text-right">$ Won (Low)</th>
                        <th className="px-3 py-2 text-right">$ Total Bid</th>
                        <th className="px-3 py-2 text-right">Capture %</th>
                        <th className="px-3 py-2 text-right">Left on Table %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.players.map((p) => (
                        <PlayerRow key={p.contractor_pk} player={p} navigateTo={navigateTo} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerRow({ player: p, navigateTo }: { player: MarketPlayer; navigateTo: (tab: string, params: any) => void }) {
  const captureColor = p.dollar_capture_pct > 50
    ? 'text-green-600'
    : p.dollar_capture_pct >= 25
      ? 'text-yellow-600'
      : 'text-red-600';

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-3 py-2 text-center text-gray-400 font-medium">{p.rank}</td>
      <td className="px-3 py-2 truncate max-w-[250px]">
        <button
          onClick={() => navigateTo('contractors', { contractorPk: p.contractor_pk })}
          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
        >
          {p.contractor_name}
        </button>
      </td>
      <td className="px-3 py-2 text-right text-gray-600">{p.jobs_bid.toLocaleString()}</td>
      <td className="px-3 py-2 text-right text-gray-600">{p.jobs_won.toLocaleString()}</td>
      <td className="px-3 py-2 text-right text-gray-600">{p.win_rate.toFixed(1)}%</td>
      <td className="px-3 py-2 text-right font-mono text-gray-900">{fmt.format(p.total_low)}</td>
      <td className="px-3 py-2 text-right font-mono text-gray-600">{fmt.format(p.total_bid)}</td>
      <td className={`px-3 py-2 text-right font-medium ${captureColor}`}>{p.dollar_capture_pct.toFixed(1)}%</td>
      <td className="px-3 py-2 text-right text-gray-500">{p.pct_left_on_table.toFixed(1)}%</td>
    </tr>
  );
}
