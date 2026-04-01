import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Trophy, TrendingUp, MapPin, DollarSign, BarChart3, ChevronLeft, ChevronRight, GitCompareArrows, Download, Users } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ComposedChart, Line, Cell,
} from 'recharts';
import {
  listContractors,
  getContractorProfile,
  getBiddingHistory,
  getGeoFootprint,
  getActivityTrend,
  getPriceTendencies,
  getContractorVsMarket,
  type ContractorProfile,
} from '../../api/estimator';
import { downloadTXT, exportCurrency, exportPct } from '../../utils/export';
import { LoadingSpinner, InlineLoading, InlineError, ErrorState, EmptyState } from '../ui/states';
import type { EstimatorNavParams } from '../../routes/estimator-page';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const fmtCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

type ProfileTab = 'overview' | 'history' | 'geo' | 'activity' | 'prices' | 'vs-market';

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
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
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

// ============================================================
// Profile Panel
// ============================================================

function ContractorProfilePanel({ pk, activeTab, onTabChange, navigateTo }: {
  pk: string;
  activeTab: ProfileTab;
  onTabChange: (t: ProfileTab) => void;
  navigateTo: (tab: string, params: EstimatorNavParams) => void;
}) {
  // Date range filter — defaults to last 5 years
  const defaultMinDate = `${new Date().getFullYear() - 5}-01-01`;
  const [minDate, setMinDate] = useState(defaultMinDate);
  const [maxDate, setMaxDate] = useState('');
  const dateParams = { min_date: minDate || undefined, max_date: maxDate || undefined };

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ['contractorProfile', pk, minDate, maxDate],
    queryFn: () => getContractorProfile(pk, dateParams),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !profile) {
    return <LoadingSpinner />;
  }
  if (isError) {
    return <ErrorState title="Failed to load profile" onRetry={() => refetch()} />;
  }

  const tabs: { key: ProfileTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 size={14} /> },
    { key: 'history', label: 'Bidding History', icon: <TrendingUp size={14} /> },
    { key: 'geo', label: 'Geographic Footprint', icon: <MapPin size={14} /> },
    { key: 'activity', label: 'Activity Trend', icon: <BarChart3 size={14} /> },
    { key: 'prices', label: 'Price Tendencies', icon: <DollarSign size={14} /> },
    { key: 'vs-market', label: 'vs Market', icon: <GitCompareArrows size={14} /> },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-900">{profile.name}</h2>
        <p className="text-xs text-gray-500 mt-0.5">ID: {profile.contractor_id_code}</p>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 bg-white rounded-lg shadow p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              activeTab === t.key
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Date range filter */}
      <div className="flex items-center gap-3 bg-white rounded-lg shadow px-4 py-2">
        <span className="text-xs font-medium text-gray-500">Date Range:</span>
        <input
          type="date"
          value={minDate}
          onChange={(e) => setMinDate(e.target.value)}
          className="h-9 px-2 text-sm border rounded-md"
        />
        <span className="text-xs text-gray-400">to</span>
        <input
          type="date"
          value={maxDate}
          onChange={(e) => setMaxDate(e.target.value)}
          className="h-9 px-2 text-sm border rounded-md"
          placeholder="Present"
        />
        <button
          onClick={() => { setMinDate(defaultMinDate); setMaxDate(''); }}
          className={`text-xs px-2 py-1 rounded-md ${minDate === defaultMinDate && !maxDate ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          Last 5 Years
        </button>
        <button
          onClick={() => { setMinDate(''); setMaxDate(''); }}
          className={`text-xs px-2 py-1 rounded-md ${!minDate && !maxDate ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          All Time
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab profile={profile} />}
      {activeTab === 'history' && <HistoryTab pk={pk} dateParams={dateParams} navigateTo={navigateTo} />}
      {activeTab === 'geo' && <GeoTab pk={pk} dateParams={dateParams} />}
      {activeTab === 'activity' && <ActivityTab pk={pk} dateParams={dateParams} />}
      {activeTab === 'prices' && <PricesTab pk={pk} dateParams={dateParams} />}
      {activeTab === 'vs-market' && <VsMarketTab pk={pk} dateParams={dateParams} navigateTo={navigateTo} />}
    </div>
  );
}

// ============================================================
// Overview Tab
// ============================================================

