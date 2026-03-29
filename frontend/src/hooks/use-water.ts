import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as waterApi from '../api/water';
import type {
  WaterMainCreate,
  WaterValveCreate,
  FireHydrantCreate,
  WaterServiceCreate,
  WaterFittingCreate,
  PressureZoneCreate,
} from '../api/types';

export const waterKeys = {
  all: ['water'] as const,
  // Water Mains
  waterMains: () => [...waterKeys.all, 'waterMains'] as const,
  waterMainLists: () => [...waterKeys.waterMains(), 'list'] as const,
  waterMainList: (filters: Record<string, unknown>) => [...waterKeys.waterMainLists(), filters] as const,
  waterMainDetails: () => [...waterKeys.waterMains(), 'detail'] as const,
  waterMainDetail: (id: string) => [...waterKeys.waterMainDetails(), id] as const,
  // Water Valves
  waterValves: () => [...waterKeys.all, 'waterValves'] as const,
  waterValveLists: () => [...waterKeys.waterValves(), 'list'] as const,
  waterValveList: (filters: Record<string, unknown>) => [...waterKeys.waterValveLists(), filters] as const,
  waterValveDetails: () => [...waterKeys.waterValves(), 'detail'] as const,
  waterValveDetail: (id: string) => [...waterKeys.waterValveDetails(), id] as const,
  // Fire Hydrants
  hydrants: () => [...waterKeys.all, 'hydrants'] as const,
  hydrantLists: () => [...waterKeys.hydrants(), 'list'] as const,
  hydrantList: (filters: Record<string, unknown>) => [...waterKeys.hydrantLists(), filters] as const,
  hydrantDetails: () => [...waterKeys.hydrants(), 'detail'] as const,
  hydrantDetail: (id: string) => [...waterKeys.hydrantDetails(), id] as const,
  // Water Services
  waterServices: () => [...waterKeys.all, 'waterServices'] as const,
  waterServiceLists: () => [...waterKeys.waterServices(), 'list'] as const,
  waterServiceList: (filters: Record<string, unknown>) => [...waterKeys.waterServiceLists(), filters] as const,
  waterServiceDetails: () => [...waterKeys.waterServices(), 'detail'] as const,
  waterServiceDetail: (id: string) => [...waterKeys.waterServiceDetails(), id] as const,
  // Water Fittings
  waterFittings: () => [...waterKeys.all, 'waterFittings'] as const,
  waterFittingLists: () => [...waterKeys.waterFittings(), 'list'] as const,
  waterFittingList: (filters: Record<string, unknown>) => [...waterKeys.waterFittingLists(), filters] as const,
  waterFittingDetails: () => [...waterKeys.waterFittings(), 'detail'] as const,
  waterFittingDetail: (id: string) => [...waterKeys.waterFittingDetails(), id] as const,
  // Pressure Zones
  pressureZones: () => [...waterKeys.all, 'pressureZones'] as const,
  pressureZoneLists: () => [...waterKeys.pressureZones(), 'list'] as const,
  pressureZoneList: (filters: Record<string, unknown>) => [...waterKeys.pressureZoneLists(), filters] as const,
  pressureZoneDetails: () => [...waterKeys.pressureZones(), 'detail'] as const,
  pressureZoneDetail: (id: string) => [...waterKeys.pressureZoneDetails(), id] as const,
  // Lookups
  lookups: () => [...waterKeys.all, 'lookups'] as const,
  materialTypes: () => [...waterKeys.lookups(), 'materialTypes'] as const,
  valveTypes: () => [...waterKeys.lookups(), 'valveTypes'] as const,
};

// ---------------------------------------------------------------------------
// Water Mains
// ---------------------------------------------------------------------------

export function useWaterMainsList(filters?: {
  page?: number;
  page_size?: number;
  status?: string;
  material_code?: string;
  pressure_zone_id?: string;
}) {
  return useQuery({
    queryKey: waterKeys.waterMainList(filters ?? {}),
    queryFn: () => waterApi.listWaterMains(filters),
  });
}

export function useWaterMain(id: string | undefined) {
  return useQuery({
    queryKey: waterKeys.waterMainDetail(id!),
    queryFn: () => waterApi.getWaterMain(id!),
    enabled: !!id,
  });
}

export function useCreateWaterMain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WaterMainCreate) => waterApi.createWaterMain(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.waterMainLists() }),
  });
}

export function useUpdateWaterMain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WaterMainCreate> }) =>
      waterApi.updateWaterMain(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.waterMainLists() }),
  });
}

export function useDeleteWaterMain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => waterApi.deleteWaterMain(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.waterMainLists() }),
  });
}

// ---------------------------------------------------------------------------
// Water Valves
// ---------------------------------------------------------------------------

export function useWaterValvesList(filters?: {
  page?: number;
  page_size?: number;
  status?: string;
  valve_type_code?: string;
  is_critical?: boolean;
}) {
  return useQuery({
    queryKey: waterKeys.waterValveList(filters ?? {}),
    queryFn: () => waterApi.listWaterValves(filters),
  });
}

