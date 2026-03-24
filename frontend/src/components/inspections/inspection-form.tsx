import { useState } from 'react';
import { X, Loader2, Signpost, Landmark } from 'lucide-react';
import type { Inspection, InspectionCreate, InspectionUpdate, InspectionAssetCreatePayload } from '../../api/types';
import {
  INSPECTION_TYPE_OPTIONS,
  INSPECTION_ACTION_OPTIONS,
  CONDITION_COLORS,
  getUserRoleOption,
} from '../../lib/constants';
import { useUsersList } from '../../hooks/use-users';

export interface InspectionAssetContext {
  support_id?: string;
  assets: Array<{ asset_type: string; asset_id: string; label: string }>;
}

interface InspectionFormProps {
  mode: 'create' | 'edit';
  inspection?: Inspection | null;
  /** Pre-fill context when creating from assets */
  assetContext?: InspectionAssetContext | null;
  /** Coordinates from map selection (location click or sign location) */
  coordinates?: { lng: number; lat: number } | null;
  onSubmit: (data: InspectionCreate | InspectionUpdate) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
}

interface AssetFormRow {
  asset_type: string;
  asset_id: string;
  label: string;
  condition_rating: number | null;
  findings: string;
  retroreflectivity_value: string;
  passes_minimum_retro: boolean | null;
  action_recommended: string;
}

