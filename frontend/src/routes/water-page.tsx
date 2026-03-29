import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Search } from 'lucide-react';
import {
  useWaterMainsList,
  useWaterValvesList,
  useHydrantsList,
  useWaterServicesList,
  useWaterFittingsList,
  usePressureZonesList,
  useCreateWaterMain,
  useUpdateWaterMain,
  useDeleteWaterMain,
  useCreateWaterValve,
  useUpdateWaterValve,
  useDeleteWaterValve,
  useCreateHydrant,
  useUpdateHydrant,
  useDeleteHydrant,
  useCreateWaterService,
  useUpdateWaterService,
  useDeleteWaterService,
  useCreateWaterFitting,
  useUpdateWaterFitting,
  useDeleteWaterFitting,
  useCreatePressureZone,
  useUpdatePressureZone,
  useDeletePressureZone,
} from '../hooks/use-water';
import { WaterMap } from '../components/water/water-map';
import { WaterDetailPanel } from '../components/water/water-detail-panel';
import { WaterFormPanel } from '../components/water/water-form-panel';
import type { WaterMain, WaterValve, FireHydrant, WaterService, WaterFitting, PressureZone } from '../api/types';
import {
  CONDITION_COLORS,
  UNRATED_COLOR,
  INACTIVE_COLOR,
  INACTIVE_STATUSES,
  WATER_STATUS_OPTIONS,
  HYDRANT_FLOW_COLORS,
} from '../lib/constants';

type WaterTab = 'mains' | 'valves' | 'hydrants' | 'services' | 'fittings' | 'zones';
type PageMode = 'view' | 'add-placing' | 'add-form' | 'edit';

const TAB_CONFIG: { key: WaterTab; label: string }[] = [
  { key: 'mains', label: 'Mains' },
  { key: 'valves', label: 'Valves' },
  { key: 'hydrants', label: 'Hydrants' },
  { key: 'services', label: 'Services' },
  { key: 'fittings', label: 'Fittings' },
  { key: 'zones', label: 'Zones' },
];

