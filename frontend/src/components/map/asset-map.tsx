import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Map, { Source, Layer, Popup, Marker, NavigationControl } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';
import { Home } from 'lucide-react';
import type { Sign } from '../../api/types';
import { getSignColor, CONDITION_COLORS, UNRATED_COLOR, INACTIVE_COLOR, INACTIVE_STATUSES } from '../../lib/constants';

interface AssetMapProps {
  signs: Sign[];
  selectedSignId?: string | null;
  onSignClick?: (sign: Sign) => void;
  onVisibleCountChange?: (count: number) => void;
  placementMode?: boolean;
  placementCoords?: { lng: number; lat: number } | null;
  onPlacementClick?: (lng: number, lat: number) => void;
}

const INITIAL_VIEW = {
  longitude: -89.65,
  latitude: 39.78,
  zoom: 13,
};

/**
 * Convert condition_rating + status into a numeric value for cluster aggregation.
 * Lower = worse: 0 = damaged/missing/faded, 1-5 = condition, 6 = unrated active.
 */
function conditionToNum(condition: number | null, status: string): number {
  if (INACTIVE_STATUSES.has(status) || status === 'damaged' || status === 'faded') return 0;
  if (condition && condition >= 1 && condition <= 5) return condition;
  return 6;
}

function calcBounds(signs: Sign[]): [[number, number], [number, number]] | null {
  if (signs.length === 0) return null;
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const s of signs) {
    if (s.longitude < minLng) minLng = s.longitude;
    if (s.longitude > maxLng) maxLng = s.longitude;
    if (s.latitude < minLat) minLat = s.latitude;
    if (s.latitude > maxLat) maxLat = s.latitude;
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

/**
 * Cluster color based on the worst (min) condition number in the cluster.
 * 0 = red (damaged/inactive), 1 = red (critical), 2 = orange, 3 = yellow,
 * 4 = lime, 5 = green, 6 = gray (unrated).
 */
const CLUSTER_COLOR: unknown = [
  'step',
  ['get', 'worst_condition'],
  INACTIVE_COLOR.hex,             // default (0): damaged/inactive
  0.5, CONDITION_COLORS[1].hex,   // 1: critical
  1.5, CONDITION_COLORS[2].hex,   // 2: poor
  2.5, CONDITION_COLORS[3].hex,   // 3: fair
  3.5, CONDITION_COLORS[4].hex,   // 4: good
  4.5, CONDITION_COLORS[5].hex,   // 5: excellent
  5.5, UNRATED_COLOR.hex,         // 6: unrated
];

export function AssetMap({
  signs,
  selectedSignId,
  onSignClick,
  onVisibleCountChange,
  placementMode = false,
  placementCoords,
  onPlacementClick,
}: AssetMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [popupSign, setPopupSign] = useState<Sign | null>(null);
  const hasFittedBounds = useRef(false);

  const geojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: signs.map((s) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [s.longitude, s.latitude],
      },
      properties: {
        sign_id: s.sign_id,
        mutcd_code: s.mutcd_code || '',
        description: s.description || '',
        road_name: s.road_name || '',
        status: s.status,
        condition_rating: s.condition_rating,
        condition_num: conditionToNum(s.condition_rating, s.status),
        color: getSignColor(s.condition_rating, s.status),
        is_selected: s.sign_id === selectedSignId ? 1 : 0,
      },
    })),
  }), [signs, selectedSignId]);

  // Auto-fit bounds on initial load
  useEffect(() => {
    if (hasFittedBounds.current || !mapRef.current || signs.length === 0) return;
    hasFittedBounds.current = true;

    if (signs.length === 1) {
      mapRef.current.flyTo({
        center: [signs[0].longitude, signs[0].latitude],
        zoom: 15,
        duration: 0,
      });
    } else {
      const bounds = calcBounds(signs);
      if (bounds) {
        mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 0 });
      }
    }
  }, [signs]);

  // Fly to selected sign when it changes
  useEffect(() => {
    if (!selectedSignId || !mapRef.current) return;
    const sign = signs.find((s) => s.sign_id === selectedSignId);
    if (sign) {
      mapRef.current.flyTo({
        center: [sign.longitude, sign.latitude],
        zoom: Math.max(mapRef.current.getZoom(), 15),
        duration: 800,
      });
      setPopupSign(sign);
    }
  }, [selectedSignId, signs]);

  const handleZoomToExtent = useCallback(() => {
    if (!mapRef.current) return;
    if (signs.length === 0) {
      mapRef.current.flyTo({ center: [INITIAL_VIEW.longitude, INITIAL_VIEW.latitude], zoom: INITIAL_VIEW.zoom, duration: 800 });
    } else if (signs.length === 1) {
      mapRef.current.flyTo({ center: [signs[0].longitude, signs[0].latitude], zoom: 15, duration: 800 });
    } else {
      const bounds = calcBounds(signs);
      if (bounds) {
        mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 800 });
      }
    }
  }, [signs]);

  // Count visible signs in the current viewport and report to parent
  const updateVisibleCount = useCallback(() => {
    if (!mapRef.current || !onVisibleCountChange) return;
    const bounds = mapRef.current.getBounds();
    if (!bounds) return;
    const count = signs.filter((s) =>
      s.longitude >= bounds.getWest() &&
      s.longitude <= bounds.getEast() &&
      s.latitude >= bounds.getSouth() &&
      s.latitude <= bounds.getNorth()
    ).length;
    onVisibleCountChange(count);
  }, [signs, onVisibleCountChange]);

  // Update count on map move/zoom
  const handleMoveEnd = useCallback(() => {
    updateVisibleCount();
  }, [updateVisibleCount]);

  // Initial count after bounds fit
  useEffect(() => {
    // Small delay to let the map settle after fitBounds
    const timer = setTimeout(updateVisibleCount, 500);
    return () => clearTimeout(timer);
  }, [signs, updateVisibleCount]);

  const handleClick = useCallback((e: MapLayerMouseEvent) => {
    if (placementMode) {
      onPlacementClick?.(e.lngLat.lng, e.lngLat.lat);
      return;
    }
    const feature = e.features?.[0];
    if (!feature) {
      setPopupSign(null);
      return;
    }

    // Cluster click — zoom in to expand
    if (feature.properties?.cluster) {
      const clusterId = feature.properties.cluster_id as number;
      const map = mapRef.current?.getMap();
      const source = map?.getSource('signs');
      if (source && 'getClusterExpansionZoom' in source) {
        (source as { getClusterExpansionZoom: (id: number) => Promise<number> })
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            const geometry = feature.geometry as GeoJSON.Point;
            mapRef.current?.flyTo({
              center: geometry.coordinates as [number, number],
              zoom: zoom + 0.5,
              duration: 500,
            });
          });
      }
      return;
    }

    // Unclustered point — find the sign
    const sign = signs.find((s) => s.sign_id === feature.properties?.sign_id);
    if (sign) {
      setPopupSign(sign);
      onSignClick?.(sign);
    }
  }, [signs, onSignClick, placementMode, onPlacementClick]);

  return (
    <Map
      ref={mapRef}
      initialViewState={INITIAL_VIEW}
      style={{ width: '100%', height: '100%' }}
      mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
      interactiveLayerIds={placementMode ? [] : ['signs-clusters', 'signs-unclustered']}
      onClick={handleClick}
      onMoveEnd={handleMoveEnd}
      cursor={placementMode ? 'crosshair' : 'pointer'}
    >
      <NavigationControl position="top-right" />

      {/* Home / Zoom to Extent button */}
      <div className="absolute top-28 right-2.5 z-10">
        <button
          onClick={handleZoomToExtent}
          title="Zoom to all signs"
          className="w-[29px] h-[29px] bg-white rounded shadow flex items-center justify-center border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <Home size={15} className="text-gray-700" />
        </button>
      </div>

      <Source
        id="signs"
        type="geojson"
        data={geojson}
        cluster={true}
        clusterMaxZoom={14}
        clusterRadius={30}
        clusterProperties={{
          worst_condition: ['min', ['get', 'condition_num']],
        }}
      >
        {/* --- Cluster layers --- */}
        <Layer
          id="signs-clusters"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': CLUSTER_COLOR as string,
            'circle-radius': [
              'step', ['get', 'point_count'],
              12,      // 2-9 points
              10, 15,  // 10-49
              50, 19,  // 50-99
              100, 22, // 100-499
              500, 26, // 500+
            ],
            'circle-opacity': 0.85,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          }}
        />

        {/* Cluster count label */}
        <Layer
          id="signs-cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{
            'text-field': '{point_count_abbreviated}',
            'text-size': 12,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          }}
          paint={{
            'text-color': '#ffffff',
          }}
        />

        {/* --- Unclustered sign circles --- */}
        <Layer
          id="signs-unclustered"
          type="circle"
          filter={['!', ['has', 'point_count']]}
          paint={{
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, ['case', ['==', ['get', 'is_selected'], 1], 7, 4],
              15, ['case', ['==', ['get', 'is_selected'], 1], 12, 8],
              18, ['case', ['==', ['get', 'is_selected'], 1], 16, 12],
            ],
            'circle-color': ['get', 'color'],
            'circle-stroke-width': [
              'case',
              ['==', ['get', 'is_selected'], 1],
              3,
              2,
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

        {/* Selected sign ring */}
        <Layer
          id="signs-selected-ring"
          type="circle"
          filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'is_selected'], 1]]}
          paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 12, 15, 18, 18, 24],
            'circle-color': 'transparent',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#2563eb',
            'circle-stroke-opacity': 0.4,
          }}
        />

        {/* MUTCD code labels (only at street zoom, unclustered) */}
        <Layer
          id="signs-label"
          type="symbol"
          filter={['!', ['has', 'point_count']]}
          minzoom={15}
          layout={{
            'text-field': ['get', 'mutcd_code'],
            'text-size': 11,
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
          }}
          paint={{
            'text-color': '#374151',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1,
          }}
        />
      </Source>

      {popupSign && (
        <Popup
          longitude={popupSign.longitude}
          latitude={popupSign.latitude}
          closeOnClick={false}
          onClose={() => setPopupSign(null)}
          anchor="bottom"
          offset={12}
        >
          <div className="text-sm min-w-48">
            <div className="font-semibold text-gray-900">
              {popupSign.mutcd_code || 'Unknown'} — {popupSign.description || 'No description'}
            </div>
            {popupSign.road_name && (
              <div className="text-gray-600">{popupSign.road_name}</div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: getSignColor(popupSign.condition_rating, popupSign.status) }}
              />
              <span className="text-gray-700">
                {popupSign.condition_rating
                  ? `Condition: ${popupSign.condition_rating}/5`
                  : 'Unrated'}
              </span>
              <span className="text-gray-400">|</span>
              <span className="capitalize text-gray-700">{popupSign.status}</span>
            </div>
          </div>
        </Popup>
      )}

      {/* Placement marker */}
      {placementMode && placementCoords && (
        <Marker
          longitude={placementCoords.lng}
          latitude={placementCoords.lat}
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
      <div className="absolute bottom-8 left-4 bg-white rounded-lg shadow-lg p-3 text-xs">
        <div className="font-semibold text-gray-700 mb-1">Condition Rating</div>
        {[5, 4, 3, 2, 1].map((r) => (
          <div key={r} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: CONDITION_COLORS[r].hex }}
            />
            <span className="text-gray-600">{r} — {CONDITION_COLORS[r].label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: UNRATED_COLOR.hex }}
          />
          <span className="text-gray-600">Unrated</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: INACTIVE_COLOR.hex }}
          />
          <span className="text-gray-600">Inactive</span>
        </div>
      </div>
    </Map>
  );
}
