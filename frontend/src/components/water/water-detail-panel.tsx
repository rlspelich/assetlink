import { useState } from 'react';
import {
  X, MapPin, Calendar, Wrench, Pencil, Trash2, Loader2,
  ClipboardCheck, Gauge, Droplets, Info, Thermometer, Zap,
} from 'lucide-react';
import type { WaterMain, WaterValve, FireHydrant, WaterService, WaterFitting, PressureZone } from '../../api/types';
import {
  CONDITION_COLORS, UNRATED_COLOR, INACTIVE_COLOR, INACTIVE_STATUSES,
  formatEnumLabel, HYDRANT_FLOW_COLORS,
} from '../../lib/constants';

interface WaterDetailPanelProps {
  assetType: string;
  data: unknown;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  onCreateWorkOrder?: () => void;
  onInspect?: () => void;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}

function conditionBadge(rating: number | null, status: string) {
  const isInactive = INACTIVE_STATUSES.has(status) || status === 'inactive' || status === 'abandoned';
  const color = isInactive ? INACTIVE_COLOR : rating ? CONDITION_COLORS[rating] : UNRATED_COLOR;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: color.hex + '20', color: color.hex }}>
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color.hex }} />
      {rating ? `${rating}/5 - ${color.label}` : color.label}
    </span>
  );
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-600',
    abandoned: 'bg-gray-100 text-gray-500',
    removed: 'bg-gray-100 text-gray-500',
    proposed: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="py-4 border-b border-gray-100 last:border-b-0">
      <h4 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        <Icon size={14} />
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '' || value === false) return null;
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  );
}

function BooleanField({ label, value }: { label: string; value: boolean | null | undefined }) {
  if (value === null || value === undefined) return null;
  return (
    <Field label={label} value={
      <span className={value ? 'text-green-700 font-medium' : 'text-gray-500'}>
        {value ? 'Yes' : 'No'}
      </span>
    } />
  );
}

