import { useEffect, useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import {
  X, Save, ChevronDown, ChevronRight, Search,
  Eye, MapPin, Shield, Calendar, Loader2, Landmark, Plus,
} from 'lucide-react';
import { useSignTypes } from '../../hooks/use-signs';
import { useSupportsList, useCreateSupport } from '../../hooks/use-supports';
import {
  STATUS_OPTIONS,
  SUPPORT_TYPE_OPTIONS,
  SUPPORT_MATERIAL_OPTIONS,
  SUPPORT_STATUS_OPTIONS,
  formatEnumLabel,
} from '../../lib/constants';
import type { Sign, SignType, SignSupport } from '../../api/types';

// --- Form data type ---

interface SignFormData {
  mutcd_code: string;
  description: string;
  legend_text: string;
  sign_category: string;
  size_width_inches: string;
  size_height_inches: string;
  shape: string;
  background_color: string;
  condition_rating: number | null;
  road_name: string;
  address: string;
  side_of_road: string;
  intersection_with: string;
  location_notes: string;
  sheeting_type: string;
  sheeting_manufacturer: string;
  expected_life_years: string;
  install_date: string;
  status: string;
  facing_direction: string;
  mount_height_inches: string;
  longitude: number;
  latitude: number;
  support_id: string;
}

// --- Props ---

interface SignFormPanelProps {
  mode: 'add' | 'edit';
  sign?: Sign | null;
  coordinates?: { lng: number; lat: number } | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
}

// --- Collapsible Section ---

function FormSection({
  icon: Icon,
  title,
  defaultOpen = true,
  children,
}: {
  icon: React.ElementType;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Icon size={14} />
        {title}
      </button>
      {open && <div className="pb-3 space-y-3">{children}</div>}
    </div>
  );
}

// --- Field wrappers ---

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

const inputClass =
  'w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white';
const selectClass = inputClass;
const readonlyClass =
  'w-full px-2.5 py-1.5 text-sm border border-gray-100 rounded-md bg-gray-50 text-gray-600 font-mono text-xs';

// --- MUTCD Combobox ---

function MutcdPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (signType: SignType) => void;
}) {
  const { data: signTypes = [] } = useSignTypes();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return signTypes.slice(0, 50);
    const q = query.toLowerCase();
    return signTypes
      .filter(
        (st) =>
          st.mutcd_code.toLowerCase().includes(q) ||
          st.description.toLowerCase().includes(q) ||
          st.category.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [signTypes, query]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : value || query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          placeholder="Search MUTCD code or description..."
          className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">No matching sign types</div>
          ) : (
            filtered.map((st) => (
              <button
                key={st.mutcd_code}
                type="button"
                onClick={() => {
                  onSelect(st);
                  setQuery('');
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-50 last:border-b-0 ${
                  st.mutcd_code === value ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono font-semibold text-gray-900">
                    {st.mutcd_code}
                  </span>
                  <span className="text-[10px] text-gray-400 capitalize">{st.category}</span>
                </div>
                <div className="text-xs text-gray-600 truncate">{st.description}</div>
                {(st.shape || st.background_color) && (
                  <div className="flex gap-2 mt-0.5">
                    {st.shape && (
                      <span className="text-[10px] text-gray-400 capitalize">{st.shape}</span>
                    )}
                    {st.background_color && (
                      <span className="text-[10px] text-gray-400 capitalize">
                        {st.background_color}
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// --- Condition Rating Picker ---

function ConditionRatingPicker({
  value,
  onChange,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  const ratings = [1, 2, 3, 4, 5];
  const labels = ['Critical', 'Poor', 'Fair', 'Good', 'Excellent'];
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
  ];

  return (
    <div className="flex gap-1">
      {ratings.map((r, i) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(value === r ? null : r)}
          title={`${r} - ${labels[i]}`}
          className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
            value === r
              ? `${colors[i]} text-white`
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

// --- Support Picker ---

function SupportPicker({
  value,
  onSelect,
  coordinates,
}: {
  value: string;
  onSelect: (supportId: string) => void;
  coordinates?: { lng: number; lat: number } | null;
}) {
  const { data } = useSupportsList({ page_size: 200 });
  const createSupport = useCreateSupport();
  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState('');
  const [newMaterial, setNewMaterial] = useState('');

  const supports = data?.supports ?? [];

  async function handleCreateSupport() {
    if (!newType || !coordinates) return;
    try {
      const created = await createSupport.mutateAsync({
        support_type: newType,
        support_material: newMaterial || undefined,
        longitude: coordinates.lng,
        latitude: coordinates.lat,
      });
      onSelect(created.support_id);
      setShowCreate(false);
      setNewType('');
      setNewMaterial('');
    } catch {
      // error handled by mutation state
    }
  }

  return (
    <div className="space-y-2">
      <select
        value={value}
        onChange={(e) => onSelect(e.target.value)}
        className={inputClass}
      >
        <option value="">No support (standalone)</option>
        {supports.map((s) => (
          <option key={s.support_id} value={s.support_id}>
            {formatEnumLabel(s.support_type)} — {s.sign_count} sign{s.sign_count !== 1 ? 's' : ''} ({s.latitude.toFixed(4)}, {s.longitude.toFixed(4)})
          </option>
        ))}
      </select>

      {!showCreate ? (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <Plus size={12} />
          Create new support
        </button>
      ) : (
        <div className="bg-gray-50 rounded-md p-2.5 space-y-2 border border-gray-200">
          <div className="text-xs font-medium text-gray-600">New Support</div>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className={inputClass}
          >
            <option value="">Select type...</option>
            {SUPPORT_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{formatEnumLabel(t)}</option>
            ))}
          </select>
          <select
            value={newMaterial}
            onChange={(e) => setNewMaterial(e.target.value)}
            className={inputClass}
          >
            <option value="">Material (optional)</option>
            {SUPPORT_MATERIAL_OPTIONS.map((m) => (
              <option key={m} value={m}>{formatEnumLabel(m)}</option>
            ))}
          </select>
          {coordinates ? (
            <div className="text-[10px] text-gray-400">
              Location: {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
            </div>
          ) : (
            <div className="text-[10px] text-orange-600">
              Place sign on map first to set support location
            </div>
          )}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => { setShowCreate(false); setNewType(''); setNewMaterial(''); }}
              className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded bg-white text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateSupport}
              disabled={!newType || !coordinates || createSupport.isPending}
              className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {createSupport.isPending ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Plus size={10} />
              )}
              Create
            </button>
          </div>
          {createSupport.isError && (
            <p className="text-[10px] text-red-500">Failed to create support</p>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main Form ---

export function SignFormPanel({
  mode,
  sign,
  coordinates,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
}: SignFormPanelProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignFormData>({
    defaultValues: buildDefaults(mode, sign, coordinates),
  });

  const conditionRating = watch('condition_rating');
  const mutcdCode = watch('mutcd_code');
  const lng = watch('longitude');
  const lat = watch('latitude');

  // Update coordinates when they change externally (placement mode)
  useEffect(() => {
    if (coordinates) {
      setValue('longitude', coordinates.lng);
      setValue('latitude', coordinates.lat);
    }
  }, [coordinates, setValue]);

  function handleMutcdSelect(st: SignType) {
    setValue('mutcd_code', st.mutcd_code);
    setValue('description', st.description);
    setValue('sign_category', st.category);
    setValue('shape', st.shape || '');
    setValue('background_color', st.background_color || '');
    if (st.expected_life_years) {
      setValue('expected_life_years', String(st.expected_life_years));
    }
    if (st.standard_width) {
      setValue('size_width_inches', String(st.standard_width));
    }
    if (st.standard_height) {
      setValue('size_height_inches', String(st.standard_height));
    }
    if (st.default_sheeting_type) {
      setValue('sheeting_type', st.default_sheeting_type);
    }
  }

  const numericFields = new Set([
    'size_width_inches', 'size_height_inches', 'expected_life_years',
    'facing_direction', 'mount_height_inches',
  ]);

  function onFormSubmit(data: SignFormData) {
    // Clean up empty strings and convert string numerics to numbers
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val === '' || val === undefined || val === null) continue;
      if (numericFields.has(key) && typeof val === 'string') {
        const num = parseFloat(val);
        if (!isNaN(num)) cleaned[key] = num;
      } else {
        cleaned[key] = val;
      }
    }
    // Always include coordinates
    cleaned.longitude = data.longitude;
    cleaned.latitude = data.latitude;
    onSubmit(cleaned);
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-900 text-sm">
            {mode === 'add' ? 'Add Sign' : 'Edit Sign'}
          </div>
          {mode === 'edit' && sign?.mutcd_code && (
            <div className="text-xs text-gray-500">{sign.mutcd_code}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
        >
          <X size={16} />
        </button>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onFormSubmit)}
        className="flex-1 overflow-y-auto px-4 flex flex-col"
      >
        <div className="flex-1">
          {/* Sign Details */}
          <FormSection icon={Eye} title="Sign Details">
            <FormField label="Asset Tag">
              <input
                {...register('asset_tag')}
                placeholder="Municipality asset ID / barcode"
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </FormField>
            <FormField label="MUTCD Code" error={errors.mutcd_code?.message}>
              <MutcdPicker
                value={mutcdCode || ''}
                onSelect={handleMutcdSelect}
              />
            </FormField>

            <FormField label="Description" error={errors.description?.message}>
              <input {...register('description')} className={inputClass} />
            </FormField>

            <FormField label="Legend Text" error={errors.legend_text?.message}>
              <input {...register('legend_text')} className={inputClass} />
            </FormField>

            <FormField label="Category" error={errors.sign_category?.message}>
              <input {...register('sign_category')} className={inputClass} readOnly />
            </FormField>

            <div className="grid grid-cols-2 gap-2">
              <FormField label="Width (in)" error={errors.size_width_inches?.message}>
                <input
                  type="number"
                  step="0.1"
                  {...register('size_width_inches')}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Height (in)" error={errors.size_height_inches?.message}>
                <input
                  type="number"
                  step="0.1"
                  {...register('size_height_inches')}
                  className={inputClass}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <FormField label="Shape" error={errors.shape?.message}>
                <input {...register('shape')} className={inputClass} readOnly />
              </FormField>
              <FormField label="Background" error={errors.background_color?.message}>
                <input {...register('background_color')} className={inputClass} readOnly />
              </FormField>
            </div>

            <FormField label="Condition Rating" error={errors.condition_rating?.message}>
              <ConditionRatingPicker
                value={conditionRating ?? null}
                onChange={(v) => setValue('condition_rating', v)}
              />
            </FormField>

            <FormField label="Status" error={errors.status?.message}>
              <select {...register('status')} className={selectClass}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </FormField>
          </FormSection>

          {/* Support */}
          <FormSection icon={Landmark} title="Support" defaultOpen={!!watch('support_id')}>
            <FormField label="Attach to Support">
              <SupportPicker
                value={watch('support_id') || ''}
                onSelect={(id) => setValue('support_id', id)}
                coordinates={coordinates || (lng && lat ? { lng, lat } : null)}
              />
            </FormField>
          </FormSection>

          {/* Location */}
          <FormSection icon={MapPin} title="Location">
            <FormField label="Road Name" error={errors.road_name?.message}>
              <input {...register('road_name')} className={inputClass} />
            </FormField>

            <FormField label="Address" error={errors.address?.message}>
              <input {...register('address')} className={inputClass} />
            </FormField>

            <FormField label="Intersection With" error={errors.intersection_with?.message}>
              <input {...register('intersection_with')} className={inputClass} />
            </FormField>

            <FormField label="Side of Road" error={errors.side_of_road?.message}>
              <select {...register('side_of_road')} className={selectClass}>
                <option value="">--</option>
                <option value="N">North</option>
                <option value="S">South</option>
                <option value="E">East</option>
                <option value="W">West</option>
              </select>
            </FormField>

            <div className="grid grid-cols-2 gap-2">
              <FormField label="Facing (0-360)" error={errors.facing_direction?.message}>
                <input
                  type="number"
                  min="0"
                  max="360"
                  {...register('facing_direction')}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Mount Height (in)" error={errors.mount_height_inches?.message}>
                <input
                  type="number"
                  step="0.1"
                  {...register('mount_height_inches')}
                  className={inputClass}
                />
              </FormField>
            </div>

            <FormField label="Location Notes" error={errors.location_notes?.message}>
              <textarea
                {...register('location_notes')}
                rows={2}
                className={inputClass + ' resize-none'}
              />
            </FormField>

            {/* Coordinates (read-only) */}
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Longitude">
                <input type="text" value={lng?.toFixed(6) ?? ''} readOnly className={readonlyClass} />
              </FormField>
              <FormField label="Latitude">
                <input type="text" value={lat?.toFixed(6) ?? ''} readOnly className={readonlyClass} />
              </FormField>
            </div>
          </FormSection>

          {/* MUTCD Compliance */}
          <FormSection icon={Shield} title="MUTCD Compliance" defaultOpen={false}>
            <FormField label="Sheeting Type" error={errors.sheeting_type?.message}>
              <input {...register('sheeting_type')} className={inputClass} />
            </FormField>

            <FormField label="Sheeting Manufacturer" error={errors.sheeting_manufacturer?.message}>
              <input {...register('sheeting_manufacturer')} className={inputClass} />
            </FormField>

            <FormField label="Expected Life (years)" error={errors.expected_life_years?.message}>
              <input
                type="number"
                {...register('expected_life_years')}
                className={inputClass}
              />
            </FormField>
          </FormSection>

          {/* Lifecycle */}
          <FormSection icon={Calendar} title="Lifecycle" defaultOpen={false}>
            <FormField label="Install Date" error={errors.install_date?.message}>
              <input type="date" {...register('install_date')} className={inputClass} />
            </FormField>
          </FormSection>
        </div>

        {/* Error display */}
        {error && (
          <div className="mx-0 mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 py-3 flex gap-2 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={14} />
                {mode === 'add' ? 'Create Sign' : 'Save Changes'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// --- Helpers ---

function buildDefaults(
  mode: 'add' | 'edit',
  sign?: Sign | null,
  coordinates?: { lng: number; lat: number } | null
): SignFormData {
  if (mode === 'edit' && sign) {
    return {
      mutcd_code: sign.mutcd_code || '',
      description: sign.description || '',
      legend_text: sign.legend_text || '',
      sign_category: sign.sign_category || '',
      size_width_inches: sign.size_width_inches != null ? String(sign.size_width_inches) : '',
      size_height_inches: sign.size_height_inches != null ? String(sign.size_height_inches) : '',
      shape: sign.shape || '',
      background_color: sign.background_color || '',
      condition_rating: sign.condition_rating,
      road_name: sign.road_name || '',
      address: sign.address || '',
      side_of_road: sign.side_of_road || '',
      intersection_with: sign.intersection_with || '',
      location_notes: sign.location_notes || '',
      sheeting_type: sign.sheeting_type || '',
      sheeting_manufacturer: sign.sheeting_manufacturer || '',
      expected_life_years: sign.expected_life_years != null ? String(sign.expected_life_years) : '',
      install_date: sign.install_date ? sign.install_date.split('T')[0] : '',
      status: sign.status || 'active',
      facing_direction: sign.facing_direction != null ? String(sign.facing_direction) : '',
      mount_height_inches: sign.mount_height_inches != null ? String(sign.mount_height_inches) : '',
      longitude: sign.longitude,
      latitude: sign.latitude,
      support_id: sign.support_id || '',
    };
  }
  return {
    mutcd_code: '',
    description: '',
    legend_text: '',
    sign_category: '',
    size_width_inches: '',
    size_height_inches: '',
    shape: '',
    background_color: '',
    condition_rating: null,
    road_name: '',
    address: '',
    side_of_road: '',
    intersection_with: '',
    location_notes: '',
    sheeting_type: '',
    sheeting_manufacturer: '',
    expected_life_years: '',
    install_date: '',
    status: 'active',
    facing_direction: '',
    mount_height_inches: '',
    longitude: coordinates?.lng ?? 0,
    latitude: coordinates?.lat ?? 0,
    support_id: '',
  };
}
