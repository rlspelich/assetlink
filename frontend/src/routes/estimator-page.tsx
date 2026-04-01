import { useState } from 'react';
import { Search, Calculator, Users, GitCompareArrows, Table, TrendingUp, Calendar, FileSearch } from 'lucide-react';
import { PayItemSearch } from '../components/estimator/pay-item-search';
import { PriceHistoryPanel } from '../components/estimator/price-history-panel';
import { ContractorSearch } from '../components/estimator/contractor-search';
import { HeadToHead } from '../components/estimator/head-to-head';
import { BidTabView } from '../components/estimator/bid-tab-view';
import { MarketAnalysis } from '../components/estimator/market-analysis';
import { LettingReport } from '../components/estimator/letting-report';
import { PayItemDetailSearch } from '../components/estimator/pay-item-detail-search';
import { EstimatesTab } from '../components/estimator/estimates/estimates-tab';
import { US_STATES } from '../components/estimator/estimator-constants';
import type { Tab, EstimatorNavParams, PricingOptions } from '../components/estimator/estimator-constants';
import type { PayItem } from '../api/estimator';

// Re-export types so existing imports from this file continue to work
export type { EstimatorNavParams, PricingOptions } from '../components/estimator/estimator-constants';

export function EstimatorPage() {
  const [activeTab, setActiveTab] = useState<Tab>('pay-items');
  const [navParams, setNavParams] = useState<EstimatorNavParams>({});

  // Navigate to a tab with optional drill-down params
  const navigateTo = (tab: string, params: EstimatorNavParams = {}) => {
    setNavParams({ ...params, sourceTab: params.sourceTab ?? activeTab });
    setActiveTab(tab as Tab);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center border-b bg-gray-50 px-4">
        <TabButton
          active={activeTab === 'pay-items'}
          onClick={() => setActiveTab('pay-items')}
          icon={<Search size={15} />}
          label="Pay Item Search"
        />
        <TabButton
          active={activeTab === 'estimates'}
          onClick={() => setActiveTab('estimates')}
          icon={<Calculator size={15} />}
          label="Estimate Builder"
        />
        <TabButton
          active={activeTab === 'contractors'}
          onClick={() => setActiveTab('contractors')}
          icon={<Users size={15} />}
          label="Contractors"
        />
        <TabButton
          active={activeTab === 'head-to-head'}
          onClick={() => setActiveTab('head-to-head')}
          icon={<GitCompareArrows size={15} />}
          label="Head-to-Head"
        />
        <TabButton
          active={activeTab === 'bid-tabs'}
          onClick={() => setActiveTab('bid-tabs')}
          icon={<Table size={15} />}
          label="Bid Tabs"
        />
        <TabButton
          active={activeTab === 'market-analysis'}
          onClick={() => setActiveTab('market-analysis')}
          icon={<TrendingUp size={15} />}
          label="Market Analysis"
        />
        <TabButton
          active={activeTab === 'letting-report'}
          onClick={() => setActiveTab('letting-report')}
          icon={<Calendar size={15} />}
          label="Letting Report"
        />
        <TabButton
          active={activeTab === 'pi-detail'}
          onClick={() => setActiveTab('pi-detail')}
          icon={<FileSearch size={15} />}
          label="Bid Price Search"
        />
      </div>

      {/* Tab content — heavy tabs use hidden/visible to preserve state across switches */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'pay-items' && <PayItemsTab />}
        {activeTab === 'estimates' && <EstimatesTab />}
        <div className={`absolute inset-0 ${activeTab === 'contractors' ? '' : 'invisible pointer-events-none'}`}>
          <ContractorSearch navigateTo={navigateTo} navParams={activeTab === 'contractors' ? navParams : {}} />
        </div>
        <div className={`absolute inset-0 ${activeTab === 'head-to-head' ? '' : 'invisible pointer-events-none'}`}>
          <HeadToHead navigateTo={navigateTo} />
        </div>
        <div className={`absolute inset-0 ${activeTab === 'bid-tabs' ? '' : 'invisible pointer-events-none'}`}>
          <BidTabView navParams={activeTab === 'bid-tabs' ? navParams : {}} navigateTo={navigateTo} />
        </div>
        {activeTab === 'market-analysis' && <MarketAnalysis navigateTo={navigateTo} />}
        {activeTab === 'letting-report' && <LettingReport navigateTo={navigateTo} />}
        {activeTab === 'pi-detail' && <PayItemDetailSearch navigateTo={navigateTo} navParams={activeTab === 'pi-detail' ? navParams : {}} />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-500 text-blue-700'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ============================================================
// Pay Items Tab: search + price history side by side
// ============================================================

function PayItemsTab() {
  const [selectedItem, setSelectedItem] = useState<PayItem | null>(null);
  const [options, setOptions] = useState<PricingOptions>({
    adjustInflation: true,
    targetState: 'IL',
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Options bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b bg-gray-50 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={options.adjustInflation}
            onChange={(e) => setOptions({ ...options, adjustInflation: e.target.checked })}
            className="rounded"
          />
          <span className="text-gray-600">Adjust for Inflation</span>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-gray-500">State:</span>
          <select
            value={options.targetState}
            onChange={(e) => setOptions({ ...options, targetState: e.target.value })}
            className="h-9 px-2 border rounded text-sm"
          >
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name} ({s.factor.toFixed(2)})
              </option>
            ))}
          </select>
        </label>
      </div>
      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[420px] border-r flex-shrink-0 overflow-hidden">
          <PayItemSearch
            onSelect={setSelectedItem}
            selectedCode={selectedItem?.code}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          <PriceHistoryPanel payItem={selectedItem} options={options} />
        </div>
      </div>
    </div>
  );
}
