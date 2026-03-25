import { useState } from 'react';
import { X, Pencil, Trash2, Loader2, Wrench, MapPin, Calendar, DollarSign, FileText, Signpost, Landmark, ChevronDown, ChevronUp, Printer, Mail, User } from 'lucide-react';
import type { WorkOrder, WorkOrderAsset, WorkOrderAssetUpdate } from '../../api/types';
import { PhotoGallery } from '../photos/photo-gallery';
import {
  getWoStatusOption,
  getWoPriorityOption,
  formatEnumLabel,
  WO_ACTION_OPTIONS,
  WO_ASSET_STATUS_OPTIONS,
  getWoActionOption,
  getWoAssetStatusOption,
} from '../../lib/constants';
import { useUpdateWorkOrderAsset } from '../../hooks/use-work-orders';
import { useUsersList } from '../../hooks/use-users';
import { previewWorkOrder } from './work-order-print';
import { EmailDialog } from '../shared/email-dialog';
import { sendWorkOrderEmail } from '../../api/email';

interface WorkOrderDetailPanelProps {
  workOrder: WorkOrder;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
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

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatCurrency(val: number | null): string {
  if (val === null || val === undefined) return '';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Section({ icon: Icon, title, badge, children }: { icon: React.ElementType; title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="py-4 border-b border-gray-100 last:border-b-0">
      <h4 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        <Icon size={14} />
        {title}
        {badge}
      </h4>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  );
}

function AssetCard({
  asset,
  woId,
  editable,
}: {
  asset: WorkOrderAsset;
  woId: string;
  editable: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingAction, setEditingAction] = useState(asset.action_required ?? '');
  const [editingStatus, setEditingStatus] = useState(asset.status);
  const [editingDamageNotes, setEditingDamageNotes] = useState(asset.damage_notes ?? '');
  const [editingResolution, setEditingResolution] = useState(asset.resolution ?? '');

  const updateAsset = useUpdateWorkOrderAsset();

  const isSign = asset.asset_type === 'sign';
  const AssetIcon = isSign ? Signpost : Landmark;
  const actionOpt = getWoActionOption(asset.action_required);
  const statusOpt = getWoAssetStatusOption(asset.status);

  const handleFieldSave = (field: keyof WorkOrderAssetUpdate, value: string) => {
    updateAsset.mutate({
      woId,
      woaId: asset.work_order_asset_id,
      data: { [field]: value || null },
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => editable && setExpanded(!expanded)}
      >
        <AssetIcon size={14} className="text-gray-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-900 truncate">
            {asset.asset_label || `${formatEnumLabel(asset.asset_type)} ${asset.asset_id.slice(0, 8)}`}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {actionOpt && (
              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${actionOpt.color}`}>
                {actionOpt.label}
              </span>
            )}
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${statusOpt.color}`}>
              {statusOpt.label}
            </span>
          </div>
          {asset.damage_notes && !expanded && (
            <div className="text-[10px] text-gray-500 truncate mt-1">{asset.damage_notes}</div>
          )}
        </div>
        {editable && (
          <span className="text-gray-300 shrink-0 mt-0.5">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </div>

      {editable && expanded && (
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 space-y-2">
          {/* Action Required */}
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Action Required</label>
            <select
              value={editingAction}
              onChange={(e) => {
                setEditingAction(e.target.value);
                handleFieldSave('action_required', e.target.value);
              }}
              className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">None</option>
              {WO_ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Per-asset Status */}
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Status</label>
            <select
              value={editingStatus}
              onChange={(e) => {
                setEditingStatus(e.target.value);
                handleFieldSave('status', e.target.value);
              }}
              className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {WO_ASSET_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Damage Notes */}
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Damage Notes</label>
            <textarea
              value={editingDamageNotes}
              onChange={(e) => setEditingDamageNotes(e.target.value)}
              onBlur={() => handleFieldSave('damage_notes', editingDamageNotes)}
              rows={2}
              className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              placeholder="Describe damage..."
            />
          </div>

          {/* Resolution */}
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Resolution</label>
            <textarea
              value={editingResolution}
              onChange={(e) => setEditingResolution(e.target.value)}
              onBlur={() => handleFieldSave('resolution', editingResolution)}
              rows={2}
              className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              placeholder="Resolution notes..."
            />
          </div>

          {updateAsset.isPending && (
            <div className="flex items-center gap-1 text-[10px] text-blue-600">
              <Loader2 size={10} className="animate-spin" />
              Saving...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkOrderDetailPanel({ workOrder, onClose, onEdit, onDelete, isDeleting }: WorkOrderDetailPanelProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const statusOpt = getWoStatusOption(workOrder.status);
  const priorityOpt = getWoPriorityOption(workOrder.priority);
  const { data: usersData } = useUsersList();
  const userMap = new Map(
    (usersData?.users ?? []).map((u: { user_id: string; first_name: string; last_name: string }) => [u.user_id, `${u.first_name} ${u.last_name}`])
  );

  const canDelete = true;
  const isEditable = workOrder.status !== 'completed' && workOrder.status !== 'cancelled';
  const assets = workOrder.assets ?? [];

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 text-sm truncate">
            {workOrder.work_order_number || 'Work Order'}
          </div>
          {workOrder.assigned_to && userMap.get(workOrder.assigned_to) && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
              <User size={10} className="text-gray-400" />
              <span>{userMap.get(workOrder.assigned_to)}</span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusOpt.color}`}>
              {statusOpt.label}
            </span>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${priorityOpt.color}`}>
              {priorityOpt.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => previewWorkOrder(workOrder)}
            title="Print preview"
            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700"
          >
            <Printer size={16} />
          </button>
          <button
            onClick={() => setShowEmailDialog(true)}
            title="Email work order"
            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700"
          >
            <Mail size={16} />
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              title="Edit work order"
              className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-600"
            >
              <Pencil size={16} />
            </button>
          )}
          {onDelete && canDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete work order"
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
            Delete this work order? This cannot be undone.
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
        {/* Overview */}
        <Section icon={Wrench} title="Overview">
          <Field label="Work Type" value={formatEnumLabel(workOrder.work_type)} />
          <Field label="Category" value={workOrder.category} />
          <Field label="Resolution" value={workOrder.resolution} />
          {workOrder.description && (
            <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 mt-1">{workOrder.description}</p>
          )}
        </Section>

        {/* Affected Assets */}
        {assets.length > 0 && (
          <Section
            icon={Signpost}
            title="Affected Assets"
            badge={
              <span className="bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                {assets.length}
              </span>
            }
          >
            <div className="space-y-1.5">
              {assets.map((asset) => (
                <AssetCard
                  key={asset.work_order_asset_id}
                  asset={asset}
                  woId={workOrder.work_order_id}
                  editable={isEditable}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Legacy Asset Info (for work orders without junction table assets) */}
        {assets.length === 0 && (workOrder.asset_type || workOrder.sign_id) && (
          <Section icon={MapPin} title="Asset Info">
            <Field label="Asset Type" value={workOrder.asset_type ? formatEnumLabel(workOrder.asset_type) : null} />
            <Field label="Sign ID" value={
              workOrder.sign_id ? (
                <span className="font-mono text-xs">{workOrder.sign_id.slice(0, 8)}...</span>
              ) : null
            } />
          </Section>
        )}

        {/* Location */}
        {(workOrder.address || workOrder.location_notes) && (
          <Section icon={MapPin} title="Location">
            <Field label="Address" value={workOrder.address} />
            {workOrder.location_notes && (
              <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 mt-1">{workOrder.location_notes}</p>
            )}
          </Section>
        )}

        {/* Schedule */}
        <Section icon={Calendar} title="Schedule">
          <Field label="Due Date" value={formatDate(workOrder.due_date)} />
          <Field label="Projected Start" value={formatDate(workOrder.projected_start_date)} />
          <Field label="Projected Finish" value={formatDate(workOrder.projected_finish_date)} />
          <Field label="Actual Start" value={formatDate(workOrder.actual_start_date)} />
          <Field label="Actual Finish" value={formatDate(workOrder.actual_finish_date)} />
          <Field label="Completed" value={formatDateTime(workOrder.completed_date)} />
          <Field label="Closed" value={formatDateTime(workOrder.closed_date)} />
        </Section>

        {/* Cost Tracking */}
        {(workOrder.labor_hours !== null || workOrder.labor_cost !== null || workOrder.material_cost !== null || workOrder.equipment_cost !== null || workOrder.total_cost !== null) && (
          <Section icon={DollarSign} title="Cost Tracking">
            <Field label="Labor Hours" value={workOrder.labor_hours !== null ? `${workOrder.labor_hours} hrs` : null} />
            <Field label="Labor Cost" value={formatCurrency(workOrder.labor_cost)} />
            <Field label="Material Cost" value={formatCurrency(workOrder.material_cost)} />
            <Field label="Equipment Cost" value={formatCurrency(workOrder.equipment_cost)} />
            <Field label="Total Cost" value={
              workOrder.total_cost !== null ? (
                <span className="font-semibold">{formatCurrency(workOrder.total_cost)}</span>
              ) : null
            } />
          </Section>
        )}

        {/* Notes */}
        {(workOrder.instructions || workOrder.notes || workOrder.requested_by) && (
          <Section icon={FileText} title="Notes">
            <Field label="Requested By" value={workOrder.requested_by} />
            {workOrder.instructions && (
              <div>
                <span className="text-xs text-gray-500">Instructions</span>
                <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 mt-1">{workOrder.instructions}</p>
              </div>
            )}
            {workOrder.notes && (
              <div>
                <span className="text-xs text-gray-500">Notes</span>
                <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 mt-1">{workOrder.notes}</p>
              </div>
            )}
          </Section>
        )}
        {/* Photos */}
        <div className="py-4 border-b border-gray-100">
          <PhotoGallery entityType="work_order" entityId={workOrder.work_order_id} />
        </div>
      </div>

      {/* Footer with metadata */}
      <div className="px-4 py-2 border-t bg-gray-50 text-[10px] text-gray-400">
        <div>Created: {formatDateTime(workOrder.created_at)}</div>
        <div>Updated: {formatDateTime(workOrder.updated_at)}</div>
        <div className="font-mono truncate mt-0.5">{workOrder.work_order_id}</div>
      </div>

      {/* Email dialog */}
      <EmailDialog
        open={showEmailDialog}
        onClose={() => setShowEmailDialog(false)}
        itemLabel={workOrder.work_order_number || 'Work Order'}
        itemDescription={workOrder.description}
        onSend={(data) => sendWorkOrderEmail(workOrder.work_order_id, data)}
      />
    </div>
  );
}
