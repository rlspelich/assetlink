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

export async function bulkImportEstimateItems(estimateId: string, textData: string): Promise<EstimateItem[]> {
  return api.post(`estimator/estimates/${estimateId}/import-items`, { json: { text_data: textData } }).json();
}

export async function downloadEngineersReport(estimateId: string, format: 'txt' | 'csv', contingencyPct: number = 0): Promise<void> {
  const resp = await api.get(`estimator/estimates/${estimateId}/engineers-report`, {
    searchParams: { format, contingency_pct: String(contingencyPct) },
  });
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = format === 'csv' ? 'engineers_estimate.csv' : 'engineers_estimate.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// ============================================================
// Contractor Intelligence — Types
// ============================================================

export interface Contractor {
  contractor_pk: string;
  contractor_id_code: string;
  name: string;
  bid_count: number;
  win_count: number;
  created_at: string;
  updated_at: string;
}

export interface ContractorListResponse {
  contractors: Contractor[];
  total: number;
  page: number;
  page_size: number;
}

export interface ContractorProfile {
  contractor_pk: string;
  contractor_id_code: string;
  name: string;
  total_bids: number;
  total_wins: number;
  win_rate: number;
  avg_bid_total: number | null;
  total_bid_volume: number;
  total_won: number;
  on_table: number;
  dollar_capture_pct: number;
  first_bid_date: string | null;
  last_bid_date: string | null;
  active_years: number;
  counties: string[];
  districts: string[];
}

export interface BiddingHistoryEntry {
  bid_id: string;
  contract_id: string;
  contract_number: string;
  letting_date: string;
  county: string;
  district: string;
  rank: number;
  total: number;
  is_low: boolean;
  is_bad: boolean;
  num_bidders: number;
}

export interface BiddingHistoryResponse {
  entries: BiddingHistoryEntry[];
  total: number;
  page: number;
  page_size: number;
}

export interface GeoFootprintEntry {
  name: string;
  bid_count: number;
  win_count: number;
  win_rate: number;
  total_volume: number;
}

export interface GeoFootprint {
  contractor_pk: string;
  by_county: GeoFootprintEntry[];
  by_district: GeoFootprintEntry[];
}

export interface ActivityTrendPoint {
  year: number;
  bid_count: number;
  win_count: number;
  total_bid_volume: number;
}

export interface ActivityTrend {
  contractor_pk: string;
  trend: ActivityTrendPoint[];
}

export interface PriceTendencyItem {
  division: string;
  contractor_avg_price: number;
  market_avg_price: number;
  variance_pct: number;
  contractor_sample_count: number;
  market_sample_count: number;
}

export interface PriceTendencies {
  contractor_pk: string;
  contractor_name: string;
  tendencies: PriceTendencyItem[];
}

export interface HeadToHeadContract {
  contract_id: string;
  contract_number: string;
  letting_date: string;
  county: string;
  contractor_a_rank: number;
  contractor_a_total: number;
  contractor_b_rank: number;
  contractor_b_total: number;
  winner: string;
}

export interface HeadToHeadSummary {
  contractor_a_pk: string;
  contractor_a_name: string;
  contractor_b_pk: string;
  contractor_b_name: string;
  shared_contracts: number;
  a_wins_vs_b: number;
  b_wins_vs_a: number;
  a_total_wins: number;
  b_total_wins: number;
  contracts: HeadToHeadContract[];
}

export interface HeadToHeadItemComparison {
  pay_item_code: string;
  description: string;
  unit: string;
  contractor_a_avg_price: number;
  contractor_b_avg_price: number;
  variance_pct: number;
  sample_count: number;
}

export interface HeadToHeadItemsResponse {
  contractor_a_name: string;
  contractor_b_name: string;
  items: HeadToHeadItemComparison[];
  total: number;
  page: number;
  page_size: number;
}

export interface BidTabBidder {
  contractor_pk: string;
  contractor_name: string;
  contractor_id_code: string;
  rank: number;
  total: number;
  is_low: boolean;
  is_bad: boolean;
}

export interface BidTabLineItem {
  pay_item_code: string;
  abbreviation: string;
  unit: string;
  quantity: number;
  prices: Record<string, number | null>;
  low_price: number | null;
  high_price: number | null;
  spread_pct: number | null;
}

export interface BidTab {
  contract_id: string;
  contract_number: string;
  letting_date: string;
  county: string;
  district: string;
  bidders: BidTabBidder[];
  items: BidTabLineItem[];
  total_items: number;
}

export interface CategoryBreakdownEntry {
  division: string;
  total: number;
  pct_of_contract: number;
  item_count: number;
}

export interface CategoryBreakdown {
  contract_id: string;
  bid_id: string;
  contractor_name: string;
  breakdown: CategoryBreakdownEntry[];
  grand_total: number;
}

export interface ContractListItem {
  contract_id: string;
  number: string;
  letting_date: string;
  agency: string;
  county: string;
  district: string;
  municipality: string;
  item_count: number;
  bid_count: number;
  low_bid_total: number | null;
}

export interface ContractListResponse {
  contracts: ContractListItem[];
  total: number;
  page: number;
  page_size: number;
}


// ============================================================
// Contractor Intelligence — API Functions
// ============================================================

export async function listContractors(params: {
  page?: number;
  page_size?: number;
  search?: string;
} = {}): Promise<ContractorListResponse> {
  const sp: Record<string, string> = {};
  if (params.page) sp.page = String(params.page);
  if (params.page_size) sp.page_size = String(params.page_size);
  if (params.search) sp.search = params.search;
  return api.get('estimator/contractors', { searchParams: sp }).json();
}

export async function getContractorProfile(pk: string, params: { min_date?: string; max_date?: string } = {}): Promise<ContractorProfile> {
  const sp: Record<string, string> = {};
  if (params.min_date) sp.min_date = params.min_date;
  if (params.max_date) sp.max_date = params.max_date;
  return api.get(`estimator/contractors/${pk}/profile`, { searchParams: sp }).json();
}

export async function getBiddingHistory(pk: string, params: {
  page?: number;
  page_size?: number;
  county?: string;
  district?: string;
  wins_only?: boolean;
} = {}): Promise<BiddingHistoryResponse> {
  const sp: Record<string, string> = {};
  if (params.page) sp.page = String(params.page);
  if (params.page_size) sp.page_size = String(params.page_size);
  if (params.county) sp.county = params.county;
  if (params.district) sp.district = params.district;
  if (params.wins_only) sp.wins_only = 'true';
  return api.get(`estimator/contractors/${pk}/bidding-history`, { searchParams: sp }).json();
}

export async function getGeoFootprint(pk: string, params: { min_date?: string; max_date?: string } = {}): Promise<GeoFootprint> {
  const sp: Record<string, string> = {};
  if (params.min_date) sp.min_date = params.min_date;
  if (params.max_date) sp.max_date = params.max_date;
  return api.get(`estimator/contractors/${pk}/geographic-footprint`, { searchParams: sp }).json();
}

export async function getActivityTrend(pk: string, params: { min_date?: string; max_date?: string } = {}): Promise<ActivityTrend> {
  const sp: Record<string, string> = {};
  if (params.min_date) sp.min_date = params.min_date;
  if (params.max_date) sp.max_date = params.max_date;
  return api.get(`estimator/contractors/${pk}/activity-trend`, { searchParams: sp }).json();
}

export async function getPriceTendencies(pk: string, params: {
  min_date?: string;
  limit?: number;
} = {}): Promise<PriceTendencies> {
  const sp: Record<string, string> = {};
  if (params.min_date) sp.min_date = params.min_date;
  if (params.limit) sp.limit = String(params.limit);
  return api.get(`estimator/contractors/${pk}/price-tendencies`, { searchParams: sp }).json();
}

export interface Competitor {
  contractor_pk: string;
  name: string;
  contractor_id_code: string;
  shared_contracts: number;
}

export async function getCompetitors(pk: string, limit = 50): Promise<Competitor[]> {
  return api.get(`estimator/contractors/${pk}/competitors`, { searchParams: { limit: String(limit) } }).json();
}

export async function getHeadToHead(
  contractorA: string, contractorB: string, params: {
    min_date?: string;
    max_date?: string;
    county?: string;
  } = {}
): Promise<HeadToHeadSummary> {
  const sp: Record<string, string> = { contractor_a: contractorA, contractor_b: contractorB };
  if (params.min_date) sp.min_date = params.min_date;
  if (params.max_date) sp.max_date = params.max_date;
  if (params.county) sp.county = params.county;
  return api.get('estimator/contractors/head-to-head', { searchParams: sp }).json();
}

export async function getHeadToHeadItems(
  contractorA: string, contractorB: string, params: {
    page?: number;
    page_size?: number;
    division?: string;
  } = {}
): Promise<HeadToHeadItemsResponse> {
  const sp: Record<string, string> = { contractor_a: contractorA, contractor_b: contractorB };
  if (params.page) sp.page = String(params.page);
  if (params.page_size) sp.page_size = String(params.page_size);
  if (params.division) sp.division = params.division;
  return api.get('estimator/contractors/head-to-head/items', { searchParams: sp }).json();
}

export interface ContractFilterOptions {
  counties: string[];
  districts: string[];
  county_to_districts: Record<string, string[]>;
  district_to_counties: Record<string, string[]>;
  min_date: string | null;
  max_date: string | null;
}

export async function getContractFilterOptions(): Promise<ContractFilterOptions> {
  return api.get('estimator/contracts/filter-options').json();
}

export async function listContracts(params: {
  page?: number;
  page_size?: number;
  agency?: string;
  county?: string;
  district?: string;
  search?: string;
  min_date?: string;
  max_date?: string;
  municipality?: string;
} = {}): Promise<ContractListResponse> {
  const sp: Record<string, string> = {};
  if (params.page) sp.page = String(params.page);
  if (params.page_size) sp.page_size = String(params.page_size);
  if (params.agency) sp.agency = params.agency;
  if (params.county) sp.county = params.county;
  if (params.district) sp.district = params.district;
  if (params.search) sp.search = params.search;
  if (params.min_date) sp.min_date = params.min_date;
  if (params.max_date) sp.max_date = params.max_date;
  if (params.municipality) sp.municipality = params.municipality;
  return api.get('estimator/contracts', { searchParams: sp }).json();
}

export async function getBidTab(contractId: string): Promise<BidTab> {
  return api.get(`estimator/contracts/${contractId}/bid-tab`).json();
}

export async function getCategoryBreakdown(contractId: string, bidId?: string): Promise<CategoryBreakdown> {
  const sp: Record<string, string> = {};
  if (bidId) sp.bid_id = bidId;
  return api.get(`estimator/contracts/${contractId}/category-breakdown`, { searchParams: sp }).json();
}


// ============================================================
// Market Analysis — Types
// ============================================================

export interface MarketPlayer {
  rank: number;
  contractor_pk: string;
  contractor_name: string;
  contractor_id_code: string;
  jobs_bid: number;
  jobs_won: number;
  win_rate: number;
  total_low: number;
  total_bid: number;
  pct_won_of_bids: number;
  dollar_capture_pct: number;
  pct_left_on_table: number;
}

export interface MarketAnalysis {
  total_market_value: number;
  total_contracts: number;
  total_bidders: number;
  filters_applied: Record<string, string>;
  players: MarketPlayer[];
}

// ============================================================
// Letting Report — Types
// ============================================================

export interface LettingDate { letting_date: string; contract_count: number; }
export interface LettingBidder { contractor_name: string; contractor_id_code: string; contractor_pk: string | null; rank: number; total: number; is_low: boolean; variance_from_low: number | null; variance_pct: number | null; }
export interface LettingContract { contract_id: string; contract_number: string; county: string; district: string; item_count: number; low_bidder_name: string; low_bid_total: number | null; num_bidders: number; bidders: LettingBidder[]; }
export interface LettingReport { letting_date: string; total_contracts: number; total_value: number; contracts: LettingContract[]; }

// ============================================================
// Pay Item Detail Search — Types
// ============================================================

export interface PayItemOccurrence { bid_item_id: string; pay_item_code: string; abbreviation: string; unit: string; quantity: number; unit_price: number; extension: number; contractor_name: string; contractor_id_code: string; contractor_pk: string; contract_number: string; contract_id: string; letting_date: string; county: string; district: string; rank: number; is_low: boolean; }
export interface PayItemSearchStats { count: number; weighted_avg: number | null; straight_avg: number | null; median: number | null; high: number | null; low: number | null; total_quantity: number | null; }
export interface PayItemSearchResponse { results: PayItemOccurrence[]; total: number; page: number; page_size: number; stats: PayItemSearchStats | null; }

// ============================================================
// Contractor vs Market — Types
// ============================================================

export interface VsMarketItem { pay_item_code: string; description: string; unit: string; contractor_avg_price: number; market_avg_price: number; variance_pct: number; contractor_samples: number; market_samples: number; }
export interface VsMarketResponse { contractor_pk: string; contractor_name: string; items: VsMarketItem[]; total: number; page: number; page_size: number; }

// ============================================================
// Market Analysis / Letting / PI Detail / vs Market — API Functions
// ============================================================

export async function getMarketAnalysis(params: {
  county?: string;
  district?: string;
  min_date?: string;
  max_date?: string;
  min_project_size?: number;
  max_project_size?: number;
  limit?: number;
} = {}): Promise<MarketAnalysis> {
  const sp: Record<string, string> = {};
  if (params.county) sp.county = params.county;
  if (params.district) sp.district = params.district;
  if (params.min_date) sp.min_date = params.min_date;
  if (params.max_date) sp.max_date = params.max_date;
  if (params.min_project_size != null) sp.min_project_size = String(params.min_project_size);
  if (params.max_project_size != null) sp.max_project_size = String(params.max_project_size);
  if (params.limit != null) sp.limit = String(params.limit);
  return api.get('estimator/market-analysis', { searchParams: sp }).json();
}

export async function getLettingDates(limit?: number): Promise<LettingDate[]> {
  const sp: Record<string, string> = {};
  if (limit != null) sp.limit = String(limit);
  return api.get('estimator/letting-dates', { searchParams: sp }).json();
}

export async function getLettingReport(lettingDate: string, params?: {
  county?: string;
  district?: string;
}): Promise<LettingReport> {
  const sp: Record<string, string> = {};
  if (params?.county) sp.county = params.county;
  if (params?.district) sp.district = params.district;
  const sp2: Record<string, string> = { letting_date: lettingDate, ...sp };
  return api.get('estimator/letting-report', { searchParams: sp2 }).json();
}

export async function searchPayItemOccurrences(params: {
  pay_item_code?: string;
  description?: string;
  county?: string;
  district?: string;
  contractor?: string;
  min_date?: string;
  max_date?: string;
  min_quantity?: number;
  max_quantity?: number;
  low_bids_only?: boolean;
  page?: number;
  page_size?: number;
}): Promise<PayItemSearchResponse> {
  const sp: Record<string, string> = {};
  if (params.pay_item_code) sp.pay_item_code = params.pay_item_code;
  if (params.description) sp.description = params.description;
  if (params.county) sp.county = params.county;
  if (params.district) sp.district = params.district;
  if (params.contractor) sp.contractor = params.contractor;
  if (params.min_date) sp.min_date = params.min_date;
  if (params.max_date) sp.max_date = params.max_date;
  if (params.min_quantity != null) sp.min_quantity = String(params.min_quantity);
  if (params.max_quantity != null) sp.max_quantity = String(params.max_quantity);
  if (params.low_bids_only) sp.low_bids_only = 'true';
  if (params.page) sp.page = String(params.page);
  if (params.page_size) sp.page_size = String(params.page_size);
  return api.get('estimator/pay-item-search', { searchParams: sp }).json();
}

export async function getContractorVsMarket(pk: string, params?: {
  min_date?: string;
  county?: string;
  district?: string;
  page?: number;
  page_size?: number;
}): Promise<VsMarketResponse> {
  const sp: Record<string, string> = {};
  if (params?.min_date) sp.min_date = params.min_date;
  if (params?.county) sp.county = params.county;
  if (params?.district) sp.district = params.district;
  if (params?.page) sp.page = String(params.page);
  if (params?.page_size) sp.page_size = String(params.page_size);
  return api.get(`estimator/contractors/${pk}/vs-market`, { searchParams: sp }).json();
}
