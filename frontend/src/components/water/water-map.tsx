import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';
import { Home } from 'lucide-react';
import type { WaterMain, WaterValve, FireHydrant, WaterService, WaterFitting, PressureZone } from '../../api/types';
import {
  getWaterAssetColor,
  CONDITION_COLORS,
  HYDRANT_FLOW_COLORS,
} from '../../lib/constants';

interface WaterMapProps {
  waterMains: WaterMain[];
  waterValves: WaterValve[];
  hydrants: FireHydrant[];
  waterServices: WaterService[];
  waterFittings: WaterFitting[];
  pressureZones: PressureZone[];
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

export function WaterMap({
  waterMains,
  waterValves,
  hydrants,
  waterServices,
  waterFittings,
  pressureZones,
  selectedAsset,
  onSelectAsset,
  mode,
  activeTab,
  onMapClick,
  onLineDrawn,
  flyToCoords,
}: WaterMapProps) {
  const mapRef = useRef<MapRef>(null);
  const hasFittedBounds = useRef(false);

  // Fly to coordinates from address search
  useEffect(() => {
    if (!flyToCoords || !mapRef.current) return;
    mapRef.current.flyTo({ center: [flyToCoords.lng, flyToCoords.lat], zoom: 17, duration: 1200 });
  }, [flyToCoords]);
  const [lineDrawPoints, setLineDrawPoints] = useState<number[][]>([]);

  const isPlacementMode = mode === 'add-placing';
  const isLineMode = isPlacementMode && activeTab === 'mains';

  // --- GeoJSON Sources ---

  const waterMainGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: waterMains
      .filter((m) => m.coordinates && m.coordinates.length >= 2)
      .map((m) => ({
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: m.coordinates! },
        properties: {
          id: m.water_main_id,
          asset_type: 'mains',
          label: m.asset_tag || `WM-${m.water_main_id.slice(0, 8)}`,
          status: m.status,
          condition_rating: m.condition_rating,
          is_selected: selectedAsset?.type === 'mains' && selectedAsset.id === m.water_main_id ? 1 : 0,
        },
      })),
  }), [waterMains, selectedAsset]);

  const valveGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: waterValves
      .filter((v) => v.longitude != null && v.latitude != null)
      .map((v) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [v.longitude!, v.latitude!] },
        properties: {
          id: v.water_valve_id,
          asset_type: 'valves',
          label: v.asset_tag || `VLV-${v.water_valve_id.slice(0, 8)}`,
          status: v.status,
          condition_rating: v.condition_rating,
          color: getWaterAssetColor(v.condition_rating, v.status),
          is_critical: v.is_critical ? 1 : 0,
          is_selected: selectedAsset?.type === 'valves' && selectedAsset.id === v.water_valve_id ? 1 : 0,
        },
      })),
  }), [waterValves, selectedAsset]);

  const hydrantGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: hydrants
      .filter((h) => h.longitude != null && h.latitude != null)
      .map((h) => {
        let color: string;
        if (h.flow_class_color && HYDRANT_FLOW_COLORS[h.flow_class_color]) {
          color = HYDRANT_FLOW_COLORS[h.flow_class_color].hex;
        } else {
          color = getWaterAssetColor(h.condition_rating, h.status);
        }
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [h.longitude!, h.latitude!] },
          properties: {
            id: h.hydrant_id,
            asset_type: 'hydrants',
            label: h.asset_tag || `HYD-${h.hydrant_id.slice(0, 8)}`,
            status: h.status,
            condition_rating: h.condition_rating,
            color,
            is_selected: selectedAsset?.type === 'hydrants' && selectedAsset.id === h.hydrant_id ? 1 : 0,
          },
        };
      }),
  }), [hydrants, selectedAsset]);

  const serviceGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: waterServices
      .filter((s) => s.longitude != null && s.latitude != null)
      .map((s) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [s.longitude!, s.latitude!] },
        properties: {
          id: s.water_service_id,
          asset_type: 'services',
          label: s.asset_tag || s.address || `SVC-${s.water_service_id.slice(0, 8)}`,
          status: s.status,
          color: '#6b7280',
          is_selected: selectedAsset?.type === 'services' && selectedAsset.id === s.water_service_id ? 1 : 0,
        },
      })),
  }), [waterServices, selectedAsset]);

  const fittingGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: waterFittings
      .filter((f) => f.longitude != null && f.latitude != null)
      .map((f) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [f.longitude!, f.latitude!] },
        properties: {
          id: f.water_fitting_id,
          asset_type: 'fittings',
          label: f.asset_tag || `FIT-${f.water_fitting_id.slice(0, 8)}`,
          status: f.status,
          color: '#9ca3af',
          is_selected: selectedAsset?.type === 'fittings' && selectedAsset.id === f.water_fitting_id ? 1 : 0,
        },
      })),
  }), [waterFittings, selectedAsset]);

  const zoneGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: pressureZones
      .filter((z) => z.coordinates && z.coordinates.length > 0)
      .map((z) => ({
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: z.coordinates! },
        properties: {
          id: z.pressure_zone_id,
          asset_type: 'zones',
          label: z.zone_name,
          is_selected: selectedAsset?.type === 'zones' && selectedAsset.id === z.pressure_zone_id ? 1 : 0,
        },
      })),
  }), [pressureZones, selectedAsset]);

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
    waterValves.forEach((v) => { if (v.longitude != null && v.latitude != null) allPoints.push([v.longitude, v.latitude]); });
    hydrants.forEach((h) => { if (h.longitude != null && h.latitude != null) allPoints.push([h.longitude!, h.latitude!]); });
    waterMains.forEach((m) => m.coordinates?.forEach((c) => allPoints.push(c as [number, number])));
    waterServices.forEach((s) => { if (s.longitude != null && s.latitude != null) allPoints.push([s.longitude, s.latitude]); });
    waterFittings.forEach((f) => { if (f.longitude != null && f.latitude != null) allPoints.push([f.longitude, f.latitude]); });

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
  }, [waterMains, waterValves, hydrants, waterServices, waterFittings]);

  // Fly to selected asset
  useEffect(() => {
    if (!selectedAsset || !mapRef.current) return;
    let center: [number, number] | null = null;

    switch (selectedAsset.type) {
      case 'valves': {
        const v = waterValves.find((x) => x.water_valve_id === selectedAsset.id);
        if (v?.longitude != null && v?.latitude != null) center = [v.longitude, v.latitude];
        break;
      }
      case 'hydrants': {
        const h = hydrants.find((x) => x.hydrant_id === selectedAsset.id);
        if (h?.longitude != null && h?.latitude != null) center = [h.longitude!, h.latitude!];
        break;
      }
      case 'mains': {
        const m = waterMains.find((x) => x.water_main_id === selectedAsset.id);
        if (m?.coordinates?.length) {
          const mid = m.coordinates[Math.floor(m.coordinates.length / 2)];
          center = mid as [number, number];
        }
        break;
      }
      case 'services': {
        const s = waterServices.find((x) => x.water_service_id === selectedAsset.id);
        if (s?.longitude != null && s?.latitude != null) center = [s.longitude, s.latitude];
        break;
      }
      case 'fittings': {
        const f = waterFittings.find((x) => x.water_fitting_id === selectedAsset.id);
        if (f?.longitude != null && f?.latitude != null) center = [f.longitude, f.latitude];
        break;
      }
      case 'zones': {
        const z = pressureZones.find((x) => x.pressure_zone_id === selectedAsset.id);
        if (z?.coordinates?.[0]?.[0]) {
          // Center of first ring
          const ring = z.coordinates[0];
          let sumLng = 0, sumLat = 0;
          for (const pt of ring) { sumLng += pt[0]; sumLat += pt[1]; }
          center = [sumLng / ring.length, sumLat / ring.length];
        }
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
  }, [selectedAsset, waterMains, waterValves, hydrants, waterServices, waterFittings, pressureZones]);

  // Reset line draw when leaving placement mode
  useEffect(() => {
    if (!isLineMode) {
      setLineDrawPoints([]);
    }
  }, [isLineMode]);

  const handleZoomToExtent = useCallback(() => {
    if (!mapRef.current) return;
    const allPoints: [number, number][] = [];
    waterValves.forEach((v) => { if (v.longitude != null && v.latitude != null) allPoints.push([v.longitude, v.latitude]); });
    hydrants.forEach((h) => { if (h.longitude != null && h.latitude != null) allPoints.push([h.longitude!, h.latitude!]); });
    waterMains.forEach((m) => m.coordinates?.forEach((c) => allPoints.push(c as [number, number])));

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
  }, [waterMains, waterValves, hydrants]);

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
    if (!feature) return;

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
    : [
        'water-mains-line', 'valves-unclustered', 'valves-clusters',
        'hydrants-unclustered', 'hydrants-clusters',
        'services-point', 'fittings-point', 'zones-fill',
      ];

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
          className="w-[29px] h-[29px] bg-white rounded shadow flex items-center justify-center border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <Home size={15} className="text-gray-700" />
        </button>
      </div>

      {/* --- Pressure Zones (polygon fill, rendered first / below) --- */}
      <Source id="pressure-zones" type="geojson" data={zoneGeojson}>
        <Layer
          id="zones-fill"
          type="fill"
          paint={{
            'fill-color': '#3b82f6',
            'fill-opacity': [
              'case',
              ['==', ['get', 'is_selected'], 1],
              0.2,
              0.08,
            ],
          }}
        />
        <Layer
          id="zones-outline"
          type="line"
          paint={{
            'line-color': '#3b82f6',
            'line-width': [
              'case',
              ['==', ['get', 'is_selected'], 1],
              3,
              1.5,
            ],
            'line-opacity': 0.6,
          }}
        />
        <Layer
          id="zones-label"
          type="symbol"
          layout={{
            'text-field': ['get', 'label'],
            'text-size': 12,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          }}
          paint={{
            'text-color': '#1e40af',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
          }}
        />
      </Source>

      {/* --- Water Mains (blue lines) --- */}
      <Source id="water-mains" type="geojson" data={waterMainGeojson}>
        <Layer
          id="water-mains-line"
          type="line"
          paint={{
            'line-color': '#3b82f6',
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
          id="water-mains-selected"
          type="line"
          filter={['==', ['get', 'is_selected'], 1]}
          paint={{
            'line-color': '#2563eb',
            'line-width': 8,
            'line-opacity': 0.3,
          }}
        />
      </Source>

      {/* --- Water Fittings (tiny gray circles) --- */}
      <Source id="fittings" type="geojson" data={fittingGeojson}>
        <Layer
          id="fittings-point"
          type="circle"
          paint={{
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, ['case', ['==', ['get', 'is_selected'], 1], 4, 2],
              15, ['case', ['==', ['get', 'is_selected'], 1], 6, 3],
              18, ['case', ['==', ['get', 'is_selected'], 1], 10, 6],
            ],
            'circle-color': '#9ca3af',
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

      {/* --- Water Services (small gray circles) --- */}
      <Source id="services" type="geojson" data={serviceGeojson}>
        <Layer
          id="services-point"
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

      {/* --- Water Valves (clustered, purple squares rendered as circles) --- */}
      <Source
        id="valves"
        type="geojson"
        data={valveGeojson}
        cluster={true}
        clusterMaxZoom={14}
        clusterRadius={30}
      >
        <Layer
          id="valves-clusters"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': '#8b5cf6',
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
          id="valves-cluster-count"
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
          id="valves-unclustered"
          type="circle"
          filter={['!', ['has', 'point_count']]}
          paint={{
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, ['case', ['==', ['get', 'is_selected'], 1], 6, 4],
              15, ['case', ['==', ['get', 'is_selected'], 1], 10, 6],
              18, ['case', ['==', ['get', 'is_selected'], 1], 14, 10],
            ],
            'circle-color': ['get', 'color'],
            'circle-stroke-width': [
              'case',
              ['==', ['get', 'is_critical'], 1], 3,
              ['==', ['get', 'is_selected'], 1], 3,
              2,
            ],
            'circle-stroke-color': [
              'case',
              ['==', ['get', 'is_selected'], 1], '#2563eb',
              ['==', ['get', 'is_critical'], 1], '#dc2626',
              '#ffffff',
            ],
            'circle-opacity': 0.9,
          }}
        />
        <Layer
          id="valves-label"
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

      {/* --- Fire Hydrants (clustered, larger circles, colored by flow class) --- */}
      <Source
        id="hydrants"
        type="geojson"
        data={hydrantGeojson}
        cluster={true}
        clusterMaxZoom={14}
        clusterRadius={30}
      >
        <Layer
          id="hydrants-clusters"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': '#ef4444',
            'circle-radius': [
              'step', ['get', 'point_count'],
              14, 10, 17, 50, 21, 100, 24,
            ],
            'circle-opacity': 0.85,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          }}
        />
        <Layer
          id="hydrants-cluster-count"
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
          id="hydrants-unclustered"
          type="circle"
          filter={['!', ['has', 'point_count']]}
          paint={{
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, ['case', ['==', ['get', 'is_selected'], 1], 8, 6],
              15, ['case', ['==', ['get', 'is_selected'], 1], 14, 10],
              18, ['case', ['==', ['get', 'is_selected'], 1], 18, 14],
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
          id="hydrants-label"
          type="symbol"
          filter={['!', ['has', 'point_count']]}
          minzoom={15}
          layout={{
            'text-field': ['get', 'label'],
            'text-size': 11,
            'text-offset': [0, 1.8],
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

      {/* Legend */}
      <div className="absolute bottom-8 left-4 bg-white rounded-lg shadow-lg p-3 text-xs space-y-2">
        <div>
          <div className="font-semibold text-gray-700 mb-1">Asset Types</div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-0.5 bg-blue-500" />
            <span className="text-gray-600">Water Main</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span className="text-gray-600">Valve</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
            <span className="text-gray-600">Hydrant</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-500" />
            <span className="text-gray-600">Service</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400" />
            <span className="text-gray-600">Fitting</span>
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
        <div className="border-t border-gray-100 pt-1.5">
          <div className="font-semibold text-gray-700 mb-1">Hydrant Flow</div>
          {Object.entries(HYDRANT_FLOW_COLORS).map(([key, { label, hex }]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hex }} />
              <span className="text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </Map>
  );
}