function isPointTab(tab: WaterTab): boolean {
  return tab !== 'mains';
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

export function WaterPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<WaterTab>('mains');
  const [selectedAsset, setSelectedAsset] = useState<{ type: string; id: string; data: unknown } | null>(null);
  const [mode, setMode] = useState<PageMode>('view');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [placementCoords, setPlacementCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [drawnCoordinates, setDrawnCoordinates] = useState<number[][] | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch all asset types
  const { data: mainsData, isLoading: mainsLoading } = useWaterMainsList({
    page_size: 1000,
    status: statusFilter || undefined,
  });
  const { data: valvesData, isLoading: valvesLoading } = useWaterValvesList({
    page_size: 1000,
    status: statusFilter || undefined,
  });
  const { data: hydrantsData, isLoading: hydrantsLoading } = useHydrantsList({
    page_size: 1000,
    status: statusFilter || undefined,
  });
  const { data: servicesData, isLoading: servicesLoading } = useWaterServicesList({
    page_size: 1000,
    status: statusFilter || undefined,
  });
  const { data: fittingsData, isLoading: fittingsLoading } = useWaterFittingsList({
    page_size: 1000,
    status: statusFilter || undefined,
  });
  const { data: zonesData, isLoading: zonesLoading } = usePressureZonesList({
    page_size: 1000,
  });

  // Mutations
  const createWaterMain = useCreateWaterMain();
  const updateWaterMain = useUpdateWaterMain();
  const deleteWaterMain = useDeleteWaterMain();
  const createWaterValve = useCreateWaterValve();
  const updateWaterValve = useUpdateWaterValve();
  const deleteWaterValve = useDeleteWaterValve();
  const createHydrant = useCreateHydrant();
  const updateHydrant = useUpdateHydrant();
  const deleteHydrant = useDeleteHydrant();
  const createWaterService = useCreateWaterService();
  const updateWaterService = useUpdateWaterService();
  const deleteWaterService = useDeleteWaterService();
  const createWaterFitting = useCreateWaterFitting();
  const updateWaterFitting = useUpdateWaterFitting();
  const deleteWaterFitting = useDeleteWaterFitting();
  const createPressureZone = useCreatePressureZone();
  const updatePressureZone = useUpdatePressureZone();
  const deletePressureZone = useDeletePressureZone();

  // Extract arrays
  const waterMains = mainsData?.water_mains ?? [];
  const waterValves = valvesData?.water_valves ?? [];
  const hydrants = hydrantsData?.hydrants ?? [];
  const waterServices = servicesData?.water_services ?? [];
  const waterFittings = fittingsData?.water_fittings ?? [];
  const pressureZones = zonesData?.pressure_zones ?? [];

  // Filtered list for active tab
  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const matchText = (texts: (string | null | undefined)[]) => {
      if (!q) return true;
      return texts.some((t) => t && t.toLowerCase().includes(q));
    };

    switch (activeTab) {
      case 'mains':
        return waterMains.filter((m) => matchText([m.asset_tag, m.description, m.material_code]));
      case 'valves':
        return waterValves.filter((v) => matchText([v.asset_tag, v.description, v.valve_type_code, v.manufacturer]));
      case 'hydrants':
        return hydrants.filter((h) => matchText([h.asset_tag, h.description, h.make, h.model]));
      case 'services':
        return waterServices.filter((s) => matchText([s.asset_tag, s.address, s.account_number, s.meter_number]));
      case 'fittings':
        return waterFittings.filter((f) => matchText([f.asset_tag, f.fitting_type]));
      case 'zones':
        return pressureZones.filter((z) => matchText([z.zone_name, z.zone_number, z.description]));
      default:
        return [];
    }
  }, [activeTab, waterMains, waterValves, hydrants, waterServices, waterFittings, pressureZones, searchQuery]);

  const isLoading = activeTab === 'mains' ? mainsLoading
    : activeTab === 'valves' ? valvesLoading
    : activeTab === 'hydrants' ? hydrantsLoading
    : activeTab === 'services' ? servicesLoading
    : activeTab === 'fittings' ? fittingsLoading
    : zonesLoading;

  const totalCount = activeTab === 'mains' ? (mainsData?.total ?? 0)
    : activeTab === 'valves' ? (valvesData?.total ?? 0)
    : activeTab === 'hydrants' ? (hydrantsData?.total ?? 0)
    : activeTab === 'services' ? (servicesData?.total ?? 0)
    : activeTab === 'fittings' ? (fittingsData?.total ?? 0)
    : (zonesData?.total ?? 0);

  // Asset ID accessor per type
  function getAssetId(item: unknown, tab: WaterTab): string {
    switch (tab) {
      case 'mains': return (item as WaterMain).water_main_id;
      case 'valves': return (item as WaterValve).water_valve_id;
      case 'hydrants': return (item as FireHydrant).hydrant_id;
      case 'services': return (item as WaterService).water_service_id;
      case 'fittings': return (item as WaterFitting).water_fitting_id;
      case 'zones': return (item as PressureZone).pressure_zone_id;
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
      case 'mains': data = waterMains.find((m) => m.water_main_id === id); break;
      case 'valves': data = waterValves.find((v) => v.water_valve_id === id); break;
      case 'hydrants': data = hydrants.find((h) => h.hydrant_id === id); break;
      case 'services': data = waterServices.find((s) => s.water_service_id === id); break;
      case 'fittings': data = waterFittings.find((f) => f.water_fitting_id === id); break;
      case 'zones': data = pressureZones.find((z) => z.pressure_zone_id === id); break;
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
    // Zones go straight to form (no map placement needed)
    if (activeTab === 'zones') {
      setMode('add-form');
    } else {
      setMode('add-placing');
    }
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
          case 'mains':
            await createWaterMain.mutateAsync(formData as unknown as Parameters<typeof createWaterMain.mutateAsync>[0]);
            break;
          case 'valves':
            await createWaterValve.mutateAsync(formData as unknown as Parameters<typeof createWaterValve.mutateAsync>[0]);
            break;
          case 'hydrants':
            await createHydrant.mutateAsync(formData as unknown as Parameters<typeof createHydrant.mutateAsync>[0]);
            break;
          case 'services':
            await createWaterService.mutateAsync(formData as unknown as Parameters<typeof createWaterService.mutateAsync>[0]);
            break;
          case 'fittings':
            await createWaterFitting.mutateAsync(formData as unknown as Parameters<typeof createWaterFitting.mutateAsync>[0]);
            break;
          case 'zones':
            await createPressureZone.mutateAsync(formData as unknown as Parameters<typeof createPressureZone.mutateAsync>[0]);
            break;
        }
      } else if (mode === 'edit' && selectedAsset) {
        let updated: unknown;
        switch (selectedAsset.type) {
          case 'mains':
            updated = await updateWaterMain.mutateAsync({ id: selectedAsset.id, data: formData as unknown as Parameters<typeof updateWaterMain.mutateAsync>[0]['data'] });
            break;
          case 'valves':
            updated = await updateWaterValve.mutateAsync({ id: selectedAsset.id, data: formData as unknown as Parameters<typeof updateWaterValve.mutateAsync>[0]['data'] });
            break;
          case 'hydrants':
            updated = await updateHydrant.mutateAsync({ id: selectedAsset.id, data: formData as unknown as Parameters<typeof updateHydrant.mutateAsync>[0]['data'] });
            break;
          case 'services':
            updated = await updateWaterService.mutateAsync({ id: selectedAsset.id, data: formData as unknown as Parameters<typeof updateWaterService.mutateAsync>[0]['data'] });
            break;
          case 'fittings':
            updated = await updateWaterFitting.mutateAsync({ id: selectedAsset.id, data: formData as unknown as Parameters<typeof updateWaterFitting.mutateAsync>[0]['data'] });
            break;
          case 'zones':
            updated = await updatePressureZone.mutateAsync({ id: selectedAsset.id, data: formData as unknown as Parameters<typeof updatePressureZone.mutateAsync>[0]['data'] });
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
        case 'mains': await deleteWaterMain.mutateAsync(selectedAsset.id); break;
        case 'valves': await deleteWaterValve.mutateAsync(selectedAsset.id); break;
        case 'hydrants': await deleteHydrant.mutateAsync(selectedAsset.id); break;
        case 'services': await deleteWaterService.mutateAsync(selectedAsset.id); break;
        case 'fittings': await deleteWaterFitting.mutateAsync(selectedAsset.id); break;
        case 'zones': await deletePressureZone.mutateAsync(selectedAsset.id); break;
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
      case 'mains': {
        const m = asset.data as WaterMain;
        return m.asset_tag || `Water Main ${m.water_main_id.slice(0, 8)}`;
      }
      case 'valves': {
        const v = asset.data as WaterValve;
        return v.asset_tag || `Valve ${v.water_valve_id.slice(0, 8)}`;
      }
      case 'hydrants': {
        const h = asset.data as FireHydrant;
        return h.asset_tag || `Hydrant ${h.hydrant_id.slice(0, 8)}`;
      }
      case 'services': {
        const s = asset.data as WaterService;
        return s.asset_tag || s.address || `Service ${s.water_service_id.slice(0, 8)}`;
      }
      case 'fittings': {
        const f = asset.data as WaterFitting;
        return f.asset_tag || `Fitting ${f.water_fitting_id.slice(0, 8)}`;
      }
      case 'zones': {
        const z = asset.data as PressureZone;
        return z.zone_name;
      }
      default: return 'Unknown';
    }
  }

  const isPlacementMode = mode === 'add-placing';
  const showForm = mode === 'add-form' || mode === 'edit';
  const showDetail = mode === 'view' && selectedAsset !== null;

  const isSubmitting = createWaterMain.isPending || updateWaterMain.isPending
    || createWaterValve.isPending || updateWaterValve.isPending
    || createHydrant.isPending || updateHydrant.isPending
    || createWaterService.isPending || updateWaterService.isPending
    || createWaterFitting.isPending || updateWaterFitting.isPending
    || createPressureZone.isPending || updatePressureZone.isPending;

  const isDeleting = deleteWaterMain.isPending || deleteWaterValve.isPending
    || deleteHydrant.isPending || deleteWaterService.isPending
    || deleteWaterFitting.isPending || deletePressureZone.isPending;

  const addLabel = activeTab === 'mains' ? 'Add Main'
    : activeTab === 'valves' ? 'Add Valve'
    : activeTab === 'hydrants' ? 'Add Hydrant'
    : activeTab === 'services' ? 'Add Service'
    : activeTab === 'fittings' ? 'Add Fitting'
    : 'Add Zone';

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
            {waterMains.length} mains &middot; {waterValves.length} valves &middot; {hydrants.length} hydrants &middot; {waterServices.length} svc &middot; {waterFittings.length} fit &middot; {pressureZones.length} zones
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
          {activeTab !== 'zones' && (
            <div className="flex gap-1.5">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setSelectedAsset(null); }}
                className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                {WATER_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Count */}
        <div className="px-3 py-1.5 text-[10px] text-gray-400 border-b border-gray-50">
          {filteredList.length} of {totalCount} {activeTab}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-xs text-gray-400">Loading...</div>
          ) : filteredList.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-xs text-gray-400">
              No {activeTab} found
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
                  {activeTab === 'mains' && <WaterMainListItem item={item as WaterMain} />}
                  {activeTab === 'valves' && <WaterValveListItem item={item as WaterValve} />}
                  {activeTab === 'hydrants' && <HydrantListItem item={item as FireHydrant} />}
                  {activeTab === 'services' && <WaterServiceListItem item={item as WaterService} />}
                  {activeTab === 'fittings' && <WaterFittingListItem item={item as WaterFitting} />}
                  {activeTab === 'zones' && <PressureZoneListItem item={item as PressureZone} />}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Center: Map */}
      <div className="flex-1 relative">
        <WaterMap
          waterMains={waterMains}
          waterValves={waterValves}
          hydrants={hydrants}
          waterServices={waterServices}
          waterFittings={waterFittings}
          pressureZones={pressureZones}
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
        <WaterDetailPanel
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
        <WaterFormPanel
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