export function WaterDetailPanel({ assetType, data, onClose, onEdit, onDelete, isDeleting, onCreateWorkOrder, onInspect }: WaterDetailPanelProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const typeLabel = assetType === 'mains' ? 'Water Main'
    : assetType === 'valves' ? 'Water Valve'
    : assetType === 'hydrants' ? 'Fire Hydrant'
    : assetType === 'services' ? 'Water Service'
    : assetType === 'fittings' ? 'Water Fitting'
    : 'Pressure Zone';

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{typeLabel}</div>
          <div className="font-semibold text-gray-900 text-sm truncate">
            {getTitle(assetType, data)}
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {assetType !== 'zones' && conditionBadge(getCondition(assetType, data), getStatus(assetType, data))}
            {statusBadge(getStatus(assetType, data))}
          </div>
          <div className="flex gap-1.5 mt-2">
            {onCreateWorkOrder && assetType !== 'zones' && (
              <button
                onClick={onCreateWorkOrder}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <Wrench size={12} />
                Work Order
              </button>
            )}
            {onInspect && assetType !== 'zones' && (
              <button
                onClick={onInspect}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              >
                <ClipboardCheck size={12} />
                Inspect
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <button onClick={onEdit} title="Edit" className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-600">
              <Pencil size={16} />
            </button>
          )}
          {onDelete && (
            <button onClick={() => setShowDeleteConfirm(true)} title="Delete" className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-red-600">
              <Trash2 size={16} />
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <p className="text-xs text-gray-800 font-medium mb-2">Delete this {typeLabel.toLowerCase()}?</p>
          <div className="space-y-2">
            <button
              onClick={() => { onDelete?.(); setShowDeleteConfirm(false); }}
              disabled={isDeleting}
              className="w-full px-3 py-2 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-left"
            >
              <div className="font-medium flex items-center gap-1">
                {isDeleting && <Loader2 size={10} className="animate-spin" />}
                Delete Permanently
              </div>
            </button>
            <button onClick={() => setShowDeleteConfirm(false)} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4">
        {assetType === 'mains' && <WaterMainDetail data={data as WaterMain} />}
        {assetType === 'valves' && <WaterValveDetail data={data as WaterValve} />}
        {assetType === 'hydrants' && <HydrantDetail data={data as FireHydrant} />}
        {assetType === 'services' && <WaterServiceDetail data={data as WaterService} />}
        {assetType === 'fittings' && <WaterFittingDetail data={data as WaterFitting} />}
        {assetType === 'zones' && <PressureZoneDetail data={data as PressureZone} />}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-gray-50 text-[10px] text-gray-400">
        <div>Created: {formatDate(getCreatedAt(assetType, data))}</div>
        <div>Updated: {formatDate(getUpdatedAt(assetType, data))}</div>
        <div className="font-mono truncate mt-0.5">{getId(assetType, data)}</div>
      </div>
    </div>
  );
}

// --- Helpers ---

function getTitle(type: string, data: unknown): string {
  switch (type) {
    case 'mains': { const d = data as WaterMain; return d.asset_tag || `WM-${d.water_main_id.slice(0, 8)}`; }
    case 'valves': { const d = data as WaterValve; return d.asset_tag || `VLV-${d.water_valve_id.slice(0, 8)}`; }
    case 'hydrants': { const d = data as FireHydrant; return d.asset_tag || `HYD-${d.hydrant_id.slice(0, 8)}`; }
    case 'services': { const d = data as WaterService; return d.asset_tag || d.address || `SVC-${d.water_service_id.slice(0, 8)}`; }
    case 'fittings': { const d = data as WaterFitting; return d.asset_tag || `FIT-${d.water_fitting_id.slice(0, 8)}`; }
    case 'zones': { const d = data as PressureZone; return d.zone_name; }
    default: return 'Unknown';
  }
}

function getCondition(type: string, data: unknown): number | null {
  switch (type) {
    case 'mains': return (data as WaterMain).condition_rating;
    case 'valves': return (data as WaterValve).condition_rating;
    case 'hydrants': return (data as FireHydrant).condition_rating;
    default: return null;
  }
}

function getStatus(type: string, data: unknown): string {
  switch (type) {
    case 'mains': return (data as WaterMain).status;
    case 'valves': return (data as WaterValve).status;
    case 'hydrants': return (data as FireHydrant).status;
    case 'services': return (data as WaterService).status;
    case 'fittings': return (data as WaterFitting).status;
    default: return 'active';
  }
}

function getId(type: string, data: unknown): string {
  switch (type) {
    case 'mains': return (data as WaterMain).water_main_id;
    case 'valves': return (data as WaterValve).water_valve_id;
    case 'hydrants': return (data as FireHydrant).hydrant_id;
    case 'services': return (data as WaterService).water_service_id;
    case 'fittings': return (data as WaterFitting).water_fitting_id;
    case 'zones': return (data as PressureZone).pressure_zone_id;
    default: return '';
  }
}

function getCreatedAt(type: string, data: unknown): string {
  switch (type) {
    case 'mains': return (data as WaterMain).created_at;
    case 'valves': return (data as WaterValve).created_at;
    case 'hydrants': return (data as FireHydrant).created_at;
    case 'services': return (data as WaterService).created_at;
    case 'fittings': return (data as WaterFitting).created_at;
    case 'zones': return (data as PressureZone).created_at;
    default: return '';
  }
}

function getUpdatedAt(type: string, data: unknown): string {
  switch (type) {
    case 'mains': return (data as WaterMain).updated_at;
    case 'valves': return (data as WaterValve).updated_at;
    case 'hydrants': return (data as FireHydrant).updated_at;
    case 'services': return (data as WaterService).updated_at;
    case 'fittings': return (data as WaterFitting).updated_at;
    case 'zones': return (data as PressureZone).updated_at;
    default: return '';
  }
}

// --- Per-type detail sections ---

function WaterMainDetail({ data: m }: { data: WaterMain }) {
  return (
    <>
      <Section icon={Info} title="Pipe Details">
        <Field label="Asset Tag" value={m.asset_tag} />
        <Field label="Material" value={m.material_code ? formatEnumLabel(m.material_code) : null} />
        <Field label="Diameter" value={m.diameter_inches ? `${m.diameter_inches}"` : null} />
        <Field label="Length" value={m.length_feet ? `${m.length_feet} ft` : null} />
        <Field label="Pressure Class" value={m.pressure_class} />
        <Field label="Shape" value={m.shape ? formatEnumLabel(m.shape) : null} />
        <Field label="Description" value={m.description} />
        <Field label="Install Date" value={formatDate(m.install_date)} />
      </Section>

      {(m.lining_type || m.lining_date) && (
        <Section icon={Droplets} title="Lining">
          <Field label="Lining Type" value={m.lining_type ? formatEnumLabel(m.lining_type) : null} />
          <Field label="Lining Date" value={formatDate(m.lining_date)} />
        </Section>
      )}

      <Section icon={Gauge} title="Flow & Pressure">
        <Field label="Flow Direction" value={m.flow_direction ? formatEnumLabel(m.flow_direction) : null} />
        <Field label="Pressure Zone" value={m.pressure_zone_id ? m.pressure_zone_id.slice(0, 8) + '...' : null} />
        <Field label="Depth" value={m.depth_feet ? `${m.depth_feet} ft` : null} />
        <Field label="Break Count" value={m.break_count > 0 ? m.break_count : null} />
      </Section>

      <Section icon={Calendar} title="Lifecycle">
        <Field label="Owner" value={m.owner ? formatEnumLabel(m.owner) : null} />
        <Field label="Maintained By" value={m.maintained_by} />
        <Field label="Expected Life" value={m.expected_life_years ? `${m.expected_life_years} years` : null} />
        <Field label="Replacement Cost" value={m.replacement_cost ? `$${m.replacement_cost.toLocaleString()}` : null} />
      </Section>

      {m.notes && (
        <Section icon={Info} title="Notes">
          <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">{m.notes}</p>
        </Section>
      )}

      {m.custom_fields && Object.keys(m.custom_fields).length > 0 && (
        <Section icon={Info} title="Custom Fields">
          {Object.entries(m.custom_fields).map(([key, val]) => (
            <Field key={key} label={key.replace(/_/g, ' ')} value={String(val)} />
          ))}
        </Section>
      )}
    </>
  );
}

function WaterValveDetail({ data: v }: { data: WaterValve }) {
  return (
    <>
      <Section icon={Info} title="Valve Details">
        <Field label="Asset Tag" value={v.asset_tag} />
        <Field label="Valve Type" value={v.valve_type_code ? formatEnumLabel(v.valve_type_code) : null} />
        <Field label="Size" value={v.size_inches ? `${v.size_inches}"` : null} />
        <Field label="Manufacturer" value={v.manufacturer} />
        <Field label="Model" value={v.model} />
        <Field label="Material" value={v.material ? formatEnumLabel(v.material) : null} />
        <Field label="Description" value={v.description} />
        <Field label="Install Date" value={formatDate(v.install_date)} />
      </Section>

      <Section icon={Gauge} title="Operation">
        <Field label="Turns to Close" value={v.turns_to_close} />
        <Field label="Turn Direction" value={v.turn_direction ? formatEnumLabel(v.turn_direction) : null} />
        <Field label="Normal Position" value={formatEnumLabel(v.normal_position)} />
        <Field label="Current Position" value={v.current_position ? formatEnumLabel(v.current_position) : null} />
        <Field label="Is Operable" value={v.is_operable ? formatEnumLabel(v.is_operable) : null} />
        <BooleanField label="Critical Valve" value={v.is_critical} />
      </Section>

      <Section icon={Wrench} title="Exercise Tracking">
        <Field label="Last Exercised" value={formatDate(v.last_exercised_date)} />
        <Field label="Exercise Interval" value={v.exercise_interval_days ? `${v.exercise_interval_days} days` : null} />
      </Section>

      <Section icon={MapPin} title="Location">
        <Field label="Pressure Zone" value={v.pressure_zone_id ? v.pressure_zone_id.slice(0, 8) + '...' : null} />
        <Field label="Depth" value={v.depth_feet ? `${v.depth_feet} ft` : null} />
        <Field label="Installation Type" value={v.installation_type ? formatEnumLabel(v.installation_type) : null} />
        {v.longitude != null && v.latitude != null && (
          <Field label="Coordinates" value={
            <span className="font-mono text-xs">{v.latitude!.toFixed(6)}, {v.longitude!.toFixed(6)}</span>
          } />
        )}
      </Section>

      {v.notes && (
        <Section icon={Info} title="Notes">
          <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">{v.notes}</p>
        </Section>
      )}

      {v.custom_fields && Object.keys(v.custom_fields).length > 0 && (
        <Section icon={Info} title="Custom Fields">
          {Object.entries(v.custom_fields).map(([key, val]) => (
            <Field key={key} label={key.replace(/_/g, ' ')} value={String(val)} />
          ))}
        </Section>
      )}
    </>
  );
}

function HydrantDetail({ data: h }: { data: FireHydrant }) {
  const flowColor = h.flow_class_color ? HYDRANT_FLOW_COLORS[h.flow_class_color] : null;

  return (
    <>
      <Section icon={Info} title="Hydrant Details">
        <Field label="Asset Tag" value={h.asset_tag} />
        <Field label="Make" value={h.make} />
        <Field label="Model" value={h.model} />
        <Field label="Year Manufactured" value={h.year_manufactured} />
        <Field label="Barrel Type" value={h.barrel_type ? formatEnumLabel(h.barrel_type) : null} />
        <Field label="Nozzle Count" value={h.nozzle_count} />
        <Field label="Nozzle Sizes" value={h.nozzle_sizes} />
        <Field label="Description" value={h.description} />
        <Field label="Install Date" value={formatDate(h.install_date)} />
        <Field label="Ownership" value={formatEnumLabel(h.ownership)} />
      </Section>

      <Section icon={Thermometer} title="Flow Test Data">
        <Field label="Flow Test Date" value={formatDate(h.flow_test_date)} />
        <Field label="Static Pressure" value={h.static_pressure_psi ? `${h.static_pressure_psi} PSI` : null} />
        <Field label="Residual Pressure" value={h.residual_pressure_psi ? `${h.residual_pressure_psi} PSI` : null} />
        <Field label="Pitot Pressure" value={h.pitot_pressure_psi ? `${h.pitot_pressure_psi} PSI` : null} />
        <Field label="Flow" value={h.flow_gpm ? `${h.flow_gpm} GPM` : null} />
        {flowColor && (
          <Field label="Flow Class" value={
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: flowColor.hex }} />
              {flowColor.label}
            </span>
          } />
        )}
      </Section>

      <Section icon={Droplets} title="Flushing">
        <Field label="Last Flush Date" value={formatDate(h.last_flush_date)} />
        <Field label="Flush Interval" value={h.flush_interval_days ? `${h.flush_interval_days} days` : null} />
      </Section>

      <Section icon={Zap} title="Connection">
        <Field label="Connected Main" value={h.connected_main_id ? h.connected_main_id.slice(0, 8) + '...' : null} />
        <Field label="Auxiliary Valve" value={h.auxiliary_valve_id ? h.auxiliary_valve_id.slice(0, 8) + '...' : null} />
        <Field label="Lateral Size" value={h.lateral_size_inches ? `${h.lateral_size_inches}"` : null} />
        <Field label="Main Size" value={h.main_size_inches ? `${h.main_size_inches}"` : null} />
        <Field label="Pressure Zone" value={h.pressure_zone_id ? h.pressure_zone_id.slice(0, 8) + '...' : null} />
      </Section>

      {h.out_of_service_reason && (
        <Section icon={Info} title="Out of Service">
          <p className="text-xs text-red-600 bg-red-50 rounded p-2">{h.out_of_service_reason}</p>
        </Section>
      )}

      <Section icon={MapPin} title="Location">
        {h.longitude != null && h.latitude != null && (
          <Field label="Coordinates" value={
            <span className="font-mono text-xs">{h.latitude!.toFixed(6)}, {h.longitude!.toFixed(6)}</span>
          } />
        )}
      </Section>

      {h.notes && (
        <Section icon={Info} title="Notes">
          <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">{h.notes}</p>
        </Section>
      )}

      {h.custom_fields && Object.keys(h.custom_fields).length > 0 && (
        <Section icon={Info} title="Custom Fields">
          {Object.entries(h.custom_fields).map(([key, val]) => (
            <Field key={key} label={key.replace(/_/g, ' ')} value={String(val)} />
          ))}
        </Section>
      )}
    </>
  );
}

