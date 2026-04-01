import { useState, useRef, useEffect, memo } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, User } from 'lucide-react';
import type { Inspection } from '../../api/types';
import { useUsersList } from '../../hooks/use-users';
import {
  CONDITION_COLORS,
  UNRATED_COLOR,
  getInspectionTypeOption,
  getInspectionMarkerColor,
} from '../../lib/constants';

interface InspectionListPanelProps {
  inspections: Inspection[];
  total: number;
  isLoading: boolean;
  selectedInspId: string | null;
  onInspSelect: (insp: Inspection) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  typeFilter: string;
  onTypeFilterChange: (type: string) => void;
  followUpFilter: string;
  onFollowUpFilterChange: (val: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

import { formatShortDate as formatDate } from '../../lib/format-utils';

export const InspectionListPanel = memo(function InspectionListPanel({
  inspections,
  isLoading,
  selectedInspId,
  onInspSelect,
  searchQuery,
}: InspectionListPanelProps) {
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const selectedRef = useRef<HTMLDivElement>(null);
  const { data: usersData } = useUsersList();
  const userMap = new Map(
    (usersData?.users ?? []).map((u) => [u.user_id, `${u.first_name} ${u.last_name}`])
  );

  // Auto-scroll to selected inspection
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedInspId]);

  const totalPages = Math.ceil(inspections.length / PAGE_SIZE);
  const paged = inspections.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when data changes
  useEffect(() => { setPage(0); }, [inspections]);

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full shrink-0 overflow-hidden">
      {/* Inspection list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-gray-400">Loading inspections...</div>
        ) : inspections.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            {searchQuery ? 'No inspections match filters' : 'No inspections yet'}
          </div>
        ) : (
          paged.map((insp) => {
            const isSelected = insp.inspection_id === selectedInspId;
            const condColor = insp.condition_rating
              ? CONDITION_COLORS[insp.condition_rating]
              : UNRATED_COLOR;
            const typeOpt = getInspectionTypeOption(insp.inspection_type);

            const assetCount = insp.assets?.length ?? 0;
            const markerColor = getInspectionMarkerColor(
              insp.follow_up_required,
              insp.follow_up_work_order_id,
              insp.status,
            );

            return (
              <div
                key={insp.inspection_id}
                ref={isSelected ? selectedRef : null}
                onClick={() => onInspSelect(insp)}
                className={`px-3 py-2.5 border-b border-gray-50 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-50 border-l-2 border-l-blue-500'
                    : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                    style={{ backgroundColor: markerColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-mono font-semibold text-gray-900 truncate">
                        {insp.inspection_number || '\u2014'}
                      </span>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0 ${typeOpt.color}`}>
                        {typeOpt.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-gray-500">{formatDate(insp.inspection_date)}</span>
                      {assetCount > 0 && (
                        <span className="bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 text-[9px] font-medium">
                          {assetCount} asset{assetCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px]"
                        style={{ color: condColor.hex }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: condColor.hex }} />
                        {insp.condition_rating ? `${insp.condition_rating}/5` : 'Unrated'}
                      </span>
                      {insp.follow_up_required && !insp.follow_up_work_order_id && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-red-600 font-medium">
                          <AlertCircle size={8} />
                          Follow-up
                        </span>
                      )}
                    </div>
                    {insp.inspector_id && userMap.get(insp.inspector_id) && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <User size={9} className="text-gray-400" />
                        <span className="text-[10px] text-gray-500">{userMap.get(insp.inspector_id)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t bg-gray-50 text-xs text-gray-600 shrink-0">
          <span>{inspections.length}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={12} />
            </button>
            <span>{page + 1}/{totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