function WaterMainListItem({ item }: { item: WaterMain }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-xs font-medium text-gray-900 truncate">
          {item.asset_tag || `WM-${item.water_main_id.slice(0, 8)}`}
        </span>
        {conditionBadgeSmall(item.condition_rating, item.status)}
      </div>
      <div className="flex items-center gap-1.5">
        {statusBadgeSmall(item.status)}
        {item.diameter_inches != null && (
          <span className="text-[10px] text-gray-400">{item.diameter_inches}"</span>
        )}
        {item.length_feet != null && (
          <span className="text-[10px] text-gray-400">{item.length_feet} ft</span>
        )}
        {item.material_code && (
          <span className="text-[10px] text-gray-500 uppercase">{item.material_code}</span>
        )}
      </div>
    </div>
  );
}

function WaterValveListItem({ item }: { item: WaterValve }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-xs font-medium text-gray-900 truncate">
          {item.asset_tag || `VLV-${item.water_valve_id.slice(0, 8)}`}
        </span>
        {conditionBadgeSmall(item.condition_rating, item.status)}
      </div>
      <div className="flex items-center gap-1.5">
        {statusBadgeSmall(item.status)}
        {item.valve_type_code && (
          <span className="text-[10px] text-gray-500 capitalize">{item.valve_type_code}</span>
        )}
        {item.size_inches != null && (
          <span className="text-[10px] text-gray-400">{item.size_inches}"</span>
        )}
        {item.is_critical && (
          <span className="text-[10px] text-red-600 font-medium">CRIT</span>
        )}
      </div>
    </div>
  );
}

