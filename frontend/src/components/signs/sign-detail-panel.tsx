import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MapPin, Ruler, Calendar, Shield, Wrench, Eye, Pencil, Trash2, Loader2, Landmark, ChevronLeft, Plus, AlertTriangle, ClipboardCheck } from 'lucide-react';
import type { Sign } from '../../api/types';
import { CONDITION_COLORS, UNRATED_COLOR, INACTIVE_STATUSES, INACTIVE_COLOR, formatEnumLabel, getWoStatusOption, getWoPriorityOption, getInspectionTypeOption, getInspectionStatusOption } from '../../lib/constants';
import { useSignWorkOrders } from '../../hooks/use-work-orders';
import { useSignInspections } from '../../hooks/use-inspections';

interface SignDetailPanelProps {
  sign: Sign;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  /** When set, shows a "Back to Support" link at the top */
  onBackToSupport?: () => void;
  onCreateWorkOrder?: (context: { assets: Array<{ asset_type: string; asset_id: string; label: string }> }) => void;
  onInspect?: (context: { assets: Array<{ asset_type: string; asset_id: string; label: string }> }) => void;
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
    faded: 'bg-yellow-100 text-yellow-800',
    missing: 'bg-gray-100 text-gray-600',
    obscured: 'bg-orange-100 text-orange-800',
    replaced: 'bg-blue-100 text-blue-800',
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

export function SignDetailPanel({ sign, onClose, onEdit, onDelete, isDeleting, onBackToSupport, onCreateWorkOrder, onInspect }: SignDetailPanelProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();
  const { data: woData } = useSignWorkOrders(sign.sign_id);
  const { data: inspData } = useSignInspections(sign.sign_id);

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full shrink-0 overflow-hidden">
      {/* Back to Support link */}
      {onBackToSupport && (
        <button
          onClick={onBackToSupport}
          className="px-4 py-2 border-b border-gray-100 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
        >
          <ChevronLeft size={14} />
          Back to Support
        </button>
      )}

      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 text-sm truncate">
            {sign.mutcd_code || 'Unknown Code'}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {sign.description || 'No description'}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {conditionBadge(sign.condition_rating, sign.status)}
            {statusBadge(sign.status)}
          </div>
          <div className="flex gap-1.5 mt-2">
            {onCreateWorkOrder && (
              <button
                onClick={() => onCreateWorkOrder({
                  assets: [{ asset_type: 'sign', asset_id: sign.sign_id, label: `${sign.mutcd_code ?? 'Sign'} — ${sign.description ?? 'Unknown'}` }],
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
                  assets: [{ asset_type: 'sign', asset_id: sign.sign_id, label: `${sign.mutcd_code ?? 'Sign'} — ${sign.description ?? 'Unknown'}` }],
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
          {onEdit && (
            <button
              onClick={onEdit}
              title="Edit sign"
              className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-600"
            >
              <Pencil size={16} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete sign"
              className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-red-600"
            >
              <Trash2 size={16} />
            </button>
          )}
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
            Delete this sign? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onDelete?.();
                setShowDeleteConfirm(false);
              }}
              disabled={isDeleting}
              className="flex-1 px-2 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {isDeleting ? (
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
        {/* Sign Identity */}
        <Section icon={Eye} title="Sign Details">
          <Field label="Asset Tag" value={sign.asset_tag} />
          <Field label="MUTCD Code" value={sign.mutcd_code} />
          <Field label="Category" value={sign.sign_category ? (
            <span className="capitalize">{sign.sign_category}</span>
          ) : null} />
          <Field label="Legend Text" value={sign.legend_text} />
          <Field label="Shape" value={sign.shape ? (
            <span className="capitalize">{sign.shape}</span>
          ) : null} />
          <Field label="Background" value={sign.background_color ? (
            <span className="capitalize">{sign.background_color}</span>
          ) : null} />
          <Field label="Size" value={
            sign.size_width_inches && sign.size_height_inches
              ? `${sign.size_width_inches}" × ${sign.size_height_inches}"`
              : null
          } />
        </Section>

        {/* Location */}
        <Section icon={MapPin} title="Location">
          <Field label="Road" value={sign.road_name} />
          <Field label="Address" value={sign.address} />
          <Field label="Intersection" value={sign.intersection_with} />
          <Field label="Side of Road" value={sign.side_of_road} />
          <Field label="Facing" value={sign.facing_direction ? `${sign.facing_direction}°` : null} />
          <Field label="Mount Height" value={sign.mount_height_inches ? `${sign.mount_height_inches}"` : null} />
          <Field label="Coordinates" value={
            <span className="font-mono text-xs">{sign.latitude.toFixed(6)}, {sign.longitude.toFixed(6)}</span>
          } />
          {sign.location_notes && (
            <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 mt-1">{sign.location_notes}</p>
          )}
        </Section>

        {/* Support */}
        <Section icon={Landmark} title="Support">
          {sign.support_id ? (
            <>
              <Field label="Type" value={sign.support_type ? formatEnumLabel(sign.support_type) : null} />
              <Field label="Status" value={sign.support_status ? (
                <span className="capitalize">{sign.support_status}</span>
              ) : null} />
              <div className="text-[10px] text-gray-400 font-mono truncate mt-1">
                {sign.support_id}
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400 italic">No support assigned</p>
          )}
        </Section>

        {/* MUTCD Compliance */}
        <Section icon={Shield} title="MUTCD Compliance">
          <Field label="Sheeting Type" value={sign.sheeting_type} />
          <Field label="Manufacturer" value={sign.sheeting_manufacturer} />
          <Field label="Expected Life" value={sign.expected_life_years ? `${sign.expected_life_years} years` : null} />
          <Field label="Retro Reading" value={sign.measured_value ? `${sign.measured_value} mcd/lux/m²` : null} />
          <Field label="Last Measured" value={formatDate(sign.last_measured_date)} />
          <Field label="Passes Minimum" value={
            sign.passes_minimum !== null ? (
              <span className={sign.passes_minimum ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                {sign.passes_minimum ? 'Yes' : 'No — Replace'}
              </span>
            ) : null
          } />
          <Field label="Replace By" value={
            sign.expected_replacement_date ? (
              <span className={
                new Date(sign.expected_replacement_date) < new Date()
                  ? 'text-red-700 font-medium'
                  : 'text-gray-900'
              }>
                {formatDate(sign.expected_replacement_date)}
              </span>
            ) : null
          } />
        </Section>

        {/* Lifecycle */}
        <Section icon={Calendar} title="Lifecycle">
          <Field label="Installed" value={formatDate(sign.install_date)} />
          <Field label="Last Inspected" value={formatDate(sign.last_inspected_date)} />
          <Field label="Last Replaced" value={formatDate(sign.last_replaced_date)} />
          <Field label="Replacement Cost" value={
            sign.replacement_cost_estimate
              ? `$${sign.replacement_cost_estimate.toLocaleString()}`
              : null
          } />
        </Section>

        {/* Measurements */}
        {(sign.size_width_inches || sign.size_height_inches || sign.mount_height_inches) && (
          <Section icon={Ruler} title="Measurements">
            <Field label="Width" value={sign.size_width_inches ? `${sign.size_width_inches}"` : null} />
            <Field label="Height" value={sign.size_height_inches ? `${sign.size_height_inches}"` : null} />
            <Field label="Mount Height" value={sign.mount_height_inches ? `${sign.mount_height_inches}"` : null} />
            <Field label="Offset from Road" value={
              sign.offset_from_road_inches ? `${sign.offset_from_road_inches}"` : null
            } />
          </Section>
        )}

        {/* Work Orders */}
        <Section icon={Wrench} title="Work Orders">
          {woData && woData.work_orders.length > 0 ? (
            <div className="space-y-2">
              {woData.work_orders.map((wo) => {
                const statusOpt = getWoStatusOption(wo.status);
                const priorityOpt = getWoPriorityOption(wo.priority);
                return (
                  <button
                    key={wo.work_order_id}
                    onClick={() => navigate(`/work-orders`, { state: { selectedWorkOrderId: wo.work_order_id } })}
                    className="w-full text-left p-2 rounded border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${statusOpt.color}`}>
                        {statusOpt.label}
                      </span>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${priorityOpt.color}`}>
                        {priorityOpt.label}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-gray-900 truncate">
                      {wo.work_order_number || 'WO'}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {formatEnumLabel(wo.work_type)} &middot; {formatDate(wo.created_at)}
                    </div>
                  </button>
                );
              })}
              {woData.total > woData.work_orders.length && (
                <button
                  onClick={() => navigate('/work-orders', { state: { filterSignId: sign.sign_id } })}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  View all {woData.total} work orders
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No work orders</p>
          )}
        </Section>

        {/* Inspections */}
        <Section icon={ClipboardCheck} title="Inspections">
          {inspData && inspData.inspections.length > 0 ? (
            <div className="space-y-2">
              {inspData.inspections.map((insp) => {
                const typeOpt = getInspectionTypeOption(insp.inspection_type);
                const statusOpt = getInspectionStatusOption(insp.status);
                const condColor = insp.condition_rating
                  ? CONDITION_COLORS[insp.condition_rating]
                  : UNRATED_COLOR;
                return (
                  <button
                    key={insp.inspection_id}
                    onClick={() => navigate('/inspections', { state: { selectedInspectionId: insp.inspection_id } })}
                    className="w-full text-left p-2 rounded border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${typeOpt.color}`}>
                        {typeOpt.label}
                      </span>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${statusOpt.color}`}>
                        {statusOpt.label}
                      </span>
                      {insp.follow_up_required && (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          insp.follow_up_work_order_id ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {insp.follow_up_work_order_id ? 'WO' : 'F/U'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: condColor.hex }} />
                      <span className="text-xs text-gray-900">
                        {insp.condition_rating ? `${insp.condition_rating}/5` : 'No rating'}
                      </span>
                      {insp.retroreflectivity_value && (
                        <span className="text-[10px] text-gray-500">
                          Retro: {insp.retroreflectivity_value}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {formatDate(insp.inspection_date)}
                    </div>
                  </button>
                );
              })}
              {inspData.total > inspData.inspections.length && (
                <button
                  onClick={() => navigate('/inspections')}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  View all {inspData.total} inspections
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No inspections</p>
          )}
        </Section>

        {/* Custom Fields */}
        {sign.custom_fields && Object.keys(sign.custom_fields).length > 0 && (
          <Section icon={Wrench} title="Custom Fields">
            {Object.entries(sign.custom_fields).map(([key, val]) => (
              <Field key={key} label={key.replace(/_/g, ' ')} value={String(val)} />
            ))}
          </Section>
        )}
      </div>

      {/* Footer with metadata */}
      <div className="px-4 py-2 border-t bg-gray-50 text-[10px] text-gray-400">
        <div>Created: {formatDate(sign.created_at)}</div>
        <div>Updated: {formatDate(sign.updated_at)}</div>
        <div className="font-mono truncate mt-0.5">{sign.sign_id}</div>
      </div>
    </div>
  );
}