function WaterServiceDetail({ data: s }: { data: WaterService }) {
  return (
    <>
      <Section icon={Info} title="Service Details">
        <Field label="Asset Tag" value={s.asset_tag} />
        <Field label="Service Type" value={formatEnumLabel(s.service_type)} />
        <Field label="Install Date" value={formatDate(s.install_date)} />
      </Section>

      <Section icon={Gauge} title="Meter">
        <Field label="Meter Number" value={s.meter_number} />
        <Field label="Meter Size" value={s.meter_size_inches ? `${s.meter_size_inches}"` : null} />
        <Field label="Meter Type" value={s.meter_type ? formatEnumLabel(s.meter_type) : null} />
      </Section>

      <Section icon={Droplets} title="Service Line">
        <Field label="Material" value={s.service_line_material ? formatEnumLabel(s.service_line_material) : null} />
        <Field label="Size" value={s.service_line_size_inches ? `${s.service_line_size_inches}"` : null} />
        <Field label="Tap Main" value={s.tap_main_id ? s.tap_main_id.slice(0, 8) + '...' : null} />
        <Field label="Curb Stop" value={s.curb_stop_location} />
      </Section>

      <Section icon={MapPin} title="Location / Account">
        <Field label="Address" value={s.address} />
        <Field label="Account Number" value={s.account_number} />
        {s.longitude != null && s.latitude != null && (
          <Field label="Coordinates" value={
            <span className="font-mono text-xs">{s.latitude!.toFixed(6)}, {s.longitude!.toFixed(6)}</span>
          } />
        )}
      </Section>

      {s.notes && (
        <Section icon={Info} title="Notes">
          <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">{s.notes}</p>
        </Section>
      )}

      {s.custom_fields && Object.keys(s.custom_fields).length > 0 && (
        <Section icon={Info} title="Custom Fields">
          {Object.entries(s.custom_fields).map(([key, val]) => (
            <Field key={key} label={key.replace(/_/g, ' ')} value={String(val)} />
          ))}
        </Section>
      )}
    </>
  );
}

