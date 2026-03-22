import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, ClipboardCheck, Calendar, Eye, Signpost, Landmark, Wrench,
  Pencil, Trash2, Loader2, ExternalLink, AlertCircle, Printer, Mail,
} from 'lucide-react';
import type { Inspection } from '../../api/types';
import { useCreateWorkOrderFromInspection } from '../../hooks/use-inspections';
import {
  CONDITION_COLORS,
  UNRATED_COLOR,
  getInspectionTypeOption,
  getInspectionStatusOption,
  getInspectionActionOption,
  formatEnumLabel,
} from '../../lib/constants';
import { previewInspection } from './inspection-print';
import { EmailDialog } from '../shared/email-dialog';
import { sendInspectionEmail } from '../../api/email';

interface InspectionDetailPanelProps {
  inspection: Inspection;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  onRefresh?: () => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
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

function conditionBadge(rating: number | null) {
  const color = rating ? CONDITION_COLORS[rating] : UNRATED_COLOR;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: color.hex + '20', color: color.hex }}>
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color.hex }} />
      {rating ? `${rating}/5 \u2014 ${color.label}` : color.label}
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
  if (value === null || value === undefined || value === '' || value === '\u2014') {
    return null;
  }
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  );
}

export function InspectionDetailPanel({
  inspection,
  onClose,
  onEdit,
  onDelete,
  isDeleting,
  onRefresh,
}: InspectionDetailPanelProps) {
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const createWOFromInspection = useCreateWorkOrderFromInspection();
  const [woError, setWoError] = useState<string | null>(null);
  const [createdWO, setCreatedWO] = useState<{ id: string; number: string } | null>(null);

  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const typeOpt = getInspectionTypeOption(inspection.inspection_type);
  const statusOpt = getInspectionStatusOption(inspection.status);

  const handleCreateWorkOrder = async () => {
    setWoError(null);
    try {
      const wo = await createWOFromInspection.mutateAsync(inspection.inspection_id);
      setCreatedWO({ id: wo.work_order_id, number: wo.work_order_number || 'WO' });
      onRefresh?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create work order';
      setWoError(message);
    }
  };

  const canDelete = true;
  const hasLinkedWO = !!inspection.follow_up_work_order_id || !!createdWO;

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${typeOpt.color}`}>
              {typeOpt.label}
            </span>
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${statusOpt.color}`}>
              {statusOpt.label}
            </span>
          </div>
          <div className="text-sm font-medium text-gray-900">
            {inspection.inspection_number || 'Inspection'}
          </div>
          <div className="text-xs text-gray-500">
            {formatDate(inspection.inspection_date)}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {conditionBadge(inspection.condition_rating)}
            {inspection.follow_up_required && (
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                hasLinkedWO ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
              }`}>
                {hasLinkedWO ? 'WO Linked' : 'Follow-up Required'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => previewInspection(inspection)}
            title="Print inspection"
            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700"
          >
            <Printer size={16} />
          </button>
          <button
            onClick={() => setShowEmailDialog(true)}
            title="Email inspection"
            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700"
          >
            <Mail size={16} />
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              title="Edit inspection"
              className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-600"
            >
              <Pencil size={16} />
            </button>
          )}
          {onDelete && canDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete inspection"
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
            Delete this inspection? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => { onDelete?.(); setShowDeleteConfirm(false); }}
              disabled={isDeleting}
              className="flex-1 px-2 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {isDeleting ? <><Loader2 size={12} className="animate-spin" />Deleting...</> : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Create Work Order button — prominent */}
      {!hasLinkedWO && (
        <div className="px-4 py-3 border-b bg-amber-50">
          <button
            onClick={handleCreateWorkOrder}
            disabled={createWOFromInspection.isPending}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {createWOFromInspection.isPending ? (
              <><Loader2 size={14} className="animate-spin" />Creating Work Order...</>
            ) : (
              <><Wrench size={14} />Create Work Order</>
            )}
          </button>
          {woError && (
            <p className="text-xs text-red-700 mt-1.5 flex items-center gap-1">
              <AlertCircle size={12} /> {woError}
            </p>
          )}
        </div>
      )}

      {/* Linked WO success */}
      {createdWO && (
        <div className="px-4 py-2 border-b bg-green-50">
          <button
            onClick={() => navigate('/work-orders', { state: { selectedWorkOrderId: createdWO.id } })}
            className="flex items-center gap-2 text-xs text-green-800 font-medium hover:text-green-900"
          >
            <Wrench size={12} />
            Created {createdWO.number}
            <ExternalLink size={10} />
          </button>
        </div>
      )}

      {/* Existing linked WO */}
      {inspection.follow_up_work_order_id && !createdWO && (
        <div className="px-4 py-2 border-b bg-blue-50">
          <button
            onClick={() => navigate('/work-orders', { state: { selectedWorkOrderId: inspection.follow_up_work_order_id } })}
            className="flex items-center gap-2 text-xs text-blue-800 font-medium hover:text-blue-900"
          >
            <Wrench size={12} />
            Linked Work Order
            <ExternalLink size={10} />
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4">
        {/* Overview */}
        <Section icon={ClipboardCheck} title="Overview">
          <Field label="Type" value={typeOpt.label} />
          <Field label="Date" value={formatDate(inspection.inspection_date)} />
          <Field label="Status" value={
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${statusOpt.color}`}>
              {statusOpt.label}
            </span>
          } />
          <Field label="Condition" value={inspection.condition_rating ? `${inspection.condition_rating}/5` : null} />
          {inspection.retroreflectivity_value && (
            <Field label="Retro Reading" value={`${inspection.retroreflectivity_value} mcd/lux/m2`} />
          )}
          {inspection.passes_minimum_retro !== null && (
            <Field label="Passes Minimum" value={
              <span className={inspection.passes_minimum_retro ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                {inspection.passes_minimum_retro ? 'Yes' : 'No'}
              </span>
            } />
          )}
        </Section>

        {/* Inspected Assets */}
        {inspection.assets.length > 0 && (
          <Section icon={Eye} title={`Inspected Assets (${inspection.assets.length})`}>
            <div className="space-y-2">
              {inspection.assets.map((ia) => {
                const isSign = ia.asset_type === 'sign';
                const AssetIcon = isSign ? Signpost : Landmark;
                const actionOpt = getInspectionActionOption(ia.action_recommended);
                return (
                  <div
                    key={ia.inspection_asset_id}
                    className="border border-gray-100 rounded-lg p-2.5 bg-gray-50"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <AssetIcon size={12} className="text-gray-400 shrink-0" />
                      <span className="text-xs font-medium text-gray-900 truncate flex-1">
                        {ia.asset_label || formatEnumLabel(ia.asset_type)}
                      </span>
                      {actionOpt && (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${actionOpt.color}`}>
                          {actionOpt.label}
                        </span>
                      )}
                    </div>
                    {ia.condition_rating && (
                      <div className="mb-1">
                        {conditionBadge(ia.condition_rating)}
                      </div>
                    )}
                    {ia.retroreflectivity_value && (
                      <div className="text-[11px] text-gray-600 mb-0.5">
                        Retro: {ia.retroreflectivity_value} mcd/lux/m2
                        {ia.passes_minimum_retro !== null && (
                          <span className={ia.passes_minimum_retro ? ' text-green-700' : ' text-red-700'}>
                            {ia.passes_minimum_retro ? ' (Passes)' : ' (Fails)'}
                          </span>
                        )}
                      </div>
                    )}
                    {ia.findings && (
                      <p className="text-[11px] text-gray-600 mt-0.5">{ia.findings}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Findings / Recommendations */}
        {(inspection.findings || inspection.recommendations) && (
          <Section icon={Calendar} title="Findings & Recommendations">
            {inspection.findings && (
              <div>
                <span className="text-[10px] text-gray-400 uppercase">Findings</span>
                <p className="text-xs text-gray-700 bg-gray-50 rounded p-2 mt-0.5">{inspection.findings}</p>
              </div>
            )}
            {inspection.recommendations && (
              <div>
                <span className="text-[10px] text-gray-400 uppercase">Recommendations</span>
                <p className="text-xs text-gray-700 bg-gray-50 rounded p-2 mt-0.5">{inspection.recommendations}</p>
              </div>
            )}
          </Section>
        )}
      </div>

      {/* Footer with metadata */}
      <div className="px-4 py-2 border-t bg-gray-50 text-[10px] text-gray-400">
        <div>Created: {formatDate(inspection.created_at)}</div>
        <div>Updated: {formatDate(inspection.updated_at)}</div>
        <div className="font-mono truncate mt-0.5">{inspection.inspection_id}</div>
      </div>

      {/* Email dialog */}
      <EmailDialog
        open={showEmailDialog}
        onClose={() => setShowEmailDialog(false)}
        itemLabel={inspection.inspection_number || 'Inspection'}
        itemDescription={inspection.findings}
        onSend={(data) => sendInspectionEmail(inspection.inspection_id, data)}
      />
    </div>
  );
}
