import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Search, Filter, ChevronDown, X } from 'lucide-react';
import {
  useInspectionsList,
  useCreateInspection,
  useUpdateInspection,
  useDeleteInspection,
  useInspection,
} from '../hooks/use-inspections';
import { useSignsList } from '../hooks/use-signs';
import { InspectionDetailPanel } from '../components/inspections/inspection-detail-panel';
import { InspectionForm, type InspectionAssetContext } from '../components/inspections/inspection-form';
import { InspectionListPanel } from '../components/inspections/inspection-list-panel';
import { InspectionMap } from '../components/map/inspection-map';
import { InspectionTable } from '../components/inspections/inspection-table';
import { ViewModeToggle, type ViewMode } from '../components/shared/view-mode-toggle';
import type { Sign, Inspection, InspectionCreate, InspectionUpdate } from '../api/types';
import {
  INSPECTION_STATUS_OPTIONS,
  INSPECTION_TYPE_OPTIONS,
} from '../lib/constants';

export function InspectionsPage() {
  const location = useLocation();
  const routeState = location.state as {
    selectedInspectionId?: string;
    assetContext?: InspectionAssetContext;
    filterInspector?: string;
    filterStatus?: string;
  } | null;

  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [statusFilter, setStatusFilter] = useState(routeState?.filterStatus || '');
  const [typeFilter, setTypeFilter] = useState('');
  const [followUpFilter, setFollowUpFilter] = useState('');
  const [inspectorFilter, setInspectorFilter] = useState(routeState?.filterInspector || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [assetContext, setAssetContext] = useState<InspectionAssetContext | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const handledRouteState = useRef(false);

  // Asset selection mode for creating inspections from the map
  type CreationMode = 'idle' | 'choosing' | 'select-sign' | 'drop-pin' | 'form';
  const [creationMode, setCreationMode] = useState<CreationMode>('idle');
  const [selectionCoords, setSelectionCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [formCoordinates, setFormCoordinates] = useState<{ lng: number; lat: number } | null>(null);

  // Fetch signs for the base layer
  const { data: signsData } = useSignsList({ page_size: 1000 });
  const signs = signsData?.signs ?? [];

  const { data, isLoading } = useInspectionsList({
    page_size: 1000,
    status: statusFilter || undefined,
    inspection_type: typeFilter || undefined,
    follow_up_required: followUpFilter === '' ? undefined : followUpFilter === 'true',
    inspector_id: inspectorFilter || undefined,
  });

  // Fetch full detail for selected inspection (to get assets)
  const { data: detailInspection } = useInspection(selectedInspectionId ?? undefined);

  const createInspection = useCreateInspection();
  const updateInspection = useUpdateInspection();
  const deleteInspection = useDeleteInspection();

  // Client-side search filtering
  const filteredInspections = useMemo(() => {
    if (!data?.inspections) return [];
    if (!searchQuery.trim()) return data.inspections;
    const q = searchQuery.toLowerCase();
    return data.inspections.filter((insp) =>
      (insp.inspection_number && insp.inspection_number.toLowerCase().includes(q)) ||
      (insp.findings && insp.findings.toLowerCase().includes(q))
    );
  }, [data?.inspections, searchQuery]);

  // Compute highlighted sign IDs from selected inspection's linked assets
  const highlightedSignIds = useMemo(() => {
    if (!selectedInspection?.assets) return [];
    return selectedInspection.assets
      .filter((a) => a.asset_type === 'sign')
      .map((a) => a.asset_id);
  }, [selectedInspection]);

  // Handle route state (navigate from sign/support detail) — once only
  useEffect(() => {
    if (handledRouteState.current) return;
    if (routeState?.assetContext) {
      handledRouteState.current = true;
      setAssetContext(routeState.assetContext);
      setFormMode('create');
      setShowForm(true);
      window.history.replaceState({}, document.title);
    }
    if (routeState?.selectedInspectionId && data?.inspections) {
      const insp = data.inspections.find(
        (i) => i.inspection_id === routeState.selectedInspectionId,
      );
      if (insp) {
        setSelectedInspection(insp);
        setSelectedInspectionId(insp.inspection_id);
        window.history.replaceState({}, document.title);
      }
    }
  }, [routeState, data?.inspections]);

  // Use detail data when available
  useEffect(() => {
    if (detailInspection && selectedInspectionId) {
      setSelectedInspection(detailInspection);
    }
  }, [detailInspection, selectedInspectionId]);

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
    // In map or split mode, enter asset selection mode
    setSelectedInspection(null);
    setSelectedInspectionId(null);
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
    if (!selectedInspection) return;
    setFormMode('edit');
    setSubmitError(null);
    setShowForm(true);
  };

  const handleFormSubmit = async (formData: InspectionCreate | InspectionUpdate) => {
    setSubmitError(null);
    try {
      if (formMode === 'create') {
        const created = await createInspection.mutateAsync(formData as InspectionCreate);
        setShowForm(false);
        setAssetContext(null);
        setFormCoordinates(null);
        setCreationMode('idle');
        setSelectedInspection(created);
        setSelectedInspectionId(created.inspection_id);
      } else if (selectedInspection) {
        const updated = await updateInspection.mutateAsync({
          id: selectedInspection.inspection_id,
          data: formData as InspectionUpdate,
        });
        setShowForm(false);
        setSelectedInspection(updated);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save inspection';
      setSubmitError(message);
    }
  };

  const handleDelete = async () => {
    if (!selectedInspection) return;
    try {
      await deleteInspection.mutateAsync(selectedInspection.inspection_id);
      setSelectedInspection(null);
      setSelectedInspectionId(null);
    } catch (err: unknown) {
      console.error('Delete failed:', err);
    }
  };

  const handleInspSelect = useCallback((insp: Inspection) => {
    if (selectedInspection?.inspection_id === insp.inspection_id) {
      setSelectedInspection(null);
      setSelectedInspectionId(null);
    } else {
      setSelectedInspection(insp);
      setSelectedInspectionId(insp.inspection_id);
    }
  }, [selectedInspection]);

  const handleMapDeselect = useCallback(() => {
    setSelectedInspection(null);
    setSelectedInspectionId(null);
  }, []);

  const geoInspCount = useMemo(
    () => filteredInspections.filter((i) => i.longitude != null && i.latitude != null).length,
    [filteredInspections],
  );

  const hasActiveFilters = statusFilter || typeFilter || followUpFilter || inspectorFilter;

  // Header bar with filters — used in table and split modes
  const headerBar = (
    <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 shrink-0">
      {/* Left: title + count */}
      <div className="flex items-center gap-2 shrink-0">
        <h2 className="text-sm font-semibold text-gray-900">Inspections</h2>
        <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
          {filteredInspections.length === (data?.total ?? 0)
            ? `${data?.total ?? 0}`
            : `${filteredInspections.length} / ${data?.total ?? 0}`}
        </span>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search INS #, findings..."
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
              {[statusFilter, typeFilter, followUpFilter].filter(Boolean).length}
            </span>
          )}
          <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {showFilters && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-20 space-y-2 min-w-[200px]">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setSelectedInspection(null); setSelectedInspectionId(null); }}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              {INSPECTION_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setSelectedInspection(null); setSelectedInspectionId(null); }}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All types</option>
              {INSPECTION_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={followUpFilter}
              onChange={(e) => { setFollowUpFilter(e.target.value); setSelectedInspection(null); setSelectedInspectionId(null); }}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All follow-up</option>
              <option value="true">Follow-up Required</option>
              <option value="false">No Follow-up</option>
            </select>
            {hasActiveFilters && (
              <button
                onClick={() => { setStatusFilter(''); setTypeFilter(''); setFollowUpFilter(''); setInspectorFilter(''); setSelectedInspection(null); setSelectedInspectionId(null); window.history.replaceState({}, document.title); }}
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
        New Inspection
      </button>
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Map View: original layout with list panel */}
      {viewMode === 'map' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Inspection list */}
          <InspectionListPanel
            inspections={filteredInspections}
            total={data?.total ?? 0}
            isLoading={isLoading}
            selectedInspId={selectedInspection?.inspection_id ?? null}
            onInspSelect={handleInspSelect}
            statusFilter={statusFilter}
            onStatusFilterChange={(s) => { setStatusFilter(s); setSelectedInspection(null); setSelectedInspectionId(null); }}
            typeFilter={typeFilter}
            onTypeFilterChange={(t) => { setTypeFilter(t); setSelectedInspection(null); setSelectedInspectionId(null); }}
            followUpFilter={followUpFilter}
            onFollowUpFilterChange={(f) => { setFollowUpFilter(f); setSelectedInspection(null); setSelectedInspectionId(null); }}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          {/* Center: Map */}
          <div className="flex-1 relative">
            <InspectionMap
              signs={signs}
              inspections={filteredInspections}
              selectedInspId={(creationMode === 'choosing' || creationMode === 'select-sign' || creationMode === 'drop-pin') ? null : (selectedInspection?.inspection_id ?? null)}
              onInspClick={handleInspSelect}
              onDeselect={handleMapDeselect}
              highlightedSignIds={highlightedSignIds}
              assetSelectionMode={creationMode === 'select-sign' || creationMode === 'drop-pin'}
              onSignSelect={creationMode === 'select-sign' ? handleSignSelect : undefined}
              onLocationSelect={creationMode === 'drop-pin' ? handleLocationSelect : undefined}
              selectionCoords={selectionCoords}
            />

            {/* Choosing mode */}
            {creationMode === 'choosing' && (
              <div className="absolute top-4 left-4 right-4 flex justify-center z-10 pointer-events-none">
                <div className="bg-white rounded-lg shadow-lg px-4 py-3 flex items-center gap-2 pointer-events-auto border border-gray-200">
                  <span className="text-xs text-gray-600 mr-1">New inspection:</span>
                  <button onClick={() => setCreationMode('select-sign')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors">Select Existing Sign</button>
                  <button onClick={() => setCreationMode('drop-pin')} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors">Drop Location Pin</button>
                  <button onClick={handleSelectionSkip} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium transition-colors">Skip</button>
                  <button onClick={handleSelectionCancel} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"><X size={14} /></button>
                </div>
              </div>
            )}
            {creationMode === 'select-sign' && (
              <div className="absolute top-4 left-4 right-4 flex justify-center z-10 pointer-events-none">
                <div className="bg-blue-600 text-white rounded-lg shadow-lg px-4 py-2.5 flex items-center gap-3 text-xs pointer-events-auto">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span>Click a sign on the map to attach it to the inspection</span>
                  <button onClick={handleSelectionCancel} className="p-1 hover:bg-white/20 rounded transition-colors"><X size={14} /></button>
                </div>
              </div>
            )}
            {creationMode === 'drop-pin' && (
              <div className="absolute top-4 left-4 right-4 flex justify-center z-10 pointer-events-none">
                <div className="bg-green-600 text-white rounded-lg shadow-lg px-4 py-2.5 flex items-center gap-3 text-xs pointer-events-auto">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span>Click the map to set the inspection location</span>
                  <button onClick={handleSelectionCancel} className="p-1 hover:bg-white/20 rounded transition-colors"><X size={14} /></button>
                </div>
              </div>
            )}

            {/* Status bar with Create button (hidden during selection) */}
            {creationMode === 'idle' && (
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <div className="bg-white/90 backdrop-blur rounded-lg shadow px-3 py-1.5 text-xs text-gray-600">
                  {filteredInspections.length === (data?.total ?? 0) ? (
                    <span>{data?.total ?? 0} inspections{geoInspCount < filteredInspections.length ? ` (${geoInspCount} mapped)` : ''}</span>
                  ) : (
                    <span>{filteredInspections.length} of {data?.total ?? 0} inspections</span>
                  )}
                </div>

                <button
                  onClick={handleCreate}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Plus size={14} />
                  New Inspection
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
          {selectedInspection && !showForm && (
            <InspectionDetailPanel
              inspection={selectedInspection}
              onClose={() => { setSelectedInspection(null); setSelectedInspectionId(null); }}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isDeleting={deleteInspection.isPending}
              onRefresh={() => {
                if (selectedInspectionId) {
                  setSelectedInspectionId(selectedInspectionId);
                }
              }}
            />
          )}
        </div>
      )}

      {/* Table View: header bar + full table + detail panel */}
      {viewMode === 'table' && (
        <>
          {headerBar}
          <div className="flex-1 flex overflow-hidden">
            <InspectionTable
              inspections={filteredInspections}
              selectedInspId={selectedInspection?.inspection_id ?? null}
              onInspSelect={handleInspSelect}
            />

            {/* Right: Detail panel */}
            {selectedInspection && !showForm && (
              <InspectionDetailPanel
                inspection={selectedInspection}
                onClose={() => { setSelectedInspection(null); setSelectedInspectionId(null); }}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isDeleting={deleteInspection.isPending}
                onRefresh={() => {
                  if (selectedInspectionId) {
                    setSelectedInspectionId(selectedInspectionId);
                  }
                }}
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
                <InspectionMap
                  signs={signs}
                  inspections={filteredInspections}
                  selectedInspId={(creationMode === 'choosing' || creationMode === 'select-sign' || creationMode === 'drop-pin') ? null : (selectedInspection?.inspection_id ?? null)}
                  onInspClick={handleInspSelect}
                  onDeselect={handleMapDeselect}
                  highlightedSignIds={highlightedSignIds}
                  assetSelectionMode={creationMode === 'select-sign' || creationMode === 'drop-pin'}
                  onSignSelect={handleSignSelect}
                  onLocationSelect={handleLocationSelect}
                  selectionCoords={selectionCoords}
                />

                {/* Asset selection mode banner (split view) */}
                {(creationMode as string) === 'selecting' && (
                  <div className="absolute top-4 left-4 right-4 flex justify-center z-10 pointer-events-none">
                    <div className="bg-blue-600 text-white rounded-lg shadow-lg px-4 py-2.5 flex items-center gap-3 text-xs pointer-events-auto">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      <span>Click a sign to attach it, click the map for a new location, or</span>
                      <button
                        onClick={handleSelectionSkip}
                        className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded text-white font-medium transition-colors"
                      >
                        Skip
                      </button>
                      <button
                        onClick={handleSelectionCancel}
                        className="p-1 hover:bg-white/20 rounded transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200" />

              {/* Table — 40% */}
              <div className="flex flex-col overflow-hidden" style={{ flex: '0 0 40%' }}>
                <InspectionTable
                  inspections={filteredInspections}
                  selectedInspId={selectedInspection?.inspection_id ?? null}
                  onInspSelect={handleInspSelect}
                />
              </div>
            </div>

            {/* Right: Detail panel */}
            {selectedInspection && !showForm && (
              <InspectionDetailPanel
                inspection={selectedInspection}
                onClose={() => { setSelectedInspection(null); setSelectedInspectionId(null); }}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isDeleting={deleteInspection.isPending}
                onRefresh={() => {
                  if (selectedInspectionId) {
                    setSelectedInspectionId(selectedInspectionId);
                  }
                }}
              />
            )}
          </div>
        </>
      )}

      {/* Form modal */}
      {showForm && (
        <InspectionForm
          mode={formMode}
          inspection={formMode === 'edit' ? selectedInspection : null}
          assetContext={assetContext}
          coordinates={formMode === 'create' ? formCoordinates : null}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setAssetContext(null); setFormCoordinates(null); setCreationMode('idle'); setSubmitError(null); }}
          isSubmitting={createInspection.isPending || updateInspection.isPending}
          error={submitError}
        />
      )}
    </div>
  );
}
