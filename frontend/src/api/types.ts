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

// --- Reports ---

export interface PriorityBucket {
  priority: string;
  created: number;
  completed: number;
  open: number;
}

export interface WorkTypeBucket {
  work_type: string;
  count: number;
}

export interface StatusBucket {
  status: string;
  count: number;
}

export interface MonthBucket {
  month: string; // "2026-01"
  created: number;
  completed: number;
}

export interface AssigneeBucket {
  user_id: string | null;
  user_name: string;
  completed: number;
  open: number;
}

export interface TypeBucket {
  inspection_type: string;
  count: number;
}

export interface InspectionMonthBucket {
  month: string;
  completed: number;
}

export interface InspectorBucket {
  user_id: string | null;
  user_name: string;
  completed: number;
}

export interface ConditionRatingBucket {
  rating: number | null;
  count: number;
}

export interface WorkOrderReport {
  start_date: string;
  end_date: string;
  total_created: number;
  total_completed: number;
  total_open: number;
  total_cancelled: number;
  avg_days_to_complete: number | null;
  avg_emergency_response_days: number | null;
  by_priority: PriorityBucket[];
  by_work_type: WorkTypeBucket[];
  by_status: StatusBucket[];
  by_month: MonthBucket[];
  by_assignee: AssigneeBucket[];
  total_assets_affected: number;
  signs_affected: number;
  supports_affected: number;
}

export interface InspectionReport {
  start_date: string;
  end_date: string;
  total_completed: number;
  total_open: number;
  signs_inspected: number;
  coverage_rate: number | null;
  follow_ups_required: number;
  follow_ups_with_wo: number;
  follow_up_rate: number | null;
  avg_condition_rating: number | null;
  condition_distribution: ConditionRatingBucket[];
  retro_readings_taken: number;
  retro_pass_count: number;
  retro_fail_count: number;
  retro_pass_rate: number | null;
  by_type: TypeBucket[];
  by_month: InspectionMonthBucket[];
  by_inspector: InspectorBucket[];
}

export interface InventoryReport {
  as_of_date: string;
  total_signs: number;
  total_supports: number;
  condition_distribution: ConditionBucket[];
  status_distribution: StatusBucket[];
  category_distribution: CategoryBucket[];
  age_distribution: AgeBucket[];
  sheeting_distribution: SheetingBucket[];
  signs_with_retro_data: number;
  signs_passing_retro: number;
  signs_failing_retro: number;
  compliance_rate: number | null;
  overdue_for_replacement: number;
  due_within_90_days: number;
  due_within_1_year: number;
  estimated_replacement_cost: number;
  signs_added_last_30: number;
  signs_removed_last_30: number;
}

export interface CrewMemberStats {
  user_id: string;
  user_name: string;
  role: string;
  wos_assigned: number;
  wos_completed: number;
  avg_days_to_complete: number | null;
  inspections_completed: number;
  signs_inspected: number;
}

export interface CrewProductivityReport {
  start_date: string;
  end_date: string;
  crew_stats: CrewMemberStats[];
}

export interface WorkOrderReportParams {
  start_date?: string;
  end_date?: string;
  assigned_to?: string;
  priority?: string;
  work_type?: string;
}

export interface InspectionReportParams {
  start_date?: string;
  end_date?: string;
  inspector_id?: string;
  inspection_type?: string;
}

export interface InventoryReportParams {
  as_of_date?: string;
}

export interface CrewProductivityReportParams {
  start_date?: string;
  end_date?: string;
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


// --- Attachments ---

export interface Attachment {
  attachment_id: string;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  file_name: string;
  file_url: string;
  file_size_bytes: number | null;
  content_type: string | null;
  attachment_type: string;
  title: string | null;
  description: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}