function ConditionButtons({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((rating) => {
        const color = CONDITION_COLORS[rating];
        const isSelected = value === rating;
        return (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(isSelected ? null : rating)}
            className={`w-8 h-8 rounded text-xs font-bold transition-all ${
              isSelected
                ? 'ring-2 ring-offset-1 shadow-sm'
                : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              backgroundColor: color.hex + (isSelected ? '30' : '15'),
              color: color.hex,
              outlineColor: isSelected ? color.hex : undefined,
            }}
            title={`${rating}/5 — ${color.label}`}
          >
            {rating}
          </button>
        );
      })}
    </div>
  );
}

export function InspectionForm({
  mode,
  inspection,
  assetContext,
  coordinates,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
}: InspectionFormProps) {
  const today = new Date().toISOString().split('T')[0];

  const [inspectionType, setInspectionType] = useState(inspection?.inspection_type ?? 'sign_condition');
  const [inspectionDate, setInspectionDate] = useState(inspection?.inspection_date ?? today);
  const [inspectorId, setInspectorId] = useState(inspection?.inspector_id ?? '');

  // Fetch active users for the inspector dropdown
  const { data: usersData } = useUsersList({ is_active: true });
  const inspectors = usersData?.users ?? [];
  const [overallCondition, setOverallCondition] = useState<number | null>(inspection?.condition_rating ?? null);
  const [findings, setFindings] = useState(inspection?.findings ?? '');
  const [recommendations, setRecommendations] = useState(inspection?.recommendations ?? '');
  const [followUpRequired, setFollowUpRequired] = useState(inspection?.follow_up_required ?? false);
  const [status, setStatus] = useState(inspection?.status ?? 'completed');

  // Per-asset state
  const [assetRows, setAssetRows] = useState<AssetFormRow[]>(() => {
    if (!assetContext?.assets) return [];
    return assetContext.assets.map((a) => ({
      asset_type: a.asset_type,
      asset_id: a.asset_id,
      label: a.label,
      condition_rating: null,
      findings: '',
      retroreflectivity_value: '',
      passes_minimum_retro: null,
      action_recommended: 'ok',
    }));
  });

  const updateAssetRow = (index: number, field: keyof AssetFormRow, value: unknown) => {
    setAssetRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'create') {
      const data: InspectionCreate = {
        inspection_type: inspectionType,
        inspection_date: inspectionDate,
        inspector_id: inspectorId || undefined,
        status,
        condition_rating: overallCondition ?? undefined,
        findings: findings || undefined,
        recommendations: recommendations || undefined,
        follow_up_required: followUpRequired,
        longitude: coordinates?.lng,
        latitude: coordinates?.lat,
      };

      if (assetContext) {
        if (assetContext.support_id && assetRows.length === 0) {
          // Support-based creation: pass support_id, backend auto-attaches
          data.support_id = assetContext.support_id;
        } else if (assetRows.length > 0) {
          // Explicit assets list with per-asset data
          data.assets = assetRows.map((r): InspectionAssetCreatePayload => ({
            asset_type: r.asset_type,
            asset_id: r.asset_id,
            condition_rating: r.condition_rating ?? undefined,
            findings: r.findings || undefined,
            retroreflectivity_value: r.retroreflectivity_value ? parseFloat(r.retroreflectivity_value) : undefined,
            passes_minimum_retro: r.passes_minimum_retro ?? undefined,
            action_recommended: r.action_recommended || undefined,
            status: r.action_recommended && r.action_recommended !== 'ok' ? 'needs_action' : 'inspected',
          }));

          // If there's a support_id too, also pass it for geometry
          if (assetContext.support_id) {
            data.support_id = assetContext.support_id;
          }
        }
      }

      onSubmit(data);
    } else {
      const data: InspectionUpdate = {
        inspection_type: inspectionType,
        inspection_date: inspectionDate,
        inspector_id: inspectorId || undefined,
        status,
        condition_rating: overallCondition ?? undefined,
        findings: findings || undefined,
        recommendations: recommendations || undefined,
        follow_up_required: followUpRequired,
      };
      onSubmit(data);
    }
  };

  const hasAssets = assetContext && assetRows.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-900">
            {mode === 'create' ? 'New Inspection' : 'Edit Inspection'}
          </h2>
          <button onClick={onCancel} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Asset context banner */}
        {hasAssets && mode === 'create' && (
          <div className="px-5 py-2 bg-blue-50 border-b text-xs text-blue-700">
            <span className="font-medium">{assetRows.length} asset{assetRows.length !== 1 ? 's' : ''}</span> will be inspected
          </div>
        )}

        {/* Location banner (from map selection) */}
        {coordinates && mode === 'create' && !hasAssets && (
          <div className="px-5 py-2 bg-green-50 border-b text-xs text-green-700 flex items-center gap-1.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>Location: {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Inspection Type + Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Inspection Type *</label>
              <select
                value={inspectionType}
                onChange={(e) => setInspectionType(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {INSPECTION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                required
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Inspector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Inspector</label>
            <select
              value={inspectorId}
              onChange={(e) => setInspectorId(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select inspector...</option>
              {inspectors.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.first_name} {u.last_name} ({getUserRoleOption(u.role).label})
                </option>
              ))}
            </select>
          </div>

          {/* Overall condition + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Overall Condition</label>
              <ConditionButtons value={overallCondition} onChange={setOverallCondition} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Per-asset inspection (only during create with context) */}
          {hasAssets && mode === 'create' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Inspected Assets ({assetRows.length})
              </label>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {assetRows.map((row, idx) => {
                  const isSign = row.asset_type === 'sign';
                  const AssetIcon = isSign ? Signpost : Landmark;
                  return (
                    <div key={row.asset_id} className="border border-gray-200 rounded-lg p-2.5 bg-gray-50">
                      <div className="flex items-center gap-2 mb-2">
                        <AssetIcon size={12} className="text-gray-400 shrink-0" />
                        <span className="text-xs font-medium text-gray-900 truncate flex-1">{row.label}</span>
                      </div>

                      {/* Condition rating */}
                      <div className="mb-2">
                        <label className="block text-[10px] text-gray-500 mb-0.5">Condition</label>
                        <ConditionButtons
                          value={row.condition_rating}
                          onChange={(v) => updateAssetRow(idx, 'condition_rating', v)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Findings */}
                        <div className="col-span-2">
                          <label className="block text-[10px] text-gray-500 mb-0.5">Findings</label>
                          <input
                            type="text"
                            value={row.findings}
                            onChange={(e) => updateAssetRow(idx, 'findings', e.target.value)}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Describe condition..."
                          />
                        </div>

                        {/* Retro value (signs only) */}
                        {isSign && (
                          <>
                            <div>
                              <label className="block text-[10px] text-gray-500 mb-0.5">Retro (mcd/lux/m2)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={row.retroreflectivity_value}
                                onChange={(e) => updateAssetRow(idx, 'retroreflectivity_value', e.target.value)}
                                className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="e.g. 85.0"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 mb-0.5">Passes Min?</label>
                              <select
                                value={row.passes_minimum_retro === null ? '' : row.passes_minimum_retro ? 'true' : 'false'}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  updateAssetRow(idx, 'passes_minimum_retro', v === '' ? null : v === 'true');
                                }}
                                className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="">N/A</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            </div>
                          </>
                        )}

                        {/* Action recommended */}
                        <div className={isSign ? '' : 'col-span-2'}>
                          <label className="block text-[10px] text-gray-500 mb-0.5">Action</label>
                          <select
                            value={row.action_recommended}
                            onChange={(e) => updateAssetRow(idx, 'action_recommended', e.target.value)}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {INSPECTION_ACTION_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Findings */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Overall Findings</label>
            <textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Describe overall observations..."
            />
          </div>

          {/* Recommendations */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Recommendations</label>
            <textarea
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              rows={2}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Recommended actions..."
            />
          </div>

          {/* Follow-up required */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={followUpRequired}
              onChange={(e) => setFollowUpRequired(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-700 font-medium">Follow-up required</span>
          </label>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-gray-50">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !inspectionDate}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Saving...
              </>
            ) : (
              mode === 'create' ? 'Create Inspection' : 'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
