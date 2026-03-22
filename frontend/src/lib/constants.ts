// Condition rating color scheme — used in map markers and table badges
export const CONDITION_COLORS: Record<number, { label: string; hex: string; tw: string }> = {
  5: { label: 'Excellent', hex: '#22c55e', tw: 'bg-green-500' },
  4: { label: 'Good', hex: '#84cc16', tw: 'bg-lime-500' },
  3: { label: 'Fair', hex: '#eab308', tw: 'bg-yellow-500' },
  2: { label: 'Poor', hex: '#f97316', tw: 'bg-orange-500' },
  1: { label: 'Critical', hex: '#ef4444', tw: 'bg-red-500' },
};

export const UNRATED_COLOR = { label: 'Unrated', hex: '#6b7280', tw: 'bg-gray-500' };
export const INACTIVE_COLOR = { label: 'Inactive', hex: '#9ca3af', tw: 'bg-gray-400' };

export const INACTIVE_STATUSES = new Set(['missing', 'removed', 'replaced']);

export const STATUS_OPTIONS = [
  'active', 'damaged', 'faded', 'missing', 'obscured', 'replaced', 'removed',
] as const;

export function getSignColor(condition: number | null, status: string): string {
  if (INACTIVE_STATUSES.has(status)) return INACTIVE_COLOR.hex;
  if (condition && CONDITION_COLORS[condition]) return CONDITION_COLORS[condition].hex;
  return UNRATED_COLOR.hex;
}

// --- User Role constants ---

export const USER_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', description: 'Full access to all features and settings', color: 'bg-purple-100 text-purple-800' },
  { value: 'supervisor', label: 'Supervisor', description: 'Manage work orders, inspections, and assign work', color: 'bg-blue-100 text-blue-800' },
  { value: 'crew_chief', label: 'Crew Chief', description: 'View and update assigned work orders', color: 'bg-green-100 text-green-800' },
] as const;

export function getUserRoleOption(value: string) {
  return USER_ROLE_OPTIONS.find((o) => o.value === value) ?? USER_ROLE_OPTIONS[2];
}

// --- Work Order constants ---

