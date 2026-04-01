import { api, buildSearchParams } from './client';
import type {
  WaterMain,
  WaterMainCreate,
  WaterMainListResponse,
  WaterValve,
  WaterValveCreate,
  WaterValveListResponse,
  FireHydrant,
  FireHydrantCreate,
  FireHydrantListResponse,
  WaterService,
  WaterServiceCreate,
  WaterServiceListResponse,
  WaterFitting,
  WaterFittingCreate,
  WaterFittingListResponse,
  PressureZone,
  PressureZoneCreate,
  PressureZoneListResponse,
  WaterMaterialType,
  WaterValveType,
} from './types';

// ---------------------------------------------------------------------------
// Water Mains
// ---------------------------------------------------------------------------

export async function listWaterMains(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  material_code?: string;
  pressure_zone_id?: string;
}): Promise<WaterMainListResponse> {
  const searchParams = buildSearchParams({
    page: params?.page,
    page_size: params?.page_size,
    status: params?.status,
    material_code: params?.material_code,
    pressure_zone_id: params?.pressure_zone_id,
  });
  return api.get('water-mains', { searchParams }).json();
}

export async function getWaterMain(id: string): Promise<WaterMain> {
  return api.get(`water-mains/${id}`).json();
}

export async function createWaterMain(data: WaterMainCreate): Promise<WaterMain> {
  return api.post('water-mains', { json: data }).json();
}

export async function updateWaterMain(id: string, data: Partial<WaterMainCreate>): Promise<WaterMain> {
  return api.put(`water-mains/${id}`, { json: data }).json();
}

export async function deleteWaterMain(id: string): Promise<void> {
  await api.delete(`water-mains/${id}`);
}

// ---------------------------------------------------------------------------
// Water Valves
// ---------------------------------------------------------------------------

export async function listWaterValves(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  valve_type_code?: string;
  is_critical?: boolean;
}): Promise<WaterValveListResponse> {
  const searchParams = buildSearchParams({
    page: params?.page,
    page_size: params?.page_size,
    status: params?.status,
    valve_type_code: params?.valve_type_code,
    is_critical: params?.is_critical,
  });
  return api.get('water-valves', { searchParams }).json();
}

export async function getWaterValve(id: string): Promise<WaterValve> {
  return api.get(`water-valves/${id}`).json();
}

export async function createWaterValve(data: WaterValveCreate): Promise<WaterValve> {
  return api.post('water-valves', { json: data }).json();
}

export async function updateWaterValve(id: string, data: Partial<WaterValveCreate>): Promise<WaterValve> {
  return api.put(`water-valves/${id}`, { json: data }).json();
}

export async function deleteWaterValve(id: string): Promise<void> {
  await api.delete(`water-valves/${id}`);
}

// ---------------------------------------------------------------------------
// Fire Hydrants
// ---------------------------------------------------------------------------

export async function listHydrants(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  flow_class_color?: string;
}): Promise<FireHydrantListResponse> {
  const searchParams = buildSearchParams({
    page: params?.page,
    page_size: params?.page_size,
    status: params?.status,
    flow_class_color: params?.flow_class_color,
  });
  return api.get('hydrants', { searchParams }).json();
}

export async function getHydrant(id: string): Promise<FireHydrant> {
  return api.get(`hydrants/${id}`).json();
}

export async function createHydrant(data: FireHydrantCreate): Promise<FireHydrant> {
  return api.post('hydrants', { json: data }).json();
}

export async function updateHydrant(id: string, data: Partial<FireHydrantCreate>): Promise<FireHydrant> {
  return api.put(`hydrants/${id}`, { json: data }).json();
}

export async function deleteHydrant(id: string): Promise<void> {
  await api.delete(`hydrants/${id}`);
}

// ---------------------------------------------------------------------------
// Pressure Zones
// ---------------------------------------------------------------------------

export async function listPressureZones(params?: {
  page?: number;
  page_size?: number;
}): Promise<PressureZoneListResponse> {
  const searchParams = buildSearchParams({
    page: params?.page,
    page_size: params?.page_size,
  });
  return api.get('pressure-zones', { searchParams }).json();
}

export async function getPressureZone(id: string): Promise<PressureZone> {
  return api.get(`pressure-zones/${id}`).json();
}

export async function createPressureZone(data: PressureZoneCreate): Promise<PressureZone> {
  return api.post('pressure-zones', { json: data }).json();
}

export async function updatePressureZone(id: string, data: Partial<PressureZoneCreate>): Promise<PressureZone> {
  return api.put(`pressure-zones/${id}`, { json: data }).json();
}

export async function deletePressureZone(id: string): Promise<void> {
  await api.delete(`pressure-zones/${id}`);
}

// ---------------------------------------------------------------------------
// Water Services
// ---------------------------------------------------------------------------

export async function listWaterServices(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  service_type?: string;
}): Promise<WaterServiceListResponse> {
  const searchParams = buildSearchParams({
    page: params?.page,
    page_size: params?.page_size,
    status: params?.status,
    service_type: params?.service_type,
  });
  return api.get('water-services', { searchParams }).json();
}

export async function getWaterService(id: string): Promise<WaterService> {
  return api.get(`water-services/${id}`).json();
}

export async function createWaterService(data: WaterServiceCreate): Promise<WaterService> {
  return api.post('water-services', { json: data }).json();
}

export async function updateWaterService(id: string, data: Partial<WaterServiceCreate>): Promise<WaterService> {
  return api.put(`water-services/${id}`, { json: data }).json();
}

export async function deleteWaterService(id: string): Promise<void> {
  await api.delete(`water-services/${id}`);
}

// ---------------------------------------------------------------------------
// Water Fittings
// ---------------------------------------------------------------------------

export async function listWaterFittings(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  fitting_type?: string;
}): Promise<WaterFittingListResponse> {
  const searchParams = buildSearchParams({
    page: params?.page,
    page_size: params?.page_size,
    status: params?.status,
    fitting_type: params?.fitting_type,
  });
  return api.get('water-fittings', { searchParams }).json();
}

export async function getWaterFitting(id: string): Promise<WaterFitting> {
  return api.get(`water-fittings/${id}`).json();
}

export async function createWaterFitting(data: WaterFittingCreate): Promise<WaterFitting> {
  return api.post('water-fittings', { json: data }).json();
}

export async function updateWaterFitting(id: string, data: Partial<WaterFittingCreate>): Promise<WaterFitting> {
  return api.put(`water-fittings/${id}`, { json: data }).json();
}

export async function deleteWaterFitting(id: string): Promise<void> {
  await api.delete(`water-fittings/${id}`);
}

// ---------------------------------------------------------------------------
// Lookup Tables
// ---------------------------------------------------------------------------

export async function listWaterMaterialTypes(): Promise<WaterMaterialType[]> {
  return api.get('water-material-types').json();
}

export async function listWaterValveTypes(): Promise<WaterValveType[]> {
  return api.get('water-valve-types').json();
}
