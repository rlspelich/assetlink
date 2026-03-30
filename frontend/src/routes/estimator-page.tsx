import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Calculator, Plus, Trash2, Copy, RefreshCw, Download, Users, GitCompareArrows, Table, TrendingUp, Calendar, FileSearch } from 'lucide-react';
import { PayItemSearch } from '../components/estimator/pay-item-search';
import { PriceHistoryPanel } from '../components/estimator/price-history-panel';
import { ConfidenceBadge } from '../components/estimator/confidence-badge';
import { ContractorSearch } from '../components/estimator/contractor-search';
import { HeadToHead } from '../components/estimator/head-to-head';
import { BidTabView } from '../components/estimator/bid-tab-view';
import { MarketAnalysis } from '../components/estimator/market-analysis';
import { LettingReport } from '../components/estimator/letting-report';
import { PayItemDetailSearch } from '../components/estimator/pay-item-detail-search';
import {
  listEstimates, createEstimate, getEstimate, deleteEstimate, updateEstimate,
  duplicateEstimate, recalculateEstimate, addEstimateItems,
  deleteEstimateItem, searchPayItems, updateEstimateItem,
  type PayItem, type Estimate, type EstimateItem,
} from '../api/estimator';

type Tab = 'pay-items' | 'estimates' | 'contractors' | 'head-to-head' | 'bid-tabs' | 'market-analysis' | 'letting-report' | 'pi-detail';

export function EstimatorPage() {
  const [activeTab, setActiveTab] = useState<Tab>('pay-items');

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
          label="PI Detail Search"
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'pay-items' && <PayItemsTab />}
        {activeTab === 'estimates' && <EstimatesTab />}
        {activeTab === 'contractors' && <ContractorSearch />}
        {activeTab === 'head-to-head' && <HeadToHead />}
        {activeTab === 'bid-tabs' && <BidTabView />}
        {activeTab === 'market-analysis' && <MarketAnalysis />}
        {activeTab === 'letting-report' && <LettingReport />}
        {activeTab === 'pi-detail' && <PayItemDetailSearch />}
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

export interface PricingOptions {
  adjustInflation: boolean;
  targetState: string;
}

const US_STATES = [
  { code: 'AL', name: 'Alabama', factor: 0.87 }, { code: 'AK', name: 'Alaska', factor: 1.28 },
  { code: 'AZ', name: 'Arizona', factor: 0.92 }, { code: 'AR', name: 'Arkansas', factor: 0.84 },
  { code: 'CA', name: 'California', factor: 1.25 }, { code: 'CO', name: 'Colorado', factor: 0.98 },
  { code: 'CT', name: 'Connecticut', factor: 1.15 }, { code: 'DE', name: 'Delaware', factor: 1.02 },
  { code: 'DC', name: 'District of Columbia', factor: 1.08 },
  { code: 'FL', name: 'Florida', factor: 0.89 }, { code: 'GA', name: 'Georgia', factor: 0.88 },
  { code: 'HI', name: 'Hawaii', factor: 1.32 }, { code: 'ID', name: 'Idaho', factor: 0.91 },
  { code: 'IL', name: 'Illinois', factor: 1.00 }, { code: 'IN', name: 'Indiana', factor: 0.95 },
  { code: 'IA', name: 'Iowa', factor: 0.93 }, { code: 'KS', name: 'Kansas', factor: 0.90 },
  { code: 'KY', name: 'Kentucky', factor: 0.89 }, { code: 'LA', name: 'Louisiana', factor: 0.86 },
  { code: 'ME', name: 'Maine', factor: 0.96 }, { code: 'MD', name: 'Maryland', factor: 1.01 },
  { code: 'MA', name: 'Massachusetts', factor: 1.18 }, { code: 'MI', name: 'Michigan', factor: 0.97 },
  { code: 'MN', name: 'Minnesota', factor: 1.03 }, { code: 'MS', name: 'Mississippi', factor: 0.82 },
  { code: 'MO', name: 'Missouri', factor: 0.94 }, { code: 'MT', name: 'Montana', factor: 0.92 },
  { code: 'NE', name: 'Nebraska', factor: 0.91 }, { code: 'NV', name: 'Nevada', factor: 1.02 },
  { code: 'NH', name: 'New Hampshire', factor: 1.00 }, { code: 'NJ', name: 'New Jersey', factor: 1.16 },
  { code: 'NM', name: 'New Mexico', factor: 0.89 }, { code: 'NY', name: 'New York', factor: 1.22 },
  { code: 'NC', name: 'North Carolina', factor: 0.86 }, { code: 'ND', name: 'North Dakota', factor: 0.91 },
  { code: 'OH', name: 'Ohio', factor: 0.96 }, { code: 'OK', name: 'Oklahoma', factor: 0.85 },
  { code: 'OR', name: 'Oregon', factor: 1.01 }, { code: 'PA', name: 'Pennsylvania', factor: 1.05 },
  { code: 'RI', name: 'Rhode Island', factor: 1.12 }, { code: 'SC', name: 'South Carolina', factor: 0.84 },
  { code: 'SD', name: 'South Dakota', factor: 0.88 }, { code: 'TN', name: 'Tennessee', factor: 0.87 },
  { code: 'TX', name: 'Texas', factor: 0.88 }, { code: 'UT', name: 'Utah', factor: 0.93 },
  { code: 'VT', name: 'Vermont', factor: 0.95 }, { code: 'VA', name: 'Virginia', factor: 0.94 },
  { code: 'WA', name: 'Washington', factor: 1.05 }, { code: 'WV', name: 'West Virginia', factor: 0.92 },
  { code: 'WI', name: 'Wisconsin', factor: 0.98 }, { code: 'WY', name: 'Wyoming', factor: 0.90 },
];

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
            className="px-2 py-1 border rounded text-xs"
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

