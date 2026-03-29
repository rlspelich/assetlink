import { api } from './client';
import type {
  Manhole,
  ManholeCreate,
  ManholeListResponse,
  SewerMain,
  SewerMainCreate,
  SewerMainListResponse,
  ForceMain,
  ForceMainCreate,
  ForceMainListResponse,
  LiftStation,
  LiftStationCreate,
  LiftStationListResponse,
  SewerLateral,
  SewerLateralCreate,
  SewerLateralListResponse,
  SewerMaterialType,
  SewerPipeShape,
  ManholeType,
} from './types';

// ---------------------------------------------------------------------------
// Manholes
// ---------------------------------------------------------------------------

export async function listManholes(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  system_type?: string;
  manhole_type_code?: string;
}): Promise<ManholeListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.system_type) searchParams.set('system_type', params.system_type);
  if (params?.manhole_type_code) searchParams.set('manhole_type_code', params.manhole_type_code);
  return api.get('manholes', { searchParams }).json();
}

export async function getManhole(id: string): Promise<Manhole> {
  return api.get(`manholes/${id}`).json();
}

export async function createManhole(data: ManholeCreate): Promise<Manhole> {
  return api.post('manholes', { json: data }).json();
}

export async function updateManhole(id: string, data: Partial<ManholeCreate>): Promise<Manhole> {
  return api.put(`manholes/${id}`, { json: data }).json();
}

export async function deleteManhole(id: string): Promise<void> {
  await api.delete(`manholes/${id}`);
}

// ---------------------------------------------------------------------------
// Sewer Mains
// ---------------------------------------------------------------------------

export async function listSewerMains(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  system_type?: string;
  material_code?: string;
}): Promise<SewerMainListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.system_type) searchParams.set('system_type', params.system_type);
  if (params?.material_code) searchParams.set('material_code', params.material_code);
  return api.get('sewer-mains', { searchParams }).json();
}

export async function getSewerMain(id: string): Promise<SewerMain> {
  return api.get(`sewer-mains/${id}`).json();
}

export async function createSewerMain(data: SewerMainCreate): Promise<SewerMain> {
  return api.post('sewer-mains', { json: data }).json();
}

export async function updateSewerMain(id: string, data: Partial<SewerMainCreate>): Promise<SewerMain> {
  return api.put(`sewer-mains/${id}`, { json: data }).json();
}

export async function deleteSewerMain(id: string): Promise<void> {
  await api.delete(`sewer-mains/${id}`);
}

// ---------------------------------------------------------------------------
// Force Mains
// ---------------------------------------------------------------------------

export async function listForceMains(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  material_code?: string;
}): Promise<ForceMainListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.material_code) searchParams.set('material_code', params.material_code);
  return api.get('force-mains', { searchParams }).json();
}

export async function getForceMain(id: string): Promise<ForceMain> {
  return api.get(`force-mains/${id}`).json();
}

export async function createForceMain(data: ForceMainCreate): Promise<ForceMain> {
  return api.post('force-mains', { json: data }).json();
}

export async function updateForceMain(id: string, data: Partial<ForceMainCreate>): Promise<ForceMain> {
  return api.put(`force-mains/${id}`, { json: data }).json();
}

export async function deleteForceMain(id: string): Promise<void> {
  await api.delete(`force-mains/${id}`);
}

// ---------------------------------------------------------------------------
// Lift Stations
// ---------------------------------------------------------------------------

export async function listLiftStations(params?: {
  page?: number;
  page_size?: number;
  status?: string;
}): Promise<LiftStationListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.status) searchParams.set('status', params.status);
  return api.get('lift-stations', { searchParams }).json();
}

export async function getLiftStation(id: string): Promise<LiftStation> {
  return api.get(`lift-stations/${id}`).json();
}

export async function createLiftStation(data: LiftStationCreate): Promise<LiftStation> {
  return api.post('lift-stations', { json: data }).json();
}

export async function updateLiftStation(id: string, data: Partial<LiftStationCreate>): Promise<LiftStation> {
  return api.put(`lift-stations/${id}`, { json: data }).json();
}

export async function deleteLiftStation(id: string): Promise<void> {
  await api.delete(`lift-stations/${id}`);
}

// ---------------------------------------------------------------------------
// Sewer Laterals
// ---------------------------------------------------------------------------

export async function listSewerLaterals(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  service_type?: string;
}): Promise<SewerLateralListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.service_type) searchParams.set('service_type', params.service_type);
  return api.get('sewer-laterals', { searchParams }).json();
}

export async function getSewerLateral(id: string): Promise<SewerLateral> {
  return api.get(`sewer-laterals/${id}`).json();
}

export async function createSewerLateral(data: SewerLateralCreate): Promise<SewerLateral> {
  return api.post('sewer-laterals', { json: data }).json();
}

export async function updateSewerLateral(id: string, data: Partial<SewerLateralCreate>): Promise<SewerLateral> {
  return api.put(`sewer-laterals/${id}`, { json: data }).json();
}

export async function deleteSewerLateral(id: string): Promise<void> {
  await api.delete(`sewer-laterals/${id}`);
}

// ---------------------------------------------------------------------------
// Lookup Tables
// ---------------------------------------------------------------------------

export async function listSewerMaterialTypes(): Promise<SewerMaterialType[]> {
  return api.get('sewer-material-types').json();
}

export async function listSewerPipeShapes(): Promise<SewerPipeShape[]> {
  return api.get('sewer-pipe-shapes').json();
}

export async function listManholeTypes(): Promise<ManholeType[]> {
  return api.get('manhole-types').json();
}
