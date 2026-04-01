import { useState, memo } from 'react';
import { X, Landmark, MapPin, Calendar, Trash2, Loader2, ClipboardCheck, Plus, Unlink, Pencil, Save, XCircle } from 'lucide-react';
import { useSupport, useDeleteSupport, useUpdateSupport } from '../../hooks/use-supports';
import type { Sign } from '../../api/types';
import { CONDITION_COLORS, UNRATED_COLOR, INACTIVE_STATUSES, INACTIVE_COLOR, formatEnumLabel } from '../../lib/constants';

interface SupportDetailPanelProps {
  supportId: string;
  /** The sign_id that was originally clicked (highlighted in the list) */
  clickedSignId?: string | null;
  onClose: () => void;
  onSignSelect: (sign: Sign) => void;
  onCreateWorkOrder?: (context: {
    support_id: string;
    assets: Array<{ asset_type: string; asset_id: string; label: string }>;
  }) => void;
  onInspect?: (context: {
    support_id: string;
    assets: Array<{ asset_type: string; asset_id: string; label: string }>;
  }) => void;
  onAddSignToSupport?: (supportId: string, coordinates: { lng: number; lat: number }) => void;
  onRemoveSignFromSupport?: (signId: string) => void;
  onArchiveSupport?: (supportId: string) => void;
  onArchiveSupportAndSigns?: (supportId: string) => void;
  onDeleteSupportAndSigns?: (supportId: string) => void;
}

import { formatDate as _formatDate } from '../../lib/format-utils';
const formatDate = (d: string | null) => _formatDate(d, '—');

function conditionBadge(rating: number | null, status: string) {
  const color = INACTIVE_STATUSES.has(status)
    ? INACTIVE_COLOR
    : rating
      ? CONDITION_COLORS[rating]
      : UNRATED_COLOR;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: color.hex + '20', color: color.hex }}>
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color.hex }} />
      {rating ? `${rating}/5 — ${color.label}` : color.label}
    </span>
  );
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    damaged: 'bg-red-100 text-red-800',
    leaning: 'bg-yellow-100 text-yellow-800',
    missing: 'bg-gray-100 text-gray-600',
    removed: 'bg-gray-100 text-gray-500',
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
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '' || value === '—') {
    return null;
  }
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  );
}

function getSignColor(sign: Sign) {
  if (INACTIVE_STATUSES.has(sign.status)) return INACTIVE_COLOR;
  if (sign.condition_rating) return CONDITION_COLORS[sign.condition_rating];
  return UNRATED_COLOR;
}

