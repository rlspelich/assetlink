import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, X, Map as MapIcon, ShieldCheck } from 'lucide-react';
import { useSignsList, useSign, useCreateSign, useUpdateSign, useDeleteSign } from '../hooks/use-signs';
import { useUpdateSupport, useDeleteSupport } from '../hooks/use-supports';
import { AssetMap } from '../components/map/asset-map';
import { AddressSearch } from '../components/shared/address-search';
import { SignListPanel } from '../components/signs/sign-list-panel';
import { SignDetailPanel } from '../components/signs/sign-detail-panel';
import { SignFormPanel } from '../components/signs/sign-form-panel';
import { SupportDetailPanel } from '../components/signs/support-detail-panel';
import type { Sign } from '../api/types';

type PageMode = 'view' | 'add-placing' | 'add-form' | 'edit';

export function SignsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { highlightSignId?: string } | null;
  const handledRouteState = useRef(false);

  const [selectedSign, setSelectedSign] = useState<Sign | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mode, setMode] = useState<PageMode>('view');
  const [visibleSignCount, setVisibleSignCount] = useState<number | null>(null);
  const [placementCoords, setPlacementCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [flyToCoords, setFlyToCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Support-centric view state
  const [viewingSupport, setViewingSupport] = useState<string | null>(null);
  const [addToSupportId, setAddToSupportId] = useState<string | null>(null);
  const [clickedSignId, setClickedSignId] = useState<string | null>(null);
  // When drilling into a sign from the support panel, track it so we can go back
  const [drilledFromSupport, setDrilledFromSupport] = useState<string | null>(null);

  const { data, isLoading } = useSignsList({
    page_size: 1000,
    status: statusFilter || undefined,
    sign_category: categoryFilter || undefined,
  });

  const createSign = useCreateSign();
  const updateSign = useUpdateSign();
  const deleteSign = useDeleteSign();
  const updateSupport = useUpdateSupport();
  const deleteSupport = useDeleteSupport();

  // Fetch a specific sign when navigating from dashboard priority table
  const highlightSignId = (!handledRouteState.current && routeState?.highlightSignId) ? routeState.highlightSignId : undefined;
  const { data: highlightedSignData } = useSign(highlightSignId);

  // Handle route state — pre-select a sign (e.g. from dashboard priority table)
  useEffect(() => {
    if (handledRouteState.current || !routeState?.highlightSignId) return;
    // Try to find in the list first, then fall back to the dedicated fetch
    const sign = data?.signs?.find((s) => s.sign_id === routeState.highlightSignId) ?? highlightedSignData ?? null;
    if (sign) {
      handledRouteState.current = true;
      setSelectedSign(sign);
      setViewingSupport(null);
      setDrilledFromSupport(null);
      window.history.replaceState({}, document.title);
    }
  }, [routeState, data?.signs, highlightedSignData]);

  // Build a lookup: support_id -> array of sign_ids that share it
  const supportSignCounts = useMemo(() => {
    if (!data?.signs) return new Map<string, string[]>();
    const map = new Map<string, string[]>();
    for (const s of data.signs) {
      if (s.support_id) {
        const existing = map.get(s.support_id);
        if (existing) {
          existing.push(s.sign_id);
        } else {
          map.set(s.support_id, [s.sign_id]);
        }
      }
    }
    return map;
  }, [data?.signs]);

  // Client-side search filtering (road, MUTCD, description)
  // Also ensures the selected sign is always in the list (even if fetched separately)
  const filteredSigns = useMemo(() => {
    if (!data?.signs) return selectedSign ? [selectedSign] : [];
    let signs = data.signs;
    // Inject selected sign if it was fetched separately and isn't in the list
    if (selectedSign && !signs.find((s) => s.sign_id === selectedSign.sign_id)) {
      signs = [selectedSign, ...signs];
    }
    // Condition filter (client-side)
    if (conditionFilter) {
      if (conditionFilter === 'unrated') {
        signs = signs.filter((s) => !s.condition_rating);
      } else {
        const rating = parseInt(conditionFilter, 10);
        signs = signs.filter((s) => s.condition_rating === rating);
      }
    }
    if (!searchQuery.trim()) return signs;
    const q = searchQuery.toLowerCase();
    return signs.filter((s) =>
      (s.mutcd_code && s.mutcd_code.toLowerCase().includes(q)) ||
      (s.description && s.description.toLowerCase().includes(q)) ||
      (s.road_name && s.road_name.toLowerCase().includes(q)) ||
      (s.address && s.address.toLowerCase().includes(q)) ||
      (s.intersection_with && s.intersection_with.toLowerCase().includes(q)) ||
      (s.legend_text && s.legend_text.toLowerCase().includes(q))
    );
  }, [data?.signs, searchQuery, conditionFilter, selectedSign]);

  const handleSignSelect = (sign: Sign) => {
    if (mode !== 'view') return; // Don't select signs while adding/editing

    // If clicking the same sign, deselect
    if (selectedSign?.sign_id === sign.sign_id && !viewingSupport) {
      setSelectedSign(null);
      setViewingSupport(null);
      setClickedSignId(null);
      setDrilledFromSupport(null);
      return;
    }

    // Check if this sign shares a support with other signs
    if (sign.support_id) {
      const siblings = supportSignCounts.get(sign.support_id);
      if (siblings && siblings.length > 1) {
        // Multiple signs on this support -- show support panel
        setViewingSupport(sign.support_id);
        setClickedSignId(sign.sign_id);
        setSelectedSign(null);
        setDrilledFromSupport(null);
        return;
      }
    }

    // Standalone sign (no support, or only sign on its support)
    setSelectedSign(sign);
    setViewingSupport(null);
    setClickedSignId(null);
    setDrilledFromSupport(null);
  };

  const handleDrillIntoSign = (sign: Sign) => {
    // Drilling into a sign from the support panel
    setDrilledFromSupport(viewingSupport);
    setSelectedSign(sign);
    setViewingSupport(null);
  };

  const handleBackToSupport = () => {
    if (drilledFromSupport) {
      setViewingSupport(drilledFromSupport);
      setClickedSignId(selectedSign?.sign_id ?? null);
      setSelectedSign(null);
      setDrilledFromSupport(null);
    }
  };

  const handleStartAdd = () => {
    setSelectedSign(null);
    setViewingSupport(null);
    setClickedSignId(null);
    setDrilledFromSupport(null);
    setPlacementCoords(null);
    setSubmitError(null);
    setMode('add-placing');
  };

  const handlePlacementClick = useCallback((lng: number, lat: number) => {
    setPlacementCoords({ lng, lat });
    setMode('add-form');
  }, []);

  const handleStartEdit = () => {
    if (!selectedSign) return;
    setSubmitError(null);
    setMode('edit');
  };

  const handleCancel = () => {
    setMode('view');
    setPlacementCoords(null);
    setSubmitError(null);
    setAddToSupportId(null);
  };

  const handleFormSubmit = async (formData: Record<string, unknown>) => {
    setSubmitError(null);
    try {
      if (mode === 'add-form') {
        // If adding to a specific support, inject support_id
        const submitData = addToSupportId
          ? { ...formData, support_id: addToSupportId }
          : formData;
        await createSign.mutateAsync(submitData as unknown as Parameters<typeof createSign.mutateAsync>[0]);
      } else if (mode === 'edit' && selectedSign) {
        const updated = await updateSign.mutateAsync({
          id: selectedSign.sign_id,
          data: formData as unknown as Parameters<typeof updateSign.mutateAsync>[0]['data'],
        });
        setSelectedSign(updated);
      }
      setMode('view');
      setPlacementCoords(null);
      setAddToSupportId(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save sign';
      setSubmitError(message);
    }
  };

  const handleArchive = async () => {
    if (!selectedSign) return;
    try {
      await updateSign.mutateAsync({
        id: selectedSign.sign_id,
        data: { status: 'archived' } as unknown as Parameters<typeof updateSign.mutateAsync>[0]['data'],
      });
      setSelectedSign(null);
      setDrilledFromSupport(null);
      setMode('view');
    } catch (err: unknown) {
      console.error('Archive failed:', err);
    }
  };

  const handleDelete = async () => {
    if (!selectedSign) return;
    try {
      await deleteSign.mutateAsync(selectedSign.sign_id);
      setSelectedSign(null);
      setDrilledFromSupport(null);
      setMode('view');
    } catch (err: unknown) {
      console.error('Delete failed:', err);
    }
  };

  const handleCreateWorkOrder = (context: {
    support_id?: string;
    assets: Array<{ asset_type: string; asset_id: string; label: string }>;
  }) => {
    navigate('/work-orders', {
      state: {
        assetContext: context,
      },
    });
  };

  const handleInspect = (context: {
    support_id?: string;
    assets: Array<{ asset_type: string; asset_id: string; label: string }>;
  }) => {
    navigate('/inspections', {
      state: {
        assetContext: context,
      },
    });
  };

  const handleCloseSupport = () => {
    setViewingSupport(null);
    setClickedSignId(null);
  };

  // Add a new sign to an existing support — opens form with support pre-linked
  const handleAddSignToSupport = (supportId: string, coordinates: { lng: number; lat: number }) => {
    setAddToSupportId(supportId);
    setPlacementCoords(coordinates);
    setSelectedSign(null);
    setViewingSupport(null);
    setClickedSignId(null);
    setSubmitError(null);
    setMode('add-form');
  };

  // Remove a sign from its support (detach, don't delete)
  const handleRemoveSignFromSupport = async (signId: string) => {
    try {
      await updateSign.mutateAsync({
        id: signId,
        data: { support_id: null } as unknown as Parameters<typeof updateSign.mutateAsync>[0]['data'],
      });
      // Refresh the support panel by re-setting the viewing support
      const currentSupport = viewingSupport;
      setViewingSupport(null);
      setTimeout(() => setViewingSupport(currentSupport), 50);
    } catch (err: unknown) {
      console.error('Failed to detach sign from support:', err);
    }
  };

  // Archive a support only (no signs)
  const handleArchiveSupport = async (supportId: string) => {
    try {
      await updateSupport.mutateAsync({
        id: supportId,
        data: { status: 'archived' } as unknown as Parameters<typeof updateSupport.mutateAsync>[0]['data'],
      });
      setViewingSupport(null);
      setClickedSignId(null);
    } catch (err: unknown) {
      console.error('Archive support failed:', err);
    }
  };

  // Archive support + all its signs
  const handleArchiveSupportAndSigns = async (supportId: string) => {
    try {
      // First archive all signs on this support
      const signs = data?.signs?.filter(s => s.support_id === supportId) ?? [];
      for (const sign of signs) {
        await updateSign.mutateAsync({
          id: sign.sign_id,
          data: { status: 'archived' } as unknown as Parameters<typeof updateSign.mutateAsync>[0]['data'],
        });
      }
      // Then archive the support
      await updateSupport.mutateAsync({
        id: supportId,
        data: { status: 'archived' } as unknown as Parameters<typeof updateSupport.mutateAsync>[0]['data'],
      });
      setViewingSupport(null);
      setClickedSignId(null);
    } catch (err: unknown) {
      console.error('Archive support + signs failed:', err);
    }
  };

  // Delete support + all its signs permanently
  const handleDeleteSupportAndSigns = async (supportId: string) => {
    try {
      // First delete all signs on this support
      const signs = data?.signs?.filter(s => s.support_id === supportId) ?? [];
      for (const sign of signs) {
        await deleteSign.mutateAsync(sign.sign_id);
      }
      // Then delete the support (now has no signs attached)
      await deleteSupport.mutateAsync(supportId);
      setViewingSupport(null);
      setClickedSignId(null);
    } catch (err: unknown) {
      console.error('Delete support + signs failed:', err);
    }
  };

  const isPlacementMode = mode === 'add-placing' || mode === 'add-form';
  const showForm = mode === 'add-form' || mode === 'edit';
  const showSignDetail = mode === 'view' && selectedSign && !viewingSupport;
  const showSupportDetail = mode === 'view' && viewingSupport && !selectedSign;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Full-width header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <MapIcon size={16} className="text-blue-600" />
            Signs
          </h2>
          <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{data?.total ?? 0} total</span>
          <button
            onClick={() => navigate('/compliance')}
            className="px-3 py-1.5 text-sm font-medium rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck size={15} />
            Compliance
          </button>
        </div>
        <div className="flex items-center gap-3">
          {visibleSignCount != null && visibleSignCount < filteredSigns.length && (
            <span className="text-xs text-gray-500">{visibleSignCount.toLocaleString()} in view</span>
          )}
          <AddressSearch onSelect={(lng, lat) => setFlyToCoords({ lng, lat })} placeholder="Go to address..." className="w-48" />
          {mode === 'view' && (
            <button
              onClick={handleStartAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Plus size={14} />
              Add Sign
            </button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
      {/* Left: Sign list */}
      <SignListPanel
        signs={filteredSigns}
        total={data?.total ?? 0}
        isLoading={isLoading}
        selectedSignId={selectedSign?.sign_id ?? clickedSignId}
        onSignSelect={handleSignSelect}
        statusFilter={statusFilter}
        onStatusFilterChange={(s) => { setStatusFilter(s); setSelectedSign(null); setViewingSupport(null); }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={(c) => { setCategoryFilter(c); setSelectedSign(null); setViewingSupport(null); }}
        conditionFilter={conditionFilter}
        onConditionFilterChange={(c) => { setConditionFilter(c); setSelectedSign(null); setViewingSupport(null); }}
        supportSignCounts={supportSignCounts}
      />

      {/* Center: Map */}
      <div className="flex-1 relative">
        <AssetMap
          signs={filteredSigns}
          selectedSignId={selectedSign?.sign_id ?? clickedSignId}
          onSignClick={handleSignSelect}
          onVisibleCountChange={setVisibleSignCount}
          placementMode={isPlacementMode}
          placementCoords={placementCoords}
          onPlacementClick={handlePlacementClick}
          flyToCoords={flyToCoords}
        />


        {/* Placement mode banner */}
        {mode === 'add-placing' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white rounded-lg shadow-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Click the map to place a sign
            <button
              onClick={handleCancel}
              aria-label="Cancel"
              className="ml-2 p-0.5 rounded hover:bg-blue-500"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Right: Support detail panel */}
      {showSupportDetail && (
        <SupportDetailPanel
          supportId={viewingSupport}
          clickedSignId={clickedSignId}
          onClose={handleCloseSupport}
          onSignSelect={handleDrillIntoSign}
          onCreateWorkOrder={handleCreateWorkOrder}
          onInspect={handleInspect}
          onAddSignToSupport={handleAddSignToSupport}
          onRemoveSignFromSupport={handleRemoveSignFromSupport}
          onArchiveSupport={handleArchiveSupport}
          onArchiveSupportAndSigns={handleArchiveSupportAndSigns}
          onDeleteSupportAndSigns={handleDeleteSupportAndSigns}
        />
      )}

      {/* Right: Sign detail panel */}
      {showSignDetail && (
        <SignDetailPanel
          sign={selectedSign}
          onClose={() => { setSelectedSign(null); setDrilledFromSupport(null); }}
          onEdit={handleStartEdit}
          onDelete={handleDelete}
          onArchive={handleArchive}
          isDeleting={deleteSign.isPending}
          isArchiving={updateSign.isPending}
          onBackToSupport={drilledFromSupport ? handleBackToSupport : undefined}
          onCreateWorkOrder={handleCreateWorkOrder}
          onInspect={handleInspect}
        />
      )}

      {showForm && (
        <SignFormPanel
          mode={mode === 'edit' ? 'edit' : 'add'}
          sign={mode === 'edit' ? selectedSign : null}
          coordinates={placementCoords}
          onSubmit={handleFormSubmit}
          onCancel={handleCancel}
          isSubmitting={createSign.isPending || updateSign.isPending}
          error={submitError}
        />
      )}
    </div>
    </div>
  );
}