// ============================================================
// Estimates Tab: list + detail
// ============================================================

function EstimatesTab() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: listData } = useQuery({
    queryKey: ['estimates'],
    queryFn: () => listEstimates(),
  });

  const createMut = useMutation({
    mutationFn: createEstimate,
    onSuccess: (est) => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      setSelectedId(est.estimate_id);
      setShowNewForm(false);
    },
  });

  if (selectedId) {
    return (
      <EstimateDetailView
        estimateId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Estimates</h2>
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            <Plus size={16} />
            New Estimate
          </button>
        </div>

        {/* New estimate form */}
        {showNewForm && (
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <NewEstimateForm
              onSubmit={(data) => createMut.mutate(data)}
              onCancel={() => setShowNewForm(false)}
              isLoading={createMut.isPending}
            />
          </div>
        )}

        {/* Estimate list */}
        {!listData?.estimates.length && !showNewForm ? (
          <div className="text-center py-16 text-gray-400">
            <Calculator size={48} className="mx-auto mb-3" />
            <p className="text-lg">No estimates yet</p>
            <p className="text-sm mt-1">Create your first estimate to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {listData?.estimates.map((est) => (
              <EstimateRow
                key={est.estimate_id}
                estimate={est}
                onClick={() => setSelectedId(est.estimate_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EstimateRow({ estimate, onClick }: { estimate: Estimate; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
    >
      <div>
        <div className="font-medium text-gray-900">{estimate.name}</div>
        <div className="text-xs text-gray-500 mt-1">
          {estimate.item_count} items |
          {' '}{US_STATES.find(s => s.code === estimate.target_state)?.name || estimate.target_state} |
          {' '}{estimate.status}
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold text-gray-900">
          ${Number(estimate.total_with_regional || estimate.total_adjusted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        {estimate.confidence_low != null && estimate.confidence_high != null && (
          <div className="text-xs text-gray-500">
            ${Number(estimate.confidence_low).toLocaleString(undefined, { maximumFractionDigits: 0 })} –
            ${Number(estimate.confidence_high).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        )}
      </div>
    </div>
  );
}

function NewEstimateForm({ onSubmit, onCancel, isLoading }: {
  onSubmit: (data: any) => void; onCancel: () => void; isLoading: boolean;
}) {
  const [name, setName] = useState('');
  const [targetState, setTargetState] = useState('IL');

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Estimate Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., I-55 Resurfacing Bid"
          className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
        <select
          value={targetState}
          onChange={(e) => setTargetState(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-md"
        >
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.factor.toFixed(2)})
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-100">
          Cancel
        </button>
        <button
          onClick={() => onSubmit({ name, target_state: targetState })}
          disabled={!name.trim() || isLoading}
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Creating...' : 'Create Estimate'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Estimate Detail View
// ============================================================

function EstimateDetailView({ estimateId, onBack }: { estimateId: string; onBack: () => void }) {
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const queryClient = useQueryClient();

  const { data: estimate, isLoading } = useQuery({
    queryKey: ['estimate', estimateId],
    queryFn: () => getEstimate(estimateId),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteEstimate(estimateId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['estimates'] }); onBack(); },
  });

  const dupMut = useMutation({
    mutationFn: () => duplicateEstimate(estimateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      onBack();
    },
  });

  const renameMut = useMutation({
    mutationFn: (name: string) => updateEstimate(estimateId, { name } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] });
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      setEditingName(false);
    },
  });

  const recalcMut = useMutation({
    mutationFn: () => recalculateEstimate(estimateId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] }),
  });

  const addItemsMut = useMutation({
    mutationFn: (items: { pay_item_code: string; quantity: number; description?: string; unit?: string }[]) =>
      addEstimateItems(estimateId, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] });
      setShowAddItem(false);
    },
  });

  const deleteItemMut = useMutation({
    mutationFn: (itemId: string) => deleteEstimateItem(estimateId, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] }),
  });

  if (isLoading || !estimate) {
    return <div className="p-8 text-center text-gray-400">Loading estimate...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={onBack} className="text-xs text-blue-600 hover:underline mb-1">
              &larr; Back to Estimates
            </button>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && nameValue.trim()) renameMut.mutate(nameValue.trim());
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  autoFocus
                  className="text-xl font-bold text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent py-0.5"
                />
                <button
                  onClick={() => { if (nameValue.trim()) renameMut.mutate(nameValue.trim()); }}
                  className="text-xs text-blue-600 hover:underline"
                >Save</button>
                <button
                  onClick={() => setEditingName(false)}
                  className="text-xs text-gray-400 hover:underline"
                >Cancel</button>
              </div>
            ) : (
              <h2
                className="text-xl font-bold text-gray-900 cursor-pointer hover:text-blue-700"
                onClick={() => { setNameValue(estimate.name); setEditingName(true); }}
                title="Click to rename"
              >
                {estimate.name}
              </h2>
            )}
            <div className="text-xs text-gray-500 mt-1">
              {US_STATES.find(s => s.code === estimate.target_state)?.name || estimate.target_state}
              ({US_STATES.find(s => s.code === estimate.target_state)?.factor.toFixed(2)}) |
              Inflation: {estimate.use_inflation_adjustment ? 'On' : 'Off'}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!estimate) return;
                const headers = ['Code', 'Description', 'Quantity', 'Unit', 'Unit Price', 'Extension', 'Confidence'];
                const rows = estimate.items.map((i) => [
                  i.pay_item_code,
                  `"${i.description}"`,
                  Number(i.quantity),
                  i.unit,
                  Number(i.unit_price).toFixed(4),
                  Number(i.extension).toFixed(2),
                  i.confidence_label || 'no data',
                ]);
                const totalsRow = ['', '', '', '', 'TOTAL', Number(estimate.total_with_regional || estimate.total_adjusted).toFixed(2), ''];
                const csv = [headers, ...rows, [], totalsRow].map((r) => r.join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${estimate.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-md hover:bg-gray-100"
              title="Download as CSV"
            >
              <Download size={14} />
              CSV
            </button>
            <button
              onClick={() => recalcMut.mutate()}
              disabled={recalcMut.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-md hover:bg-gray-100"
              title="Recalculate all prices"
            >
              <RefreshCw size={14} className={recalcMut.isPending ? 'animate-spin' : ''} />
              Recalculate
            </button>
            <button
              onClick={() => dupMut.mutate()}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-md hover:bg-gray-100"
            >
              <Copy size={14} />
              Duplicate
            </button>
            <button
              onClick={() => { if (confirm('Delete this estimate?')) deleteMut.mutate(); }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-md hover:bg-red-50"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Totals bar */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <TotalCard label="Total (Nominal)" value={estimate.total_nominal} />
          <TotalCard label="Total (Adjusted)" value={estimate.total_adjusted} />
          <TotalCard label="Total (w/ Regional)" value={estimate.total_with_regional} primary />
          <div className="bg-white rounded-lg p-3 border">
            <div className="text-[10px] font-medium text-gray-500 uppercase">Confidence Range</div>
            {estimate.confidence_low != null ? (
              <div className="text-sm font-bold text-gray-700 mt-0.5">
                ${Number(estimate.confidence_low).toLocaleString(undefined, { maximumFractionDigits: 0 })} –
                ${Number(estimate.confidence_high).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            ) : (
              <div className="text-sm text-gray-400 mt-0.5">—</div>
            )}
            <div className="text-[10px] text-gray-400">{estimate.item_count} items</div>
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">Line Items</span>
            <button
              onClick={() => setShowAddItem(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus size={14} />
              Add Item
            </button>
          </div>

          {showAddItem && (
            <AddItemForm
              onAdd={(items) => addItemsMut.mutate(items)}
              onCancel={() => setShowAddItem(false)}
              isLoading={addItemsMut.isPending}
            />
          )}

          {estimate.items.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No items yet. Add pay items to build your estimate.
            </div>
          ) : (
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">Code</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Quantity</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Unit</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Unit Price</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Extension</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600">Confidence</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {estimate.items.map((item) => (
                  <EditableItemRow
                    key={item.estimate_item_id}
                    item={item}
                    estimateId={estimateId}
                    onDelete={() => deleteItemMut.mutate(item.estimate_item_id)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function EditableItemRow({ item, estimateId, onDelete }: {
  item: EstimateItem; estimateId: string; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editPrice, setEditPrice] = useState('');
  const queryClient = useQueryClient();

  const updateMut = useMutation({
    mutationFn: (price: number) => updateEstimateItem(estimateId, item.estimate_item_id, {
      unit_price: price,
      unit_price_source: 'manual',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] });
      setEditing(false);
    },
  });

  const startEdit = () => {
    setEditPrice(Number(item.unit_price) > 0 ? String(Number(item.unit_price)) : '');
    setEditing(true);
  };

  const submitEdit = () => {
    const price = parseFloat(editPrice);
    if (!isNaN(price) && price >= 0) {
      updateMut.mutate(price);
    }
  };

  const noData = Number(item.unit_price) === 0 && item.unit_price_source !== 'manual';

  return (
    <tr className={`border-b hover:bg-gray-50 ${noData ? 'bg-yellow-50' : ''}`}>
      <td className="px-3 py-2 font-mono text-gray-400 text-[11px]">{item.pay_item_code}</td>
      <td className="px-3 py-2 truncate max-w-[250px]">{item.description}</td>
      <td className="px-3 py-2 text-right font-mono">{Number(item.quantity).toLocaleString()}</td>
      <td className="px-3 py-2 text-gray-500">{item.unit}</td>
      <td className="px-3 py-2 text-right font-mono">
        {editing ? (
          <div className="flex items-center gap-1 justify-end">
            <span className="text-gray-400">$</span>
            <input
              type="number"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus
              className="w-24 px-2 py-0.5 text-xs text-right border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              step="0.01"
            />
            <button onClick={submitEdit} className="text-[10px] text-blue-600 hover:underline">Save</button>
          </div>
        ) : (
          <button
            onClick={startEdit}
            className={`hover:underline cursor-pointer ${noData ? 'text-red-600 font-medium' : ''}`}
            title="Click to edit price"
          >
            {noData ? (
              'Enter price'
            ) : (
              <>
                ${Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                {item.unit_price_source === 'manual' && (
                  <span className="ml-1 text-[9px] text-orange-500">manual</span>
                )}
              </>
            )}
          </button>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono font-semibold">
        ${Number(item.extension).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="px-3 py-2 text-center">
        <ConfidenceBadge percentile={item.confidence_pct} label={item.confidence_label} />
      </td>
      <td className="px-2 py-2">
        <button
          onClick={onDelete}
          className="text-gray-400 hover:text-red-500"
          title="Remove item"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}

function TotalCard({ label, value, primary }: { label: string; value: number; primary?: boolean }) {
  return (
    <div className={`rounded-lg p-3 border ${primary ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
      <div className="text-[10px] font-medium text-gray-500 uppercase">{label}</div>
      <div className={`text-base font-bold mt-0.5 ${primary ? 'text-blue-700' : 'text-gray-700'}`}>
        ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}

function AddItemForm({ onAdd, onCancel, isLoading }: {
  onAdd: (items: { pay_item_code: string; quantity: number; description?: string; unit?: string }[]) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [mode, setMode] = useState<'search' | 'custom'>('search');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<PayItem | null>(null);
  const [quantity, setQuantity] = useState('');
  // Custom item fields
  const [customDesc, setCustomDesc] = useState('');
  const [customUnit, setCustomUnit] = useState('');

  const handleSearch = (value: string) => {
    setSearch(value);
    setSelectedItem(null);
    clearTimeout((window as any).__addItemTimer);
    (window as any).__addItemTimer = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const { data } = useQuery({
    queryKey: ['payItemsAddForm', debouncedSearch],
    queryFn: () => searchPayItems({ search: debouncedSearch, page_size: 10 }),
    enabled: debouncedSearch.length >= 2 && !selectedItem && mode === 'search',
  });

  const handleAdd = () => {
    if (mode === 'search' && selectedItem && quantity) {
      onAdd([{
        pay_item_code: selectedItem.code,
        quantity: Number(quantity),
        description: selectedItem.description,
        unit: selectedItem.unit,
      }]);
      setSelectedItem(null);
      setSearch('');
      setQuantity('');
    } else if (mode === 'custom' && customDesc && quantity) {
      onAdd([{
        pay_item_code: `CUSTOM_${Date.now()}`,
        quantity: Number(quantity),
        description: customDesc,
        unit: customUnit || 'EACH',
      }]);
      setCustomDesc('');
      setCustomUnit('');
      setQuantity('');
    }
  };

  const canAdd = mode === 'search'
    ? !!selectedItem && !!quantity
    : !!customDesc && !!quantity;

  return (
    <div className="mb-4 p-3 border rounded-lg bg-blue-50">
      {/* Mode toggle */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setMode('search')}
          className={`px-3 py-1 text-xs rounded-full border ${mode === 'search' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          Search Database
        </button>
        <button
          onClick={() => setMode('custom')}
          className={`px-3 py-1 text-xs rounded-full border ${mode === 'custom' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          Custom Item
        </button>
      </div>

      {mode === 'search' ? (
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <label className="block text-[10px] font-medium text-gray-600 mb-1">Search Pay Item</label>
            <input
              type="text"
              value={selectedItem ? selectedItem.description : search}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => { if (selectedItem) { setSearch(selectedItem.description); setSelectedItem(null); } }}
              placeholder="Type to search by description..."
              className="w-full px-3 py-1.5 text-sm border rounded-md"
            />
            {data && !selectedItem && debouncedSearch.length >= 2 && (
              <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
                {data.pay_items.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-400">No items found</div>
                ) : (
                  data.pay_items.map((item) => (
                    <div
                      key={`${item.agency}-${item.code}`}
                      onClick={() => { setSelectedItem(item); setSearch(''); setDebouncedSearch(''); }}
                      className="px-3 py-2 text-xs cursor-pointer hover:bg-blue-50 border-b last:border-b-0"
                    >
                      <span className="font-mono text-gray-400 mr-2">{item.code}</span>
                      <span className="font-medium">{item.description}</span>
                      <span className="text-gray-400 ml-2">{item.unit}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="w-40">
            <label className="block text-[10px] font-medium text-gray-600 mb-1">
              Quantity{selectedItem ? ` (${selectedItem.unit})` : ''}
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={selectedItem ? `0 ${selectedItem.unit}` : '0'}
              className="w-full px-3 py-1.5 text-sm border rounded-md"
            />
          </div>
          <button onClick={handleAdd} disabled={!canAdd || isLoading}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {isLoading ? 'Adding...' : 'Add'}
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-100">Cancel</button>
        </div>
      ) : (
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-gray-600 mb-1">Description</label>
            <input
              type="text"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              placeholder="e.g., Subcontractor — Traffic Control"
              className="w-full px-3 py-1.5 text-sm border rounded-md"
            />
          </div>
          <div className="w-24">
            <label className="block text-[10px] font-medium text-gray-600 mb-1">Unit</label>
            <select
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border rounded-md"
            >
              <option value="EACH">EACH</option>
              <option value="L SUM">L SUM</option>
              <option value="TON">TON</option>
              <option value="CU YD">CU YD</option>
              <option value="SQ YD">SQ YD</option>
              <option value="FOOT">FOOT</option>
              <option value="LB">LB</option>
              <option value="GAL">GAL</option>
              <option value="HOUR">HOUR</option>
              <option value="DAY">DAY</option>
              <option value="MILE">MILE</option>
              <option value="ACRE">ACRE</option>
            </select>
          </div>
          <div className="w-32">
            <label className="block text-[10px] font-medium text-gray-600 mb-1">Quantity</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-1.5 text-sm border rounded-md"
            />
          </div>
          <button onClick={handleAdd} disabled={!canAdd || isLoading}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {isLoading ? 'Adding...' : 'Add'}
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-100">Cancel</button>
        </div>
      )}
    </div>
  );
}
