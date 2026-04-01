import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Copy, RefreshCw, Download, Upload, FileText, ChevronDown } from 'lucide-react';
import { ConfidenceBadge } from '../confidence-badge';
import { US_STATES, CONTINGENCY_PHASES } from '../estimator-constants';
import { EditableItemRow } from './editable-item-row';
import { AddItemForm } from './add-item-form';
import { BulkImportModal } from './bulk-import-modal';
import {
  getEstimate, deleteEstimate, updateEstimate,
  duplicateEstimate, recalculateEstimate, addEstimateItems,
  deleteEstimateItem, downloadEngineersReport,
} from '../../../api/estimator';

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

export function EstimateDetailView({ estimateId, onBack }: { estimateId: string; onBack: () => void }) {
  const [showAddItem, setShowAddItem] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showReportDropdown, setShowReportDropdown] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [contingencyPhase, setContingencyPhase] = useState<string>('Final Design (10%)');
  const [customContingencyPct, setCustomContingencyPct] = useState(10);
  const [itemsPage, setItemsPage] = useState(1);
  const ITEMS_PER_PAGE = 50;
  const queryClient = useQueryClient();

  const contingencyPct = contingencyPhase === 'Custom'
    ? customContingencyPct
    : CONTINGENCY_PHASES.find(p => p.label === contingencyPhase)?.value ?? 10;

  const { data: estimate, isLoading } = useQuery({
    queryKey: ['estimate', estimateId],
    queryFn: () => getEstimate(estimateId),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteEstimate(estimateId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['estimates'] }); onBack(); },
    onError: (error: Error) => {
      console.error('Failed to delete estimate:', error.message);
    },
  });

  const dupMut = useMutation({
    mutationFn: () => duplicateEstimate(estimateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      onBack();
    },
    onError: (error: Error) => {
      console.error('Failed to duplicate estimate:', error.message);
    },
  });

  const renameMut = useMutation({
    mutationFn: (name: string) => updateEstimate(estimateId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] });
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      setEditingName(false);
    },
    onError: (error: Error) => {
      console.error('Failed to rename estimate:', error.message);
    },
  });

  const recalcMut = useMutation({
    mutationFn: () => recalculateEstimate(estimateId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] }),
    onError: (error: Error) => {
      console.error('Failed to recalculate estimate:', error.message);
    },
  });

  const addItemsMut = useMutation({
    mutationFn: (items: { pay_item_code: string; quantity: number; description?: string; unit?: string }[]) =>
      addEstimateItems(estimateId, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] });
      setShowAddItem(false);
    },
    onError: (error: Error) => {
      console.error('Failed to add estimate items:', error.message);
    },
  });

  const deleteItemMut = useMutation({
    mutationFn: (itemId: string) => deleteEstimateItem(estimateId, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] }),
    onError: (error: Error) => {
      console.error('Failed to delete estimate item:', error.message);
    },
  });

  if (isLoading || !estimate) {
    return <div className="p-8 text-center text-gray-400">Loading estimate...</div>;
  }

  const subtotal = Number(estimate.total_with_regional || estimate.total_adjusted);
  const contingencyAmount = subtotal * (contingencyPct / 100);
  const grandTotal = subtotal + contingencyAmount;

  const totalItems = estimate.items.length;
  const totalItemPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const safePage = Math.min(itemsPage, totalItemPages);
  const pagedItems = estimate.items.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

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
            {/* Engineer's Report dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowReportDropdown(!showReportDropdown)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-md hover:bg-gray-100"
                title="Engineer's Estimate Report"
              >
                <FileText size={14} />
                Engineer&apos;s Report
                <ChevronDown size={12} />
              </button>
              {showReportDropdown && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-white shadow-lg rounded-md border min-w-[180px]">
                  <button
                    onClick={() => {
                      downloadEngineersReport(estimateId, 'txt', contingencyPct);
                      setShowReportDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"
                  >
                    <FileText size={14} className="text-gray-400" />
                    TXT Report
                  </button>
                  <button
                    onClick={() => {
                      downloadEngineersReport(estimateId, 'csv', contingencyPct);
                      setShowReportDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 border-t"
                  >
                    <Download size={14} className="text-gray-400" />
                    CSV Report
                  </button>
                </div>
              )}
            </div>
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
              aria-label="Delete estimate"
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
            <div className="flex gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Upload size={14} />
                Import Items
              </button>
              <button
                onClick={() => setShowAddItem(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus size={14} />
                Add Item
              </button>
            </div>
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
                {pagedItems.map((item) => (
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

          {/* Pagination */}
          {totalItemPages > 1 && (
            <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
              <span>
                Showing {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, totalItems)} of {totalItems} items
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setItemsPage(1)}
                  disabled={safePage === 1}
                  className="px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  First
                </button>
                <button
                  onClick={() => setItemsPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="px-2 py-1">
                  Page {safePage} of {totalItemPages}
                </span>
                <button
                  onClick={() => setItemsPage((p) => Math.min(totalItemPages, p + 1))}
                  disabled={safePage === totalItemPages}
                  className="px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <button
                  onClick={() => setItemsPage(totalItemPages)}
                  disabled={safePage === totalItemPages}
                  className="px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Last
                </button>
              </div>
            </div>
          )}

          {/* Contingency calculator */}
          {estimate.items.length > 0 && (
            <div className="mt-4 bg-gray-50 border-t rounded-b-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-semibold text-gray-600 uppercase">Contingency</span>
                  <select
                    value={contingencyPhase}
                    onChange={(e) => setContingencyPhase(e.target.value)}
                    className="px-2 py-2 text-xs border rounded-md bg-white"
                  >
                    {CONTINGENCY_PHASES.map((p) => (
                      <option key={p.label} value={p.label}>{p.label}</option>
                    ))}
                  </select>
                  {contingencyPhase === 'Custom' && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={customContingencyPct}
                        onChange={(e) => setCustomContingencyPct(Number(e.target.value))}
                        min={0}
                        max={100}
                        step={1}
                        className="w-16 px-2 py-2 text-xs border rounded-md text-right"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  )}
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center justify-end gap-8 text-xs text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-mono font-medium w-28 text-right">
                      ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-8 text-xs text-gray-600">
                    <span>Contingency ({contingencyPct}%)</span>
                    <span className="font-mono font-medium w-28 text-right">
                      ${contingencyAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-8 text-sm font-bold text-gray-900 border-t pt-1">
                    <span>Grand Total</span>
                    <span className="font-mono w-28 text-right">
                      ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bulk import modal */}
      {showImportModal && (
        <BulkImportModal
          estimateId={estimateId}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] });
            setShowImportModal(false);
          }}
        />
      )}
    </div>
  );
}
