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

// ---------------------------------------------------------------------------
// Sewer Module
// ---------------------------------------------------------------------------

// --- Reference / Lookup Types ---

export interface SewerMaterialType {
  code: string;
  description: string;
  expected_life_years: number | null;
  is_active: boolean;
}

export interface SewerPipeShape {
  code: string;
  description: string;
  is_active: boolean;
}

export interface ManholeType {
  code: string;
  description: string;
  is_active: boolean;
}

// --- Manhole (Point) ---

export interface Manhole {
  manhole_id: string;
  tenant_id: string;
  asset_tag: string | null;
  description: string | null;
  manhole_type_code: string | null;
  material: string | null;
  diameter_inches: number | null;
  rim_elevation_ft: number | null;
  invert_elevation_ft: number | null;
  depth_ft: number | null;
  cover_type: string | null;
  cover_diameter_inches: number | null;
  frame_type: string | null;
  has_steps: boolean | null;
  step_material: string | null;
  cone_type: string | null;
  chimney_height_inches: number | null;
  channel_type: string | null;
  bench_type: string | null;
  system_type: string;
  macp_grade: number | null;
  macp_score: number | null;
  last_macp_date: string | null;
  status: string;
  install_date: string | null;
  condition_rating: number | null;
  custom_fields: Record<string, unknown> | null;
  notes: string | null;
  longitude: number;
  latitude: number;
  pipe_connection_count: number;
  created_at: string;
  updated_at: string;
}

export interface ManholeCreate {
  asset_tag?: string;
  description?: string;
  manhole_type_code?: string;
  material?: string;
  diameter_inches?: number;
  rim_elevation_ft?: number;
  invert_elevation_ft?: number;
  depth_ft?: number;
  cover_type?: string;
  cover_diameter_inches?: number;
  frame_type?: string;
  has_steps?: boolean;
  step_material?: string;
  cone_type?: string;
  chimney_height_inches?: number;
  channel_type?: string;
  bench_type?: string;
  system_type?: string;
  macp_grade?: number;
  macp_score?: number;
  last_macp_date?: string;
  status?: string;
  install_date?: string;
  condition_rating?: number;
  custom_fields?: Record<string, unknown>;
  notes?: string;
  longitude: number;
  latitude: number;
}

export interface ManholeListResponse {
  manholes: Manhole[];
  total: number;
  page: number;
  page_size: number;
}

// --- Sewer Main — Gravity (LineString) ---

export interface SewerMain {
  sewer_main_id: string;
  tenant_id: string;
  asset_tag: string | null;
  description: string | null;
  material_code: string | null;
  shape_code: string | null;
  diameter_inches: number | null;
  height_inches: number | null;
  width_inches: number | null;
  length_feet: number | null;
  lining_type: string | null;
  lining_date: string | null;
  lining_thickness_mm: number | null;
  depth_ft_upstream: number | null;
  depth_ft_downstream: number | null;
  slope_pct: number | null;
  upstream_invert_ft: number | null;
  downstream_invert_ft: number | null;
  upstream_manhole_id: string | null;
  downstream_manhole_id: string | null;
  system_type: string;
  owner: string;
  maintained_by: string | null;
  pacp_grade: number | null;
  pacp_structural_score: number | null;
  pacp_om_score: number | null;
  last_pacp_date: string | null;
  status: string;
  install_date: string | null;
  condition_rating: number | null;
  expected_life_years: number | null;
  replacement_cost: number | null;
  custom_fields: Record<string, unknown> | null;
  notes: string | null;
  coordinates: number[][] | null;
  created_at: string;
  updated_at: string;
}

export interface SewerMainCreate {
  asset_tag?: string;
  description?: string;
  material_code?: string;
  shape_code?: string;
  diameter_inches?: number;
  height_inches?: number;
  width_inches?: number;
  length_feet?: number;
  lining_type?: string;
  lining_date?: string;
  lining_thickness_mm?: number;
  depth_ft_upstream?: number;
  depth_ft_downstream?: number;
  slope_pct?: number;
  upstream_invert_ft?: number;
  downstream_invert_ft?: number;
  upstream_manhole_id?: string;
  downstream_manhole_id?: string;
  system_type?: string;
  owner?: string;
  maintained_by?: string;
  pacp_grade?: number;
  pacp_structural_score?: number;
  pacp_om_score?: number;
  last_pacp_date?: string;
  status?: string;
  install_date?: string;
  condition_rating?: number;
  expected_life_years?: number;
  replacement_cost?: number;
  custom_fields?: Record<string, unknown>;
  notes?: string;
  coordinates: number[][];
}