export function useWaterValve(id: string | undefined) {
  return useQuery({
    queryKey: waterKeys.waterValveDetail(id!),
    queryFn: () => waterApi.getWaterValve(id!),
    enabled: !!id,
  });
}

export function useCreateWaterValve() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WaterValveCreate) => waterApi.createWaterValve(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.waterValveLists() }),
  });
}

export function useUpdateWaterValve() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WaterValveCreate> }) =>
      waterApi.updateWaterValve(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.waterValveLists() }),
  });
}

export function useDeleteWaterValve() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => waterApi.deleteWaterValve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.waterValveLists() }),
  });
}

// ---------------------------------------------------------------------------
// Fire Hydrants
// ---------------------------------------------------------------------------

export function useHydrantsList(filters?: {
  page?: number;
  page_size?: number;
  status?: string;
  flow_class_color?: string;
}) {
  return useQuery({
    queryKey: waterKeys.hydrantList(filters ?? {}),
    queryFn: () => waterApi.listHydrants(filters),
  });
}

export function useHydrant(id: string | undefined) {
  return useQuery({
    queryKey: waterKeys.hydrantDetail(id!),
    queryFn: () => waterApi.getHydrant(id!),
    enabled: !!id,
  });
}

export function useCreateHydrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FireHydrantCreate) => waterApi.createHydrant(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.hydrantLists() }),
  });
}

export function useUpdateHydrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FireHydrantCreate> }) =>
      waterApi.updateHydrant(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.hydrantLists() }),
  });
}

export function useDeleteHydrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => waterApi.deleteHydrant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.hydrantLists() }),
  });
}

// ---------------------------------------------------------------------------
// Pressure Zones
// ---------------------------------------------------------------------------

export function usePressureZonesList(filters?: {
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: waterKeys.pressureZoneList(filters ?? {}),
    queryFn: () => waterApi.listPressureZones(filters),
  });
}

export function usePressureZone(id: string | undefined) {
  return useQuery({
    queryKey: waterKeys.pressureZoneDetail(id!),
    queryFn: () => waterApi.getPressureZone(id!),
    enabled: !!id,
  });
}

export function useCreatePressureZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PressureZoneCreate) => waterApi.createPressureZone(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.pressureZoneLists() }),
  });
}

export function useUpdatePressureZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PressureZoneCreate> }) =>
      waterApi.updatePressureZone(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.pressureZoneLists() }),
  });
}

export function useDeletePressureZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => waterApi.deletePressureZone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.pressureZoneLists() }),
  });
}

// ---------------------------------------------------------------------------
// Water Services
// ---------------------------------------------------------------------------

export function useWaterServicesList(filters?: {
  page?: number;
  page_size?: number;
  status?: string;
  service_type?: string;
}) {
  return useQuery({
    queryKey: waterKeys.waterServiceList(filters ?? {}),
    queryFn: () => waterApi.listWaterServices(filters),
  });
}

export function useWaterService(id: string | undefined) {
  return useQuery({
    queryKey: waterKeys.waterServiceDetail(id!),
    queryFn: () => waterApi.getWaterService(id!),
    enabled: !!id,
  });
}

export function useCreateWaterService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WaterServiceCreate) => waterApi.createWaterService(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.waterServiceLists() }),
  });
}

export function useUpdateWaterService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WaterServiceCreate> }) =>
      waterApi.updateWaterService(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.waterServiceLists() }),
  });
}

export function useDeleteWaterService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => waterApi.deleteWaterService(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.waterServiceLists() }),
  });
}

// ---------------------------------------------------------------------------
// Water Fittings
// ---------------------------------------------------------------------------

export function useWaterFittingsList(filters?: {
  page?: number;
  page_size?: number;
  status?: string;
  fitting_type?: string;
}) {
  return useQuery({
    queryKey: waterKeys.waterFittingList(filters ?? {}),
    queryFn: () => waterApi.listWaterFittings(filters),
  });
}

export function useWaterFitting(id: string | undefined) {
  return useQuery({
    queryKey: waterKeys.waterFittingDetail(id!),
    queryFn: () => waterApi.getWaterFitting(id!),
    enabled: !!id,
  });
}

export function useCreateWaterFitting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WaterFittingCreate) => waterApi.createWaterFitting(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.waterFittingLists() }),
  });
}

export function useUpdateWaterFitting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WaterFittingCreate> }) =>
      waterApi.updateWaterFitting(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.waterFittingLists() }),
  });
}

export function useDeleteWaterFitting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => waterApi.deleteWaterFitting(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: waterKeys.waterFittingLists() }),
  });
}

// ---------------------------------------------------------------------------
// Lookup Tables
// ---------------------------------------------------------------------------

export function useWaterMaterialTypes() {
  return useQuery({
    queryKey: waterKeys.materialTypes(),
    queryFn: () => waterApi.listWaterMaterialTypes(),
    staleTime: Infinity,
  });
}

export function useWaterValveTypes() {
  return useQuery({
    queryKey: waterKeys.valveTypes(),
    queryFn: () => waterApi.listWaterValveTypes(),
    staleTime: Infinity,
  });
}
