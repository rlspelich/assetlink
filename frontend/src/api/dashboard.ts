import { api } from './client';
import type { ComplianceDashboard } from './types';

export async function getComplianceDashboard(): Promise<ComplianceDashboard> {
  return api.get('dashboard/compliance').json();
}
