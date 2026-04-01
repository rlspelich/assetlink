import { useState, useEffect } from 'react';
import {
  X, Save, Loader2, ChevronDown, ChevronRight,
  Info, MapPin, Gauge, Droplets, Thermometer, Zap,
} from 'lucide-react';
import { WATER_STATUS_OPTIONS, HYDRANT_FLOW_COLORS } from '../../lib/constants';

interface WaterFormPanelProps {
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

export function WaterFormPanel({ mode, assetType, data, coordinates, lineCoordinates, onSubmit, onCancel, isSubmitting, error }: WaterFormPanelProps) {
  const typeLabel = assetType === 'mains' ? 'Water Main'
    : assetType === 'valves' ? 'Water Valve'
    : assetType === 'hydrants' ? 'Fire Hydrant'
    : assetType === 'services' ? 'Water Service'
    : assetType === 'fittings' ? 'Water Fitting'
    : 'Pressure Zone';

  const isLineAsset = assetType === 'mains';

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
        <button type="button" onClick={onCancel} aria-label="Close" className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 flex flex-col">
        <div className="flex-1">
          {assetType === 'mains' && <WaterMainForm form={form} setField={setField} />}
          {assetType === 'valves' && <WaterValveForm form={form} setField={setField} />}
          {assetType === 'hydrants' && <HydrantForm form={form} setField={setField} />}
          {assetType === 'services' && <WaterServiceForm form={form} setField={setField} />}
          {assetType === 'fittings' && <WaterFittingForm form={form} setField={setField} />}
          {assetType === 'zones' && <PressureZoneForm form={form} setField={setField} />}

          {/* Common: Location (read-only coords) */}
          {!isLineAsset && assetType !== 'zones' && (
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
          {WATER_STATUS_OPTIONS.map((s) => (
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

function WaterMainForm({ form, setField }: FormProps) {
  return (
    <>
      <FormSection icon={Info} title="Pipe Details">
        <CommonFields form={form} setField={setField} />
        <FormField label="Description">
          <input value={(form.description as string) || ''} onChange={(e) => setField('description', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Material">
          <input value={(form.material_code as string) || ''} onChange={(e) => setField('material_code', e.target.value)} placeholder="e.g. DI, PVC, CI" className={inputClass} />
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

      <FormSection icon={Gauge} title="Flow & Burial" defaultOpen={false}>
        <FormField label="Flow Direction">
          <input value={(form.flow_direction as string) || ''} onChange={(e) => setField('flow_direction', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Depth (ft)">
          <input type="number" step="0.1" value={form.depth_feet != null ? String(form.depth_feet) : ''} onChange={(e) => setField('depth_feet', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
        </FormField>
        <FormField label="Break Count">
          <input type="number" value={form.break_count != null ? String(form.break_count) : ''} onChange={(e) => setField('break_count', e.target.value ? parseInt(e.target.value) : '')} className={inputClass} />
        </FormField>
      </FormSection>

      <FormSection icon={Droplets} title="Lining" defaultOpen={false}>
        <FormField label="Lining Type">
          <input value={(form.lining_type as string) || ''} onChange={(e) => setField('lining_type', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Lining Date">
          <input type="date" value={(form.lining_date as string) || ''} onChange={(e) => setField('lining_date', e.target.value)} className={inputClass} />
        </FormField>
      </FormSection>
    </>
  );
}

function WaterValveForm({ form, setField }: FormProps) {
  return (
    <>
      <FormSection icon={Info} title="Valve Details">
        <CommonFields form={form} setField={setField} />
        <FormField label="Description">
          <input value={(form.description as string) || ''} onChange={(e) => setField('description', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Valve Type">
          <input value={(form.valve_type_code as string) || ''} onChange={(e) => setField('valve_type_code', e.target.value)} placeholder="e.g. gate, butterfly, ball" className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Size (in)">
            <input type="number" value={form.size_inches != null ? String(form.size_inches) : ''} onChange={(e) => setField('size_inches', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
          <FormField label="Turns to Close">
            <input type="number" value={form.turns_to_close != null ? String(form.turns_to_close) : ''} onChange={(e) => setField('turns_to_close', e.target.value ? parseInt(e.target.value) : '')} className={inputClass} />
          </FormField>
        </div>
        <FormField label="Manufacturer">
          <input value={(form.manufacturer as string) || ''} onChange={(e) => setField('manufacturer', e.target.value)} className={inputClass} />
        </FormField>
      </FormSection>

      <FormSection icon={Gauge} title="Operation" defaultOpen={false}>
        <FormField label="Normal Position">
          <select value={(form.normal_position as string) || 'open'} onChange={(e) => setField('normal_position', e.target.value)} className={selectClass}>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="partially_open">Partially Open</option>
          </select>
        </FormField>
        <FormField label="Current Position">
          <select value={(form.current_position as string) || ''} onChange={(e) => setField('current_position', e.target.value || null)} className={selectClass}>
            <option value="">--</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="partially_open">Partially Open</option>
          </select>
        </FormField>
        <FormField label="Critical Valve">
          <select value={form.is_critical != null ? String(form.is_critical) : 'false'} onChange={(e) => setField('is_critical', e.target.value === 'true')} className={selectClass}>
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </FormField>
      </FormSection>

      <FormSection icon={Zap} title="Exercise Tracking" defaultOpen={false}>
        <FormField label="Last Exercised">
          <input type="date" value={(form.last_exercised_date as string) || ''} onChange={(e) => setField('last_exercised_date', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Exercise Interval (days)">
          <input type="number" value={form.exercise_interval_days != null ? String(form.exercise_interval_days) : ''} onChange={(e) => setField('exercise_interval_days', e.target.value ? parseInt(e.target.value) : '')} className={inputClass} />
        </FormField>
      </FormSection>
    </>
  );
}

function HydrantForm({ form, setField }: FormProps) {
  return (
    <>
      <FormSection icon={Info} title="Hydrant Details">
        <CommonFields form={form} setField={setField} />
        <FormField label="Description">
          <input value={(form.description as string) || ''} onChange={(e) => setField('description', e.target.value)} className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Make">
            <input value={(form.make as string) || ''} onChange={(e) => setField('make', e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Model">
            <input value={(form.model as string) || ''} onChange={(e) => setField('model', e.target.value)} className={inputClass} />
          </FormField>
        </div>
        <FormField label="Barrel Type">
          <input value={(form.barrel_type as string) || ''} onChange={(e) => setField('barrel_type', e.target.value)} placeholder="e.g. dry_barrel, wet_barrel" className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Nozzle Count">
            <input type="number" value={form.nozzle_count != null ? String(form.nozzle_count) : ''} onChange={(e) => setField('nozzle_count', e.target.value ? parseInt(e.target.value) : '')} className={inputClass} />
          </FormField>
          <FormField label="Nozzle Sizes">
            <input value={(form.nozzle_sizes as string) || ''} onChange={(e) => setField('nozzle_sizes', e.target.value)} placeholder='e.g. 2.5", 4.5"' className={inputClass} />
          </FormField>
        </div>
        <FormField label="Ownership">
          <select value={(form.ownership as string) || 'public'} onChange={(e) => setField('ownership', e.target.value)} className={selectClass}>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </FormField>
      </FormSection>

      <FormSection icon={Thermometer} title="Flow Test" defaultOpen={false}>
        <FormField label="Flow Test Date">
          <input type="date" value={(form.flow_test_date as string) || ''} onChange={(e) => setField('flow_test_date', e.target.value)} className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Static PSI">
            <input type="number" step="0.1" value={form.static_pressure_psi != null ? String(form.static_pressure_psi) : ''} onChange={(e) => setField('static_pressure_psi', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
          <FormField label="Residual PSI">
            <input type="number" step="0.1" value={form.residual_pressure_psi != null ? String(form.residual_pressure_psi) : ''} onChange={(e) => setField('residual_pressure_psi', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Pitot PSI">
            <input type="number" step="0.1" value={form.pitot_pressure_psi != null ? String(form.pitot_pressure_psi) : ''} onChange={(e) => setField('pitot_pressure_psi', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
          <FormField label="Flow GPM">
            <input type="number" step="0.1" value={form.flow_gpm != null ? String(form.flow_gpm) : ''} onChange={(e) => setField('flow_gpm', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
        </div>
        <FormField label="Flow Class Color">
          <select value={(form.flow_class_color as string) || ''} onChange={(e) => setField('flow_class_color', e.target.value || null)} className={selectClass}>
            <option value="">--</option>
            {Object.entries(HYDRANT_FLOW_COLORS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </FormField>
      </FormSection>

      <FormSection icon={Droplets} title="Flushing" defaultOpen={false}>
        <FormField label="Last Flush Date">
          <input type="date" value={(form.last_flush_date as string) || ''} onChange={(e) => setField('last_flush_date', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Flush Interval (days)">
          <input type="number" value={form.flush_interval_days != null ? String(form.flush_interval_days) : ''} onChange={(e) => setField('flush_interval_days', e.target.value ? parseInt(e.target.value) : '')} className={inputClass} />
        </FormField>
      </FormSection>
    </>
  );
}

function WaterServiceForm({ form, setField }: FormProps) {
  return (
    <>
      <FormSection icon={Info} title="Service Details">
        <FormField label="Asset Tag">
          <input value={(form.asset_tag as string) || ''} onChange={(e) => setField('asset_tag', e.target.value)} placeholder="Asset ID / barcode" className={inputClass} />
        </FormField>
        <FormField label="Service Type">
          <input value={(form.service_type as string) || ''} onChange={(e) => setField('service_type', e.target.value)} placeholder="e.g. residential, commercial, irrigation" className={inputClass} />
        </FormField>
        <FormField label="Status">
          <select value={(form.status as string) || 'active'} onChange={(e) => setField('status', e.target.value)} className={selectClass}>
            {WATER_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Install Date">
          <input type="date" value={(form.install_date as string) || ''} onChange={(e) => setField('install_date', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Notes">
          <textarea value={(form.notes as string) || ''} onChange={(e) => setField('notes', e.target.value)} rows={2} className={inputClass + ' resize-none'} />
        </FormField>
      </FormSection>

      <FormSection icon={Gauge} title="Meter" defaultOpen={false}>
        <FormField label="Meter Number">
          <input value={(form.meter_number as string) || ''} onChange={(e) => setField('meter_number', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Meter Size (in)">
          <input type="number" step="0.25" value={form.meter_size_inches != null ? String(form.meter_size_inches) : ''} onChange={(e) => setField('meter_size_inches', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
        </FormField>
        <FormField label="Meter Type">
          <input value={(form.meter_type as string) || ''} onChange={(e) => setField('meter_type', e.target.value)} placeholder="e.g. positive_displacement, turbine" className={inputClass} />
        </FormField>
      </FormSection>

      <FormSection icon={Droplets} title="Service Line" defaultOpen={false}>
        <FormField label="Material">
          <input value={(form.service_line_material as string) || ''} onChange={(e) => setField('service_line_material', e.target.value)} placeholder="e.g. copper, lead, PVC" className={inputClass} />
        </FormField>
        <FormField label="Size (in)">
          <input type="number" step="0.25" value={form.service_line_size_inches != null ? String(form.service_line_size_inches) : ''} onChange={(e) => setField('service_line_size_inches', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
        </FormField>
        <FormField label="Curb Stop Location">
          <input value={(form.curb_stop_location as string) || ''} onChange={(e) => setField('curb_stop_location', e.target.value)} className={inputClass} />
        </FormField>
      </FormSection>

      <FormSection icon={MapPin} title="Location / Account" defaultOpen={false}>
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

function WaterFittingForm({ form, setField }: FormProps) {
  return (
    <>
      <FormSection icon={Info} title="Fitting Details">
        <FormField label="Asset Tag">
          <input value={(form.asset_tag as string) || ''} onChange={(e) => setField('asset_tag', e.target.value)} placeholder="Asset ID / barcode" className={inputClass} />
        </FormField>
        <FormField label="Fitting Type">
          <input value={(form.fitting_type as string) || ''} onChange={(e) => setField('fitting_type', e.target.value)} placeholder="e.g. tee, elbow, reducer, cap" className={inputClass} />
        </FormField>
        <FormField label="Material">
          <input value={(form.material_code as string) || ''} onChange={(e) => setField('material_code', e.target.value)} className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Primary Size (in)">
            <input type="number" step="0.25" value={form.primary_size_inches != null ? String(form.primary_size_inches) : ''} onChange={(e) => setField('primary_size_inches', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
          <FormField label="Secondary Size (in)">
            <input type="number" step="0.25" value={form.secondary_size_inches != null ? String(form.secondary_size_inches) : ''} onChange={(e) => setField('secondary_size_inches', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
        </div>
        <FormField label="Status">
          <select value={(form.status as string) || 'active'} onChange={(e) => setField('status', e.target.value)} className={selectClass}>
            {WATER_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Install Date">
          <input type="date" value={(form.install_date as string) || ''} onChange={(e) => setField('install_date', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Notes">
          <textarea value={(form.notes as string) || ''} onChange={(e) => setField('notes', e.target.value)} rows={2} className={inputClass + ' resize-none'} />
        </FormField>
      </FormSection>
    </>
  );
}

function PressureZoneForm({ form, setField }: FormProps) {
  return (
    <>
      <FormSection icon={Info} title="Zone Details">
        <FormField label="Zone Name">
          <input value={(form.zone_name as string) || ''} onChange={(e) => setField('zone_name', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Zone Number">
          <input value={(form.zone_number as string) || ''} onChange={(e) => setField('zone_number', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Description">
          <textarea value={(form.description as string) || ''} onChange={(e) => setField('description', e.target.value)} rows={2} className={inputClass + ' resize-none'} />
        </FormField>
      </FormSection>

      <FormSection icon={Gauge} title="Pressure Targets" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Min PSI">
            <input type="number" step="0.1" value={form.target_pressure_min_psi != null ? String(form.target_pressure_min_psi) : ''} onChange={(e) => setField('target_pressure_min_psi', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
          <FormField label="Max PSI">
            <input type="number" step="0.1" value={form.target_pressure_max_psi != null ? String(form.target_pressure_max_psi) : ''} onChange={(e) => setField('target_pressure_max_psi', e.target.value ? parseFloat(e.target.value) : '')} className={inputClass} />
          </FormField>
        </div>
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

  // Point assets get coordinates
  if (assetType === 'valves' || assetType === 'hydrants' || assetType === 'services' || assetType === 'fittings') {
    base.longitude = coordinates?.lng ?? 0;
    base.latitude = coordinates?.lat ?? 0;
  }
  // Line assets get coordinate array
  if (assetType === 'mains') {
    base.coordinates = lineCoordinates ?? [];
    base.owner = 'public';
  }
  // Hydrant defaults
  if (assetType === 'hydrants') {
    base.ownership = 'public';
  }
  // Valve defaults
  if (assetType === 'valves') {
    base.normal_position = 'open';
    base.is_critical = false;
  }
  // Service defaults
  if (assetType === 'services') {
    base.service_type = '';
  }
  // Fitting defaults
  if (assetType === 'fittings') {
    base.fitting_type = '';
  }
  // Zone defaults (no common fields)
  if (assetType === 'zones') {
    return {
      zone_name: '',
      zone_number: '',
      target_pressure_min_psi: '',
      target_pressure_max_psi: '',
      description: '',
    };
  }

  return base;
}