export interface SewerMainListResponse {
  sewer_mains: SewerMain[];
  total: number;
  page: number;
  page_size: number;
}

// --- Force Main — Pressurized (LineString) ---

export interface ForceMain {
  force_main_id: string;
  tenant_id: string;
  asset_tag: string | null;
  description: string | null;
  material_code: string | null;
  diameter_inches: number | null;
  length_feet: number | null;
  pressure_class: string | null;
  depth_feet: number | null;
  lift_station_id: string | null;
  discharge_manhole_id: string | null;
  has_cathodic_protection: boolean | null;
  cp_test_date: string | null;
  arv_count: number | null;
  owner: string;
  maintained_by: string | null;
  status: string;
  install_date: string | null;
  condition_rating: number | null;
  custom_fields: Record<string, unknown> | null;
  notes: string | null;
  coordinates: number[][] | null;
  created_at: string;
  updated_at: string;
}

export interface ForceMainCreate {
  asset_tag?: string;
  description?: string;
  material_code?: string;
  diameter_inches?: number;
  length_feet?: number;
  pressure_class?: string;
  depth_feet?: number;
  lift_station_id?: string;
  discharge_manhole_id?: string;
  has_cathodic_protection?: boolean;
  cp_test_date?: string;
  arv_count?: number;
  owner?: string;
  maintained_by?: string;
  status?: string;
  install_date?: string;
  condition_rating?: number;
  custom_fields?: Record<string, unknown>;
  notes?: string;
  coordinates: number[][];
}

export interface ForceMainListResponse {
  force_mains: ForceMain[];
  total: number;
  page: number;
  page_size: number;
}

// --- Lift Station / Pump Station (Point) ---

export interface LiftStation {
  lift_station_id: string;
  tenant_id: string;
  asset_tag: string | null;
  station_name: string | null;
  description: string | null;
  wet_well_depth_ft: number | null;
  wet_well_diameter_ft: number | null;
  wet_well_material: string | null;
  pump_count: number | null;
  pump_type: string | null;
  pump_hp: number | null;
  firm_capacity_gpm: number | null;
  design_capacity_gpm: number | null;
  control_type: string | null;
  has_scada: boolean | null;
  has_backup_power: boolean | null;
  backup_power_type: string | null;
  has_alarm: boolean | null;
  alarm_type: string | null;
  electrical_service: string | null;
  voltage: number | null;
  owner: string;
  maintained_by: string | null;
  status: string;
  install_date: string | null;
  condition_rating: number | null;
  custom_fields: Record<string, unknown> | null;
  notes: string | null;
  longitude: number;
  latitude: number;
  force_main_count: number;
  created_at: string;
  updated_at: string;
}

export interface LiftStationCreate {
  asset_tag?: string;
  station_name?: string;
  description?: string;
  wet_well_depth_ft?: number;
  wet_well_diameter_ft?: number;
  wet_well_material?: string;
  pump_count?: number;
  pump_type?: string;
  pump_hp?: number;
  firm_capacity_gpm?: number;
  design_capacity_gpm?: number;
  control_type?: string;
  has_scada?: boolean;
  has_backup_power?: boolean;
  backup_power_type?: string;
  has_alarm?: boolean;
  alarm_type?: string;
  electrical_service?: string;
  voltage?: number;
  owner?: string;
  maintained_by?: string;
  status?: string;
  install_date?: string;
  condition_rating?: number;
  custom_fields?: Record<string, unknown>;
  notes?: string;
  longitude: number;
  latitude: number;
}

export interface LiftStationListResponse {
  lift_stations: LiftStation[];
  total: number;
  page: number;
  page_size: number;
}

// --- Sewer Lateral / Service Connection (Point or LineString) ---

export interface SewerLateral {
  sewer_lateral_id: string;
  tenant_id: string;
  asset_tag: string | null;
  service_type: string | null;
  material_code: string | null;
  diameter_inches: number | null;
  length_feet: number | null;
  depth_at_main_ft: number | null;
  connected_main_id: string | null;
  tap_location: string | null;
  has_cleanout: boolean | null;
  cleanout_location: string | null;
  address: string | null;
  account_number: string | null;
  status: string;
  install_date: string | null;
  custom_fields: Record<string, unknown> | null;
  notes: string | null;
  longitude: number | null;
  latitude: number | null;
  coordinates: number[][] | null;
  created_at: string;
  updated_at: string;
}

export interface SewerLateralCreate {
  asset_tag?: string;
  service_type?: string;
  material_code?: string;
  diameter_inches?: number;
  length_feet?: number;
  depth_at_main_ft?: number;
  connected_main_id?: string;
  tap_location?: string;
  has_cleanout?: boolean;
  cleanout_location?: string;
  address?: string;
  account_number?: string;
  status?: string;
  install_date?: string;
  custom_fields?: Record<string, unknown>;
  notes?: string;
  longitude?: number;
  latitude?: number;
  coordinates?: number[][];
}

