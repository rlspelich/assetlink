import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as signsApi from '../api/signs';
import type { SignCreate } from '../api/types';

export const signKeys = {
  all: ['signs'] as const,
  lists: () => [...signKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...signKeys.lists(), filters] as const,
  details: () => [...signKeys.all, 'detail'] as const,
  detail: (id: string) => [...signKeys.details(), id] as const,
  types: () => [...signKeys.all, 'types'] as const,
};

export function useSignsList(filters?: {
  page?: number;
  page_size?: number;
  status?: string;
  road_name?: string;
  mutcd_code?: string;
  sign_category?: string;
}) {
  return useQuery({
    queryKey: signKeys.list(filters ?? {}),
    queryFn: () => signsApi.listSigns(filters),
  });
}

export function useSign(id: string | undefined) {
  return useQuery({
    queryKey: signKeys.detail(id!),
    queryFn: () => signsApi.getSign(id!),
    enabled: !!id,
  });
}

export function useCreateSign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SignCreate) => signsApi.createSign(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: signKeys.lists() }),
  });
}

export function useUpdateSign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SignCreate> }) =>
      signsApi.updateSign(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: signKeys.lists() }),
  });
}

export function useDeleteSign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => signsApi.deleteSign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: signKeys.lists() }),
  });
}

export function useSignTypes() {
  return useQuery({
    queryKey: signKeys.types(),
    queryFn: () => signsApi.listSignTypes(),
    staleTime: Infinity,
  });
}

export function useImportSignsCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => signsApi.importSignsCsv(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: signKeys.lists() }),
  });
}
