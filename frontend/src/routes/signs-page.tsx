import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { useSignsList, useCreateSign, useUpdateSign, useDeleteSign } from '../hooks/use-signs';
import { AssetMap } from '../components/map/asset-map';
import { SignListPanel } from '../components/signs/sign-list-panel';
import { SignDetailPanel } from '../components/signs/sign-detail-panel';
import { SignFormPanel } from '../components/signs/sign-form-panel';
import { SupportDetailPanel } from '../components/signs/support-detail-panel';
import type { Sign } from '../api/types';

type PageMode = 'view' | 'add-placing' | 'add-form' | 'edit';

export function SignsPage() {
  const navigate = useNavigate();
  const [selectedSign, setSelectedSign] = useState<Sign | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mode, setMode] = useState<PageMode>('view');
  const [placementCoords, setPlacementCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Support-centric view state
  const [viewingSupport, setViewingSupport] = useState<string | null>(null);
  const [clickedSignId, setClickedSignId] = useState<string | null>(null);
  // When drilling into a sign from the support panel, track it so we can go back
  const [drilledFromSupport, setDrilledFromSupport] = useState<string | null>(null);

  const { data, isLoading } = useSignsList({
    page_size: 200,
    status: statusFilter || undefined,
    sign_category: categoryFilter || undefined,
  });

  const createSign = useCreateSign();
  const updateSign = useUpdateSign();
  const deleteSign = useDeleteSign();

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
  const filteredSigns = useMemo(() => {
    if (!data?.signs) return [];
    if (!searchQuery.trim()) return data.signs;
    const q = searchQuery.toLowerCase();
    return data.signs.filter((s) =>
      (s.mutcd_code && s.mutcd_code.toLowerCase().includes(q)) ||
      (s.description && s.description.toLowerCase().includes(q)) ||
      (s.road_name && s.road_name.toLowerCase().includes(q)) ||
      (s.address && s.address.toLowerCase().includes(q)) ||
      (s.intersection_with && s.intersection_with.toLowerCase().includes(q)) ||
      (s.legend_text && s.legend_text.toLowerCase().includes(q))
    );
  }, [data?.signs, searchQuery]);

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
  };

  const handleFormSubmit = async (formData: Record<string, unknown>) => {
    setSubmitError(null);
    try {
      if (mode === 'add-form') {
        await createSign.mutateAsync(formData as unknown as Parameters<typeof createSign.mutateAsync>[0]);
      } else if (mode === 'edit' && selectedSign) {
        const updated = await updateSign.mutateAsync({
          id: selectedSign.sign_id,
          data: formData as unknown as Parameters<typeof updateSign.mutateAsync>[0]['data'],
        });
        setSelectedSign(updated);
      }
      setMode('view');
      setPlacementCoords(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save sign';
      setSubmitError(message);
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

  const isPlacementMode = mode === 'add-placing' || mode === 'add-form';
  const showForm = mode === 'add-form' || mode === 'edit';
  const showSignDetail = mode === 'view' && selectedSign && !viewingSupport;
  const showSupportDetail = mode === 'view' && viewingSupport && !selectedSign;

  return (
    <div className="h-full flex overflow-hidden">
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
        supportSignCounts={supportSignCounts}
      />

      {/* Center: Map */}
      <div className="flex-1 relative">
        <AssetMap
          signs={filteredSigns}
          selectedSignId={selectedSign?.sign_id ?? clickedSignId}
          onSignClick={handleSignSelect}
          placementMode={isPlacementMode}
          placementCoords={placementCoords}
          onPlacementClick={handlePlacementClick}
        />

        {/* Status bar with Add button */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="bg-white/90 backdrop-blur rounded-lg shadow px-3 py-1.5 text-xs text-gray-600">
            {filteredSigns.length === (data?.total ?? 0) ? (
              <span>{data?.total ?? 0} signs</span>
            ) : (
              <span>{filteredSigns.length} of {data?.total ?? 0} signs</span>
            )}
          </div>

          {mode === 'view' && (
            <button
              onClick={handleStartAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Plus size={14} />
              Add Sign
            </button>
          )}
        </div>

        {/* Placement mode banner */}
        {mode === 'add-placing' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white rounded-lg shadow-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Click the map to place a sign
            <button
              onClick={handleCancel}
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
        />
      )}

      {/* Right: Sign detail panel */}
      {showSignDetail && (
        <SignDetailPanel
          sign={selectedSign}
          onClose={() => { setSelectedSign(null); setDrilledFromSupport(null); }}
          onEdit={handleStartEdit}
          onDelete={handleDelete}
          isDeleting={deleteSign.isPending}
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
  );
}
