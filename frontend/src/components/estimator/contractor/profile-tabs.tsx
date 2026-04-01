import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, TrendingUp, MapPin, DollarSign, BarChart3, GitCompareArrows, Download } from 'lucide-react';
import {
  getContractorProfile,
  type ContractorProfile,
} from '../../../api/estimator';
import { downloadTXT, exportCurrency, exportPct } from '../../../utils/export';
import { LoadingSpinner, ErrorState } from '../../ui/states';
import type { EstimatorNavParams } from '../../../routes/estimator-page';
import { HistoryTab } from './history-tab';
import { GeoTab } from './geo-tab';
import { ActivityTab } from './activity-tab';
import { PricesTab } from './prices-tab';
import { VsMarketTab } from './vs-market-tab';

export type ProfileTab = 'overview' | 'history' | 'geo' | 'activity' | 'prices' | 'vs-market';

export const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const fmtCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

export function ContractorProfilePanel({ pk, activeTab, onTabChange, navigateTo }: {
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
