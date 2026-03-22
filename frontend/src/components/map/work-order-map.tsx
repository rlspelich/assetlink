import { useCallback, useMemo, useRef, useEffect } from 'react';
import Map, { Source, Layer, NavigationControl, Popup, Marker } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';
import { Home } from 'lucide-react';
import type { Sign, WorkOrder } from '../../api/types';
import { getWoPriorityMarkerColor, getWoPriorityOption, getWoStatusOption, formatEnumLabel } from '../../lib/constants';
import { useState } from 'react';

interface WorkOrderMapProps {
  signs: Sign[];
  workOrders: WorkOrder[];
  selectedWOId?: string | null;
  onWOClick?: (wo: WorkOrder) => void;
  onDeselect?: () => void;
  highlightedSignIds?: string[];
  assetSelectionMode?: boolean;
  onSignSelect?: (sign: Sign) => void;
  onLocationSelect?: (lng: number, lat: number) => void;
  selectionCoords?: { lng: number; lat: number } | null;
}

const INITIAL_VIEW = {
  longitude: -89.65,
  latitude: 39.78,
  zoom: 13,
};

const COMPLETED_STATUSES = new Set(['completed', 'cancelled']);

function calcBounds(items: Array<{ longitude: number | null; latitude: number | null }>): [[number, number], [number, number]] | null {
  const valid = items.filter((i) => i.longitude != null && i.latitude != null) as Array<{ longitude: number; latitude: number }>;
  if (valid.length === 0) return null;
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const item of valid) {
    if (item.longitude < minLng) minLng = item.longitude;
    if (item.longitude > maxLng) maxLng = item.longitude;
    if (item.latitude < minLat) minLat = item.latitude;
    if (item.latitude > maxLat) maxLat = item.latitude;
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

export function WorkOrderMap({
  signs,
  workOrders,
  selectedWOId,
  onWOClick,
  onDeselect,
  highlightedSignIds = [],
  assetSelectionMode = false,
  onSignSelect,
  onLocationSelect,
  selectionCoords,
}: WorkOrderMapProps) {
  const mapRef = useRef<MapRef>(null);
  const hasFittedBounds = useRef(false);
  const [popupWO, setPopupWO] = useState<WorkOrder | null>(null);

  const highlightedSet = useMemo(() => new Set(highlightedSignIds), [highlightedSignIds]);

  // Signs base layer GeoJSON (dimmed)
  const signsGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: signs.map((s) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [s.longitude, s.latitude] },
      properties: {
        sign_id: s.sign_id,
        is_highlighted: highlightedSet.has(s.sign_id) ? 1 : 0,
      },
    })),
  }), [signs, highlightedSet]);

  // Work orders GeoJSON (only those with coordinates)
  const woGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: workOrders
      .filter((wo) => wo.longitude != null && wo.latitude != null)
      .map((wo) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [wo.longitude!, wo.latitude!] },
        properties: {
          work_order_id: wo.work_order_id,
          priority: wo.priority,
          status: wo.status,
          color: getWoPriorityMarkerColor(wo.priority),
          is_completed: COMPLETED_STATUSES.has(wo.status) ? 1 : 0,
          is_selected: wo.work_order_id === selectedWOId ? 1 : 0,
          wo_number: wo.work_order_number || '',
          description: wo.description || '',
        },
      })),
  }), [workOrders, selectedWOId]);

  // Auto-fit bounds on initial load
  useEffect(() => {
    if (hasFittedBounds.current || !mapRef.current) return;
    const geoWOs = workOrders.filter((wo) => wo.longitude != null && wo.latitude != null);
    if (geoWOs.length === 0) return;
    hasFittedBounds.current = true;

    if (geoWOs.length === 1) {
      mapRef.current.flyTo({
        center: [geoWOs[0].longitude!, geoWOs[0].latitude!],
        zoom: 15,
        duration: 0,
      });
    } else {
      const bounds = calcBounds(geoWOs);
      if (bounds) {
        mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 0 });
      }
    }
  }, [workOrders]);

  // Fly to selected WO
  useEffect(() => {
    if (!selectedWOId || !mapRef.current) return;
    const wo = workOrders.find((w) => w.work_order_id === selectedWOId);
    if (wo && wo.longitude != null && wo.latitude != null) {
      mapRef.current.flyTo({
        center: [wo.longitude, wo.latitude],
        zoom: Math.max(mapRef.current.getZoom(), 15),
        duration: 800,
      });
      setPopupWO(wo);
    }
  }, [selectedWOId, workOrders]);

  const handleZoomToExtent = useCallback(() => {
    if (!mapRef.current) return;
    const geoWOs = workOrders.filter((wo) => wo.longitude != null && wo.latitude != null);
    if (geoWOs.length === 0) {
      mapRef.current.flyTo({ center: [INITIAL_VIEW.longitude, INITIAL_VIEW.latitude], zoom: INITIAL_VIEW.zoom, duration: 800 });
    } else if (geoWOs.length === 1) {
      mapRef.current.flyTo({ center: [geoWOs[0].longitude!, geoWOs[0].latitude!], zoom: 15, duration: 800 });
    } else {
      const bounds = calcBounds(geoWOs);
      if (bounds) {
        mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 800 });
      }
    }
  }, [workOrders]);

  const handleClick = useCallback((e: MapLayerMouseEvent) => {
    // Asset selection mode: check for sign clicks first, then location clicks
    if (assetSelectionMode) {
      const feature = e.features?.[0];
      if (feature?.properties?.sign_id) {
        const sign = signs.find((s) => s.sign_id === feature.properties?.sign_id);
        if (sign) {
          onSignSelect?.(sign);
          return;
        }
      }
      // No sign feature hit — treat as location click
      onLocationSelect?.(e.lngLat.lng, e.lngLat.lat);
      return;
    }

    const feature = e.features?.[0];
    if (!feature) {
      setPopupWO(null);
      onDeselect?.();
      return;
    }

    const woId = feature.properties?.work_order_id;
    if (woId) {
      const wo = workOrders.find((w) => w.work_order_id === woId);
      if (wo) {
        setPopupWO(wo);
        onWOClick?.(wo);
      }
    }
  }, [workOrders, signs, onWOClick, onDeselect, assetSelectionMode, onSignSelect, onLocationSelect]);

  return (
    <Map
      ref={mapRef}
      initialViewState={INITIAL_VIEW}
      style={{ width: '100%', height: '100%' }}
      mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
      interactiveLayerIds={assetSelectionMode ? ['signs-base-circle', 'wo-markers'] : ['wo-markers']}
      onClick={handleClick}
      cursor={assetSelectionMode && onLocationSelect && !onSignSelect ? 'crosshair' : 'pointer'}
    >
      <NavigationControl position="top-right" />

      {/* Home button */}
      <div className="absolute top-28 right-2.5 z-10">
        <button
          onClick={handleZoomToExtent}
          title="Zoom to all work orders"
          className="w-[29px] h-[29px] bg-white rounded shadow flex items-center justify-center border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <Home size={15} className="text-gray-700" />
        </button>
      </div>

      {/* Signs base layer (dimmed normally, full color in selection mode) */}
      <Source id="signs-base" type="geojson" data={signsGeojson}>
        <Layer
          id="signs-base-circle"
          type="circle"
          paint={{
            'circle-radius': assetSelectionMode
              ? ['interpolate', ['linear'], ['zoom'], 10, 4, 15, 7, 18, 10]
              : [
                  'case',
                  ['==', ['get', 'is_highlighted'], 1],
                  6,
                  3.5,
                ],
            'circle-color': assetSelectionMode
              ? '#3b82f6'
              : [
                  'case',
                  ['==', ['get', 'is_highlighted'], 1],
                  '#3b82f6',
                  '#9ca3af',
                ],
            'circle-opacity': assetSelectionMode
              ? 0.85
              : [
                  'case',
                  ['==', ['get', 'is_highlighted'], 1],
                  0.8,
                  0.4,
                ],
            'circle-stroke-width': assetSelectionMode
              ? 1.5
              : [
                  'case',
                  ['==', ['get', 'is_highlighted'], 1],
                  1.5,
                  0,
                ],
            'circle-stroke-color': '#ffffff',
          }}
        />
      </Source>

      {/* Work order markers */}
      <Source id="work-orders" type="geojson" data={woGeojson}>
        {/* Main WO circles */}
        <Layer
          id="wo-markers"
          type="circle"
          paint={{
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, ['case', ['==', ['get', 'is_completed'], 1], 4, 6],
              15, ['case', ['==', ['get', 'is_completed'], 1], 5, 8],
              18, ['case', ['==', ['get', 'is_completed'], 1], 7, 11],
            ],
            'circle-color': ['get', 'color'],
            'circle-stroke-width': [
              'case',
              ['==', ['get', 'is_selected'], 1],
              3,
              1.5,
            ],
            'circle-stroke-color': [
              'case',
              ['==', ['get', 'is_selected'], 1],
              '#2563eb',
              '#ffffff',
            ],
            'circle-opacity': [
              'case',
              ['==', ['get', 'is_completed'], 1],
              0.6,
              0.9,
            ],
          }}
        />
        {/* Selected WO ring */}
        <Layer
          id="wo-selected-ring"
          type="circle"
          filter={['==', ['get', 'is_selected'], 1]}
          paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 10, 15, 14, 18, 18],
            'circle-color': 'transparent',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#2563eb',
            'circle-stroke-opacity': 0.4,
          }}
        />
        {/* WO number labels */}
        <Layer
          id="wo-label"
          type="symbol"
          minzoom={14}
          layout={{
            'text-field': ['get', 'wo_number'],
            'text-size': 10,
            'text-offset': [0, 1.6],
            'text-anchor': 'top',
          }}
          paint={{
            'text-color': '#374151',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1,
          }}
        />
      </Source>

      {/* Popup for selected WO */}
      {popupWO && popupWO.longitude != null && popupWO.latitude != null && (
        <Popup
          longitude={popupWO.longitude}
          latitude={popupWO.latitude}
          closeOnClick={false}
          onClose={() => setPopupWO(null)}
          anchor="bottom"
          offset={12}
        >
          <div className="text-sm min-w-48">
            <div className="font-semibold text-gray-900">
              {popupWO.work_order_number || 'Work Order'}
            </div>
            <div className="text-gray-600 text-xs truncate">
              {popupWO.description || 'No description'}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: getWoPriorityMarkerColor(popupWO.priority) }}
              />
              <span className="text-xs text-gray-700 capitalize">{popupWO.priority}</span>
              <span className="text-gray-400">|</span>
              <span className="text-xs text-gray-700 capitalize">{formatEnumLabel(popupWO.status)}</span>
            </div>
          </div>
        </Popup>
      )}

      {/* Selection mode marker */}
      {assetSelectionMode && selectionCoords && (
        <Marker
          longitude={selectionCoords.lng}
          latitude={selectionCoords.lat}
          anchor="bottom"
        >
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
            <div className="w-0.5 h-3 bg-blue-600" />
          </div>
        </Marker>
      )}

      {/* Legend — bottom-left */}
      {!assetSelectionMode && (
        <div className="absolute bottom-8 left-4 bg-white rounded-lg shadow-lg p-3 text-xs">
          <div className="font-semibold text-gray-700 mb-1">Priority</div>
          {[
            { label: 'Emergency', color: '#ef4444' },
            { label: 'Urgent', color: '#f97316' },
            { label: 'Routine', color: '#3b82f6' },
            { label: 'Planned', color: '#6b7280' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-gray-600">{item.label}</span>
            </div>
          ))}
          <div className="border-t border-gray-100 mt-1.5 pt-1.5">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300 opacity-50" />
              <span className="text-gray-400">Signs (base layer)</span>
            </div>
          </div>
        </div>
      )}
    </Map>
  );
}