function OverviewTab({ profile }: { profile: ContractorProfile }) {
  const captureColor = profile.dollar_capture_pct > 50
    ? 'text-green-600'
    : profile.dollar_capture_pct >= 25
      ? 'text-yellow-600'
      : 'text-red-600';

  const stats = [
    { label: 'Total Bids', value: profile.total_bids.toLocaleString(), icon: <BarChart3 size={16} className="text-blue-500" /> },
    { label: 'Wins', value: profile.total_wins.toLocaleString(), icon: <Trophy size={16} className="text-yellow-500" /> },
    { label: 'Win Rate', value: profile.win_rate.toFixed(1) + '%', icon: <TrendingUp size={16} className="text-green-500" /> },
    { label: '$ Won', value: fmtCompact.format(profile.total_won), icon: <DollarSign size={16} className="text-emerald-500" /> },
    { label: '$ On Table', value: fmtCompact.format(profile.on_table), icon: <DollarSign size={16} className="text-orange-500" /> },
    { label: 'Capture %', value: profile.dollar_capture_pct.toFixed(1) + '%', icon: <DollarSign size={16} className="text-indigo-500" />, customColor: captureColor },
    { label: 'Avg Bid Total', value: profile.avg_bid_total ? fmtCompact.format(profile.avg_bid_total) : 'N/A', icon: <DollarSign size={16} className="text-teal-500" /> },
    { label: 'Total Volume', value: fmtCompact.format(profile.total_bid_volume), icon: <DollarSign size={16} className="text-indigo-500" /> },
    { label: 'Active Years', value: String(profile.active_years), icon: <BarChart3 size={16} className="text-purple-500" /> },
  ];

  const handleExportSummary = () => {
    const lines = [
      'CONTRACTOR PROFILE SUMMARY',
      `Date: ${new Date().toISOString().slice(0, 10)}`,
      '',
      `Contractor: ${profile.name}`,
      `ID: ${profile.contractor_id_code}`,
      '',
      'KEY METRICS',
      '-'.repeat(40),
      `Total Bids:      ${profile.total_bids.toLocaleString()}`,
      `Total Wins:      ${profile.total_wins.toLocaleString()}`,
      `Win Rate:        ${profile.win_rate.toFixed(1)}%`,
      `$ Won:           $${exportCurrency(profile.total_won)}`,
      `$ On Table:      $${exportCurrency(profile.on_table)}`,
      `Capture %:       ${exportPct(profile.dollar_capture_pct)}`,
      `Avg Bid Total:   ${profile.avg_bid_total ? '$' + exportCurrency(profile.avg_bid_total) : 'N/A'}`,
      `Total Volume:    $${exportCurrency(profile.total_bid_volume)}`,
      `Active Years:    ${profile.active_years}`,
      '',
      `First Bid: ${profile.first_bid_date || 'N/A'}`,
      `Last Bid:  ${profile.last_bid_date || 'N/A'}`,
      '',
      `Counties (${profile.counties.length}): ${profile.counties.join(', ')}`,
      `Districts (${profile.districts.length}): ${profile.districts.join(', ')}`,
    ];
    downloadTXT(lines.join('\n'), `contractor_profile_${profile.contractor_id_code}.txt`);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={handleExportSummary}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          <Download size={12} /> Export Summary
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 mb-1">
              {s.icon}
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
            <div className={`text-lg font-semibold ${'customColor' in s && s.customColor ? s.customColor : 'text-gray-900'}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Date Range</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <div>First bid: <span className="font-medium">{profile.first_bid_date || 'N/A'}</span></div>
            <div>Last bid: <span className="font-medium">{profile.last_bid_date || 'N/A'}</span></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Coverage</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <div>Counties: <span className="font-medium">{profile.counties.length}</span></div>
            <div>Districts: <span className="font-medium">{profile.districts.length}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Bidding History Tab
// ============================================================

function HistoryTab({ pk, dateParams, navigateTo }: { pk: string; dateParams: { min_date?: string; max_date?: string }; navigateTo: (tab: string, params: EstimatorNavParams) => void }) {
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
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={14} /></button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Geographic Footprint Tab
// ============================================================

function GeoTab({ pk, dateParams }: { pk: string; dateParams: { min_date?: string; max_date?: string } }) {
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

function GeoTable({ title, entries }: { title: string; entries: { name: string; bid_count: number; win_count: number; win_rate: number; total_volume: number }[] }) {
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

// ============================================================
// Activity Trend Tab
// ============================================================

function ActivityTab({ pk, dateParams }: { pk: string; dateParams: { min_date?: string; max_date?: string } }) {
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

// ============================================================
// Price Tendencies Tab
// ============================================================

function PricesTab({ pk, dateParams }: { pk: string; dateParams: { min_date?: string; max_date?: string } }) {
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

// ============================================================
// vs Market Tab
// ============================================================

function VsMarketTab({ pk, dateParams, navigateTo }: { pk: string; dateParams: { min_date?: string; max_date?: string }; navigateTo: (tab: string, params: EstimatorNavParams) => void }) {
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
