import { useState } from 'react';
import { X, Landmark, MapPin, Calendar, Pencil, Trash2, Loader2, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { useSupport, useDeleteSupport } from '../../hooks/use-supports';
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
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

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

export function SupportDetailPanel({ supportId, clickedSignId, onClose, onSignSelect, onCreateWorkOrder, onInspect }: SupportDetailPanelProps) {
  const { data: support, isLoading } = useSupport(supportId);
  const deleteSupport = useDeleteSupport();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (isLoading || !support) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full shrink-0 overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    try {
      await deleteSupport.mutateAsync(supportId);
      setShowDeleteConfirm(false);
      onClose();
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
            <span className="truncate">{formatEnumLabel(support.support_type)}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {support.sign_count} {support.sign_count === 1 ? 'sign' : 'signs'} on this support
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
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <AlertTriangle size={12} />
                Report Issue
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
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              >
                <ClipboardCheck size={12} />
                Inspect
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete support"
            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-red-600"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-200">
          <p className="text-xs text-red-800 font-medium mb-2">
            Delete this support and detach all signs? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteSupport.isPending}
              className="flex-1 px-2 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {deleteSupport.isPending ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4">
        {/* Support Info */}
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

        {/* Location */}
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

        {/* Lifecycle */}
        <Section icon={Calendar} title="Lifecycle">
          <Field label="Installed" value={formatDate(support.install_date)} />
        </Section>

        {/* Signs on this support */}
        <div className="py-4 border-b border-gray-100 last:border-b-0">
          <h4 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Signs on Support
            <span className="bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
              {support.signs.length}
            </span>
          </h4>
          <div className="space-y-1">
            {support.signs.map((sign) => {
              const color = getSignColor(sign);
              const isClicked = sign.sign_id === clickedSignId;
              return (
                <button
                  key={sign.sign_id}
                  onClick={() => onSignSelect(sign)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    isClicked
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-100 hover:bg-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: color.hex }}
                    />
                    <div className="min-w-0 flex-1">
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
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer with metadata */}
      <div className="px-4 py-2 border-t bg-gray-50 text-[10px] text-gray-400">
        <div>Created: {formatDate(support.created_at)}</div>
        <div>Updated: {formatDate(support.updated_at)}</div>
        <div className="font-mono truncate mt-0.5">{support.support_id}</div>
      </div>
    </div>
  );
}
