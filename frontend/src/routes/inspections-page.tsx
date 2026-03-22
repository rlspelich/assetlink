import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, ClipboardCheck, Loader2, Search } from 'lucide-react';
import {
  useInspectionsList,
  useCreateInspection,
  useUpdateInspection,
  useDeleteInspection,
  useInspection,
} from '../hooks/use-inspections';
import { InspectionDetailPanel } from '../components/inspections/inspection-detail-panel';
import { InspectionForm, type InspectionAssetContext } from '../components/inspections/inspection-form';
import type { Inspection, InspectionCreate, InspectionUpdate } from '../api/types';
import {
  INSPECTION_TYPE_OPTIONS,
  INSPECTION_STATUS_OPTIONS,
  CONDITION_COLORS,
  UNRATED_COLOR,
  getInspectionTypeOption,
  getInspectionStatusOption,
  formatEnumLabel,
} from '../lib/constants';

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

export function InspectionsPage() {
  const location = useLocation();
  const routeState = location.state as {
    selectedInspectionId?: string;
    assetContext?: InspectionAssetContext;
  } | null;

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [followUpFilter, setFollowUpFilter] = useState('');
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [assetContext, setAssetContext] = useState<InspectionAssetContext | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useInspectionsList({
    page,
    page_size: 50,
    status: statusFilter || undefined,
    inspection_type: typeFilter || undefined,
    follow_up_required: followUpFilter === '' ? undefined : followUpFilter === 'true',
  });

  // Fetch full detail for selected inspection (to get assets)
  const { data: detailInspection } = useInspection(selectedInspectionId ?? undefined);

  const createInspection = useCreateInspection();
  const updateInspection = useUpdateInspection();
  const deleteInspection = useDeleteInspection();

  // Handle route state (navigate from sign/support detail)
  useEffect(() => {
    if (routeState?.assetContext) {
      setAssetContext(routeState.assetContext);
      setFormMode('create');
      setShowForm(true);
      window.history.replaceState({}, document.title);
    }
    if (routeState?.selectedInspectionId && data?.inspections) {
      const insp = data.inspections.find(
        (i) => i.inspection_id === routeState.selectedInspectionId,
      );
      if (insp) {
        setSelectedInspection(insp);
        setSelectedInspectionId(insp.inspection_id);
        window.history.replaceState({}, document.title);
      }
    }
  }, [routeState, data?.inspections]);

  // Use detail data when available
  useEffect(() => {
    if (detailInspection && selectedInspectionId) {
      setSelectedInspection(detailInspection);
    }
  }, [detailInspection, selectedInspectionId]);

  const handleCreate = () => {
    setAssetContext(null);
    setFormMode('create');
    setSubmitError(null);
    setShowForm(true);
  };

  const handleEdit = () => {
    if (!selectedInspection) return;
    setFormMode('edit');
    setSubmitError(null);
    setShowForm(true);
  };

  const handleFormSubmit = async (formData: InspectionCreate | InspectionUpdate) => {
    setSubmitError(null);
    try {
      if (formMode === 'create') {
        const created = await createInspection.mutateAsync(formData as InspectionCreate);
        setShowForm(false);
        setAssetContext(null);
        setSelectedInspection(created);
        setSelectedInspectionId(created.inspection_id);
      } else if (selectedInspection) {
        const updated = await updateInspection.mutateAsync({
          id: selectedInspection.inspection_id,
          data: formData as InspectionUpdate,
        });
        setShowForm(false);
        setSelectedInspection(updated);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save inspection';
      setSubmitError(message);
    }
  };

  const handleDelete = async () => {
    if (!selectedInspection) return;
    try {
      await deleteInspection.mutateAsync(selectedInspection.inspection_id);
      setSelectedInspection(null);
      setSelectedInspectionId(null);
    } catch (err: unknown) {
      console.error('Delete failed:', err);
    }
  };

  const handleRowClick = (insp: Inspection) => {
    if (selectedInspection?.inspection_id === insp.inspection_id) {
      setSelectedInspection(null);
      setSelectedInspectionId(null);
    } else {
      setSelectedInspection(insp);
      setSelectedInspectionId(insp.inspection_id);
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1;

  return (
    <div className="h-full flex overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <ClipboardCheck size={20} className="text-gray-600" />
              <h1 className="text-lg font-semibold text-gray-900">Inspections</h1>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {data?.total ?? 0}
              </span>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} />
              New Inspection
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              {INSPECTION_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Types</option>
              {INSPECTION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={followUpFilter}
              onChange={(e) => { setFollowUpFilter(e.target.value); setPage(1); }}
              className="rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Follow-up</option>
              <option value="true">Follow-up Required</option>
              <option value="false">No Follow-up</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : !data?.inspections.length ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Search size={32} className="mb-2" />
              <p className="text-sm">No inspections found</p>
              <button
                onClick={handleCreate}
                className="mt-3 text-xs text-blue-600 hover:text-blue-800"
              >
                Create your first inspection
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Assets</th>
                  <th className="px-4 py-2 font-medium">Condition</th>
                  <th className="px-4 py-2 font-medium">Follow-up</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.inspections.map((insp) => {
                  const typeOpt = getInspectionTypeOption(insp.inspection_type);
                  const statusOpt = getInspectionStatusOption(insp.status);
                  const isSelected = selectedInspection?.inspection_id === insp.inspection_id;
                  const condColor = insp.condition_rating
                    ? CONDITION_COLORS[insp.condition_rating]
                    : UNRATED_COLOR;

                  // Asset count/labels from the list response
                  const assetCount = insp.assets?.length ?? 0;
                  const assetSummary = assetCount > 0
                    ? insp.assets.slice(0, 2).map((a) => a.asset_label || formatEnumLabel(a.asset_type)).join(', ')
                      + (assetCount > 2 ? ` +${assetCount - 2}` : '')
                    : '\u2014';

                  return (
                    <tr
                      key={insp.inspection_id}
                      onClick={() => handleRowClick(insp)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-l-2 border-blue-500'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-2.5 text-gray-900 whitespace-nowrap text-xs">
                        {formatDate(insp.inspection_date)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${typeOpt.color}`}>
                          {typeOpt.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs truncate max-w-[200px]" title={assetSummary}>
                        {assetCount > 0 && (
                          <span className="bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 text-[10px] font-medium mr-1">
                            {assetCount}
                          </span>
                        )}
                        {assetSummary}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="inline-flex items-center gap-1 text-xs"
                          style={{ color: condColor.hex }}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: condColor.hex }} />
                          {insp.condition_rating ? `${insp.condition_rating}/5` : '\u2014'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {insp.follow_up_required ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            insp.follow_up_work_order_id
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {insp.follow_up_work_order_id ? 'WO Linked' : 'Required'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusOpt.color}`}>
                          {statusOpt.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(insp.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="px-4 py-2 border-t bg-white flex items-center justify-between text-xs text-gray-500">
            <span>
              Page {data.page} of {totalPages} ({data.total} total)
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Detail panel */}
      {selectedInspection && !showForm && (
        <InspectionDetailPanel
          inspection={selectedInspection}
          onClose={() => { setSelectedInspection(null); setSelectedInspectionId(null); }}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isDeleting={deleteInspection.isPending}
          onRefresh={() => {
            if (selectedInspectionId) {
              setSelectedInspectionId(selectedInspectionId); // re-trigger fetch
            }
          }}
        />
      )}

      {/* Form modal */}
      {showForm && (
        <InspectionForm
          mode={formMode}
          inspection={formMode === 'edit' ? selectedInspection : null}
          assetContext={assetContext}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setAssetContext(null); setSubmitError(null); }}
          isSubmitting={createInspection.isPending || updateInspection.isPending}
          error={submitError}
        />
      )}
    </div>
  );
}
