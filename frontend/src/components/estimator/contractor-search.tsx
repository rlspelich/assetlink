import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Trophy, TrendingUp, MapPin, DollarSign, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  listContractors,
  getContractorProfile,
  getBiddingHistory,
  getGeoFootprint,
  getActivityTrend,
  getPriceTendencies,
  type ContractorProfile,
} from '../../api/estimator';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const fmtCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

type ProfileTab = 'overview' | 'history' | 'geo' | 'activity' | 'prices';

export function ContractorSearch() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedPk, setSelectedPk] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview');

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
    clearTimeout((window as any).__contractorSearchTimer);
    (window as any).__contractorSearchTimer = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const { data, isLoading } = useQuery({
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
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {data && (
            <div className="mt-1 text-xs text-gray-500">
              {data.total.toLocaleString()} contractors
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading && (
            <div className="flex items-center justify-center p-8 text-gray-400">Loading...</div>
          )}
          {data && data.contractors.length === 0 && (
            <div className="p-4 text-sm text-gray-400">No contractors found.</div>
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
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Select a contractor to view their profile
          </div>
        ) : (
          <ContractorProfilePanel pk={selectedPk} activeTab={profileTab} onTabChange={setProfileTab} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Profile Panel
// ============================================================

function ContractorProfilePanel({ pk, activeTab, onTabChange }: {
  pk: string;
  activeTab: ProfileTab;
  onTabChange: (t: ProfileTab) => void;
}) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['contractorProfile', pk],
    queryFn: () => getContractorProfile(pk),
  });

  if (isLoading || !profile) {
    return <div className="flex items-center justify-center p-8 text-gray-400">Loading...</div>;
  }

  const tabs: { key: ProfileTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 size={14} /> },
    { key: 'history', label: 'Bidding History', icon: <TrendingUp size={14} /> },
    { key: 'geo', label: 'Geographic Footprint', icon: <MapPin size={14} /> },
    { key: 'activity', label: 'Activity Trend', icon: <BarChart3 size={14} /> },
    { key: 'prices', label: 'Price Tendencies', icon: <DollarSign size={14} /> },
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

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab profile={profile} />}
      {activeTab === 'history' && <HistoryTab pk={pk} />}
      {activeTab === 'geo' && <GeoTab pk={pk} />}
      {activeTab === 'activity' && <ActivityTab pk={pk} />}
      {activeTab === 'prices' && <PricesTab pk={pk} />}
    </div>
  );
}

// ============================================================
// Overview Tab
// ============================================================

function OverviewTab({ profile }: { profile: ContractorProfile }) {
  const stats = [
    { label: 'Total Bids', value: profile.total_bids.toLocaleString(), icon: <BarChart3 size={16} className="text-blue-500" /> },
    { label: 'Wins', value: profile.total_wins.toLocaleString(), icon: <Trophy size={16} className="text-yellow-500" /> },
    { label: 'Win Rate', value: profile.win_rate.toFixed(1) + '%', icon: <TrendingUp size={16} className="text-green-500" /> },
    { label: 'Avg Bid Total', value: profile.avg_bid_total ? fmtCompact.format(profile.avg_bid_total) : 'N/A', icon: <DollarSign size={16} className="text-emerald-500" /> },
    { label: 'Total Volume', value: fmtCompact.format(profile.total_bid_volume), icon: <DollarSign size={16} className="text-indigo-500" /> },
    { label: 'Active Years', value: String(profile.active_years), icon: <BarChart3 size={16} className="text-purple-500" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 mb-1">
              {s.icon}
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
            <div className="text-lg font-semibold text-gray-900">{s.value}</div>
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

function HistoryTab({ pk }: { pk: string }) {
  const [page, setPage] = useState(1);
  const [winsOnly, setWinsOnly] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['biddingHistory', pk, page, winsOnly],
    queryFn: () => getBiddingHistory(pk, { page, page_size: 25, wins_only: winsOnly || undefined }),
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
        <div className="flex items-center justify-center p-8 text-gray-400">Loading...</div>
      ) : !data || data.entries.length === 0 ? (
        <div className="p-4 text-sm text-gray-400">No bidding history found.</div>
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
                    <td className="px-3 py-2 font-medium text-gray-900">{e.contract_number}</td>
                    <td className="px-3 py-2 text-gray-600">{e.county}</td>
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

function GeoTab({ pk }: { pk: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['geoFootprint', pk],
    queryFn: () => getGeoFootprint(pk),
  });

  if (isLoading) return <div className="flex items-center justify-center p-8 text-gray-400">Loading...</div>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      <GeoTable title="By County" entries={data.by_county} />
      <GeoTable title="By District" entries={data.by_district} />
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
        <div className="p-4 text-sm text-gray-400">No data.</div>
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

function ActivityTab({ pk }: { pk: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['activityTrend', pk],
    queryFn: () => getActivityTrend(pk),
  });

  if (isLoading) return <div className="flex items-center justify-center p-8 text-gray-400">Loading...</div>;
  if (!data || data.trend.length === 0) return <div className="p-4 text-sm text-gray-400">No activity data.</div>;

  const maxBids = Math.max(...data.trend.map((t) => t.bid_count), 1);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-medium text-gray-700">Year-over-Year Activity</h3>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2">Year</th>
              <th className="px-3 py-2 text-right">Bids</th>
              <th className="px-3 py-2 text-right">Wins</th>
              <th className="px-3 py-2 text-right">Win %</th>
              <th className="px-3 py-2">Bid Volume</th>
              <th className="px-3 py-2 text-right">Total Volume</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.trend.map((t) => {
              const winRate = t.bid_count > 0 ? (t.win_count / t.bid_count) * 100 : 0;
              const bidBarWidth = (t.bid_count / maxBids) * 100;
              return (
                <tr key={t.year} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{t.year}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{t.bid_count}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{t.win_count}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{winRate.toFixed(1)}%</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${bidBarWidth}%` }}
                        />
                      </div>
                    </div>
                  </td>
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

function PricesTab({ pk }: { pk: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['priceTendencies', pk],
    queryFn: () => getPriceTendencies(pk),
  });

  if (isLoading) return <div className="flex items-center justify-center p-8 text-gray-400">Loading...</div>;
  if (!data || data.tendencies.length === 0) return <div className="p-4 text-sm text-gray-400">No price tendency data.</div>;

  return (
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
  );
}