function HydrantListItem({ item }: { item: FireHydrant }) {
  const flowColor = item.flow_class_color ? HYDRANT_FLOW_COLORS[item.flow_class_color] : null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-xs font-medium text-gray-900 truncate">
          {item.asset_tag || `HYD-${item.hydrant_id.slice(0, 8)}`}
        </span>
        {conditionBadgeSmall(item.condition_rating, item.status)}
      </div>
      <div className="flex items-center gap-1.5">
        {statusBadgeSmall(item.status)}
        {flowColor && (
          <span className="inline-flex items-center gap-0.5 text-[10px]">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: flowColor.hex }} />
            <span className="text-gray-500 capitalize">{item.flow_class_color}</span>
          </span>
        )}
        {item.flow_gpm != null && (
          <span className="text-[10px] text-gray-400">{item.flow_gpm} GPM</span>
        )}
      </div>
    </div>
  );
}

function WaterServiceListItem({ item }: { item: WaterService }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-xs font-medium text-gray-900 truncate">
          {item.asset_tag || item.address || `SVC-${item.water_service_id.slice(0, 8)}`}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {statusBadgeSmall(item.status)}
        <span className="text-[10px] text-gray-500 capitalize">{item.service_type}</span>
        {item.meter_number && (
          <span className="text-[10px] text-gray-400">#{item.meter_number}</span>
        )}
      </div>
    </div>
  );
}

function WaterFittingListItem({ item }: { item: WaterFitting }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-xs font-medium text-gray-900 truncate">
          {item.asset_tag || `FIT-${item.water_fitting_id.slice(0, 8)}`}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {statusBadgeSmall(item.status)}
        <span className="text-[10px] text-gray-500 capitalize">{item.fitting_type}</span>
        {item.primary_size_inches != null && (
          <span className="text-[10px] text-gray-400">{item.primary_size_inches}"</span>
        )}
      </div>
    </div>
  );
}

function PressureZoneListItem({ item }: { item: PressureZone }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-xs font-medium text-gray-900 truncate">
          {item.zone_name}
        </span>
        {item.zone_number && (
          <span className="text-[10px] text-gray-400">#{item.zone_number}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {item.target_pressure_min_psi != null && item.target_pressure_max_psi != null && (
          <span className="text-[10px] text-gray-500">{item.target_pressure_min_psi}-{item.target_pressure_max_psi} PSI</span>
        )}
      </div>
    </div>
  );
}
