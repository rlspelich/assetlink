import { useState, useEffect } from 'react';
import {
  X, Save, Loader2, ChevronDown, ChevronRight,
  Info, MapPin, ArrowDown, Waves, Gauge, Droplets, Zap,
} from 'lucide-react';
import { SEWER_STATUS_OPTIONS, SEWER_SYSTEM_TYPE_OPTIONS } from '../../lib/constants';

interface SewerFormPanelProps {
  mode: 'add' | 'edit';
  assetType: string;
  data: unknown | null;
  coordinates?: { lng: number; lat: number } | null;
  lineCoordinates?: number[][] | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
}

// --- Reusable form components ---

function FormSection({
  icon: Icon, title, defaultOpen = true, children,
}: { icon: React.ElementType; title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button type="button" onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Icon size={14} />
        {title}
      </button>
      {open && <div className="pb-3 space-y-3">{children}</div>}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputClass = 'w-full px-2.5 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white';
const selectClass = inputClass;
const readonlyClass = 'w-full px-2.5 py-2 text-sm border border-gray-100 rounded-md bg-gray-50 text-gray-600 font-mono text-xs';

function ConditionRatingPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const ratings = [1, 2, 3, 4, 5];
  const labels = ['Critical', 'Poor', 'Fair', 'Good', 'Excellent'];
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
  return (
    <div className="flex gap-1">
      {ratings.map((r, i) => (
        <button key={r} type="button" onClick={() => onChange(value === r ? null : r)}
          title={`${r} - ${labels[i]}`}
          className={`flex-1 py-2 text-xs font-medium rounded transition-colors ${
            value === r ? `${colors[i]} text-white` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}>
          {r}
        </button>
      ))}
    </div>
  );
}

// --- Main form ---

export function SewerFormPanel({ mode, assetType, data, coordinates, lineCoordinates, onSubmit, onCancel, isSubmitting, error }: SewerFormPanelProps) {
  const typeLabel = assetType === 'manholes' ? 'Manhole'
    : assetType === 'mains' ? 'Sewer Main'
    : assetType === 'force_mains' ? 'Force Main'
    : assetType === 'lift_stations' ? 'Lift Station'
    : 'Lateral';

  const isLineAsset = assetType === 'mains' || assetType === 'force_mains';

  // Generic form state
  const [form, setForm] = useState<Record<string, unknown>>(() => buildDefaults(assetType, mode, data, coordinates, lineCoordinates));

  // Update coordinates when they change externally
  useEffect(() => {
    if (coordinates) {
      setForm((f) => ({ ...f, longitude: coordinates.lng, latitude: coordinates.lat }));
    }
  }, [coordinates]);

  useEffect(() => {
    if (lineCoordinates) {
      setForm((f) => ({ ...f, coordinates: lineCoordinates }));
    }
  }, [lineCoordinates]);

  function setField(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Clean empty strings
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(form)) {
      if (val === '' || val === undefined) continue;
      cleaned[key] = val;
    }
    onSubmit(cleaned);
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-900 text-sm">
            {mode === 'add' ? `Add ${typeLabel}` : `Edit ${typeLabel}`}
          </div>
        </div>
        <button type="button" onClick={onCancel} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 flex flex-col">
        <div className="flex-1">
          {assetType === 'manholes' && <ManholeForm form={form} setField={setField} />}
          {assetType === 'mains' && <SewerMainForm form={form} setField={setField} />}
          {assetType === 'force_mains' && <ForceMainForm form={form} setField={setField} />}
          {assetType === 'lift_stations' && <LiftStationForm form={form} setField={setField} />}
          {assetType === 'laterals' && <LateralForm form={form} setField={setField} />}

          {/* Common: Location (read-only coords) */}
          {!isLineAsset && (
            <FormSection icon={MapPin} title="Location" defaultOpen={false}>
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Longitude">
                  <input type="text" value={typeof form.longitude === 'number' ? (form.longitude as number).toFixed(6) : ''} readOnly className={readonlyClass} />
                </FormField>
                <FormField label="Latitude">
                  <input type="text" value={typeof form.latitude === 'number' ? (form.latitude as number).toFixed(6) : ''} readOnly className={readonlyClass} />
                </FormField>
              </div>
            </FormSection>
          )}
          {isLineAsset && (
            <FormSection icon={MapPin} title="Geometry" defaultOpen={false}>
              <div className="text-xs text-gray-500">
                {Array.isArray(form.coordinates) && (form.coordinates as number[][]).length > 0
                  ? `${(form.coordinates as number[][]).length} vertices`
                  : 'No line drawn'}
              </div>
            </FormSection>
          )}
        </div>

        {error && (
          <div className="mx-0 mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
        )}

        <div className="sticky bottom-0 bg-white border-t border-gray-100 py-3 flex gap-2 mt-2">
          <button type="button" onClick={onCancel}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting}
            className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5">
            {isSubmitting ? (
              <><Loader2 size={14} className="animate-spin" />Saving...</>
            ) : (
              <><Save size={14} />{mode === 'add' ? `Create ${typeLabel}` : 'Save Changes'}</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// --- Per-type forms ---

interface FormProps {
  form: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
}

function CommonFields({ form, setField }: FormProps) {
  return (
    <>
      <FormField label="Asset Tag">
        <input value={(form.asset_tag as string) || ''} onChange={(e) => setField('asset_tag', e.target.value)} placeholder="Asset ID / barcode" className={inputClass} />
      </FormField>
      <FormField label="Status">
        <select value={(form.status as string) || 'active'} onChange={(e) => setField('status', e.target.value)} className={selectClass}>
          {SEWER_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Condition Rating">
        <ConditionRatingPicker value={(form.condition_rating as number | null) ?? null} onChange={(v) => setField('condition_rating', v)} />
      </FormField>
      <FormField label="Install Date">
        <input type="date" value={(form.install_date as string) || ''} onChange={(e) => setField('install_date', e.target.value)} className={inputClass} />
      </FormField>
      <FormField label="Notes">
        <textarea value={(form.notes as string) || ''} onChange={(e) => setField('notes', e.target.value)} rows={2} className={inputClass + ' resize-none'} />
      </FormField>
    </>
  );
}

function SystemTypeField({ form, setField }: FormProps) {
  return (
    <FormField label="System Type">
      <select value={(form.system_type as string) || 'sanitary'} onChange={(e) => setField('system_type', e.target.value)} className={selectClass}>
        {SEWER_SYSTEM_TYPE_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </FormField>
  );
}

function ManholeForm({ form, setField }: FormProps) {
  return (
    <>
      <FormSection icon={Info} title="Manhole Details">
        <CommonFields form={form} setField={setField} />
        <SystemTypeField form={form} setField={setField} />
        <FormField label="Description">
          <input value={(form.description as string) || ''} onChange={(e) => setField('description', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Material">
          <input value={(form.material as string) || ''} onChange={(e) => setField('material', e.target.value)} placeholder="e.g. brick, precast, block" className={inputClass} />
        </FormField>
        <FormField label="Diameter (in)">
          <input type="number" value={(form.diameter_inches as string) || ''} onChange={(e) => setField('diameter_inches', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
        </FormField>
      </FormSection>

      <FormSection icon={ArrowDown} title="Elevations" defaultOpen={false}>
        <FormField label="Rim Elevation (ft)">
          <input type="number" step="0.01" value={form.rim_elevation_ft != null ? String(form.rim_elevation_ft) : ''} onChange={(e) => setField('rim_elevation_ft', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
        </FormField>
        <FormField label="Invert Elevation (ft)">
          <input type="number" step="0.01" value={form.invert_elevation_ft != null ? String(form.invert_elevation_ft) : ''} onChange={(e) => setField('invert_elevation_ft', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
        </FormField>
        <FormField label="Depth (ft)">
          <input type="number" step="0.1" value={form.depth_ft != null ? String(form.depth_ft) : ''} onChange={(e) => setField('depth_ft', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
        </FormField>
      </FormSection>

      <FormSection icon={Waves} title="Structure" defaultOpen={false}>
        <FormField label="Cover Type">
          <input value={(form.cover_type as string) || ''} onChange={(e) => setField('cover_type', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Cone Type">
          <input value={(form.cone_type as string) || ''} onChange={(e) => setField('cone_type', e.target.value)} className={inputClass} />
        </FormField>
      </FormSection>

      <FormSection icon={Gauge} title="MACP Assessment" defaultOpen={false}>
        <FormField label="MACP Grade">
          <input type="number" min="1" max="5" value={form.macp_grade != null ? String(form.macp_grade) : ''} onChange={(e) => setField('macp_grade', e.target.value ? parseInt(e.target.value) : '')} className={inputClass} />
        </FormField>
        <FormField label="MACP Score">
          <input type="number" step="0.1" value={form.macp_score != null ? String(form.macp_score) : ''} onChange={(e) => setField('macp_score', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
        </FormField>
        <FormField label="Last MACP Date">
          <input type="date" value={(form.last_macp_date as string) || ''} onChange={(e) => setField('last_macp_date', e.target.value)} className={inputClass} />
        </FormField>
      </FormSection>
    </>
  );
}

function SewerMainForm({ form, setField }: FormProps) {
  return (
    <>
      <FormSection icon={Info} title="Pipe Details">
        <CommonFields form={form} setField={setField} />
        <SystemTypeField form={form} setField={setField} />
        <FormField label="Description">
          <input value={(form.description as string) || ''} onChange={(e) => setField('description', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Material">
          <input value={(form.material_code as string) || ''} onChange={(e) => setField('material_code', e.target.value)} placeholder="e.g. PVC, RCP, VCP" className={inputClass} />
        </FormField>
        <FormField label="Shape">
          <input value={(form.shape_code as string) || ''} onChange={(e) => setField('shape_code', e.target.value)} placeholder="e.g. circular, egg" className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Diameter (in)">
            <input type="number" value={form.diameter_inches != null ? String(form.diameter_inches) : ''} onChange={(e) => setField('diameter_inches', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
          <FormField label="Length (ft)">
            <input type="number" value={form.length_feet != null ? String(form.length_feet) : ''} onChange={(e) => setField('length_feet', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
        </div>
        <FormField label="Owner">
          <input value={(form.owner as string) || ''} onChange={(e) => setField('owner', e.target.value)} className={inputClass} />
        </FormField>
      </FormSection>

      <FormSection icon={ArrowDown} title="Hydraulics" defaultOpen={false}>
        <FormField label="Slope (%)">
          <input type="number" step="0.01" value={form.slope_pct != null ? String(form.slope_pct) : ''} onChange={(e) => setField('slope_pct', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Upstream Invert">
            <input type="number" step="0.01" value={form.upstream_invert_ft != null ? String(form.upstream_invert_ft) : ''} onChange={(e) => setField('upstream_invert_ft', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
          <FormField label="Downstream Invert">
            <input type="number" step="0.01" value={form.downstream_invert_ft != null ? String(form.downstream_invert_ft) : ''} onChange={(e) => setField('downstream_invert_ft', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
        </div>
      </FormSection>

      <FormSection icon={Gauge} title="PACP Assessment" defaultOpen={false}>
        <FormField label="PACP Grade">
          <input type="number" min="1" max="5" value={form.pacp_grade != null ? String(form.pacp_grade) : ''} onChange={(e) => setField('pacp_grade', e.target.value ? parseInt(e.target.value) : '')} className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Structural Score">
            <input type="number" step="0.1" value={form.pacp_structural_score != null ? String(form.pacp_structural_score) : ''} onChange={(e) => setField('pacp_structural_score', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
          <FormField label="O&M Score">
            <input type="number" step="0.1" value={form.pacp_om_score != null ? String(form.pacp_om_score) : ''} onChange={(e) => setField('pacp_om_score', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
        </div>
        <FormField label="Last PACP Date">
          <input type="date" value={(form.last_pacp_date as string) || ''} onChange={(e) => setField('last_pacp_date', e.target.value)} className={inputClass} />
        </FormField>
      </FormSection>
    </>
  );
}

function ForceMainForm({ form, setField }: FormProps) {
  return (
    <>
      <FormSection icon={Info} title="Force Main Details">
        <CommonFields form={form} setField={setField} />
        <FormField label="Description">
          <input value={(form.description as string) || ''} onChange={(e) => setField('description', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Material">
          <input value={(form.material_code as string) || ''} onChange={(e) => setField('material_code', e.target.value)} placeholder="e.g. DI, PVC, HDPE" className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Diameter (in)">
            <input type="number" value={form.diameter_inches != null ? String(form.diameter_inches) : ''} onChange={(e) => setField('diameter_inches', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
          <FormField label="Length (ft)">
            <input type="number" value={form.length_feet != null ? String(form.length_feet) : ''} onChange={(e) => setField('length_feet', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
        </div>
        <FormField label="Pressure Class">
          <input value={(form.pressure_class as string) || ''} onChange={(e) => setField('pressure_class', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Owner">
          <input value={(form.owner as string) || ''} onChange={(e) => setField('owner', e.target.value)} className={inputClass} />
        </FormField>
      </FormSection>

      <FormSection icon={Zap} title="Cathodic Protection" defaultOpen={false}>
        <FormField label="Has CP">
          <select value={form.has_cathodic_protection != null ? String(form.has_cathodic_protection) : ''} onChange={(e) => setField('has_cathodic_protection', e.target.value === '' ? null : e.target.value === 'true')} className={selectClass}>
            <option value="">--</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </FormField>
        <FormField label="CP Test Date">
          <input type="date" value={(form.cp_test_date as string) || ''} onChange={(e) => setField('cp_test_date', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="ARV Count">
          <input type="number" value={form.arv_count != null ? String(form.arv_count) : ''} onChange={(e) => setField('arv_count', e.target.value ? parseInt(e.target.value) : '')} className={inputClass} />
        </FormField>
      </FormSection>
    </>
  );
}

function LiftStationForm({ form, setField }: FormProps) {
  return (
    <>
      <FormSection icon={Info} title="Station Details">
        <CommonFields form={form} setField={setField} />
        <FormField label="Station Name">
          <input value={(form.station_name as string) || ''} onChange={(e) => setField('station_name', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Description">
          <input value={(form.description as string) || ''} onChange={(e) => setField('description', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Owner">
          <input value={(form.owner as string) || ''} onChange={(e) => setField('owner', e.target.value)} className={inputClass} />
        </FormField>
      </FormSection>

      <FormSection icon={Droplets} title="Wet Well" defaultOpen={false}>
        <FormField label="Depth (ft)">
          <input type="number" step="0.1" value={form.wet_well_depth_ft != null ? String(form.wet_well_depth_ft) : ''} onChange={(e) => setField('wet_well_depth_ft', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
        </FormField>
        <FormField label="Diameter (ft)">
          <input type="number" step="0.1" value={form.wet_well_diameter_ft != null ? String(form.wet_well_diameter_ft) : ''} onChange={(e) => setField('wet_well_diameter_ft', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
        </FormField>
        <FormField label="Material">
          <input value={(form.wet_well_material as string) || ''} onChange={(e) => setField('wet_well_material', e.target.value)} className={inputClass} />
        </FormField>
      </FormSection>

      <FormSection icon={Gauge} title="Pumps" defaultOpen={false}>
        <FormField label="Pump Count">
          <input type="number" value={form.pump_count != null ? String(form.pump_count) : ''} onChange={(e) => setField('pump_count', e.target.value ? parseInt(e.target.value) : '')} className={inputClass} />
        </FormField>
        <FormField label="Pump Type">
          <input value={(form.pump_type as string) || ''} onChange={(e) => setField('pump_type', e.target.value)} placeholder="e.g. submersible, suction lift" className={inputClass} />
        </FormField>
        <FormField label="Pump HP">
          <input type="number" step="0.1" value={form.pump_hp != null ? String(form.pump_hp) : ''} onChange={(e) => setField('pump_hp', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Firm Cap (GPM)">
            <input type="number" value={form.firm_capacity_gpm != null ? String(form.firm_capacity_gpm) : ''} onChange={(e) => setField('firm_capacity_gpm', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
          <FormField label="Design Cap (GPM)">
            <input type="number" value={form.design_capacity_gpm != null ? String(form.design_capacity_gpm) : ''} onChange={(e) => setField('design_capacity_gpm', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
        </div>
      </FormSection>

      <FormSection icon={Zap} title="Controls & Power" defaultOpen={false}>
        <FormField label="Control Type">
          <input value={(form.control_type as string) || ''} onChange={(e) => setField('control_type', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="SCADA">
          <select value={form.has_scada != null ? String(form.has_scada) : ''} onChange={(e) => setField('has_scada', e.target.value === '' ? null : e.target.value === 'true')} className={selectClass}>
            <option value="">--</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </FormField>
        <FormField label="Backup Power">
          <select value={form.has_backup_power != null ? String(form.has_backup_power) : ''} onChange={(e) => setField('has_backup_power', e.target.value === '' ? null : e.target.value === 'true')} className={selectClass}>
            <option value="">--</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </FormField>
        <FormField label="Backup Power Type">
          <input value={(form.backup_power_type as string) || ''} onChange={(e) => setField('backup_power_type', e.target.value)} placeholder="e.g. generator, battery" className={inputClass} />
        </FormField>
        <FormField label="Has Alarm">
          <select value={form.has_alarm != null ? String(form.has_alarm) : ''} onChange={(e) => setField('has_alarm', e.target.value === '' ? null : e.target.value === 'true')} className={selectClass}>
            <option value="">--</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </FormField>
        <FormField label="Voltage">
          <input type="number" value={form.voltage != null ? String(form.voltage) : ''} onChange={(e) => setField('voltage', e.target.value ? parseInt(e.target.value) : '')} className={inputClass} />
        </FormField>
      </FormSection>
    </>
  );
}

function LateralForm({ form, setField }: FormProps) {
  return (
    <>
      <FormSection icon={Info} title="Lateral Details">
        <CommonFields form={form} setField={setField} />
        <FormField label="Service Type">
          <input value={(form.service_type as string) || ''} onChange={(e) => setField('service_type', e.target.value)} placeholder="e.g. residential, commercial" className={inputClass} />
        </FormField>
        <FormField label="Material">
          <input value={(form.material_code as string) || ''} onChange={(e) => setField('material_code', e.target.value)} className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Diameter (in)">
            <input type="number" value={form.diameter_inches != null ? String(form.diameter_inches) : ''} onChange={(e) => setField('diameter_inches', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
          <FormField label="Length (ft)">
            <input type="number" value={form.length_feet != null ? String(form.length_feet) : ''} onChange={(e) => setField('length_feet', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
        </div>
      </FormSection>

      <FormSection icon={Droplets} title="Connection" defaultOpen={false}>
        <FormField label="Has Cleanout">
          <select value={form.has_cleanout != null ? String(form.has_cleanout) : ''} onChange={(e) => setField('has_cleanout', e.target.value === '' ? null : e.target.value === 'true')} className={selectClass}>
            <option value="">--</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </FormField>
        <FormField label="Cleanout Location">
          <input value={(form.cleanout_location as string) || ''} onChange={(e) => setField('cleanout_location', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Tap Location">
          <input value={(form.tap_location as string) || ''} onChange={(e) => setField('tap_location', e.target.value)} className={inputClass} />
        </FormField>
      </FormSection>

      <FormSection icon={MapPin} title="Service" defaultOpen={false}>
        <FormField label="Address">
          <input value={(form.address as string) || ''} onChange={(e) => setField('address', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Account Number">
          <input value={(form.account_number as string) || ''} onChange={(e) => setField('account_number', e.target.value)} className={inputClass} />
        </FormField>
      </FormSection>
    </>
  );
}

// --- Default builder ---

function buildDefaults(assetType: string, mode: 'add' | 'edit', data: unknown | null, coordinates?: { lng: number; lat: number } | null, lineCoordinates?: number[][] | null): Record<string, unknown> {
  if (mode === 'edit' && data) {
    // Shallow-copy all fields from data
    const d = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(d)) {
      if (k === 'created_at' || k === 'updated_at' || k === 'tenant_id') continue;
      if (typeof v === 'string' && k.endsWith('_date') && v.includes('T')) {
        result[k] = v.split('T')[0];
      } else {
        result[k] = v ?? '';
      }
    }
    return result;
  }

  // Defaults for create
  const base: Record<string, unknown> = {
    asset_tag: '',
    status: 'active',
    condition_rating: null,
    install_date: '',
    notes: '',
  };

  if (assetType === 'manholes' || assetType === 'lift_stations') {
    base.longitude = coordinates?.lng ?? 0;
    base.latitude = coordinates?.lat ?? 0;
  }
  if (assetType === 'mains' || assetType === 'force_mains') {
    base.coordinates = lineCoordinates ?? [];
  }
  if (assetType === 'manholes' || assetType === 'mains') {
    base.system_type = 'sanitary';
  }
  if (assetType === 'mains' || assetType === 'force_mains') {
    base.owner = 'municipality';
  }
  if (assetType === 'lift_stations') {
    base.owner = 'municipality';
  }

  return base;
}