export const SupportDetailPanel = memo(function SupportDetailPanel({ supportId, clickedSignId, onClose, onSignSelect, onCreateWorkOrder, onInspect, onAddSignToSupport, onRemoveSignFromSupport, onArchiveSupport, onArchiveSupportAndSigns, onDeleteSupportAndSigns }: SupportDetailPanelProps) {
  const { data: support, isLoading } = useSupport(supportId);
  const deleteSupport = useDeleteSupport();
  const updateSupport = useUpdateSupport();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmRemoveSignId, setConfirmRemoveSignId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    asset_tag: '',
    support_type: '',
    support_material: '',
    height_inches: '',
    status: '',
    condition_rating: '',
    install_date: '',
    notes: '',
  });

  const startEditing = () => {
    if (!support) return;
    setEditForm({
      asset_tag: support.asset_tag || '',
      support_type: support.support_type || '',
      support_material: support.support_material || '',
      height_inches: support.height_inches?.toString() || '',
      status: support.status || 'active',
      condition_rating: support.condition_rating?.toString() || '',
      install_date: support.install_date?.split('T')[0] || '',
      notes: support.notes || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateSupport.mutateAsync({
        id: supportId,
        data: {
          asset_tag: editForm.asset_tag || undefined,
          support_type: (editForm.support_type || 'u_channel') as 'u_channel' | 'square_tube' | 'round_pole' | 'mast_arm' | 'span_wire' | 'wood_post' | 'other',
          support_material: (editForm.support_material || undefined) as 'galvanized_steel' | 'aluminum' | 'steel' | 'wood' | 'fiberglass' | 'other' | undefined,
          height_inches: editForm.height_inches ? parseInt(editForm.height_inches) : undefined,
          status: editForm.status || 'active',
          condition_rating: editForm.condition_rating ? parseInt(editForm.condition_rating) : undefined,
          install_date: editForm.install_date || undefined,
          notes: editForm.notes || undefined,
          latitude: support!.latitude,
          longitude: support!.longitude,
        },
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update support:', err);
    }
  };

  if (isLoading || !support) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full shrink-0 overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  const handleDetachAndDelete = async () => {
    try {
      // If there are signs, detach them first via parent callbacks
      if (support.signs.length > 0 && onRemoveSignFromSupport) {
        for (const sign of support.signs) {
          await new Promise<void>((resolve) => {
            onRemoveSignFromSupport(sign.sign_id);
            // Small delay to let each detach complete
            setTimeout(resolve, 100);
          });
        }
        // Wait a bit for detaches to propagate, then delete
        setTimeout(async () => {
          try {
            await deleteSupport.mutateAsync(supportId);
            setShowDeleteConfirm(false);
            onClose();
          } catch (err: unknown) {
            console.error('Delete support after detach failed:', err);
          }
        }, 500);
      } else {
        await deleteSupport.mutateAsync(supportId);
        setShowDeleteConfirm(false);
        onClose();
      }
    } catch (err: unknown) {
      console.error('Delete support failed:', err);
    }
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold text-gray-900 text-sm">
            <Landmark size={14} className="text-gray-500 shrink-0" />
            <span className="truncate">{support.asset_tag || formatEnumLabel(support.support_type)}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {formatEnumLabel(support.support_type)} &middot; {support.sign_count} {support.sign_count === 1 ? 'sign' : 'signs'}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {conditionBadge(support.condition_rating, support.status)}
            {statusBadge(support.status)}
          </div>
          <div className="flex gap-1.5 mt-2">
            {onCreateWorkOrder && (
              <button
                onClick={() => onCreateWorkOrder({
                  support_id: supportId,
                  assets: [
                    { asset_type: 'sign_support', asset_id: supportId, label: `${formatEnumLabel(support.support_type)} Support` },
                    ...support.signs.map((s) => ({ asset_type: 'sign', asset_id: s.sign_id, label: `${s.mutcd_code ?? 'Sign'} — ${s.description ?? 'Unknown'}` })),
                  ],
                })}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Create Work Order
              </button>
            )}
            {onInspect && (
              <button
                onClick={() => onInspect({
                  support_id: supportId,
                  assets: [
                    { asset_type: 'sign_support', asset_id: supportId, label: `${formatEnumLabel(support.support_type)} Support` },
                    ...support.signs.map((s) => ({ asset_type: 'sign', asset_id: s.sign_id, label: `${s.mutcd_code ?? 'Sign'} — ${s.description ?? 'Unknown'}` })),
                  ],
                })}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              >
                <ClipboardCheck size={12} />
                Inspect
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isEditing && (
            <button
              onClick={startEditing}
              title="Edit support"
              aria-label="Edit support"
              className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-600"
            >
              <Pencil size={16} />
            </button>
          )}
          {!isEditing && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete support"
              aria-label="Delete support"
              className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-red-600"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={() => { setIsEditing(false); onClose(); }}
            aria-label="Close"
            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Delete / Archive confirmation */}
      {showDeleteConfirm && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <p className="text-xs text-gray-800 font-medium mb-1">
            Remove this {formatEnumLabel(support.support_type)}?
          </p>
          {support.signs.length > 0 && (
            <div className="text-[11px] text-gray-500 mb-2">
              {support.signs.length} {support.signs.length === 1 ? 'sign' : 'signs'} attached:
              <ul className="mt-1 ml-3 list-disc text-[10px] text-gray-400">
                {support.signs.slice(0, 5).map((s) => (
                  <li key={s.sign_id}>{s.mutcd_code} — {s.description || 'Unknown'}</li>
                ))}
                {support.signs.length > 5 && <li>...and {support.signs.length - 5} more</li>}
              </ul>
            </div>
          )}
          <div className="space-y-2 mt-3">
            {support.signs.length > 0 && (
              <button
                onClick={() => handleDetachAndDelete()}
                disabled={deleteSupport.isPending}
                className="w-full px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-left"
              >
                <div className="font-medium">Detach Signs & Delete Support</div>
                <div className="text-blue-200 text-[10px] mt-0.5">
                  Signs remain in inventory unlinked. Only the post is removed.
                </div>
              </button>
            )}
            {onArchiveSupportAndSigns && support.signs.length > 0 && (
              <button
                onClick={() => {
                  onArchiveSupportAndSigns(supportId);
                  setShowDeleteConfirm(false);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-600 text-white rounded hover:bg-slate-700 text-left"
              >
                <div className="font-medium">Archive Everything</div>
                <div className="text-slate-300 text-[10px] mt-0.5">
                  Support + all {support.signs.length} signs archived. Records preserved for legal/historical reference.
                </div>
              </button>
            )}
            {onArchiveSupport && support.signs.length === 0 && (
              <button
                onClick={() => {
                  onArchiveSupport(supportId);
                  setShowDeleteConfirm(false);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-600 text-white rounded hover:bg-slate-700 text-left"
              >
                <div className="font-medium">Archive</div>
                <div className="text-slate-300 text-[10px] mt-0.5">
                  Record preserved for legal/historical reference.
                </div>
              </button>
            )}
            {onDeleteSupportAndSigns && support.signs.length > 0 && (
              <button
                onClick={() => {
                  onDeleteSupportAndSigns(supportId);
                  setShowDeleteConfirm(false);
                }}
                className="w-full px-3 py-2 text-xs bg-red-600 text-white rounded hover:bg-red-700 text-left"
              >
                <div className="font-medium">Delete Everything Permanently</div>
                <div className="text-red-200 text-[10px] mt-0.5">
                  Support + all signs gone forever. Use for data entry errors only.
                </div>
              </button>
            )}
            {support.signs.length === 0 && (
              <button
                onClick={() => handleDetachAndDelete()}
                disabled={deleteSupport.isPending}
                className="w-full px-3 py-2 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-left"
              >
                <div className="font-medium">Delete Permanently</div>
                <div className="text-red-200 text-[10px] mt-0.5">Cannot be undone.</div>
              </button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="w-full px-2 py-2 text-xs border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4">
        {isEditing ? (
          /* ====== EDIT MODE ====== */
          <div className="py-4 border-b border-gray-100">
            <h4 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              <Pencil size={14} />
              Edit Support
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Asset Tag</label>
                <input
                  type="text"
                  value={editForm.asset_tag}
                  onChange={(e) => setEditForm({ ...editForm, asset_tag: e.target.value })}
                  placeholder="e.g. SUP-001"
                  className="w-full px-2 py-2 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Type</label>
                <select
                  value={editForm.support_type}
                  onChange={(e) => setEditForm({ ...editForm, support_type: e.target.value })}
                  className="w-full px-2 py-2 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="u_channel">U Channel</option>
                  <option value="square_tube">Square Tube</option>
                  <option value="round_pole">Round Pole</option>
                  <option value="mast_arm">Mast Arm</option>
                  <option value="span_wire">Span Wire</option>
                  <option value="wood_post">Wood Post</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Material</label>
                <select
                  value={editForm.support_material}
                  onChange={(e) => setEditForm({ ...editForm, support_material: e.target.value })}
                  className="w-full px-2 py-2 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Not specified</option>
                  <option value="galvanized_steel">Galvanized Steel</option>
                  <option value="aluminum">Aluminum</option>
                  <option value="steel">Steel</option>
                  <option value="wood">Wood</option>
                  <option value="fiberglass">Fiberglass</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Height (inches)</label>
                  <input
                    type="number"
                    value={editForm.height_inches}
                    onChange={(e) => setEditForm({ ...editForm, height_inches: e.target.value })}
                    placeholder="84"
                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Condition</label>
                  <select
                    value={editForm.condition_rating}
                    onChange={(e) => setEditForm({ ...editForm, condition_rating: e.target.value })}
                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">Not rated</option>
                    <option value="5">5 — Excellent</option>
                    <option value="4">4 — Good</option>
                    <option value="3">3 — Fair</option>
                    <option value="2">2 — Poor</option>
                    <option value="1">1 — Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-2 py-2 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="active">Active</option>
                  <option value="damaged">Damaged</option>
                  <option value="leaning">Leaning</option>
                  <option value="missing">Missing</option>
                  <option value="removed">Removed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Install Date</label>
                <input
                  type="date"
                  value={editForm.install_date}
                  onChange={(e) => setEditForm({ ...editForm, install_date: e.target.value })}
                  className="w-full px-2 py-2 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full px-2 py-2 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={updateSupport.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {updateSupport.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                >
                  <XCircle size={12} />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ====== VIEW MODE ====== */
          <>
            <Section icon={Landmark} title="Support Details">
              <Field label="Asset Tag" value={support.asset_tag || <span className="italic text-gray-400">Not assigned</span>} />
              <Field label="Type" value={formatEnumLabel(support.support_type)} />
              <Field label="Material" value={support.support_material ? formatEnumLabel(support.support_material) : null} />
              <Field label="Height" value={support.height_inches ? `${support.height_inches}"` : null} />
              <Field label="Status" value={<span className="capitalize">{support.status}</span>} />
              <Field label="Condition" value={
                support.condition_rating
                  ? `${support.condition_rating}/5 — ${CONDITION_COLORS[support.condition_rating]?.label || 'Unknown'}`
                  : null
              } />
              <Field label="Install Date" value={support.install_date ? formatDate(support.install_date) : <span className="italic text-gray-400">Not recorded</span>} />
            </Section>

            <Section icon={MapPin} title="Location">
              <Field label="Coordinates" value={
                <span className="font-mono text-xs">
                  {support.latitude.toFixed(6)}, {support.longitude.toFixed(6)}
                </span>
              } />
              {support.notes && (
                <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 mt-1">{support.notes}</p>
              )}
            </Section>

            <Section icon={Calendar} title="Lifecycle">
              <Field label="Installed" value={formatDate(support.install_date)} />
            </Section>
          </>
        )}

        {/* Signs on this support */}
        <div className="py-4 border-b border-gray-100 last:border-b-0">
          <div className="flex items-center justify-between mb-3">
            <h4 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Signs on Support
              <span className="bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                {support.signs.length}
              </span>
            </h4>
            {onAddSignToSupport && (
              <button
                onClick={() => onAddSignToSupport(supportId, { lng: support.longitude, lat: support.latitude })}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                <Plus size={12} />
                Add Sign
              </button>
            )}
          </div>
          <div className="space-y-1">
            {support.signs.map((sign) => {
              const color = getSignColor(sign);
              const isClicked = sign.sign_id === clickedSignId;
              const isConfirmingRemove = confirmRemoveSignId === sign.sign_id;
              return (
                <div key={sign.sign_id}>
                  <div
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      isClicked
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-100 hover:bg-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 cursor-pointer"
                        style={{ backgroundColor: color.hex }}
                        onClick={() => onSignSelect(sign)}
                      />
                      <div className="min-w-0 flex-1 cursor-pointer" role="button" tabIndex={0} onClick={() => onSignSelect(sign)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSignSelect(sign); }}>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-mono font-semibold text-gray-900 truncate">
                            {sign.mutcd_code || '—'}
                          </span>
                          <span className="text-[10px] text-gray-400 capitalize shrink-0">
                            {sign.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-600 truncate">
                          {sign.description || 'No description'}
                        </div>
                      </div>
                      {onRemoveSignFromSupport && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmRemoveSignId(sign.sign_id); }}
                          title="Remove sign from this support"
                          aria-label="Remove sign from this support"
                          className="p-1 rounded hover:bg-gray-200 text-gray-300 hover:text-orange-600 shrink-0"
                        >
                          <Unlink size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Inline confirmation for removing sign from support */}
                  {isConfirmingRemove && (
                    <div className="mt-1 mx-1 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-[11px] text-orange-800 mb-2">
                        Detach <strong>{sign.mutcd_code}</strong> from this support? The sign will remain in inventory but won't be linked to any post.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmRemoveSignId(null)}
                          className="flex-1 px-2 py-1 text-[11px] border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            onRemoveSignFromSupport!(sign.sign_id);
                            setConfirmRemoveSignId(null);
                          }}
                          className="flex-1 px-2 py-1 text-[11px] bg-orange-600 text-white rounded hover:bg-orange-700"
                        >
                          Detach
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer with metadata */}
      <div className="px-4 py-2 border-t bg-gray-50 text-[10px] text-gray-400">
        <div>Created: {formatDate(support.created_at)}</div>
        <div>Updated: {formatDate(support.updated_at)}</div>
        <div className="font-mono truncate mt-0.5">ID: {support.asset_tag || support.support_id}</div>
      </div>
    </div>
  );
});
