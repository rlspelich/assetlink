// Mirrors backend Pydantic schemas exactly

export interface Sign {
  sign_id: string;
  tenant_id: string;
  asset_tag: string | null;
  support_id: string | null;
  mutcd_code: string | null;
  description: string | null;
  legend_text: string | null;
  sign_category: string | null;
  size_width_inches: number | null;
  size_height_inches: number | null;
  shape: string | null;
  background_color: string | null;
  condition_rating: number | null;
  road_name: string | null;
  address: string | null;
  side_of_road: string | null;
  intersection_with: string | null;
  location_notes: string | null;
  sheeting_type: string | null;
  sheeting_manufacturer: string | null;
  expected_life_years: number | null;
  install_date: string | null;
  expected_replacement_date: string | null;
  last_measured_date: string | null;
  measured_value: number | null;
  passes_minimum: boolean | null;
  last_inspected_date: string | null;
  last_replaced_date: string | null;
  replacement_cost_estimate: number | null;
  status: string;
  facing_direction: number | null;
  mount_height_inches: number | null;
  offset_from_road_inches: number | null;
  custom_fields: Record<string, unknown> | null;
  longitude: number;
  latitude: number;
  support_type: string | null;
  support_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignCreate {
  asset_tag?: string;
  mutcd_code?: string;
  description?: string;
  legend_text?: string;
  sign_category?: string;
  size_width_inches?: number;
  size_height_inches?: number;
  shape?: string;
  background_color?: string;
  condition_rating?: number;
  road_name?: string;
  address?: string;
  side_of_road?: string;
  intersection_with?: string;
  location_notes?: string;
  sheeting_type?: string;
  sheeting_manufacturer?: string;
  expected_life_years?: number;
  install_date?: string;
  status?: string;
  facing_direction?: number;
  mount_height_inches?: number;
  custom_fields?: Record<string, unknown>;
  longitude: number;
  latitude: number;
  support_id?: string;
}

export interface SignListResponse {
  signs: Sign[];
  total: number;
  page: number;
  page_size: number;
}

export interface SignType {
  mutcd_code: string;
  category: string;
  description: string;
  standard_width: number | null;
  standard_height: number | null;
  shape: string | null;
  background_color: string | null;
  legend_color: string | null;
  default_sheeting_type: string | null;
  expected_life_years: number | null;
  thumbnail_url: string | null;
}

export interface SignImportResult {
  // Backward compat
  created: number;
  skipped: number;
  total_rows: number;
  // New detailed counts
  signs_created: number;
  signs_skipped: number;
  signs_total_rows: number;
  supports_created: number;
  supports_skipped: number;
  supports_total_rows: number;
  import_mode: string; // "signs_only" | "signs_and_supports" | "supports_only"
  support_groups: number;
  signs_linked_to_supports: number;
  support_column_mapping: Record<string, string>;
  // Existing
  errors: Array<{ row: number; field: string; message: string }>;
  column_mapping: Record<string, string>;
  unmapped_columns: string[];
  duration_seconds: number | null;
  rows_per_second: number | null;
}

export interface WorkOrderAsset {
  work_order_asset_id: string;
  work_order_id: string;
  asset_type: string;  // "sign", "sign_support"
  asset_id: string;
  damage_notes: string | null;
  action_required: string | null;  // replace, reinstall, repair, remove, inspect
  resolution: string | null;
  status: string;  // pending, in_progress, completed, skipped
  asset_label: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderAssetUpdate {
  damage_notes?: string | null;
  action_required?: string | null;
  resolution?: string | null;
  status?: string | null;
}

export interface WorkOrder {
  work_order_id: string;
  tenant_id: string;
  work_order_number: string | null;
  asset_type: string | null;
  asset_id: string | null;
  sign_id: string | null;
  description: string | null;
  work_type: string;
  priority: string;
  status: string;
  category: string | null;
  resolution: string | null;
  assigned_to: string | null;
  supervisor_id: string | null;
  requested_by: string | null;
  due_date: string | null;
  projected_start_date: string | null;
  projected_finish_date: string | null;
  actual_start_date: string | null;
  actual_finish_date: string | null;
  completed_date: string | null;
  closed_date: string | null;
  address: string | null;
  location_notes: string | null;
  labor_hours: number | null;
  labor_cost: number | null;
  material_cost: number | null;
  equipment_cost: number | null;
  total_cost: number | null;
  instructions: string | null;
  notes: string | null;
  materials_used: Record<string, unknown> | null;
  custom_fields: Record<string, unknown> | null;
  longitude: number | null;
  latitude: number | null;
  assets: WorkOrderAsset[];
  created_at: string;
  updated_at: string;
}

export interface WorkOrderAssetCreatePayload {
  asset_type: string;
  asset_id: string;
  damage_notes?: string;
  action_required?: string;
}

export interface WorkOrderCreate {
  work_type: string;
  description?: string;
  priority?: string;
  status?: string;
  category?: string;
  asset_type?: string;
  asset_id?: string;
  sign_id?: string;
  support_id?: string;
  assets?: WorkOrderAssetCreatePayload[];
  assigned_to?: string;
  supervisor_id?: string;
  requested_by?: string;
  due_date?: string;
  projected_start_date?: string;
  projected_finish_date?: string;
  address?: string;
  location_notes?: string;
  instructions?: string;
  notes?: string;
  custom_fields?: Record<string, unknown>;
  longitude?: number;
  latitude?: number;
}

export interface WorkOrderUpdate {
  description?: string;
  work_type?: string;
  priority?: string;
  status?: string;
  category?: string;
  resolution?: string;
  assigned_to?: string;
  supervisor_id?: string;
  due_date?: string;
  projected_start_date?: string;
  projected_finish_date?: string;
  actual_start_date?: string;
  actual_finish_date?: string;
  address?: string;
  location_notes?: string;
  instructions?: string;
  notes?: string;
  labor_hours?: number;
  labor_cost?: number;
  material_cost?: number;
  equipment_cost?: number;
  total_cost?: number;
  materials_used?: Record<string, unknown>;
  custom_fields?: Record<string, unknown>;
  assets_to_add?: WorkOrderAssetCreatePayload[];
  assets_to_remove?: string[];
}

export interface WorkOrderListResponse {
  work_orders: WorkOrder[];
  total: number;
  page: number;
  page_size: number;
}

// --- Inspections ---

export interface InspectionAsset {
  inspection_asset_id: string;
  inspection_id: string;
  tenant_id: string;
  asset_type: string;  // "sign", "sign_support"
  asset_id: string;
  condition_rating: number | null;
  findings: string | null;
  defects: Record<string, unknown> | null;
  retroreflectivity_value: number | null;
  passes_minimum_retro: boolean | null;
  action_recommended: string | null;  // replace, repair, monitor, ok
  status: string;  // inspected, needs_action, deferred, ok
  asset_label: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionAssetCreatePayload {
  asset_type: string;
  asset_id: string;
  condition_rating?: number;
  findings?: string;
  defects?: Record<string, unknown>;
  retroreflectivity_value?: number;
  passes_minimum_retro?: boolean;
  action_recommended?: string;
  status?: string;
}

export interface Inspection {
  inspection_id: string;
  tenant_id: string;
  inspection_number: string | null;
  asset_type: string | null;
  asset_id: string | null;
  sign_id: string | null;
  work_order_id: string | null;
  inspection_type: string;
  inspection_date: string;
  inspector_id: string | null;
  status: string;
  condition_rating: number | null;
  findings: string | null;
  defects: Record<string, unknown> | null;
  recommendations: string | null;
  repairs_made: string | null;
  retroreflectivity_value: number | null;
  passes_minimum_retro: boolean | null;
  follow_up_required: boolean;
  follow_up_work_order_id: string | null;
  custom_fields: Record<string, unknown> | null;
  longitude: number | null;
  latitude: number | null;
  assets: InspectionAsset[];
  created_at: string;
  updated_at: string;
}

export interface InspectionCreate {
  inspection_type: string;
  inspection_date: string;
  asset_type?: string;
  asset_id?: string;
  sign_id?: string;
  support_id?: string;
  work_order_id?: string;
  inspector_id?: string;
  status?: string;
  condition_rating?: number;
  findings?: string;
  defects?: Record<string, unknown>;
  recommendations?: string;
  repairs_made?: string;
  retroreflectivity_value?: number;
  passes_minimum_retro?: boolean;
  follow_up_required?: boolean;
  custom_fields?: Record<string, unknown>;
  longitude?: number;
  latitude?: number;
  assets?: InspectionAssetCreatePayload[];
}

export interface InspectionUpdate {
  inspection_type?: string;
  inspection_date?: string;
  inspector_id?: string;
  status?: string;
  condition_rating?: number;
  findings?: string;
  defects?: Record<string, unknown>;
  recommendations?: string;
  repairs_made?: string;
  retroreflectivity_value?: number;
  passes_minimum_retro?: boolean;
  follow_up_required?: boolean;
  custom_fields?: Record<string, unknown>;
  assets_to_add?: InspectionAssetCreatePayload[];
  assets_to_remove?: string[];
}

export interface InspectionListResponse {
  inspections: Inspection[];
  total: number;
  page: number;
  page_size: number;
}

// --- Users ---

export interface User {
  user_id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  role: string;
  employee_id: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  employee_id?: string;
  phone?: string;
}

export interface UserUpdate {
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
  employee_id?: string | null;
  phone?: string | null;
  is_active?: boolean;
}

export interface UserListResponse {
  users: User[];
  total: number;
}

// --- Sign Supports ---

export interface SignSupport {
  support_id: string;
  tenant_id: string;
  asset_tag: string | null;
  support_type: string;
  support_material: string | null;
  install_date: string | null;
  condition_rating: number | null;
  height_inches: number | null;
  status: string;
  notes: string | null;
  longitude: number;
  latitude: number;
  sign_count: number;
  created_at: string;
  updated_at: string;
}

export interface SignSupportDetail extends SignSupport {
  signs: Sign[];
}

export interface SignSupportCreate {
  asset_tag?: string;
  support_type: string;
  support_material?: string;
  install_date?: string;
  condition_rating?: number;
  height_inches?: number;
  status?: string;
  notes?: string;
  longitude: number;
  latitude: number;
}

export interface SignSupportListResponse {
  supports: SignSupport[];
  total: number;
  page: number;
  page_size: number;
}

// --- Compliance Dashboard ---

export interface ConditionBucket {
  rating: number | null;
  label: string;
  count: number;
}

export interface AgeBucket {
  range: string;
  count: number;
}

export interface SheetingBucket {
  sheeting_type: string;
  count: number;
}

export interface CategoryBucket {
  category: string;
  count: number;
}

export interface PrioritySign {
  sign_id: string;
  asset_tag: string | null;
  mutcd_code: string | null;
  description: string | null;
  road_name: string | null;
  intersection_with: string | null;
  condition_rating: number | null;
  status: string;
  install_date: string | null;
  expected_replacement_date: string | null;
  days_overdue: number | null;
  measured_value: number | null;
  passes_minimum: boolean | null;
  sheeting_type: string | null;
  last_inspected_date: string | null;
  replacement_cost_estimate: number | null;
  longitude: number;
  latitude: number;
  priority_score: number;
}

export interface ComplianceDashboard {
  total_signs: number;
  total_supports: number;
  signs_passing_retro: number;
  signs_failing_retro: number;
  signs_retro_unknown: number;
  compliance_rate: number | null;
  signs_overdue_replacement: number;
  signs_due_soon: number;
  signs_missing: number;
  signs_damaged: number;
  signs_faded: number;
  signs_never_inspected: number;
  signs_inspection_overdue: number;
  signs_inspected_recently: number;
  condition_distribution: ConditionBucket[];
  age_distribution: AgeBucket[];
  sheeting_distribution: SheetingBucket[];
  estimated_replacement_cost: number;
  replacements_this_year: number;
  replacements_next_year: number;
  replacements_year_after: number;
  priority_signs: PrioritySign[];
  category_distribution: CategoryBucket[];
}
