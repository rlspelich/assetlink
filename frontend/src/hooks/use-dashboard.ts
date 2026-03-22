import { useQuery } from '@tanstack/react-query';
import { getComplianceDashboard } from '../api/dashboard';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  compliance: () => [...dashboardKeys.all, 'compliance'] as const,
};

export function useComplianceDashboard() {
  return useQuery({
    queryKey: dashboardKeys.compliance(),
    queryFn: getComplianceDashboard,
    staleTime: 60_000,
  });
}