function WaterFittingDetail({ data: f }: { data: WaterFitting }) {
  return (
    <>
      <Section icon={Info} title="Fitting Details">
        <Field label="Asset Tag" value={f.asset_tag} />
        <Field label="Fitting Type" value={formatEnumLabel(f.fitting_type)} />
        <Field label="Material" value={f.material_code ? formatEnumLabel(f.material_code) : null} />
        <Field label="Primary Size" value={f.primary_size_inches ? `${f.primary_size_inches}"` : null} />
        <Field label="Secondary Size" value={f.secondary_size_inches ? `${f.secondary_size_inches}"` : null} />
        <Field label="Install Date" value={formatDate(f.install_date)} />
      </Section>

      <Section icon={MapPin} title="Location">
        {f.longitude != null && f.latitude != null && (
          <Field label="Coordinates" value={
            <span className="font-mono text-xs">{f.latitude!.toFixed(6)}, {f.longitude!.toFixed(6)}</span>
          } />
        )}
      </Section>

      {f.notes && (
        <Section icon={Info} title="Notes">
          <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">{f.notes}</p>
        </Section>
      )}

      {f.custom_fields && Object.keys(f.custom_fields).length > 0 && (
        <Section icon={Info} title="Custom Fields">
          {Object.entries(f.custom_fields).map(([key, val]) => (
            <Field key={key} label={key.replace(/_/g, ' ')} value={String(val)} />
          ))}
        </Section>
      )}
    </>
  );
}

function PressureZoneDetail({ data: z }: { data: PressureZone }) {
  return (
    <>
      <Section icon={Info} title="Zone Details">
        <Field label="Zone Name" value={z.zone_name} />
        <Field label="Zone Number" value={z.zone_number} />
        <Field label="Description" value={z.description} />
      </Section>

      <Section icon={Gauge} title="Pressure Targets">
        <Field label="Min Pressure" value={z.target_pressure_min_psi ? `${z.target_pressure_min_psi} PSI` : null} />
        <Field label="Max Pressure" value={z.target_pressure_max_psi ? `${z.target_pressure_max_psi} PSI` : null} />
      </Section>
    </>
  );
}
