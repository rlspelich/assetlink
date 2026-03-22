import { useState } from 'react';
import { X, Loader2, Signpost, Landmark } from 'lucide-react';
import type { WorkOrder, WorkOrderCreate, WorkOrderUpdate } from '../../api/types';
import { WO_WORK_TYPE_OPTIONS, WO_PRIORITY_OPTIONS, WO_ACTION_OPTIONS } from '../../lib/constants';
import { useUsersList } from '../../hooks/use-users';
import { getUserRoleOption } from '../../lib/constants';

export interface AssetContext {
  support_id?: string;
  assets: Array<{ asset_type: string; asset_id: string; label: string }>;
}

interface WorkOrderFormProps {
  mode: 'create' | 'edit';
  workOrder?: WorkOrder | null;
  /** Pre-fill context when creating from assets */
  assetContext?: AssetContext | null;
  /** Coordinates from map selection (location click or sign location) */
  coordinates?: { lng: number; lat: number } | null;
  onSubmit: (data: WorkOrderCreate | WorkOrderUpdate) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
}

interface AssetFormRow {
  asset_type: string;
  asset_id: string;
  label: string;
  action_required: string;
  damage_notes: string;
}

export function WorkOrderForm({
  mode,
  workOrder,
  assetContext,
  coordinates,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
}: WorkOrderFormProps) {
  const [description, setDescription] = useState(workOrder?.description ?? '');
  const [workType, setWorkType] = useState(workOrder?.work_type ?? 'repair');
  const [priority, setPriority] = useState(workOrder?.priority ?? 'routine');
  const [category, setCategory] = useState(workOrder?.category ?? '');
  const [assignedTo, setAssignedTo] = useState(workOrder?.assigned_to ?? '');
  const [dueDate, setDueDate] = useState(workOrder?.due_date ?? '');

  // Fetch active users for the assignment dropdown
  const { data: usersData } = useUsersList({ is_active: true });
  const assignableUsers = (usersData?.users ?? []).filter(
    (u) => u.role === 'supervisor' || u.role === 'crew_chief',
  );
  const [address, setAddress] = useState(workOrder?.address ?? '');
  const [instructions, setInstructions] = useState(workOrder?.instructions ?? '');
  const [notes, setNotes] = useState(workOrder?.notes ?? '');

  // Per-asset action/notes state (only used when creating with asset context)
  const [assetRows, setAssetRows] = useState<AssetFormRow[]>(() => {
    if (!assetContext?.assets) return [];
    return assetContext.assets.map((a) => ({
      asset_type: a.asset_type,
      asset_id: a.asset_id,
      label: a.label,
      action_required: 'replace',
      damage_notes: '',
    }));
  });

  const updateAssetRow = (index: number, field: keyof AssetFormRow, value: string) => {
    setAssetRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'create') {
      const data: WorkOrderCreate = {
        work_type: workType,
        description: description || undefined,
        priority,
        category: category || undefined,
        assigned_to: assignedTo || undefined,
        due_date: dueDate || undefined,
        address: address || undefined,
        instructions: instructions || undefined,
        notes: notes || undefined,
        longitude: coordinates?.lng,
        latitude: coordinates?.lat,
      };

      // Multi-asset context
      if (assetContext) {
        if (assetContext.support_id) {
          // Support-based creation: pass support_id, backend auto-attaches
          data.support_id = assetContext.support_id;
        } else if (assetRows.length > 0) {
          // Explicit assets list
          data.assets = assetRows.map((r) => ({
            asset_type: r.asset_type,
            asset_id: r.asset_id,
            action_required: r.action_required || undefined,
            damage_notes: r.damage_notes || undefined,
          }));
        }
      }

      onSubmit(data);
    } else {
      const data: WorkOrderUpdate = {
        description: description || undefined,
        work_type: workType,
        priority,
        category: category || undefined,
        assigned_to: assignedTo || undefined,
        due_date: dueDate || undefined,
        address: address || undefined,
        instructions: instructions || undefined,
        notes: notes || undefined,
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
            {mode === 'create' ? 'Create Work Order' : 'Edit Work Order'}
          </h2>
          <button onClick={onCancel} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Asset context banner */}
        {hasAssets && mode === 'create' && (
          <div className="px-5 py-2 bg-blue-50 border-b text-xs text-blue-700">
            <span className="font-medium">{assetRows.length} asset{assetRows.length !== 1 ? 's' : ''}</span> will be attached to this work order
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
          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Describe the work to be done..."
            />
          </div>

          {/* Work Type + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Work Type *</label>
              <select
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {WO_WORK_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {WO_PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category + Assigned To row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. Signs, Traffic"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Assigned To</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Unassigned</option>
                {assignableUsers.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.first_name} {u.last_name} ({getUserRoleOption(u.role).label})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date + Address row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Location/address"
              />
            </div>
          </div>

          {/* Affected Assets (only during create with context) */}
          {hasAssets && mode === 'create' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Affected Assets ({assetRows.length})
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {assetRows.map((row, idx) => {
                  const isSign = row.asset_type === 'sign';
                  const AssetIcon = isSign ? Signpost : Landmark;
                  return (
                    <div key={row.asset_id} className="border border-gray-200 rounded-lg p-2.5 bg-gray-50">
                      <div className="flex items-center gap-2 mb-2">
                        <AssetIcon size={12} className="text-gray-400 shrink-0" />
                        <span className="text-xs font-medium text-gray-900 truncate flex-1">{row.label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">Action</label>
                          <select
                            value={row.action_required}
                            onChange={(e) => updateAssetRow(idx, 'action_required', e.target.value)}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">None</option>
                            {WO_ACTION_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">Damage Notes</label>
                          <input
                            type="text"
                            value={row.damage_notes}
                            onChange={(e) => updateAssetRow(idx, 'damage_notes', e.target.value)}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Special instructions for crew..."
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Additional notes..."
            />
          </div>

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
            disabled={isSubmitting || !description.trim()}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Saving...
              </>
            ) : (
              mode === 'create' ? 'Create Work Order' : 'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
