import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Search, Filter, ChevronDown, X } from 'lucide-react';
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
import { WorkOrderTable } from '../components/work-orders/work-order-table';
import { ViewModeToggle, type ViewMode } from '../components/shared/view-mode-toggle';
import type { Sign, WorkOrder, WorkOrderCreate, WorkOrderUpdate } from '../api/types';
import type { AssetContext } from '../components/work-orders/work-order-form';
import {
  WO_STATUS_OPTIONS,
  WO_PRIORITY_OPTIONS,
  WO_WORK_TYPE_OPTIONS,
} from '../lib/constants';

export function WorkOrdersPage() {
  const location = useLocation();
  const routeState = location.state as {
    selectedWorkOrderId?: string;
    signContext?: { sign_id: string; description?: string; road_name?: string };
    assetContext?: AssetContext;
    filterAssignedTo?: string;
    filterStatus?: string;
    filterPriority?: string;
  } | null;

  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [statusFilter, setStatusFilter] = useState(routeState?.filterStatus || '');
  const [priorityFilter, setPriorityFilter] = useState(routeState?.filterPriority || '');
  const [workTypeFilter, setWorkTypeFilter] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState(routeState?.filterAssignedTo || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [assetContext, setAssetContext] = useState<AssetContext | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const handledRouteState = useRef(false);

  // Asset selection mode for creating WOs from the map
  type CreationMode = 'idle' | 'choosing' | 'select-sign' | 'drop-pin' | 'form';
  const [creationMode, setCreationMode] = useState<CreationMode>('idle');
  const [selectionCoords, setSelectionCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [formCoordinates, setFormCoordinates] = useState<{ lng: number; lat: number } | null>(null);

  // Fetch signs for the base layer
  const { data: signsData } = useSignsList({ page_size: 1000 });
  const signs = signsData?.signs ?? [];

  const { data, isLoading } = useWorkOrdersList({
    page_size: 1000,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    work_type: workTypeFilter || undefined,
    assigned_to: assignedToFilter || undefined,
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
    // In table mode (no map visible), skip selection and go straight to form
    if (viewMode === 'table') {
      setAssetContext(null);
      setFormCoordinates(null);
      setFormMode('create');
      setSubmitError(null);
      setShowForm(true);
      return;
    }
    // In map or split mode, show the choosing panel
    setSelectedWO(null);
    setSelectionCoords(null);
    setCreationMode('choosing');
  };

  const handleSelectionCancel = () => {
    setCreationMode('idle');
    setSelectionCoords(null);
  };

  const handleSelectionSkip = () => {
    setCreationMode('idle');
    setSelectionCoords(null);
    setAssetContext(null);
    setFormCoordinates(null);
    setFormMode('create');
    setSubmitError(null);
    setShowForm(true);
  };

  const handleSignSelect = useCallback((sign: Sign) => {
    setCreationMode('idle');
    setSelectionCoords(null);
    setAssetContext({
      assets: [{
        asset_type: 'sign',
        asset_id: sign.sign_id,
        label: `${sign.mutcd_code || 'Sign'} — ${sign.description || sign.road_name || sign.sign_id}`,
      }],
    });
    setFormCoordinates({ lng: sign.longitude, lat: sign.latitude });
    setFormMode('create');
    setSubmitError(null);
    setShowForm(true);
  }, []);

  const handleLocationSelect = useCallback((lng: number, lat: number) => {
    setCreationMode('idle');
    setSelectionCoords(null);
    setAssetContext(null);
    setFormCoordinates({ lng, lat });
    setFormMode('create');
    setSubmitError(null);
    setShowForm(true);
  }, []);

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
        setFormCoordinates(null);
        setCreationMode('idle');
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

  const hasActiveFilters = statusFilter || priorityFilter || workTypeFilter || assignedToFilter;

  // Header bar with filters — used in table and split modes
  const headerBar = (
    <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 shrink-0">
      {/* Left: title + count */}
      <div className="flex items-center gap-2 shrink-0">
        <h2 className="text-sm font-semibold text-gray-900">Work Orders</h2>
        <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
          {filteredWOs.length === (data?.total ?? 0)
            ? `${data?.total ?? 0}`
            : `${filteredWOs.length} / ${data?.total ?? 0}`}
        </span>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search WO #, description, address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Filter toggle + dropdowns */}
      <div className="relative">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-md border transition-colors ${
            hasActiveFilters
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter size={12} />
          Filters
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-700 rounded-full px-1.5 text-[10px]">
              {[statusFilter, priorityFilter, workTypeFilter, assignedToFilter].filter(Boolean).length}
            </span>
          )}
          <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {showFilters && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-20 space-y-2 min-w-[200px]">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setSelectedWO(null); }}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              {WO_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value); setSelectedWO(null); }}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All priorities</option>
              {WO_PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <select
              value={workTypeFilter}
              onChange={(e) => { setWorkTypeFilter(e.target.value); setSelectedWO(null); }}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All types</option>
              {WO_WORK_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {hasActiveFilters && (
              <button
                onClick={() => { setStatusFilter(''); setPriorityFilter(''); setWorkTypeFilter(''); setAssignedToFilter(''); setSelectedWO(null); window.history.replaceState({}, document.title); }}
                className="text-[10px] text-red-500 hover:text-red-700"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Center: view mode toggle */}
      <ViewModeToggle mode={viewMode} onChange={setViewMode} />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: Create button */}
      <button
        onClick={handleCreate}
        className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
      >
        <Plus size={14} />
        Create Work Order
      </button>
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Map View: original layout with list panel, but add toggle overlay on map */}
      {viewMode === 'map' && (
        <div className="flex-1 flex overflow-hidden">
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
              selectedWOId={(creationMode === 'choosing' || creationMode === 'select-sign' || creationMode === 'drop-pin') ? null : (selectedWO?.work_order_id ?? null)}
              onWOClick={creationMode === 'select-sign' ? undefined : handleWOSelect}
              onDeselect={handleMapDeselect}
              highlightedSignIds={highlightedSignIds}
              assetSelectionMode={creationMode === 'select-sign' || creationMode === 'drop-pin'}
              onSignSelect={creationMode === 'select-sign' ? handleSignSelect : undefined}
              onLocationSelect={creationMode === 'drop-pin' ? handleLocationSelect : undefined}
              selectionCoords={selectionCoords}
            />

            {/* Choosing mode — pick what to do */}
            {creationMode === 'choosing' && (
              <div className="absolute top-4 left-4 right-4 flex justify-center z-10 pointer-events-none">
                <div className="bg-white rounded-lg shadow-lg px-4 py-3 flex items-center gap-2 pointer-events-auto border border-gray-200">
                  <span className="text-xs text-gray-600 mr-1">Create work order:</span>
                  <button
                    onClick={() => setCreationMode('select-sign')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
                  >
                    Select Existing Sign
                  </button>
                  <button
                    onClick={() => setCreationMode('drop-pin')}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors"
                  >
                    Drop Location Pin
                  </button>
                  <button
                    onClick={handleSelectionSkip}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleSelectionCancel}
                    className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Select sign mode banner */}
            {creationMode === 'select-sign' && (
              <div className="absolute top-4 left-4 right-4 flex justify-center z-10 pointer-events-none">
                <div className="bg-blue-600 text-white rounded-lg shadow-lg px-4 py-2.5 flex items-center gap-3 text-xs pointer-events-auto">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span>Click a sign on the map to attach it to the work order</span>
                  <button
                    onClick={handleSelectionCancel}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Drop pin mode banner */}
            {creationMode === 'drop-pin' && (
              <div className="absolute top-4 left-4 right-4 flex justify-center z-10 pointer-events-none">
                <div className="bg-green-600 text-white rounded-lg shadow-lg px-4 py-2.5 flex items-center gap-3 text-xs pointer-events-auto">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span>Click the map to set the work order location</span>
                  <button
                    onClick={handleSelectionCancel}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Status bar with Create button and view toggle (hidden during selection) */}
            {creationMode === 'idle' && (
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
            )}

            {/* View mode toggle — top center */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2">
              <div className="bg-white/90 backdrop-blur rounded-full shadow">
                <ViewModeToggle mode={viewMode} onChange={setViewMode} />
              </div>
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
        </div>
      )}

      {/* Table View: header bar + full table + detail panel */}
      {viewMode === 'table' && (
        <>
          {headerBar}
          <div className="flex-1 flex overflow-hidden">
            <WorkOrderTable
              workOrders={filteredWOs}
              selectedWOId={selectedWO?.work_order_id ?? null}
              onWOSelect={handleWOSelect}
            />

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
          </div>
        </>
      )}

      {/* Split View: header bar + map (60%) + table (40%) + detail panel */}
      {viewMode === 'split' && (
        <>
          {headerBar}
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Map — 60% */}
              <div className="relative" style={{ flex: '0 0 60%' }}>
                <WorkOrderMap
                  signs={signs}
                  workOrders={filteredWOs}
                  selectedWOId={(creationMode === 'choosing' || creationMode === 'select-sign' || creationMode === 'drop-pin') ? null : (selectedWO?.work_order_id ?? null)}
                  onWOClick={creationMode === 'select-sign' ? undefined : handleWOSelect}
                  onDeselect={handleMapDeselect}
                  highlightedSignIds={highlightedSignIds}
                  assetSelectionMode={creationMode === 'select-sign' || creationMode === 'drop-pin'}
                  onSignSelect={creationMode === 'select-sign' ? handleSignSelect : undefined}
                  onLocationSelect={creationMode === 'drop-pin' ? handleLocationSelect : undefined}
                  selectionCoords={selectionCoords}
                />
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200" />

              {/* Table — 40% */}
              <div className="flex flex-col overflow-hidden" style={{ flex: '0 0 40%' }}>
                <WorkOrderTable
                  workOrders={filteredWOs}
                  selectedWOId={selectedWO?.work_order_id ?? null}
                  onWOSelect={handleWOSelect}
                />
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
          </div>
        </>
      )}

      {/* Form modal */}
      {showForm && (
        <WorkOrderForm
          mode={formMode}
          workOrder={formMode === 'edit' ? selectedWO : null}
          assetContext={assetContext}
          coordinates={formMode === 'create' ? formCoordinates : null}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setAssetContext(null); setFormCoordinates(null); setCreationMode('idle'); setSubmitError(null); }}
          isSubmitting={createWO.isPending || updateWO.isPending}
          error={submitError}
        />
      )}
    </div>
  );
}