export interface SewerLateralListResponse {
  sewer_laterals: SewerLateral[];
  total: number;
  page: number;
  page_size: number;
}

// ---------------------------------------------------------------------------
// Water Module
// ---------------------------------------------------------------------------

// --- Reference / Lookup Types ---

export interface WaterMaterialType {
  code: string;
  description: string;
  expected_life_years: number | null;
  is_active: boolean;
}

export interface WaterValveType {
  code: string;
  description: string;
  exercise_interval_days: number | null;
  is_active: boolean;
}

// --- Water Main (LineString) ---

export interface WaterMain {
  water_main_id: string;
  tenant_id: string;
  asset_tag: string | null;
  description: string | null;
  material_code: string | null;
  diameter_inches: number | null;
  length_feet: number | null;
  pressure_class: string | null;
  shape: string | null;
  lining_type: string | null;
  lining_date: string | null;
  depth_feet: number | null;
  soil_type: string | null;
  owner: string;
  maintained_by: string | null;
  status: string;
  install_date: string | null;
  expected_life_years: number | null;
  replacement_cost: number | null;
  flow_direction: string | null;
  pressure_zone_id: string | null;
  upstream_node_type: string | null;
  upstream_node_id: string | null;
  downstream_node_type: string | null;
  downstream_node_id: string | null;
  break_count: number;
  condition_rating: number | null;
  custom_fields: Record<string, unknown> | null;
  notes: string | null;
  coordinates: number[][] | null;
  created_at: string;
  updated_at: string;
}

export interface WaterMainCreate {
  asset_tag?: string;
  description?: string;
  material_code?: string;
  diameter_inches?: number;
  length_feet?: number;
  pressure_class?: string;
  shape?: string;
  lining_type?: string;
  lining_date?: string;
  depth_feet?: number;
  soil_type?: string;
  owner?: string;
  maintained_by?: string;
  status?: string;
  install_date?: string;
  expected_life_years?: number;
  replacement_cost?: number;
  flow_direction?: string;
  pressure_zone_id?: string;
  upstream_node_type?: string;
  upstream_node_id?: string;
  downstream_node_type?: string;
  downstream_node_id?: string;
  break_count?: number;
  condition_rating?: number;
  custom_fields?: Record<string, unknown>;
  notes?: string;
  coordinates: number[][];
}

export interface WaterMainListResponse {
  water_mains: WaterMain[];
  total: number;
  page: number;
  page_size: number;
}

// --- Water Valve (Point) ---

