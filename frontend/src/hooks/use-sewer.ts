import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as sewerApi from '../api/sewer';
import type {
  ManholeCreate,
  SewerMainCreate,
  ForceMainCreate,
  LiftStationCreate,
  SewerLateralCreate,
} from '../api/types';

export const sewerKeys = {
  all: ['sewer'] as const,
  // Manholes
  manholes: () => [...sewerKeys.all, 'manholes'] as const,
  manholeLists: () => [...sewerKeys.manholes(), 'list'] as const,
  manholeList: (filters: Record<string, unknown>) => [...sewerKeys.manholeLists(), filters] as const,
  manholeDetails: () => [...sewerKeys.manholes(), 'detail'] as const,
  manholeDetail: (id: string) => [...sewerKeys.manholeDetails(), id] as const,
  // Sewer Mains
  sewerMains: () => [...sewerKeys.all, 'sewerMains'] as const,
  sewerMainLists: () => [...sewerKeys.sewerMains(), 'list'] as const,
  sewerMainList: (filters: Record<string, unknown>) => [...sewerKeys.sewerMainLists(), filters] as const,
  sewerMainDetails: () => [...sewerKeys.sewerMains(), 'detail'] as const,
  sewerMainDetail: (id: string) => [...sewerKeys.sewerMainDetails(), id] as const,
  // Force Mains
  forceMains: () => [...sewerKeys.all, 'forceMains'] as const,
  forceMainLists: () => [...sewerKeys.forceMains(), 'list'] as const,
  forceMainList: (filters: Record<string, unknown>) => [...sewerKeys.forceMainLists(), filters] as const,
  forceMainDetails: () => [...sewerKeys.forceMains(), 'detail'] as const,
  forceMainDetail: (id: string) => [...sewerKeys.forceMainDetails(), id] as const,
  // Lift Stations
  liftStations: () => [...sewerKeys.all, 'liftStations'] as const,
  liftStationLists: () => [...sewerKeys.liftStations(), 'list'] as const,
  liftStationList: (filters: Record<string, unknown>) => [...sewerKeys.liftStationLists(), filters] as const,
  liftStationDetails: () => [...sewerKeys.liftStations(), 'detail'] as const,
  liftStationDetail: (id: string) => [...sewerKeys.liftStationDetails(), id] as const,
  // Sewer Laterals
  sewerLaterals: () => [...sewerKeys.all, 'sewerLaterals'] as const,
  sewerLateralLists: () => [...sewerKeys.sewerLaterals(), 'list'] as const,
  sewerLateralList: (filters: Record<string, unknown>) => [...sewerKeys.sewerLateralLists(), filters] as const,
  sewerLateralDetails: () => [...sewerKeys.sewerLaterals(), 'detail'] as const,
  sewerLateralDetail: (id: string) => [...sewerKeys.sewerLateralDetails(), id] as const,
  // Lookups
  lookups: () => [...sewerKeys.all, 'lookups'] as const,
  materialTypes: () => [...sewerKeys.lookups(), 'materialTypes'] as const,
  pipeShapes: () => [...sewerKeys.lookups(), 'pipeShapes'] as const,
  manholeTypes: () => [...sewerKeys.lookups(), 'manholeTypes'] as const,
};

// ---------------------------------------------------------------------------
// Manholes
// ---------------------------------------------------------------------------

export function useManholesList(filters?: {
  page?: number;
  page_size?: number;
  status?: string;
  system_type?: string;
  manhole_type_code?: string;
}) {
  return useQuery({
    queryKey: sewerKeys.manholeList(filters ?? {}),
    queryFn: () => sewerApi.listManholes(filters),
  });
}

export function useManhole(id: string | undefined) {
  return useQuery({
    queryKey: sewerKeys.manholeDetail(id!),
    queryFn: () => sewerApi.getManhole(id!),
    enabled: !!id,
  });
}

export function useCreateManhole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ManholeCreate) => sewerApi.createManhole(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: sewerKeys.manholeLists() }),
  });
}

export function useUpdateManhole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ManholeCreate> }) =>
      sewerApi.updateManhole(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: sewerKeys.manholeLists() }),
  });
}

export function useDeleteManhole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sewerApi.deleteManhole(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: sewerKeys.manholeLists() }),
  });
}

// ---------------------------------------------------------------------------
// Sewer Mains
// ---------------------------------------------------------------------------

export function useSewerMainsList(filters?: {
  page?: number;
  page_size?: number;
  status?: string;
  system_type?: string;
  material_code?: string;
}) {
  return useQuery({
    queryKey: sewerKeys.sewerMainList(filters ?? {}),
    queryFn: () => sewerApi.listSewerMains(filters),
  });
}

