import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Wrench, Loader2, Search } from 'lucide-react';
import {
  useWorkOrdersList,
  useCreateWorkOrder,
  useUpdateWorkOrder,
  useDeleteWorkOrder,
} from '../hooks/use-work-orders';
import { WorkOrderDetailPanel } from '../components/work-orders/work-order-detail-panel';
import { WorkOrderForm } from '../components/work-orders/work-order-form';
import type { WorkOrder, WorkOrderCreate, WorkOrderUpdate } from '../api/types';
import type { AssetContext } from '../components/work-orders/work-order-form';
import {
  WO_STATUS_OPTIONS,
  WO_PRIORITY_OPTIONS,
  WO_WORK_TYPE_OPTIONS,
  getWoStatusOption,
  getWoPriorityOption,
  formatEnumLabel,
} from '../lib/constants';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function WorkOrdersPage() {
  const location = useLocation();
  const routeState = location.state as {
    selectedWorkOrderId?: string;
    signContext?: { sign_id: string; description?: string; road_name?: string };
    assetContext?: AssetContext;
  } | null;

  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [workTypeFilter, setWorkTypeFilter] = useState('');
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [assetContext, setAssetContext] = useState<AssetContext | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const handledRouteState = useRef(false);

  const { data, isLoading } = useWorkOrdersList({
    page,
    page_size: 50,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    work_type: workTypeFilter || undefined,
  });

  const createWO = useCreateWorkOrder();
  const updateWO = useUpdateWorkOrder();
  const deleteWO = useDeleteWorkOrder();

  // Handle route state (navigate from sign/support detail or direct link) — once only
  useEffect(() => {
    if (handledRouteState.current) return;
    if (routeState?.assetContext) {
      handledRouteState.current = true;
      setAssetContext(routeState.assetContext);
      setFormMode('create');
      setShowForm(true);
      window.history.replaceState({}, document.title);
    } else if (routeState?.signContext) {
      handledRouteState.current = true;
      // Legacy support: convert old signContext to new assetContext format
      setAssetContext({
        assets: [{
          asset_type: 'sign',
          asset_id: routeState.signContext.sign_id,
          label: routeState.signContext.description || routeState.signContext.sign_id,
        }],
      });
      setFormMode('create');
      setShowForm(true);
      window.history.replaceState({}, document.title);
    }
    if (routeState?.selectedWorkOrderId && data?.work_orders) {
      const wo = data.work_orders.find(
        (w) => w.work_order_id === routeState.selectedWorkOrderId,
      );
      if (wo) {
        setSelectedWO(wo);
        window.history.replaceState({}, document.title);
      }
    }
  }, [routeState, data?.work_orders]);

  const handleCreate = () => {
    setAssetContext(null);
    setFormMode('create');
    setSubmitError(null);
    setShowForm(true);
  };

  const handleEdit = () => {
    if (!selectedWO) return;
    setFormMode('edit');
    setSubmitError(null);
    setShowForm(true);
  };

  const handleFormSubmit = async (formData: WorkOrderCreate | WorkOrderUpdate) => {
    setSubmitError(null);
    try {
      if (formMode === 'create') {
        const created = await createWO.mutateAsync(formData as WorkOrderCreate);
        setShowForm(false);
        setAssetContext(null);
        setSelectedWO(created);
      } else if (selectedWO) {
        const updated = await updateWO.mutateAsync({
          id: selectedWO.work_order_id,
          data: formData as WorkOrderUpdate,
        });
        setShowForm(false);
        setSelectedWO(updated);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save work order';
      setSubmitError(message);
    }
  };

  const handleDelete = async () => {
    if (!selectedWO) return;
    try {
      await deleteWO.mutateAsync(selectedWO.work_order_id);
      setSelectedWO(null);
    } catch (err: unknown) {
      console.error('Delete failed:', err);
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1;

  return (
    <div className="h-full flex overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Wrench size={20} className="text-gray-600" />
              <h1 className="text-lg font-semibold text-gray-900">Work Orders</h1>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {data?.total ?? 0}
              </span>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} />
              Create Work Order
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              {WO_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
              className="rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Priorities</option>
              {WO_PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={workTypeFilter}
              onChange={(e) => { setWorkTypeFilter(e.target.value); setPage(1); }}
              className="rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Types</option>
              {WO_WORK_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : !data?.work_orders.length ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Search size={32} className="mb-2" />
              <p className="text-sm">No work orders found</p>
              <button
                onClick={handleCreate}
                className="mt-3 text-xs text-blue-600 hover:text-blue-800"
              >
                Create your first work order
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-2 font-medium">WO #</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Priority</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Due Date</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.work_orders.map((wo) => {
                  const statusOpt = getWoStatusOption(wo.status);
                  const priorityOpt = getWoPriorityOption(wo.priority);
                  const isSelected = selectedWO?.work_order_id === wo.work_order_id;
                  return (
                    <tr
                      key={wo.work_order_id}
                      onClick={() => setSelectedWO(isSelected ? null : wo)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-l-2 border-blue-500'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-700 whitespace-nowrap">
                        {wo.work_order_number || '\u2014'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-900 truncate max-w-xs">
                        {wo.description || '\u2014'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                        {formatEnumLabel(wo.work_type)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${priorityOpt.color}`}>
                          {priorityOpt.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusOpt.color}`}>
                          {statusOpt.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs whitespace-nowrap">
                        {formatDate(wo.due_date)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(wo.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="px-4 py-2 border-t bg-white flex items-center justify-between text-xs text-gray-500">
            <span>
              Page {data.page} of {totalPages} ({data.total} total)
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Detail panel */}
      {selectedWO && !showForm && (
        <WorkOrderDetailPanel
          workOrder={selectedWO}
          onClose={() => setSelectedWO(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isDeleting={deleteWO.isPending}
        />
      )}

      {/* Form modal */}
      {showForm && (
        <WorkOrderForm
          mode={formMode}
          workOrder={formMode === 'edit' ? selectedWO : null}
          assetContext={assetContext}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setAssetContext(null); setSubmitError(null); }}
          isSubmitting={createWO.isPending || updateWO.isPending}
          error={submitError}
        />
      )}
    </div>
  );
}
