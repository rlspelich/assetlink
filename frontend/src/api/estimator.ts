import { api } from './client';

// --- Types ---

export interface PayItem {
  agency: string;
  code: string;
  description: string;
  abbreviation: string;
  unit: string;
  division: string;
  category: string;
  subcategory: string;
}

export interface PayItemListResponse {
  pay_items: PayItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface AwardPricePoint {
  letting_date: string;
  unit_price: number;
  quantity: number;
  contract_number: string;
  county: string;
  district: string;
}

export interface AwardPriceHistory {
  pay_item_code: string;
  description: string;
  unit: string;
  data_points: AwardPricePoint[];
  total_records: number;
  avg_unit_price: number | null;
  median_unit_price: number | null;
  min_unit_price: number | null;
  max_unit_price: number | null;
}

export interface PriceStats {
  pay_item_code: string;
  data_points: number;
  weighted_avg: number;
  median: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  min_price: number;
  max_price: number;
  nominal_avg: number;
  earliest_date: string | null;
  latest_date: string | null;
  unit: string;
  description: string;
}

export interface Confidence {
  percentile: number | null;
  label: string;
  color: string;
  data_points: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  weighted_avg: number | null;
}

export interface RegionalFactor {
  regional_factor_id: string;
  state_code: string;
  state_name: string;
  factor: number;
  source: string;
  year: number;
}

export interface EstimateItem {
  estimate_item_id: string;
  estimate_id: string;
  pay_item_code: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  unit_price_source: string;
  adjusted_unit_price: number | null;
  regional_unit_price: number | null;
  extension: number;
  confidence_pct: number | null;
  confidence_label: string | null;
  price_p25: number | null;
  price_p50: number | null;
  price_p75: number | null;
  price_count: number;
  sort_order: number;
}

export interface Estimate {
  estimate_id: string;
  tenant_id: string;
  name: string;
  description: string;
  status: string;
  target_state: string;
  target_district: string;
  use_inflation_adjustment: boolean;
  target_year: number | null;
  total_nominal: number;
  total_adjusted: number;
  total_with_regional: number;
  confidence_low: number | null;
  confidence_high: number | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface EstimateDetail extends Estimate {
  items: EstimateItem[];
}

export interface EstimateListResponse {
  estimates: Estimate[];
  total: number;
  page: number;
  page_size: number;
}

// --- API Functions ---

export async function searchPayItems(params: {
  search?: string;
  division?: string;
  page?: number;
  page_size?: number;
}): Promise<PayItemListResponse> {
  const sp = new URLSearchParams();
  if (params.search) sp.set('search', params.search);
  if (params.division) sp.set('division', params.division);
  if (params.page) sp.set('page', String(params.page));
  sp.set('page_size', String(params.page_size || 25));
  return api.get('estimator/pay-items', { searchParams: sp }).json();
}

export async function getAwardPriceHistory(code: string, params?: {
  district?: string;
  county?: string;
  min_date?: string;
  max_date?: string;
  limit?: number;
}): Promise<AwardPriceHistory> {
  const sp = new URLSearchParams();
  if (params?.district) sp.set('district', params.district);
  if (params?.county) sp.set('county', params.county);
  if (params?.min_date) sp.set('min_date', params.min_date);
  if (params?.max_date) sp.set('max_date', params.max_date);
  if (params?.limit) sp.set('limit', String(params.limit));
  return api.get(`estimator/award-items/${code}/price-history`, { searchParams: sp }).json();
}

export async function getPriceStats(code: string, params?: {
  district?: string;
  years_back?: number;
  adjust_inflation?: boolean;
  target_year?: number;
  target_state?: string;
}): Promise<PriceStats> {
  const sp = new URLSearchParams();
  if (params?.district) sp.set('district', params.district);
  if (params?.years_back) sp.set('years_back', String(params.years_back));
  if (params?.adjust_inflation !== undefined) sp.set('adjust_inflation', String(params.adjust_inflation));
  if (params?.target_year) sp.set('target_year', String(params.target_year));
  if (params?.target_state) sp.set('target_state', params.target_state);
  return api.get(`estimator/pay-items/${code}/price-stats`, { searchParams: sp }).json();
}

export async function getConfidence(code: string, unitPrice: number, params?: {
  district?: string;
  years_back?: number;
}): Promise<Confidence> {
  const sp = new URLSearchParams();
  sp.set('unit_price', String(unitPrice));
  if (params?.district) sp.set('district', params.district);
  if (params?.years_back) sp.set('years_back', String(params.years_back));
  return api.get(`estimator/pay-items/${code}/confidence`, { searchParams: sp }).json();
}

export async function getRegionalFactors(): Promise<RegionalFactor[]> {
  return api.get('estimator/regional-factors').json();
}

// Estimates
export async function listEstimates(page = 1, pageSize = 50): Promise<EstimateListResponse> {
  return api.get('estimator/estimates', { searchParams: { page: String(page), page_size: String(pageSize) } }).json();
}

export async function createEstimate(data: {
  name: string;
  description?: string;
  target_state?: string;
  target_district?: string;
  use_inflation_adjustment?: boolean;
  target_year?: number;
}): Promise<Estimate> {
  return api.post('estimator/estimates', { json: data }).json();
}

export async function getEstimate(id: string): Promise<EstimateDetail> {
  return api.get(`estimator/estimates/${id}`).json();
}

export async function updateEstimate(id: string, data: Partial<Estimate>): Promise<Estimate> {
  return api.put(`estimator/estimates/${id}`, { json: data }).json();
}

export async function deleteEstimate(id: string): Promise<void> {
  await api.delete(`estimator/estimates/${id}`);
}

export async function duplicateEstimate(id: string): Promise<Estimate> {
  return api.post(`estimator/estimates/${id}/duplicate`).json();
}

export async function recalculateEstimate(id: string): Promise<EstimateDetail> {
  return api.post(`estimator/estimates/${id}/recalculate`).json();
}

export async function addEstimateItems(estimateId: string, items: {
  pay_item_code: string;
  quantity: number;
  description?: string;
  unit?: string;
}[]): Promise<EstimateItem[]> {
  return api.post(`estimator/estimates/${estimateId}/items`, { json: items }).json();
}

export async function updateEstimateItem(estimateId: string, itemId: string, data: {
  quantity?: number;
  unit_price?: number;
  unit_price_source?: string;
}): Promise<EstimateItem> {
  return api.put(`estimator/estimates/${estimateId}/items/${itemId}`, { json: data }).json();
}

export async function deleteEstimateItem(estimateId: string, itemId: string): Promise<void> {
  await api.delete(`estimator/estimates/${estimateId}/items/${itemId}`);
}