export interface WaterValve {
  water_valve_id: string;
  tenant_id: string;
  asset_tag: string | null;
  description: string | null;
  valve_type_code: string | null;
  size_inches: number | null;
  manufacturer: string | null;
  model: string | null;
  material: string | null;
  turns_to_close: number | null;
  turn_direction: string | null;
  normal_position: string;
  current_position: string | null;
  is_operable: string | null;
  is_critical: boolean;
  installation_type: string | null;
  depth_feet: number | null;
  status: string;
  install_date: string | null;
  condition_rating: number | null;
  last_exercised_date: string | null;
  exercise_interval_days: number | null;
  pressure_zone_id: string | null;
  custom_fields: Record<string, unknown> | null;
  notes: string | null;
  longitude: number | null;
  latitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface WaterValveCreate {
  asset_tag?: string;
  description?: string;
  valve_type_code?: string;
  size_inches?: number;
  manufacturer?: string;
  model?: string;
  material?: string;
  turns_to_close?: number;
  turn_direction?: string;
  normal_position?: string;
  current_position?: string;
  is_operable?: string;
  is_critical?: boolean;
  installation_type?: string;
  depth_feet?: number;
  status?: string;
  install_date?: string;
  condition_rating?: number;
  last_exercised_date?: string;
  exercise_interval_days?: number;
  pressure_zone_id?: string;
  custom_fields?: Record<string, unknown>;
  notes?: string;
  longitude: number;
  latitude: number;
}

export interface WaterValveListResponse {
  water_valves: WaterValve[];
  total: number;
  page: number;
  page_size: number;
}

// --- Fire Hydrant (Point) ---

export interface FireHydrant {
  hydrant_id: string;
  tenant_id: string;
  asset_tag: string | null;
  description: string | null;
  make: string | null;
  model: string | null;
  year_manufactured: number | null;
  barrel_type: string | null;
  nozzle_count: number | null;
  nozzle_sizes: string | null;
  flow_test_date: string | null;
  static_pressure_psi: number | null;
  residual_pressure_psi: number | null;
  pitot_pressure_psi: number | null;
  flow_gpm: number | null;
  flow_class_color: string | null;
  last_flush_date: string | null;
  flush_interval_days: number | null;
  status: string;
  out_of_service_reason: string | null;
  install_date: string | null;
  condition_rating: number | null;
  ownership: string;
  auxiliary_valve_id: string | null;
  lateral_size_inches: number | null;
  main_size_inches: number | null;
  connected_main_id: string | null;
  pressure_zone_id: string | null;
  custom_fields: Record<string, unknown> | null;
  notes: string | null;
  longitude: number | null;
  latitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface FireHydrantCreate {
  asset_tag?: string;
  description?: string;
  make?: string;
  model?: string;
  year_manufactured?: number;
  barrel_type?: string;
  nozzle_count?: number;
  nozzle_sizes?: string;
  flow_test_date?: string;
  static_pressure_psi?: number;
  residual_pressure_psi?: number;
  pitot_pressure_psi?: number;
  flow_gpm?: number;
  flow_class_color?: string;
  last_flush_date?: string;
  flush_interval_days?: number;
  status?: string;
  out_of_service_reason?: string;
  install_date?: string;
  condition_rating?: number;
  ownership?: string;
  auxiliary_valve_id?: string;
  lateral_size_inches?: number;
  main_size_inches?: number;
  connected_main_id?: string;
  pressure_zone_id?: string;
  custom_fields?: Record<string, unknown>;
  notes?: string;
  longitude: number;
  latitude: number;
}

export interface FireHydrantListResponse {
  hydrants: FireHydrant[];
  total: number;
  page: number;
  page_size: number;
}

// --- Water Service Connection (Point or LineString) ---

export interface WaterService {
  water_service_id: string;
  tenant_id: string;
  asset_tag: string | null;
  service_type: string;
  meter_number: string | null;
  meter_size_inches: number | null;
  meter_type: string | null;
  service_line_material: string | null;
  service_line_size_inches: number | null;
  tap_main_id: string | null;
  address: string | null;
  account_number: string | null;
  curb_stop_location: string | null;
  status: string;
  install_date: string | null;
  custom_fields: Record<string, unknown> | null;
  notes: string | null;
  longitude: number | null;
  latitude: number | null;
  coordinates: number[][] | null;
  created_at: string;
  updated_at: string;
}

export interface WaterServiceCreate {
  asset_tag?: string;
  service_type: string;
  meter_number?: string;
  meter_size_inches?: number;
  meter_type?: string;
  service_line_material?: string;
  service_line_size_inches?: number;
  tap_main_id?: string;
  address?: string;
  account_number?: string;
  curb_stop_location?: string;
  status?: string;
  install_date?: string;
  custom_fields?: Record<string, unknown>;
  notes?: string;
  longitude?: number;
  latitude?: number;
  coordinates?: number[][];
}

export interface WaterServiceListResponse {
  water_services: WaterService[];
  total: number;
  page: number;
  page_size: number;
}

// --- Water Fitting (Point) ---

export interface WaterFitting {
  water_fitting_id: string;
  tenant_id: string;
  asset_tag: string | null;
  fitting_type: string;
  material_code: string | null;
  primary_size_inches: number | null;
  secondary_size_inches: number | null;
  status: string;
  install_date: string | null;
  custom_fields: Record<string, unknown> | null;
  notes: string | null;
  longitude: number | null;
  latitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface WaterFittingCreate {
  asset_tag?: string;
  fitting_type: string;
  material_code?: string;
  primary_size_inches?: number;
  secondary_size_inches?: number;
  status?: string;
  install_date?: string;
  custom_fields?: Record<string, unknown>;
  notes?: string;
  longitude: number;
  latitude: number;
}

export interface WaterFittingListResponse {
  water_fittings: WaterFitting[];
  total: number;
  page: number;
  page_size: number;
}

// --- Pressure Zone (Polygon) ---

export interface PressureZone {
  pressure_zone_id: string;
  tenant_id: string;
  zone_name: string;
  zone_number: string | null;
  target_pressure_min_psi: number | null;
  target_pressure_max_psi: number | null;
  description: string | null;
  coordinates: number[][][] | null;
  created_at: string;
  updated_at: string;
}

export interface PressureZoneCreate {
  zone_name: string;
  zone_number?: string;
  target_pressure_min_psi?: number;
  target_pressure_max_psi?: number;
  description?: string;
  coordinates?: number[][][];
}

export interface PressureZoneListResponse {
  pressure_zones: PressureZone[];
  total: number;
  page: number;
  page_size: number;
}
