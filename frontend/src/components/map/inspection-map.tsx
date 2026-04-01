import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import Map, { Source, Layer, NavigationControl, Popup, Marker } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';
import { Home } from 'lucide-react';
import type { Sign, Inspection } from '../../api/types';
import { getInspectionMarkerColor, getInspectionTypeOption, formatEnumLabel } from '../../lib/constants';

interface InspectionMapProps {
  signs: Sign[];
  inspections: Inspection[];
  selectedInspId?: string | null;
  onInspClick?: (insp: Inspection) => void;
  onDeselect?: () => void;
  highlightedSignIds?: string[];
  assetSelectionMode?: boolean;
  onSignSelect?: (sign: Sign) => void;
  onLocationSelect?: (lng: number, lat: number) => void;
  selectionCoords?: { lng: number; lat: number } | null;
  flyToCoords?: { lng: number; lat: number } | null;
}

const INITIAL_VIEW = {
  longitude: -89.644,
  latitude: 39.799,
  zoom: 14,
};

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

export function InspectionMap({
  signs,
  inspections,
  selectedInspId,
  onInspClick,
  onDeselect,
  highlightedSignIds = [],
  assetSelectionMode = false,
  onSignSelect,
  onLocationSelect,
  selectionCoords,
  flyToCoords,
}: InspectionMapProps) {
  const mapRef = useRef<MapRef>(null);
  const hasFittedBounds = useRef(false);

  // Fly to coordinates from address search
  useEffect(() => {
    if (!flyToCoords || !mapRef.current) return;
    mapRef.current.flyTo({ center: [flyToCoords.lng, flyToCoords.lat], zoom: 17, duration: 1200 });
  }, [flyToCoords]);
  const [popupInsp, setPopupInsp] = useState<Inspection | null>(null);

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

  // Inspections GeoJSON (only those with coordinates)
  const inspGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: inspections
      .filter((insp) => insp.longitude != null && insp.latitude != null)
      .map((insp) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [insp.longitude!, insp.latitude!] },
        properties: {
          inspection_id: insp.inspection_id,
          color: getInspectionMarkerColor(
            insp.follow_up_required,
            insp.follow_up_work_order_id,
            insp.status,
          ),
          is_selected: insp.inspection_id === selectedInspId ? 1 : 0,
          insp_number: insp.inspection_number || '',
          status: insp.status,
          inspection_type: insp.inspection_type,
        },
      })),
  }), [inspections, selectedInspId]);

  // Auto-fit bounds on initial load
  useEffect(() => {
    if (hasFittedBounds.current || !mapRef.current) return;
    const geoInsps = inspections.filter((i) => i.longitude != null && i.latitude != null);
    if (geoInsps.length === 0) return;
    hasFittedBounds.current = true;

    if (geoInsps.length === 1) {
      mapRef.current.flyTo({
        center: [geoInsps[0].longitude!, geoInsps[0].latitude!],
        zoom: 15,
        duration: 800,
      });
    } else {
      const bounds = calcBounds(geoInsps);
      if (bounds) {
        mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 800 });
      }
    }
  }, [inspections]);

  // When entering asset selection mode, zoom in so signs are clickable
  useEffect(() => {
    if (!assetSelectionMode || !mapRef.current) return;
    const currentZoom = mapRef.current.getZoom();
    if (currentZoom < 15) {
      mapRef.current.flyTo({
        zoom: 15,
        duration: 600,
      });
    }
  }, [assetSelectionMode]);

  // Fly to selected inspection
  useEffect(() => {
    if (!selectedInspId || !mapRef.current) return;
    const insp = inspections.find((i) => i.inspection_id === selectedInspId);
    if (insp && insp.longitude != null && insp.latitude != null) {
      mapRef.current.flyTo({
        center: [insp.longitude, insp.latitude],
        zoom: Math.max(mapRef.current.getZoom(), 15),
        duration: 800,
      });
      setPopupInsp(insp);
    }
  }, [selectedInspId, inspections]);

  const handleZoomToExtent = useCallback(() => {
    if (!mapRef.current) return;
    const geoInsps = inspections.filter((i) => i.longitude != null && i.latitude != null);
    if (geoInsps.length === 0) {
      mapRef.current.flyTo({ center: [INITIAL_VIEW.longitude, INITIAL_VIEW.latitude], zoom: INITIAL_VIEW.zoom, duration: 800 });
    } else if (geoInsps.length === 1) {
      mapRef.current.flyTo({ center: [geoInsps[0].longitude!, geoInsps[0].latitude!], zoom: 15, duration: 800 });
    } else {
      const bounds = calcBounds(geoInsps);
      if (bounds) {
        mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 800 });
      }
    }
  }, [inspections]);

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
      setPopupInsp(null);
      onDeselect?.();
      return;
    }

    const inspId = feature.properties?.inspection_id;
    if (inspId) {
      const insp = inspections.find((i) => i.inspection_id === inspId);
      if (insp) {
        setPopupInsp(insp);
        onInspClick?.(insp);
      }
    }
  }, [inspections, signs, onInspClick, onDeselect, assetSelectionMode, onSignSelect, onLocationSelect]);

  return (
    <Map
      ref={mapRef}
      initialViewState={INITIAL_VIEW}
      style={{ width: '100%', height: '100%' }}
      mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
      interactiveLayerIds={assetSelectionMode ? ['signs-base-circle', 'insp-markers'] : ['insp-markers']}
      onClick={handleClick}
      cursor={assetSelectionMode && onLocationSelect && !onSignSelect ? 'crosshair' : 'pointer'}
    >
      <NavigationControl position="top-right" />

      {/* Home button */}
      <div className="absolute top-28 right-2.5 z-10">
        <button
          onClick={handleZoomToExtent}
          title="Zoom to all inspections"
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
              ? ['interpolate', ['linear'], ['zoom'], 10, 3.5, 15, 7, 18, 10]
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

      {/* Inspection markers */}
      <Source id="inspections" type="geojson" data={inspGeojson}>
        <Layer
          id="insp-markers"
          type="circle"
          paint={{
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, 5,
              15, 8,
              18, 11,
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
            'circle-opacity': 0.9,
          }}
        />
        {/* Selected inspection ring */}
        <Layer
          id="insp-selected-ring"
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
        {/* Inspection number labels */}
        <Layer
          id="insp-label"
          type="symbol"
          minzoom={14}
          layout={{
            'text-field': ['get', 'insp_number'],
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

      {/* Popup */}
      {popupInsp && popupInsp.longitude != null && popupInsp.latitude != null && (
        <Popup
          longitude={popupInsp.longitude}
          latitude={popupInsp.latitude}
          closeOnClick={false}
          onClose={() => setPopupInsp(null)}
          anchor="bottom"
          offset={12}
        >
          <div className="text-sm min-w-48">
            <div className="font-semibold text-gray-900">
              {popupInsp.inspection_number || 'Inspection'}
            </div>
            <div className="text-gray-600 text-xs">
              {getInspectionTypeOption(popupInsp.inspection_type).label}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{
                  backgroundColor: getInspectionMarkerColor(
                    popupInsp.follow_up_required,
                    popupInsp.follow_up_work_order_id,
                    popupInsp.status,
                  ),
                }}
              />
              <span className="text-xs text-gray-700 capitalize">{formatEnumLabel(popupInsp.status)}</span>
              {popupInsp.follow_up_required && (
                <>
                  <span className="text-gray-400">|</span>
                  <span className="text-xs text-red-600 font-medium">Follow-up</span>
                </>
              )}
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
          <div className="font-semibold text-gray-700 mb-1">Inspection Status</div>
          {[
            { label: 'Follow-up needed', color: '#ef4444' },
            { label: 'Follow-up (WO linked)', color: '#3b82f6' },
            { label: 'Completed', color: '#22c55e' },
            { label: 'Open / In Progress', color: '#eab308' },
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
