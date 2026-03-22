import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
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
import type { Inspection, InspectionCreate, InspectionUpdate } from '../api/types';

export function InspectionsPage() {
  const location = useLocation();
  const routeState = location.state as {
    selectedInspectionId?: string;
    assetContext?: InspectionAssetContext;
  } | null;

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [followUpFilter, setFollowUpFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [assetContext, setAssetContext] = useState<InspectionAssetContext | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const handledRouteState = useRef(false);

  // Fetch signs for the base layer
  const { data: signsData } = useSignsList({ page_size: 200 });
  const signs = signsData?.signs ?? [];

  const { data, isLoading } = useInspectionsList({
    page_size: 200,
    status: statusFilter || undefined,
    inspection_type: typeFilter || undefined,
    follow_up_required: followUpFilter === '' ? undefined : followUpFilter === 'true',
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
    setAssetContext(null);
    setFormMode('create');
    setSubmitError(null);
    setShowForm(true);
  };

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

  return (
    <div className="h-full flex overflow-hidden">
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
          selectedInspId={selectedInspection?.inspection_id ?? null}
          onInspClick={handleInspSelect}
          onDeselect={handleMapDeselect}
          highlightedSignIds={highlightedSignIds}
        />

        {/* Status bar with Create button */}
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

      {/* Form modal */}
      {showForm && (
        <InspectionForm
          mode={formMode}
          inspection={formMode === 'edit' ? selectedInspection : null}
          assetContext={assetContext}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setAssetContext(null); setSubmitError(null); }}
          isSubmitting={createInspection.isPending || updateInspection.isPending}
          error={submitError}
        />
      )}
    </div>
  );
}
