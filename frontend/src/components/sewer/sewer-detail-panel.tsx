import { useState, memo } from 'react';
import {
  X, MapPin, Calendar, Wrench, Pencil, Trash2, Loader2,
  ClipboardCheck, Gauge, Waves, Droplets, Zap, Info, ArrowDown,
} from 'lucide-react';
import type { Manhole, SewerMain, ForceMain, LiftStation, SewerLateral } from '../../api/types';
import {
  CONDITION_COLORS, UNRATED_COLOR, INACTIVE_COLOR, INACTIVE_STATUSES,
  formatEnumLabel, SEWER_SYSTEM_TYPE_OPTIONS,
} from '../../lib/constants';

interface SewerDetailPanelProps {
  assetType: string;
  data: unknown;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  onCreateWorkOrder?: () => void;
  onInspect?: () => void;
}

import { formatDate } from '../../lib/format-utils';

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

function systemTypeBadge(systemType: string) {
  const opt = SEWER_SYSTEM_TYPE_OPTIONS.find((o) => o.value === systemType);
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${opt?.color || 'bg-gray-100 text-gray-700'}`}>
      {opt?.label || formatEnumLabel(systemType)}
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

export const SewerDetailPanel = memo(function SewerDetailPanel({ assetType, data, onClose, onEdit, onDelete, isDeleting, onCreateWorkOrder, onInspect }: SewerDetailPanelProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const typeLabel = assetType === 'manholes' ? 'Manhole'
    : assetType === 'mains' ? 'Sewer Main'
    : assetType === 'force_mains' ? 'Force Main'
    : assetType === 'lift_stations' ? 'Lift Station'
    : 'Lateral';

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
            {conditionBadge(getCondition(assetType, data), getStatus(assetType, data))}
            {statusBadge(getStatus(assetType, data))}
            {getSystemType(assetType, data) && systemTypeBadge(getSystemType(assetType, data)!)}
          </div>
          <div className="flex gap-1.5 mt-2">
            {onCreateWorkOrder && (
              <button
                onClick={onCreateWorkOrder}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <Wrench size={12} />
                Work Order
              </button>
            )}
            {onInspect && (
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
            <button onClick={onEdit} title="Edit" aria-label="Edit" className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-600">
              <Pencil size={16} />
            </button>
          )}
          {onDelete && (
            <button onClick={() => setShowDeleteConfirm(true)} title="Delete" aria-label="Delete" className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-red-600">
              <Trash2 size={16} />
            </button>
          )}
          <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600">
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
        {assetType === 'manholes' && <ManholeDetail data={data as Manhole} />}
        {assetType === 'mains' && <SewerMainDetail data={data as SewerMain} />}
        {assetType === 'force_mains' && <ForceMainDetail data={data as ForceMain} />}
        {assetType === 'lift_stations' && <LiftStationDetail data={data as LiftStation} />}
        {assetType === 'laterals' && <LateralDetail data={data as SewerLateral} />}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-gray-50 text-[10px] text-gray-400">
        <div>Created: {formatDate(getCreatedAt(assetType, data))}</div>
        <div>Updated: {formatDate(getUpdatedAt(assetType, data))}</div>
        <div className="font-mono truncate mt-0.5">{getId(assetType, data)}</div>
      </div>
    </div>
  );
});

// --- Helpers to get common fields across types ---

function getTitle(type: string, data: unknown): string {
  switch (type) {
    case 'manholes': { const d = data as Manhole; return d.asset_tag || `MH-${d.manhole_id.slice(0, 8)}`; }
    case 'mains': { const d = data as SewerMain; return d.asset_tag || `SM-${d.sewer_main_id.slice(0, 8)}`; }
    case 'force_mains': { const d = data as ForceMain; return d.asset_tag || `FM-${d.force_main_id.slice(0, 8)}`; }
    case 'lift_stations': { const d = data as LiftStation; return d.station_name || d.asset_tag || `LS-${d.lift_station_id.slice(0, 8)}`; }
    case 'laterals': { const d = data as SewerLateral; return d.asset_tag || d.address || `LAT-${d.sewer_lateral_id.slice(0, 8)}`; }
    default: return 'Unknown';
  }
}

function getCondition(type: string, data: unknown): number | null {
  switch (type) {
    case 'manholes': return (data as Manhole).condition_rating;
    case 'mains': return (data as SewerMain).condition_rating;
    case 'force_mains': return (data as ForceMain).condition_rating;
    case 'lift_stations': return (data as LiftStation).condition_rating;
    default: return null;
  }
}

function getStatus(type: string, data: unknown): string {
  switch (type) {
    case 'manholes': return (data as Manhole).status;
    case 'mains': return (data as SewerMain).status;
    case 'force_mains': return (data as ForceMain).status;
    case 'lift_stations': return (data as LiftStation).status;
    case 'laterals': return (data as SewerLateral).status;
    default: return 'active';
  }
}

function getSystemType(type: string, data: unknown): string | null {
  if (type === 'manholes') return (data as Manhole).system_type;
  if (type === 'mains') return (data as SewerMain).system_type;
  return null;
}

function getId(type: string, data: unknown): string {
  switch (type) {
    case 'manholes': return (data as Manhole).manhole_id;
    case 'mains': return (data as SewerMain).sewer_main_id;
    case 'force_mains': return (data as ForceMain).force_main_id;
    case 'lift_stations': return (data as LiftStation).lift_station_id;
    case 'laterals': return (data as SewerLateral).sewer_lateral_id;
    default: return '';
  }
}

function getCreatedAt(type: string, data: unknown): string {
  switch (type) {
    case 'manholes': return (data as Manhole).created_at;
    case 'mains': return (data as SewerMain).created_at;
    case 'force_mains': return (data as ForceMain).created_at;
    case 'lift_stations': return (data as LiftStation).created_at;
    case 'laterals': return (data as SewerLateral).created_at;
    default: return '';
  }
}

function getUpdatedAt(type: string, data: unknown): string {
  switch (type) {
    case 'manholes': return (data as Manhole).updated_at;
    case 'mains': return (data as SewerMain).updated_at;
    case 'force_mains': return (data as ForceMain).updated_at;
    case 'lift_stations': return (data as LiftStation).updated_at;
    case 'laterals': return (data as SewerLateral).updated_at;
    default: return '';
  }
}

// --- Per-type detail sections ---

function ManholeDetail({ data: m }: { data: Manhole }) {
  return (
    <>
      <Section icon={Info} title="Manhole Details">
        <Field label="Asset Tag" value={m.asset_tag} />
        <Field label="Type" value={m.manhole_type_code ? formatEnumLabel(m.manhole_type_code) : null} />
        <Field label="Material" value={m.material ? formatEnumLabel(m.material) : null} />
        <Field label="Diameter" value={m.diameter_inches ? `${m.diameter_inches}"` : null} />
        <Field label="Description" value={m.description} />
        <Field label="Install Date" value={formatDate(m.install_date)} />
      </Section>

      <Section icon={ArrowDown} title="Elevations">
        <Field label="Rim Elevation" value={m.rim_elevation_ft ? `${m.rim_elevation_ft} ft` : null} />
        <Field label="Invert Elevation" value={m.invert_elevation_ft ? `${m.invert_elevation_ft} ft` : null} />
        <Field label="Depth" value={m.depth_ft ? `${m.depth_ft} ft` : null} />
      </Section>

      <Section icon={Waves} title="Structure">
        <Field label="Cover Type" value={m.cover_type ? formatEnumLabel(m.cover_type) : null} />
        <Field label="Cover Diameter" value={m.cover_diameter_inches ? `${m.cover_diameter_inches}"` : null} />
        <Field label="Frame Type" value={m.frame_type ? formatEnumLabel(m.frame_type) : null} />
        <BooleanField label="Has Steps" value={m.has_steps} />
        <Field label="Step Material" value={m.step_material ? formatEnumLabel(m.step_material) : null} />
        <Field label="Cone Type" value={m.cone_type ? formatEnumLabel(m.cone_type) : null} />
        <Field label="Chimney Height" value={m.chimney_height_inches ? `${m.chimney_height_inches}"` : null} />
        <Field label="Channel Type" value={m.channel_type ? formatEnumLabel(m.channel_type) : null} />
        <Field label="Bench Type" value={m.bench_type ? formatEnumLabel(m.bench_type) : null} />
      </Section>

      <Section icon={Gauge} title="MACP Assessment">
        <Field label="MACP Grade" value={m.macp_grade} />
        <Field label="MACP Score" value={m.macp_score} />
        <Field label="Last MACP Date" value={formatDate(m.last_macp_date)} />
      </Section>

      <Section icon={MapPin} title="Location">
        <Field label="Pipe Connections" value={m.pipe_connection_count} />
        <Field label="Coordinates" value={
          <span className="font-mono text-xs">{m.latitude.toFixed(6)}, {m.longitude.toFixed(6)}</span>
        } />
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

function SewerMainDetail({ data: m }: { data: SewerMain }) {
  return (
    <>
      <Section icon={Info} title="Pipe Details">
        <Field label="Asset Tag" value={m.asset_tag} />
        <Field label="Material" value={m.material_code ? formatEnumLabel(m.material_code) : null} />
        <Field label="Shape" value={m.shape_code ? formatEnumLabel(m.shape_code) : null} />
        <Field label="Diameter" value={m.diameter_inches ? `${m.diameter_inches}"` : null} />
        {m.height_inches && <Field label="Height" value={`${m.height_inches}"`} />}
        {m.width_inches && <Field label="Width" value={`${m.width_inches}"`} />}
        <Field label="Length" value={m.length_feet ? `${m.length_feet} ft` : null} />
        <Field label="Owner" value={m.owner ? formatEnumLabel(m.owner) : null} />
        <Field label="Maintained By" value={m.maintained_by} />
        <Field label="Install Date" value={formatDate(m.install_date)} />
        <Field label="Description" value={m.description} />
      </Section>

      <Section icon={ArrowDown} title="Hydraulics">
        <Field label="Slope" value={m.slope_pct != null ? `${m.slope_pct}%` : null} />
        <Field label="Upstream Invert" value={m.upstream_invert_ft ? `${m.upstream_invert_ft} ft` : null} />
        <Field label="Downstream Invert" value={m.downstream_invert_ft ? `${m.downstream_invert_ft} ft` : null} />
        <Field label="Depth (Upstream)" value={m.depth_ft_upstream ? `${m.depth_ft_upstream} ft` : null} />
        <Field label="Depth (Downstream)" value={m.depth_ft_downstream ? `${m.depth_ft_downstream} ft` : null} />
      </Section>

      {(m.lining_type || m.lining_date) && (
        <Section icon={Waves} title="Lining">
          <Field label="Lining Type" value={m.lining_type ? formatEnumLabel(m.lining_type) : null} />
          <Field label="Lining Date" value={formatDate(m.lining_date)} />
          <Field label="Thickness" value={m.lining_thickness_mm ? `${m.lining_thickness_mm} mm` : null} />
        </Section>
      )}

      <Section icon={Gauge} title="PACP Assessment">
        <Field label="PACP Grade" value={m.pacp_grade} />
        <Field label="Structural Score" value={m.pacp_structural_score} />
        <Field label="O&M Score" value={m.pacp_om_score} />
        <Field label="Last PACP Date" value={formatDate(m.last_pacp_date)} />
      </Section>

      <Section icon={Calendar} title="Lifecycle">
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

function ForceMainDetail({ data: m }: { data: ForceMain }) {
  return (
    <>
      <Section icon={Info} title="Force Main Details">
        <Field label="Asset Tag" value={m.asset_tag} />
        <Field label="Material" value={m.material_code ? formatEnumLabel(m.material_code) : null} />
        <Field label="Diameter" value={m.diameter_inches ? `${m.diameter_inches}"` : null} />
        <Field label="Length" value={m.length_feet ? `${m.length_feet} ft` : null} />
        <Field label="Pressure Class" value={m.pressure_class} />
        <Field label="Depth" value={m.depth_feet ? `${m.depth_feet} ft` : null} />
        <Field label="Owner" value={m.owner ? formatEnumLabel(m.owner) : null} />
        <Field label="Maintained By" value={m.maintained_by} />
        <Field label="Install Date" value={formatDate(m.install_date)} />
        <Field label="Description" value={m.description} />
      </Section>

      <Section icon={Zap} title="Cathodic Protection">
        <BooleanField label="Has CP" value={m.has_cathodic_protection} />
        <Field label="CP Test Date" value={formatDate(m.cp_test_date)} />
        <Field label="ARV Count" value={m.arv_count} />
      </Section>

      <Section icon={Droplets} title="Connections">
        <Field label="Lift Station" value={m.lift_station_id ? m.lift_station_id.slice(0, 8) + '...' : null} />
        <Field label="Discharge MH" value={m.discharge_manhole_id ? m.discharge_manhole_id.slice(0, 8) + '...' : null} />
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

function LiftStationDetail({ data: ls }: { data: LiftStation }) {
  return (
    <>
      <Section icon={Info} title="Station Details">
        <Field label="Asset Tag" value={ls.asset_tag} />
        <Field label="Station Name" value={ls.station_name} />
        <Field label="Description" value={ls.description} />
        <Field label="Owner" value={ls.owner ? formatEnumLabel(ls.owner) : null} />
        <Field label="Maintained By" value={ls.maintained_by} />
        <Field label="Install Date" value={formatDate(ls.install_date)} />
      </Section>

      <Section icon={Droplets} title="Wet Well">
        <Field label="Depth" value={ls.wet_well_depth_ft ? `${ls.wet_well_depth_ft} ft` : null} />
        <Field label="Diameter" value={ls.wet_well_diameter_ft ? `${ls.wet_well_diameter_ft} ft` : null} />
        <Field label="Material" value={ls.wet_well_material ? formatEnumLabel(ls.wet_well_material) : null} />
      </Section>

      <Section icon={Gauge} title="Pumps">
        <Field label="Pump Count" value={ls.pump_count} />
        <Field label="Pump Type" value={ls.pump_type ? formatEnumLabel(ls.pump_type) : null} />
        <Field label="Pump HP" value={ls.pump_hp ? `${ls.pump_hp} HP` : null} />
        <Field label="Firm Capacity" value={ls.firm_capacity_gpm ? `${ls.firm_capacity_gpm} GPM` : null} />
        <Field label="Design Capacity" value={ls.design_capacity_gpm ? `${ls.design_capacity_gpm} GPM` : null} />
      </Section>

      <Section icon={Zap} title="Controls & Power">
        <Field label="Control Type" value={ls.control_type ? formatEnumLabel(ls.control_type) : null} />
        <BooleanField label="SCADA" value={ls.has_scada} />
        <BooleanField label="Backup Power" value={ls.has_backup_power} />
        <Field label="Backup Type" value={ls.backup_power_type ? formatEnumLabel(ls.backup_power_type) : null} />
        <BooleanField label="Alarm" value={ls.has_alarm} />
        <Field label="Alarm Type" value={ls.alarm_type ? formatEnumLabel(ls.alarm_type) : null} />
        <Field label="Electrical Service" value={ls.electrical_service} />
        <Field label="Voltage" value={ls.voltage ? `${ls.voltage}V` : null} />
      </Section>

      <Section icon={MapPin} title="Location">
        <Field label="Force Mains" value={ls.force_main_count} />
        <Field label="Coordinates" value={
          <span className="font-mono text-xs">{ls.latitude.toFixed(6)}, {ls.longitude.toFixed(6)}</span>
        } />
      </Section>

      {ls.notes && (
        <Section icon={Info} title="Notes">
          <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">{ls.notes}</p>
        </Section>
      )}

      {ls.custom_fields && Object.keys(ls.custom_fields).length > 0 && (
        <Section icon={Info} title="Custom Fields">
          {Object.entries(ls.custom_fields).map(([key, val]) => (
            <Field key={key} label={key.replace(/_/g, ' ')} value={String(val)} />
          ))}
        </Section>
      )}
    </>
  );
}

function LateralDetail({ data: l }: { data: SewerLateral }) {
  return (
    <>
      <Section icon={Info} title="Lateral Details">
        <Field label="Asset Tag" value={l.asset_tag} />
        <Field label="Service Type" value={l.service_type ? formatEnumLabel(l.service_type) : null} />
        <Field label="Material" value={l.material_code ? formatEnumLabel(l.material_code) : null} />
        <Field label="Diameter" value={l.diameter_inches ? `${l.diameter_inches}"` : null} />
        <Field label="Length" value={l.length_feet ? `${l.length_feet} ft` : null} />
        <Field label="Depth at Main" value={l.depth_at_main_ft ? `${l.depth_at_main_ft} ft` : null} />
        <Field label="Install Date" value={formatDate(l.install_date)} />
      </Section>

      <Section icon={Droplets} title="Connection">
        <Field label="Connected Main" value={l.connected_main_id ? l.connected_main_id.slice(0, 8) + '...' : null} />
        <Field label="Tap Location" value={l.tap_location} />
        <BooleanField label="Has Cleanout" value={l.has_cleanout} />
        <Field label="Cleanout Location" value={l.cleanout_location} />
      </Section>

      <Section icon={MapPin} title="Service">
        <Field label="Address" value={l.address} />
        <Field label="Account Number" value={l.account_number} />
        {l.longitude != null && l.latitude != null && (
          <Field label="Coordinates" value={
            <span className="font-mono text-xs">{l.latitude!.toFixed(6)}, {l.longitude!.toFixed(6)}</span>
          } />
        )}
      </Section>

      {l.notes && (
        <Section icon={Info} title="Notes">
          <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">{l.notes}</p>
        </Section>
      )}

      {l.custom_fields && Object.keys(l.custom_fields).length > 0 && (
        <Section icon={Info} title="Custom Fields">
          {Object.entries(l.custom_fields).map(([key, val]) => (
            <Field key={key} label={key.replace(/_/g, ' ')} value={String(val)} />
          ))}
        </Section>
      )}
    </>
  );
}
