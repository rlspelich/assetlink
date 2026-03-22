import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  useWorkOrdersList,
  useCreateWorkOrder,
  useUpdateWorkOrder,
  useDeleteWorkOrder,
} from '../hooks/use-work-orders';
import { useSignsList } from '../hooks/use-signs';
import { WorkOrderDetailPanel } from '../components/work-orders/work-order-detail-panel';
import { WorkOrderForm } from '../components/work-orders/work-order-form';
import { WorkOrderListPanel } from '../components/work-orders/work-order-list-panel';
import { WorkOrderMap } from '../components/map/work-order-map';
import type { WorkOrder, WorkOrderCreate, WorkOrderUpdate } from '../api/types';
import type { AssetContext } from '../components/work-orders/work-order-form';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [assetContext, setAssetContext] = useState<AssetContext | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const handledRouteState = useRef(false);

  // Fetch signs for the base layer
  const { data: signsData } = useSignsList({ page_size: 200 });
  const signs = signsData?.signs ?? [];

  const { data, isLoading } = useWorkOrdersList({
    page_size: 200,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    work_type: workTypeFilter || undefined,
  });

  const createWO = useCreateWorkOrder();
  const updateWO = useUpdateWorkOrder();
  const deleteWO = useDeleteWorkOrder();

  // Client-side search filtering
  const filteredWOs = useMemo(() => {
    if (!data?.work_orders) return [];
    if (!searchQuery.trim()) return data.work_orders;
    const q = searchQuery.toLowerCase();
    return data.work_orders.filter((wo) =>
      (wo.work_order_number && wo.work_order_number.toLowerCase().includes(q)) ||
      (wo.description && wo.description.toLowerCase().includes(q)) ||
      (wo.address && wo.address.toLowerCase().includes(q))
    );
  }, [data?.work_orders, searchQuery]);

  // Compute highlighted sign IDs from selected WO's linked assets
  const highlightedSignIds = useMemo(() => {
    if (!selectedWO?.assets) return [];
    return selectedWO.assets
      .filter((a) => a.asset_type === 'sign')
      .map((a) => a.asset_id);
  }, [selectedWO]);

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

  const handleWOSelect = useCallback((wo: WorkOrder) => {
    if (selectedWO?.work_order_id === wo.work_order_id) {
      setSelectedWO(null);
    } else {
      setSelectedWO(wo);
    }
  }, [selectedWO]);

  const handleMapDeselect = useCallback(() => {
    setSelectedWO(null);
  }, []);

  const geoWOCount = useMemo(
    () => filteredWOs.filter((wo) => wo.longitude != null && wo.latitude != null).length,
    [filteredWOs],
  );

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: Work order list */}
      <WorkOrderListPanel
        workOrders={filteredWOs}
        total={data?.total ?? 0}
        isLoading={isLoading}
        selectedWOId={selectedWO?.work_order_id ?? null}
        onWOSelect={handleWOSelect}
        statusFilter={statusFilter}
        onStatusFilterChange={(s) => { setStatusFilter(s); setSelectedWO(null); }}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={(p) => { setPriorityFilter(p); setSelectedWO(null); }}
        workTypeFilter={workTypeFilter}
        onWorkTypeFilterChange={(t) => { setWorkTypeFilter(t); setSelectedWO(null); }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Center: Map */}
      <div className="flex-1 relative">
        <WorkOrderMap
          signs={signs}
          workOrders={filteredWOs}
          selectedWOId={selectedWO?.work_order_id ?? null}
          onWOClick={handleWOSelect}
          onDeselect={handleMapDeselect}
          highlightedSignIds={highlightedSignIds}
        />

        {/* Status bar with Create button */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="bg-white/90 backdrop-blur rounded-lg shadow px-3 py-1.5 text-xs text-gray-600">
            {filteredWOs.length === (data?.total ?? 0) ? (
              <span>{data?.total ?? 0} work orders{geoWOCount < filteredWOs.length ? ` (${geoWOCount} mapped)` : ''}</span>
            ) : (
              <span>{filteredWOs.length} of {data?.total ?? 0} work orders</span>
            )}
          </div>

          <button
            onClick={handleCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Plus size={14} />
            Create Work Order
          </button>
        </div>
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
