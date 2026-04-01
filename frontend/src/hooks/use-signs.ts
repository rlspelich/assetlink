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
    onError: (error: Error) => {
      console.error('Failed to create sign:', error.message);
    },
  });
}

export function useUpdateSign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SignCreate> }) =>
      signsApi.updateSign(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: signKeys.lists() }),
    onError: (error: Error) => {
      console.error('Failed to update sign:', error.message);
    },
  });
}

export function useDeleteSign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => signsApi.deleteSign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: signKeys.lists() }),
    onError: (error: Error) => {
      console.error('Failed to delete sign:', error.message);
    },
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
    onError: (error: Error) => {
      console.error('Failed to import signs CSV:', error.message);
    },
  });
}

export function useImportSupportsCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => signsApi.importSupportsCsv(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: signKeys.lists() }),
    onError: (error: Error) => {
      console.error('Failed to import supports CSV:', error.message);
    },
  });
}

export function useImportSignsAndSupportsCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ signsFile, supportsFile }: { signsFile: File; supportsFile: File }) =>
      signsApi.importSignsAndSupportsCsv(signsFile, supportsFile),
    onSuccess: () => qc.invalidateQueries({ queryKey: signKeys.lists() }),
    onError: (error: Error) => {
      console.error('Failed to import signs and supports CSV:', error.message);
    },
  });
}