export function useSewerMain(id: string | undefined) {
  return useQuery({
    queryKey: sewerKeys.sewerMainDetail(id!),
    queryFn: () => sewerApi.getSewerMain(id!),
    enabled: !!id,
  });
}

export function useCreateSewerMain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SewerMainCreate) => sewerApi.createSewerMain(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: sewerKeys.sewerMainLists() }),
  });
}

export function useUpdateSewerMain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SewerMainCreate> }) =>
      sewerApi.updateSewerMain(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: sewerKeys.sewerMainLists() }),
  });
}

export function useDeleteSewerMain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sewerApi.deleteSewerMain(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: sewerKeys.sewerMainLists() }),
  });
}

// ---------------------------------------------------------------------------
// Force Mains
// ---------------------------------------------------------------------------

export function useForceMainsList(filters?: {
  page?: number;
  page_size?: number;
  status?: string;
  material_code?: string;
}) {
  return useQuery({
    queryKey: sewerKeys.forceMainList(filters ?? {}),
    queryFn: () => sewerApi.listForceMains(filters),
  });
}

export function useForceMain(id: string | undefined) {
  return useQuery({
    queryKey: sewerKeys.forceMainDetail(id!),
    queryFn: () => sewerApi.getForceMain(id!),
    enabled: !!id,
  });
}

export function useCreateForceMain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ForceMainCreate) => sewerApi.createForceMain(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: sewerKeys.forceMainLists() }),
  });
}

export function useUpdateForceMain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ForceMainCreate> }) =>
      sewerApi.updateForceMain(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: sewerKeys.forceMainLists() }),
  });
}

export function useDeleteForceMain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sewerApi.deleteForceMain(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: sewerKeys.forceMainLists() }),
  });
}

// ---------------------------------------------------------------------------
// Lift Stations
// ---------------------------------------------------------------------------

export function useLiftStationsList(filters?: {
  page?: number;
  page_size?: number;
  status?: string;
}) {
  return useQuery({
    queryKey: sewerKeys.liftStationList(filters ?? {}),
    queryFn: () => sewerApi.listLiftStations(filters),
  });
}

export function useLiftStation(id: string | undefined) {
  return useQuery({
    queryKey: sewerKeys.liftStationDetail(id!),
    queryFn: () => sewerApi.getLiftStation(id!),
    enabled: !!id,
  });
}

export function useCreateLiftStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LiftStationCreate) => sewerApi.createLiftStation(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: sewerKeys.liftStationLists() }),
  });
}

export function useUpdateLiftStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LiftStationCreate> }) =>
      sewerApi.updateLiftStation(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: sewerKeys.liftStationLists() }),
  });
}

export function useDeleteLiftStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sewerApi.deleteLiftStation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: sewerKeys.liftStationLists() }),
  });
}

// ---------------------------------------------------------------------------
// Sewer Laterals
// ---------------------------------------------------------------------------

export function useSewerLateralsList(filters?: {
  page?: number;
  page_size?: number;
  status?: string;
  service_type?: string;
}) {
  return useQuery({
    queryKey: sewerKeys.sewerLateralList(filters ?? {}),
    queryFn: () => sewerApi.listSewerLaterals(filters),
  });
}

export function useSewerLateral(id: string | undefined) {
  return useQuery({
    queryKey: sewerKeys.sewerLateralDetail(id!),
    queryFn: () => sewerApi.getSewerLateral(id!),
    enabled: !!id,
  });
}

export function useCreateSewerLateral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SewerLateralCreate) => sewerApi.createSewerLateral(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: sewerKeys.sewerLateralLists() }),
  });
}

export function useUpdateSewerLateral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SewerLateralCreate> }) =>
      sewerApi.updateSewerLateral(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: sewerKeys.sewerLateralLists() }),
  });
}

export function useDeleteSewerLateral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sewerApi.deleteSewerLateral(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: sewerKeys.sewerLateralLists() }),
  });
}

// ---------------------------------------------------------------------------
// Lookup Tables
// ---------------------------------------------------------------------------

export function useSewerMaterialTypes() {
  return useQuery({
    queryKey: sewerKeys.materialTypes(),
    queryFn: () => sewerApi.listSewerMaterialTypes(),
    staleTime: Infinity,
  });
}

export function useSewerPipeShapes() {
  return useQuery({
    queryKey: sewerKeys.pipeShapes(),
    queryFn: () => sewerApi.listSewerPipeShapes(),
    staleTime: Infinity,
  });
}

export function useManholeTypes() {
  return useQuery({
    queryKey: sewerKeys.manholeTypes(),
    queryFn: () => sewerApi.listManholeTypes(),
    staleTime: Infinity,
  });
}