export const WO_STATUS_OPTIONS = [
  { value: 'open', label: 'Open', color: 'bg-blue-100 text-blue-800', hex: '#3b82f6' },
  { value: 'assigned', label: 'Assigned', color: 'bg-indigo-100 text-indigo-800', hex: '#6366f1' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800', hex: '#eab308' },
  { value: 'on_hold', label: 'On Hold', color: 'bg-orange-100 text-orange-800', hex: '#f97316' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800', hex: '#22c55e' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-500', hex: '#6b7280' },
] as const;

export const WO_PRIORITY_OPTIONS = [
  { value: 'emergency', label: 'Emergency', color: 'bg-red-100 text-red-800', hex: '#ef4444' },
  { value: 'urgent', label: 'Urgent', color: 'bg-orange-100 text-orange-800', hex: '#f97316' },
  { value: 'routine', label: 'Routine', color: 'bg-blue-100 text-blue-800', hex: '#3b82f6' },
  { value: 'planned', label: 'Planned', color: 'bg-gray-100 text-gray-600', hex: '#6b7280' },
] as const;

export const WO_WORK_TYPE_OPTIONS = [
  { value: 'inspection', label: 'Inspection' },
  { value: 'repair', label: 'Repair' },
  { value: 'replacement', label: 'Replacement' },
  { value: 'installation', label: 'Installation' },
  { value: 'removal', label: 'Removal' },
  { value: 'other', label: 'Other' },
] as const;

export function getWoStatusOption(value: string) {
  return WO_STATUS_OPTIONS.find((o) => o.value === value) ?? WO_STATUS_OPTIONS[0];
}

export function getWoPriorityOption(value: string) {
  return WO_PRIORITY_OPTIONS.find((o) => o.value === value) ?? WO_PRIORITY_OPTIONS[2];
}

// --- Work Order Asset constants ---

export const WO_ACTION_OPTIONS = [
  { value: 'replace', label: 'Replace', color: 'bg-red-100 text-red-800' },
  { value: 'reinstall', label: 'Reinstall', color: 'bg-blue-100 text-blue-800' },
  { value: 'repair', label: 'Repair', color: 'bg-orange-100 text-orange-800' },
  { value: 'remove', label: 'Remove', color: 'bg-gray-100 text-gray-600' },
  { value: 'inspect', label: 'Inspect', color: 'bg-yellow-100 text-yellow-800' },
] as const;

export const WO_ASSET_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-100 text-gray-600' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-100 text-amber-800' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { value: 'skipped', label: 'Skipped', color: 'bg-gray-100 text-gray-400' },
] as const;

export function getWoActionOption(value: string | null) {
  if (!value) return null;
  return WO_ACTION_OPTIONS.find((o) => o.value === value) ?? null;
}

export function getWoAssetStatusOption(value: string) {
  return WO_ASSET_STATUS_OPTIONS.find((o) => o.value === value) ?? WO_ASSET_STATUS_OPTIONS[0];
}

// --- Support types and materials ---

export const SUPPORT_TYPE_OPTIONS = [
  'u_channel', 'square_tube', 'round_tube', 'wood', 'mast_arm', 'span_wire', 'bridge_mount',
] as const;

export const SUPPORT_MATERIAL_OPTIONS = [
  'aluminum', 'steel', 'galvanized_steel', 'wood', 'fiberglass',
] as const;

export const SUPPORT_STATUS_OPTIONS = [
  'active', 'damaged', 'leaning', 'missing', 'removed',
] as const;

// --- Inspection constants ---

export const INSPECTION_TYPE_OPTIONS = [
  { value: 'sign_condition', label: 'Sign Condition', color: 'bg-blue-100 text-blue-800', hex: '#3b82f6' },
  { value: 'sign_retroreflectivity', label: 'Retroreflectivity', color: 'bg-purple-100 text-purple-800', hex: '#a855f7' },
  { value: 'support_condition', label: 'Support Condition', color: 'bg-amber-100 text-amber-800', hex: '#f59e0b' },
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-700', hex: '#6b7280' },
] as const;

export const INSPECTION_STATUS_OPTIONS = [
  { value: 'open', label: 'Open', color: 'bg-blue-100 text-blue-800' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
] as const;

export const INSPECTION_ACTION_OPTIONS = [
  { value: 'ok', label: 'OK', color: 'bg-green-100 text-green-800' },
  { value: 'monitor', label: 'Monitor', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'repair', label: 'Repair', color: 'bg-orange-100 text-orange-800' },
  { value: 'replace', label: 'Replace', color: 'bg-red-100 text-red-800' },
] as const;

export const INSPECTION_ASSET_STATUS_OPTIONS = [
  { value: 'inspected', label: 'Inspected', color: 'bg-gray-100 text-gray-600' },
  { value: 'needs_action', label: 'Needs Action', color: 'bg-red-100 text-red-800' },
  { value: 'deferred', label: 'Deferred', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'ok', label: 'OK', color: 'bg-green-100 text-green-800' },
] as const;

export function getInspectionTypeOption(value: string) {
  return INSPECTION_TYPE_OPTIONS.find((o) => o.value === value) ?? INSPECTION_TYPE_OPTIONS[3];
}

export function getInspectionStatusOption(value: string) {
  return INSPECTION_STATUS_OPTIONS.find((o) => o.value === value) ?? INSPECTION_STATUS_OPTIONS[0];
}

export function getInspectionActionOption(value: string | null) {
  if (!value) return null;
  return INSPECTION_ACTION_OPTIONS.find((o) => o.value === value) ?? null;
}

export function formatEnumLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Work Order map marker colors (by priority) ---

export const WO_PRIORITY_COLORS: Record<string, string> = {
  emergency: '#ef4444',
  urgent: '#f97316',
  routine: '#3b82f6',
  planned: '#6b7280',
};

export function getWoPriorityMarkerColor(priority: string): string {
  return WO_PRIORITY_COLORS[priority] ?? '#6b7280';
}

// --- Inspection map marker colors ---

export function getInspectionMarkerColor(
  followUpRequired: boolean,
  followUpWOId: string | null,
  status: string,
): string {
  if (followUpRequired && !followUpWOId) return '#ef4444';
  if (followUpRequired && followUpWOId) return '#3b82f6';
  if (status === 'completed') return '#22c55e';
  return '#eab308';
}
