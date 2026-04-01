import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';
import { Home } from 'lucide-react';
import type { Manhole, SewerMain, ForceMain, LiftStation, SewerLateral } from '../../api/types';
import {
  getSewerAssetColor,
  getSewerSystemColor,
  CONDITION_COLORS,
} from '../../lib/constants';

interface SewerMapProps {
  manholes: Manhole[];
  sewerMains: SewerMain[];
  forceMains: ForceMain[];
  liftStations: LiftStation[];
  laterals: SewerLateral[];
  selectedAsset: { type: string; id: string } | null;
  onSelectAsset: (type: string, id: string) => void;
  mode: string;
  activeTab: string;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  onLineDrawn?: (coordinates: number[][]) => void;
  flyToCoords?: { lng: number; lat: number } | null;
}

const INITIAL_VIEW = {
  longitude: -89.644,
  latitude: 39.799,
  zoom: 14,
};

export function SewerMap({
  manholes,
  sewerMains,
  forceMains,
  liftStations,
  laterals,
  selectedAsset,
  onSelectAsset,
  mode,
  activeTab,
  onMapClick,
  onLineDrawn,
  flyToCoords,
}: SewerMapProps) {
  const mapRef = useRef<MapRef>(null);
  const hasFittedBounds = useRef(false);

  // Fly to coordinates from address search
  useEffect(() => {
    if (!flyToCoords || !mapRef.current) return;
    mapRef.current.flyTo({ center: [flyToCoords.lng, flyToCoords.lat], zoom: 17, duration: 1200 });
  }, [flyToCoords]);
  const [lineDrawPoints, setLineDrawPoints] = useState<number[][]>([]);

  const isPlacementMode = mode === 'add-placing';
  const isLineMode = isPlacementMode && (activeTab === 'mains' || activeTab === 'force_mains' || activeTab === 'laterals');

  // --- GeoJSON Sources ---

  const manholeGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: manholes.map((m) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [m.longitude, m.latitude] },
      properties: {
        id: m.manhole_id,
        asset_type: 'manholes',
        label: m.asset_tag || `MH-${m.manhole_id.slice(0, 8)}`,
        status: m.status,
        condition_rating: m.condition_rating,
        color: getSewerAssetColor(m.condition_rating, m.status),
        is_selected: selectedAsset?.type === 'manholes' && selectedAsset.id === m.manhole_id ? 1 : 0,
      },
    })),
  }), [manholes, selectedAsset]);

  const sewerMainGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: sewerMains
      .filter((m) => m.coordinates && m.coordinates.length >= 2)
      .map((m) => ({
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: m.coordinates! },
        properties: {
          id: m.sewer_main_id,
          asset_type: 'mains',
          label: m.asset_tag || `SM-${m.sewer_main_id.slice(0, 8)}`,
          status: m.status,
          condition_rating: m.condition_rating,
          system_type: m.system_type,
          color: getSewerSystemColor(m.system_type),
          is_selected: selectedAsset?.type === 'mains' && selectedAsset.id === m.sewer_main_id ? 1 : 0,
        },
      })),
  }), [sewerMains, selectedAsset]);

  const forceMainGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: forceMains
      .filter((m) => m.coordinates && m.coordinates.length >= 2)
      .map((m) => ({
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: m.coordinates! },
        properties: {
          id: m.force_main_id,
          asset_type: 'force_mains',
          label: m.asset_tag || `FM-${m.force_main_id.slice(0, 8)}`,
          status: m.status,
          condition_rating: m.condition_rating,
          is_selected: selectedAsset?.type === 'force_mains' && selectedAsset.id === m.force_main_id ? 1 : 0,
        },
      })),
  }), [forceMains, selectedAsset]);

  const liftStationGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: liftStations.map((ls) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [ls.longitude, ls.latitude] },
      properties: {
        id: ls.lift_station_id,
        asset_type: 'lift_stations',
        label: ls.station_name || ls.asset_tag || `LS-${ls.lift_station_id.slice(0, 8)}`,
        status: ls.status,
        condition_rating: ls.condition_rating,
        color: getSewerAssetColor(ls.condition_rating, ls.status),
        is_selected: selectedAsset?.type === 'lift_stations' && selectedAsset.id === ls.lift_station_id ? 1 : 0,
      },
    })),
  }), [liftStations, selectedAsset]);

  const lateralGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: laterals
      .filter((l) => l.longitude != null && l.latitude != null)
      .map((l) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [l.longitude!, l.latitude!] },
        properties: {
          id: l.sewer_lateral_id,
          asset_type: 'laterals',
          label: l.asset_tag || l.address || `LAT-${l.sewer_lateral_id.slice(0, 8)}`,
          status: l.status,
          color: '#6b7280',
          is_selected: selectedAsset?.type === 'laterals' && selectedAsset.id === l.sewer_lateral_id ? 1 : 0,
        },
      })),
  }), [laterals, selectedAsset]);

  // Line drawing preview
  const lineDrawGeojson = useMemo(() => {
    if (lineDrawPoints.length < 2) return null;
    return {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: lineDrawPoints },
        properties: {},
      }],
    };
  }, [lineDrawPoints]);

  const lineDrawPointsGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: lineDrawPoints.map((coord, i) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: coord },
      properties: { index: i },
    })),
  }), [lineDrawPoints]);

  // Auto-fit bounds on initial load
  useEffect(() => {
    if (hasFittedBounds.current || !mapRef.current) return;
    const allPoints: [number, number][] = [];
    manholes.forEach((m) => allPoints.push([m.longitude, m.latitude]));
    liftStations.forEach((ls) => allPoints.push([ls.longitude, ls.latitude]));
    sewerMains.forEach((m) => m.coordinates?.forEach((c) => allPoints.push(c as [number, number])));
    forceMains.forEach((m) => m.coordinates?.forEach((c) => allPoints.push(c as [number, number])));
    laterals.forEach((l) => { if (l.longitude != null && l.latitude != null) allPoints.push([l.longitude, l.latitude]); });

    if (allPoints.length === 0) return;
    hasFittedBounds.current = true;

    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of allPoints) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    if (allPoints.length === 1) {
      mapRef.current.flyTo({ center: allPoints[0], zoom: 15, duration: 800 });
    } else {
      mapRef.current.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, maxZoom: 16, duration: 800 });
    }
  }, [manholes, sewerMains, forceMains, liftStations, laterals]);

  // Fly to selected asset
  useEffect(() => {
    if (!selectedAsset || !mapRef.current) return;
    let center: [number, number] | null = null;

    switch (selectedAsset.type) {
      case 'manholes': {
        const m = manholes.find((x) => x.manhole_id === selectedAsset.id);
        if (m) center = [m.longitude, m.latitude];
        break;
      }
      case 'lift_stations': {
        const ls = liftStations.find((x) => x.lift_station_id === selectedAsset.id);
        if (ls) center = [ls.longitude, ls.latitude];
        break;
      }
      case 'mains': {
        const m = sewerMains.find((x) => x.sewer_main_id === selectedAsset.id);
        if (m?.coordinates?.length) {
          const mid = m.coordinates[Math.floor(m.coordinates.length / 2)];
          center = mid as [number, number];
        }
        break;
      }
      case 'force_mains': {
        const fm = forceMains.find((x) => x.force_main_id === selectedAsset.id);
        if (fm?.coordinates?.length) {
          const mid = fm.coordinates[Math.floor(fm.coordinates.length / 2)];
          center = mid as [number, number];
        }
        break;
      }
      case 'laterals': {
        const l = laterals.find((x) => x.sewer_lateral_id === selectedAsset.id);
        if (l?.longitude != null && l?.latitude != null) center = [l.longitude, l.latitude];
        break;
      }
    }

    if (center) {
      mapRef.current.flyTo({
        center,
        zoom: Math.max(mapRef.current.getZoom(), 15),
        duration: 800,
      });
    }
  }, [selectedAsset, manholes, sewerMains, forceMains, liftStations, laterals]);

  // Reset line draw when leaving placement mode
  useEffect(() => {
    if (!isLineMode) {
      setLineDrawPoints([]);
    }
  }, [isLineMode]);

  const handleZoomToExtent = useCallback(() => {
    if (!mapRef.current) return;
    const allPoints: [number, number][] = [];
    manholes.forEach((m) => allPoints.push([m.longitude, m.latitude]));
    liftStations.forEach((ls) => allPoints.push([ls.longitude, ls.latitude]));
    sewerMains.forEach((m) => m.coordinates?.forEach((c) => allPoints.push(c as [number, number])));
    forceMains.forEach((m) => m.coordinates?.forEach((c) => allPoints.push(c as [number, number])));

    if (allPoints.length === 0) {
      mapRef.current.flyTo({ center: [INITIAL_VIEW.longitude, INITIAL_VIEW.latitude], zoom: INITIAL_VIEW.zoom, duration: 800 });
      return;
    }
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of allPoints) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    mapRef.current.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, maxZoom: 16, duration: 800 });
  }, [manholes, sewerMains, forceMains, liftStations]);

  const handleClick = useCallback((e: MapLayerMouseEvent) => {
    // Line drawing mode
    if (isLineMode) {
      const newPoint = [e.lngLat.lng, e.lngLat.lat];
      setLineDrawPoints((prev) => [...prev, newPoint]);
      return;
    }

    // Point placement mode
    if (isPlacementMode) {
      onMapClick?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      return;
    }

    // Selection mode
    const feature = e.features?.[0];
    if (!feature) {
      return;
    }

    // Cluster click
    if (feature.properties?.cluster) {
      const clusterId = feature.properties.cluster_id as number;
      const sourceId = feature.source as string;
      const map = mapRef.current?.getMap();
      const source = map?.getSource(sourceId);
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

    const assetType = feature.properties?.asset_type as string;
    const assetId = feature.properties?.id as string;
    if (assetType && assetId) {
      onSelectAsset(assetType, assetId);
    }
  }, [isPlacementMode, isLineMode, onMapClick, onSelectAsset]);

  const handleDblClick = useCallback((e: MapLayerMouseEvent) => {
    if (!isLineMode) return;
    e.preventDefault();
    const finalPoints = [...lineDrawPoints, [e.lngLat.lng, e.lngLat.lat]];
    if (finalPoints.length >= 2) {
      onLineDrawn?.(finalPoints);
    }
    setLineDrawPoints([]);
  }, [isLineMode, lineDrawPoints, onLineDrawn]);

  const interactiveLayerIds = isPlacementMode
    ? []
    : ['manholes-unclustered', 'manholes-clusters', 'sewer-mains-line', 'force-mains-line', 'lift-stations-point', 'laterals-point'];

  return (
    <Map
      ref={mapRef}
      initialViewState={INITIAL_VIEW}
      style={{ width: '100%', height: '100%' }}
      mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
      interactiveLayerIds={interactiveLayerIds}
      onClick={handleClick}
      onDblClick={handleDblClick}
      cursor={isPlacementMode ? 'crosshair' : 'pointer'}
      doubleClickZoom={!isLineMode}
    >
      <NavigationControl position="top-right" />

      {/* Home button */}
      <div className="absolute top-28 right-2.5 z-10">
        <button
          onClick={handleZoomToExtent}
          title="Zoom to all assets"
          aria-label="Zoom to all assets"
          className="w-[29px] h-[29px] bg-white rounded shadow flex items-center justify-center border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <Home size={15} className="text-gray-700" />
        </button>
      </div>

      {/* --- Sewer Mains (lines) --- */}
      <Source id="sewer-mains" type="geojson" data={sewerMainGeojson}>
        <Layer
          id="sewer-mains-line"
          type="line"
          paint={{
            'line-color': ['get', 'color'],
            'line-width': [
              'case',
              ['==', ['get', 'is_selected'], 1],
              5,
              3,
            ],
            'line-opacity': 0.85,
          }}
        />
        <Layer
          id="sewer-mains-selected"
          type="line"
          filter={['==', ['get', 'is_selected'], 1]}
          paint={{
            'line-color': '#2563eb',
            'line-width': 8,
            'line-opacity': 0.3,
          }}
        />
      </Source>

      {/* --- Force Mains (dashed lines) --- */}
      <Source id="force-mains" type="geojson" data={forceMainGeojson}>
        <Layer
          id="force-mains-line"
          type="line"
          paint={{
            'line-color': '#f59e0b',
            'line-width': [
              'case',
              ['==', ['get', 'is_selected'], 1],
              5,
              3,
            ],
            'line-dasharray': [4, 3],
            'line-opacity': 0.85,
          }}
        />
        <Layer
          id="force-mains-selected"
          type="line"
          filter={['==', ['get', 'is_selected'], 1]}
          paint={{
            'line-color': '#2563eb',
            'line-width': 8,
            'line-opacity': 0.3,
          }}
        />
      </Source>

      {/* --- Manholes (clustered circles) --- */}
      <Source
        id="manholes"
        type="geojson"
        data={manholeGeojson}
        cluster={true}
        clusterMaxZoom={14}
        clusterRadius={30}
      >
        <Layer
          id="manholes-clusters"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': '#3b82f6',
            'circle-radius': [
              'step', ['get', 'point_count'],
              12, 10, 15, 50, 19, 100, 22,
            ],
            'circle-opacity': 0.85,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          }}
        />
        <Layer
          id="manholes-cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{
            'text-field': '{point_count_abbreviated}',
            'text-size': 12,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          }}
          paint={{ 'text-color': '#ffffff' }}
        />
        <Layer
          id="manholes-unclustered"
          type="circle"
          filter={['!', ['has', 'point_count']]}
          paint={{
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, ['case', ['==', ['get', 'is_selected'], 1], 7, 5],
              15, ['case', ['==', ['get', 'is_selected'], 1], 12, 8],
              18, ['case', ['==', ['get', 'is_selected'], 1], 16, 12],
            ],
            'circle-color': ['get', 'color'],
            'circle-stroke-width': [
              'case', ['==', ['get', 'is_selected'], 1], 3, 2,
            ],
            'circle-stroke-color': [
              'case', ['==', ['get', 'is_selected'], 1], '#2563eb', '#ffffff',
            ],
            'circle-opacity': 0.9,
          }}
        />
        <Layer
          id="manholes-label"
          type="symbol"
          filter={['!', ['has', 'point_count']]}
          minzoom={16}
          layout={{
            'text-field': ['get', 'label'],
            'text-size': 10,
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

      {/* --- Lift Stations (larger squares) --- */}
      <Source id="lift-stations" type="geojson" data={liftStationGeojson}>
        <Layer
          id="lift-stations-point"
          type="circle"
          paint={{
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, ['case', ['==', ['get', 'is_selected'], 1], 10, 7],
              15, ['case', ['==', ['get', 'is_selected'], 1], 16, 12],
              18, ['case', ['==', ['get', 'is_selected'], 1], 20, 16],
            ],
            'circle-color': '#ef4444',
            'circle-stroke-width': [
              'case', ['==', ['get', 'is_selected'], 1], 3, 2,
            ],
            'circle-stroke-color': [
              'case', ['==', ['get', 'is_selected'], 1], '#2563eb', '#ffffff',
            ],
            'circle-opacity': 0.9,
          }}
        />
        <Layer
          id="lift-stations-label"
          type="symbol"
          minzoom={14}
          layout={{
            'text-field': ['get', 'label'],
            'text-size': 11,
            'text-offset': [0, 2],
            'text-anchor': 'top',
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          }}
          paint={{
            'text-color': '#991b1b',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
          }}
        />
      </Source>

      {/* --- Laterals (small gray circles) --- */}
      <Source id="laterals" type="geojson" data={lateralGeojson}>
        <Layer
          id="laterals-point"
          type="circle"
          paint={{
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, ['case', ['==', ['get', 'is_selected'], 1], 5, 3],
              15, ['case', ['==', ['get', 'is_selected'], 1], 8, 5],
              18, ['case', ['==', ['get', 'is_selected'], 1], 12, 8],
            ],
            'circle-color': '#6b7280',
            'circle-stroke-width': [
              'case', ['==', ['get', 'is_selected'], 1], 3, 1,
            ],
            'circle-stroke-color': [
              'case', ['==', ['get', 'is_selected'], 1], '#2563eb', '#ffffff',
            ],
            'circle-opacity': 0.7,
          }}
        />
      </Source>

      {/* --- Line drawing preview --- */}
      {lineDrawGeojson && (
        <Source id="line-draw-preview" type="geojson" data={lineDrawGeojson}>
          <Layer
            id="line-draw-preview-line"
            type="line"
            paint={{
              'line-color': '#2563eb',
              'line-width': 3,
              'line-dasharray': [3, 2],
            }}
          />
        </Source>
      )}
      {lineDrawPoints.length > 0 && (
        <Source id="line-draw-points" type="geojson" data={lineDrawPointsGeojson}>
          <Layer
            id="line-draw-points-circle"
            type="circle"
            paint={{
              'circle-radius': 5,
              'circle-color': '#2563eb',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </Source>
      )}

      {/* Placement marker for point assets */}
      {isPlacementMode && !isLineMode && (
        <>
          {/* Handled by onMapClick going straight to form */}
        </>
      )}

      {/* Legend */}
      <div className="absolute bottom-8 left-4 bg-white rounded-lg shadow-lg p-3 text-xs space-y-2">
        <div>
          <div className="font-semibold text-gray-700 mb-1">Asset Types</div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-gray-600">Manholes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-0.5 bg-blue-500" />
            <span className="text-gray-600">Sanitary Main</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-0.5 bg-cyan-500" />
            <span className="text-gray-600">Storm Main</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-0.5 bg-purple-500" />
            <span className="text-gray-600">Combined Main</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-0.5 bg-amber-500 border-dashed" style={{ borderBottom: '2px dashed #f59e0b', height: 0 }} />
            <span className="text-gray-600">Force Main</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
            <span className="text-gray-600">Lift Station</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-500" />
            <span className="text-gray-600">Lateral</span>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-1.5">
          <div className="font-semibold text-gray-700 mb-1">Condition</div>
          {[5, 4, 3, 2, 1].map((r) => (
            <div key={r} className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CONDITION_COLORS[r].hex }} />
              <span className="text-gray-600">{r} - {CONDITION_COLORS[r].label}</span>
            </div>
          ))}
        </div>
      </div>
    </Map>
  );
}
