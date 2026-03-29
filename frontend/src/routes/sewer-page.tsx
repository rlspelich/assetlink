import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Search } from 'lucide-react';
import {
  useManholesList,
  useSewerMainsList,
  useForceMainsList,
  useLiftStationsList,
  useSewerLateralsList,
  useCreateManhole,
  useUpdateManhole,
  useDeleteManhole,
  useCreateSewerMain,
  useUpdateSewerMain,
  useDeleteSewerMain,
  useCreateForceMain,
  useUpdateForceMain,
  useDeleteForceMain,
  useCreateLiftStation,
  useUpdateLiftStation,
  useDeleteLiftStation,
  useCreateSewerLateral,
  useUpdateSewerLateral,
  useDeleteSewerLateral,
} from '../hooks/use-sewer';
import { SewerMap } from '../components/sewer/sewer-map';
import { SewerDetailPanel } from '../components/sewer/sewer-detail-panel';
import { SewerFormPanel } from '../components/sewer/sewer-form-panel';
import type { Manhole, SewerMain, ForceMain, LiftStation, SewerLateral } from '../api/types';
import {
  CONDITION_COLORS,
  UNRATED_COLOR,
  INACTIVE_COLOR,
  INACTIVE_STATUSES,
  SEWER_SYSTEM_TYPE_OPTIONS,
  SEWER_STATUS_OPTIONS,
} from '../lib/constants';

type SewerTab = 'manholes' | 'mains' | 'force_mains' | 'lift_stations' | 'laterals';
type PageMode = 'view' | 'add-placing' | 'add-form' | 'edit';

const TAB_CONFIG: { key: SewerTab; label: string }[] = [
  { key: 'manholes', label: 'Manholes' },
  { key: 'mains', label: 'Mains' },
  { key: 'force_mains', label: 'Force Mains' },
  { key: 'lift_stations', label: 'Lift Stations' },
  { key: 'laterals', label: 'Laterals' },
];

function isPointTab(tab: SewerTab): boolean {
  return tab === 'manholes' || tab === 'lift_stations';
}

function conditionBadgeSmall(rating: number | null, status: string) {
  const isInactive = INACTIVE_STATUSES.has(status) || status === 'inactive' || status === 'abandoned';
  const color = isInactive
    ? INACTIVE_COLOR
    : rating
      ? CONDITION_COLORS[rating]
      : UNRATED_COLOR;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
      style={{ backgroundColor: color.hex + '20', color: color.hex }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color.hex }} />
      {rating ? `${rating}/5` : color.label}
    </span>
  );
}

function statusBadgeSmall(status: string) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-600',
    abandoned: 'bg-gray-100 text-gray-500',
    removed: 'bg-gray-100 text-gray-500',
    proposed: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

export function SewerPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<SewerTab>('manholes');
  const [selectedAsset, setSelectedAsset] = useState<{ type: string; id: string; data: unknown } | null>(null);
  const [mode, setMode] = useState<PageMode>('view');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [systemTypeFilter, setSystemTypeFilter] = useState('');
  const [placementCoords, setPlacementCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [drawnCoordinates, setDrawnCoordinates] = useState<number[][] | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch all asset types
  const { data: manholesData, isLoading: manholesLoading } = useManholesList({
    page_size: 1000,
    status: statusFilter || undefined,
    system_type: systemTypeFilter || undefined,
  });
  const { data: sewerMainsData, isLoading: mainsLoading } = useSewerMainsList({
    page_size: 1000,
    status: statusFilter || undefined,
    system_type: systemTypeFilter || undefined,
  });
  const { data: forceMainsData, isLoading: forceMainsLoading } = useForceMainsList({
    page_size: 1000,
    status: statusFilter || undefined,
  });
  const { data: liftStationsData, isLoading: liftStationsLoading } = useLiftStationsList({
    page_size: 1000,
    status: statusFilter || undefined,
  });
  const { data: lateralsData, isLoading: lateralsLoading } = useSewerLateralsList({
    page_size: 1000,
    status: statusFilter || undefined,
  });

  // Mutations
  const createManhole = useCreateManhole();
  const updateManhole = useUpdateManhole();
  const deleteManhole = useDeleteManhole();
  const createSewerMain = useCreateSewerMain();
  const updateSewerMain = useUpdateSewerMain();
  const deleteSewerMain = useDeleteSewerMain();
  const createForceMain = useCreateForceMain();
  const updateForceMain = useUpdateForceMain();
  const deleteForceMain = useDeleteForceMain();
  const createLiftStation = useCreateLiftStation();
  const updateLiftStation = useUpdateLiftStation();
  const deleteLiftStation = useDeleteLiftStation();
  const createSewerLateral = useCreateSewerLateral();
  const updateSewerLateral = useUpdateSewerLateral();
  const deleteSewerLateral = useDeleteSewerLateral();

  // Extract arrays
  const manholes = manholesData?.manholes ?? [];
  const sewerMains = sewerMainsData?.sewer_mains ?? [];
  const forceMains = forceMainsData?.force_mains ?? [];
  const liftStations = liftStationsData?.lift_stations ?? [];
  const laterals = lateralsData?.sewer_laterals ?? [];

  // Filtered list for active tab
  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const matchText = (texts: (string | null | undefined)[]) => {
      if (!q) return true;
      return texts.some((t) => t && t.toLowerCase().includes(q));
    };

    switch (activeTab) {
      case 'manholes':
        return manholes.filter((m) => matchText([m.asset_tag, m.description, m.manhole_type_code]));
      case 'mains':
        return sewerMains.filter((m) => matchText([m.asset_tag, m.description, m.material_code]));
      case 'force_mains':
        return forceMains.filter((m) => matchText([m.asset_tag, m.description, m.material_code]));
      case 'lift_stations':
        return liftStations.filter((m) => matchText([m.asset_tag, m.station_name, m.description]));
      case 'laterals':
        return laterals.filter((m) => matchText([m.asset_tag, m.address, m.account_number]));
      default:
        return [];
    }
  }, [activeTab, manholes, sewerMains, forceMains, liftStations, laterals, searchQuery]);

  const isLoading = activeTab === 'manholes' ? manholesLoading
    : activeTab === 'mains' ? mainsLoading
    : activeTab === 'force_mains' ? forceMainsLoading
    : activeTab === 'lift_stations' ? liftStationsLoading
    : lateralsLoading;

  const totalCount = activeTab === 'manholes' ? (manholesData?.total ?? 0)
    : activeTab === 'mains' ? (sewerMainsData?.total ?? 0)
    : activeTab === 'force_mains' ? (forceMainsData?.total ?? 0)
    : activeTab === 'lift_stations' ? (liftStationsData?.total ?? 0)
    : (lateralsData?.total ?? 0);

  // Asset ID accessor per type
  function getAssetId(item: unknown, tab: SewerTab): string {
    switch (tab) {
      case 'manholes': return (item as Manhole).manhole_id;
      case 'mains': return (item as SewerMain).sewer_main_id;
      case 'force_mains': return (item as ForceMain).force_main_id;
      case 'lift_stations': return (item as LiftStation).lift_station_id;
      case 'laterals': return (item as SewerLateral).sewer_lateral_id;
    }
  }

  function handleAssetSelect(type: string, id: string) {
    if (mode !== 'view') return;

    // Deselect if same
    if (selectedAsset?.type === type && selectedAsset.id === id) {
      setSelectedAsset(null);
      return;
    }

    // Find data
    let data: unknown = null;
    switch (type) {
      case 'manholes': data = manholes.find((m) => m.manhole_id === id); break;
      case 'mains': data = sewerMains.find((m) => m.sewer_main_id === id); break;
      case 'force_mains': data = forceMains.find((m) => m.force_main_id === id); break;
      case 'lift_stations': data = liftStations.find((m) => m.lift_station_id === id); break;
      case 'laterals': data = laterals.find((m) => m.sewer_lateral_id === id); break;
    }
    if (data) {
      setSelectedAsset({ type, id, data });
    }
  }

  function handleMapSelectAsset(type: string, id: string) {
    handleAssetSelect(type, id);
  }

  function handleListSelect(item: unknown) {
    const id = getAssetId(item, activeTab);
    handleAssetSelect(activeTab, id);
  }

  const handleStartAdd = () => {
    setSelectedAsset(null);
    setPlacementCoords(null);
    setDrawnCoordinates(null);
    setSubmitError(null);
    setMode('add-placing');
  };

  const handlePlacementClick = useCallback((lngLat: { lng: number; lat: number }) => {
    if (isPointTab(activeTab)) {
      setPlacementCoords(lngLat);
      setMode('add-form');
    }
  }, [activeTab]);

  const handleLineDrawn = useCallback((coordinates: number[][]) => {
    setDrawnCoordinates(coordinates);
    setMode('add-form');
  }, []);

  const handleStartEdit = () => {
    if (!selectedAsset) return;
    setSubmitError(null);
    setMode('edit');
  };

  const handleCancel = () => {
    setMode('view');
    setPlacementCoords(null);
    setDrawnCoordinates(null);
    setSubmitError(null);
  };

  const handleFormSubmit = async (formData: Record<string, unknown>) => {
    setSubmitError(null);
    try {
      if (mode === 'add-form') {
        switch (activeTab) {
          case 'manholes':
            await createManhole.mutateAsync(formData as unknown as Parameters<typeof createManhole.mutateAsync>[0]);
            break;
          case 'mains':
            await createSewerMain.mutateAsync(formData as unknown as Parameters<typeof createSewerMain.mutateAsync>[0]);
            break;
          case 'force_mains':
            await createForceMain.mutateAsync(formData as unknown as Parameters<typeof createForceMain.mutateAsync>[0]);
            break;
          case 'lift_stations':
            await createLiftStation.mutateAsync(formData as unknown as Parameters<typeof createLiftStation.mutateAsync>[0]);
            break;
          case 'laterals':
            await createSewerLateral.mutateAsync(formData as unknown as Parameters<typeof createSewerLateral.mutateAsync>[0]);
            break;
        }
      } else if (mode === 'edit' && selectedAsset) {
        let updated: unknown;
        switch (selectedAsset.type) {
          case 'manholes':
            updated = await updateManhole.mutateAsync({ id: selectedAsset.id, data: formData as unknown as Parameters<typeof updateManhole.mutateAsync>[0]['data'] });
            break;
          case 'mains':
            updated = await updateSewerMain.mutateAsync({ id: selectedAsset.id, data: formData as unknown as Parameters<typeof updateSewerMain.mutateAsync>[0]['data'] });
            break;
          case 'force_mains':
            updated = await updateForceMain.mutateAsync({ id: selectedAsset.id, data: formData as unknown as Parameters<typeof updateForceMain.mutateAsync>[0]['data'] });
            break;
          case 'lift_stations':
            updated = await updateLiftStation.mutateAsync({ id: selectedAsset.id, data: formData as unknown as Parameters<typeof updateLiftStation.mutateAsync>[0]['data'] });
            break;
          case 'laterals':
            updated = await updateSewerLateral.mutateAsync({ id: selectedAsset.id, data: formData as unknown as Parameters<typeof updateSewerLateral.mutateAsync>[0]['data'] });
            break;
        }
        if (updated) {
          setSelectedAsset({ ...selectedAsset, data: updated });
        }
      }
      setMode('view');
      setPlacementCoords(null);
      setDrawnCoordinates(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      setSubmitError(message);
    }
  };

  const handleDelete = async () => {
    if (!selectedAsset) return;
    try {
      switch (selectedAsset.type) {
        case 'manholes': await deleteManhole.mutateAsync(selectedAsset.id); break;
        case 'mains': await deleteSewerMain.mutateAsync(selectedAsset.id); break;
        case 'force_mains': await deleteForceMain.mutateAsync(selectedAsset.id); break;
        case 'lift_stations': await deleteLiftStation.mutateAsync(selectedAsset.id); break;
        case 'laterals': await deleteSewerLateral.mutateAsync(selectedAsset.id); break;
      }
      setSelectedAsset(null);
      setMode('view');
    } catch (err: unknown) {
      console.error('Delete failed:', err);
    }
  };

  const handleCreateWorkOrder = () => {
    if (!selectedAsset) return;
    navigate('/work-orders', {
      state: {
        assetContext: {
          assets: [{ asset_type: selectedAsset.type, asset_id: selectedAsset.id, label: getAssetLabel(selectedAsset) }],
        },
      },
    });
  };

  const handleInspect = () => {
    if (!selectedAsset) return;
    navigate('/inspections', {
      state: {
        assetContext: {
          assets: [{ asset_type: selectedAsset.type, asset_id: selectedAsset.id, label: getAssetLabel(selectedAsset) }],
        },
      },
    });
  };

  function getAssetLabel(asset: { type: string; data: unknown }): string {
    switch (asset.type) {
      case 'manholes': {
        const m = asset.data as Manhole;
        return m.asset_tag || `Manhole ${m.manhole_id.slice(0, 8)}`;
      }
      case 'mains': {
        const m = asset.data as SewerMain;
        return m.asset_tag || `Main ${m.sewer_main_id.slice(0, 8)}`;
      }
      case 'force_mains': {
        const m = asset.data as ForceMain;
        return m.asset_tag || `Force Main ${m.force_main_id.slice(0, 8)}`;
      }
      case 'lift_stations': {
        const m = asset.data as LiftStation;
        return m.station_name || m.asset_tag || `Lift Station ${m.lift_station_id.slice(0, 8)}`;
      }
      case 'laterals': {
        const m = asset.data as SewerLateral;
        return m.asset_tag || m.address || `Lateral ${m.sewer_lateral_id.slice(0, 8)}`;
      }
      default: return 'Unknown';
    }
  }

  const isPlacementMode = mode === 'add-placing';
  const showForm = mode === 'add-form' || mode === 'edit';
  const showDetail = mode === 'view' && selectedAsset !== null;

  const isSubmitting = createManhole.isPending || updateManhole.isPending
    || createSewerMain.isPending || updateSewerMain.isPending
    || createForceMain.isPending || updateForceMain.isPending
    || createLiftStation.isPending || updateLiftStation.isPending
    || createSewerLateral.isPending || updateSewerLateral.isPending;

  const isDeleting = deleteManhole.isPending || deleteSewerMain.isPending
    || deleteForceMain.isPending || deleteLiftStation.isPending
    || deleteSewerLateral.isPending;

  const addLabel = activeTab === 'manholes' ? 'Add Manhole'
    : activeTab === 'mains' ? 'Add Main'
    : activeTab === 'force_mains' ? 'Add Force Main'
    : activeTab === 'lift_stations' ? 'Add Lift Station'
    : 'Add Lateral';

  const placementMessage = isPointTab(activeTab)
    ? 'Click the map to place'
    : 'Click points to draw line, double-click to finish';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Full-width header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-1">
          {TAB_CONFIG.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key);
                setSelectedAsset(null);
                setSearchQuery('');
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === key
                  ? 'text-blue-700 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {manholes.length} MH &middot; {sewerMains.length} mains &middot; {forceMains.length} FM &middot; {liftStations.length} LS &middot; {laterals.length} lat
          </span>
          {mode === 'view' && (
            <button
              onClick={handleStartAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Plus size={14} />
              {addLabel}
            </button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
      {/* Left: List panel */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0">

        {/* Filters */}
        <div className="p-2 space-y-1.5 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-1.5">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setSelectedAsset(null); }}
              className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {SEWER_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            {(activeTab === 'manholes' || activeTab === 'mains') && (
              <select
                value={systemTypeFilter}
                onChange={(e) => { setSystemTypeFilter(e.target.value); setSelectedAsset(null); }}
                className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Systems</option>
                {SEWER_SYSTEM_TYPE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Count */}
        <div className="px-3 py-1.5 text-[10px] text-gray-400 border-b border-gray-50">
          {filteredList.length} of {totalCount} {activeTab.replace(/_/g, ' ')}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-xs text-gray-400">Loading...</div>
          ) : filteredList.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-xs text-gray-400">
              No {activeTab.replace(/_/g, ' ')} found
            </div>
          ) : (
            filteredList.map((item) => {
              const id = getAssetId(item, activeTab);
              const isSelected = selectedAsset?.id === id;
              return (
                <button
                  key={id}
                  onClick={() => handleListSelect(item)}
                  className={`w-full text-left px-3 py-2 border-b border-gray-50 transition-colors ${
                    isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'
                  }`}
                >
                  {activeTab === 'manholes' && <ManholeListItem item={item as Manhole} />}
                  {activeTab === 'mains' && <SewerMainListItem item={item as SewerMain} />}
                  {activeTab === 'force_mains' && <ForceMainListItem item={item as ForceMain} />}
                  {activeTab === 'lift_stations' && <LiftStationListItem item={item as LiftStation} />}
                  {activeTab === 'laterals' && <LateralListItem item={item as SewerLateral} />}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Center: Map */}
      <div className="flex-1 relative">
        <SewerMap
          manholes={manholes}
          sewerMains={sewerMains}
          forceMains={forceMains}
          liftStations={liftStations}
          laterals={laterals}
          selectedAsset={selectedAsset ? { type: selectedAsset.type, id: selectedAsset.id } : null}
          onSelectAsset={handleMapSelectAsset}
          mode={mode}
          activeTab={activeTab}
          onMapClick={isPlacementMode && isPointTab(activeTab) ? handlePlacementClick : undefined}
          onLineDrawn={isPlacementMode && !isPointTab(activeTab) ? handleLineDrawn : undefined}
        />


        {/* Placement mode banner */}
        {isPlacementMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white rounded-lg shadow-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            {placementMessage}
            <button onClick={handleCancel} className="ml-2 p-0.5 rounded hover:bg-blue-500">
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Right: Detail panel */}
      {showDetail && selectedAsset && (
        <SewerDetailPanel
          assetType={selectedAsset.type}
          data={selectedAsset.data}
          onClose={() => setSelectedAsset(null)}
          onEdit={handleStartEdit}
          onDelete={handleDelete}
          isDeleting={isDeleting}
          onCreateWorkOrder={handleCreateWorkOrder}
          onInspect={handleInspect}
        />
      )}

      {/* Right: Form panel */}
      {showForm && (
        <SewerFormPanel
          mode={mode === 'edit' ? 'edit' : 'add'}
          assetType={mode === 'edit' && selectedAsset ? selectedAsset.type : activeTab}
          data={mode === 'edit' && selectedAsset ? selectedAsset.data : null}
          coordinates={placementCoords}
          lineCoordinates={drawnCoordinates}
          onSubmit={handleFormSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
          error={submitError}
        />
      )}
    </div>
    </div>
  );
}

// --- List item components ---

function ManholeListItem({ item }: { item: Manhole }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-xs font-medium text-gray-900 truncate">
          {item.asset_tag || `MH-${item.manhole_id.slice(0, 8)}`}
        </span>
        {conditionBadgeSmall(item.condition_rating, item.status)}
      </div>
      <div className="flex items-center gap-1.5">
        {statusBadgeSmall(item.status)}
        {item.system_type && (
          <span className="text-[10px] text-gray-500 capitalize">{item.system_type}</span>
        )}
        {item.depth_ft != null && (
          <span className="text-[10px] text-gray-400">{item.depth_ft} ft deep</span>
        )}
      </div>
    </div>
  );
}

function SewerMainListItem({ item }: { item: SewerMain }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-xs font-medium text-gray-900 truncate">
          {item.asset_tag || `SM-${item.sewer_main_id.slice(0, 8)}`}
        </span>
        {conditionBadgeSmall(item.condition_rating, item.status)}
      </div>
      <div className="flex items-center gap-1.5">
        {statusBadgeSmall(item.status)}
        {item.system_type && (
          <span className="text-[10px] text-gray-500 capitalize">{item.system_type}</span>
        )}
        {item.diameter_inches != null && (
          <span className="text-[10px] text-gray-400">{item.diameter_inches}"</span>
        )}
        {item.length_feet != null && (
          <span className="text-[10px] text-gray-400">{item.length_feet} ft</span>
        )}
      </div>
    </div>
  );
}

function ForceMainListItem({ item }: { item: ForceMain }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-xs font-medium text-gray-900 truncate">
          {item.asset_tag || `FM-${item.force_main_id.slice(0, 8)}`}
        </span>
        {conditionBadgeSmall(item.condition_rating, item.status)}
      </div>
      <div className="flex items-center gap-1.5">
        {statusBadgeSmall(item.status)}
        {item.diameter_inches != null && (
          <span className="text-[10px] text-gray-400">{item.diameter_inches}"</span>
        )}
        {item.pressure_class && (
          <span className="text-[10px] text-gray-400">{item.pressure_class}</span>
        )}
      </div>
    </div>
  );
}

function LiftStationListItem({ item }: { item: LiftStation }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-xs font-medium text-gray-900 truncate">
          {item.station_name || item.asset_tag || `LS-${item.lift_station_id.slice(0, 8)}`}
        </span>
        {conditionBadgeSmall(item.condition_rating, item.status)}
      </div>
      <div className="flex items-center gap-1.5">
        {statusBadgeSmall(item.status)}
        {item.pump_count != null && (
          <span className="text-[10px] text-gray-400">{item.pump_count} pump{item.pump_count !== 1 ? 's' : ''}</span>
        )}
        {item.has_scada && (
          <span className="text-[10px] text-cyan-600">SCADA</span>
        )}
      </div>
    </div>
  );
}

function LateralListItem({ item }: { item: SewerLateral }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-xs font-medium text-gray-900 truncate">
          {item.asset_tag || item.address || `LAT-${item.sewer_lateral_id.slice(0, 8)}`}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {statusBadgeSmall(item.status)}
        {item.service_type && (
          <span className="text-[10px] text-gray-500 capitalize">{item.service_type}</span>
        )}
        {item.diameter_inches != null && (
          <span className="text-[10px] text-gray-400">{item.diameter_inches}"</span>
        )}
      </div>
    </div>
  );
}
