import { useState, useRef, useEffect } from 'react';
import { Search, Filter, ChevronDown, Link } from 'lucide-react';
import type { Sign } from '../../api/types';
import { CONDITION_COLORS, UNRATED_COLOR, INACTIVE_STATUSES, INACTIVE_COLOR, STATUS_OPTIONS } from '../../lib/constants';

interface SignListPanelProps {
  signs: Sign[];
  total: number;
  isLoading: boolean;
  selectedSignId: string | null;
  onSignSelect: (sign: Sign) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (category: string) => void;
  conditionFilter: string;
  onConditionFilterChange: (condition: string) => void;
  /** Map of support_id -> sign_ids sharing that support (for co-location badges) */
  supportSignCounts?: Map<string, string[]>;
}

const CATEGORIES = ['regulatory', 'warning', 'guide', 'school', 'construction', 'recreation', 'temporary'];

function getColor(sign: Sign) {
  if (INACTIVE_STATUSES.has(sign.status)) return INACTIVE_COLOR;
  if (sign.condition_rating) return CONDITION_COLORS[sign.condition_rating];
  return UNRATED_COLOR;
}

export function SignListPanel({
  signs,
  total: _,
  isLoading,
  selectedSignId,
  onSignSelect,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  conditionFilter,
  onConditionFilterChange,
  supportSignCounts,
}: SignListPanelProps) {
  const [showFilters, setShowFilters] = useState(false);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to selected sign
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedSignId]);

  const hasActiveFilters = statusFilter || categoryFilter || conditionFilter;

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full shrink-0 overflow-hidden">
      {/* Search & Filters */}
      <div className="px-3 py-3 border-b bg-gray-50">

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search road, MUTCD, description..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 mt-2 text-xs transition-colors ${
            hasActiveFilters ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Filter size={12} />
          Filters
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-700 rounded-full px-1.5 text-[10px]">
              {[statusFilter, categoryFilter, conditionFilter].filter(Boolean).length}
            </span>
          )}
          <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {/* Filters panel */}
        {showFilters && (
          <div className="mt-2 space-y-2">
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => onCategoryFilterChange(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <select
              value={conditionFilter}
              onChange={(e) => onConditionFilterChange(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All conditions</option>
              <option value="5">5 — Excellent</option>
              <option value="4">4 — Good</option>
              <option value="3">3 — Fair</option>
              <option value="2">2 — Poor</option>
              <option value="1">1 — Critical</option>
              <option value="unrated">Unrated</option>
            </select>
            {hasActiveFilters && (
              <button
                onClick={() => { onStatusFilterChange(''); onCategoryFilterChange(''); onConditionFilterChange(''); }}
                className="text-[10px] text-red-500 hover:text-red-700"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sign list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-gray-400">Loading signs...</div>
        ) : signs.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            {hasActiveFilters || searchQuery ? 'No signs match filters' : 'No signs yet'}
          </div>
        ) : (
          signs.map((sign) => {
            const color = getColor(sign);
            const isSelected = sign.sign_id === selectedSignId;
            const coLocatedCount = sign.support_id && supportSignCounts
              ? (supportSignCounts.get(sign.support_id)?.length ?? 0)
              : 0;
            return (
              <div
                key={sign.sign_id}
                ref={isSelected ? selectedRef : null}
                onClick={() => onSignSelect(sign)}
                className={`px-3 py-2.5 border-b border-gray-50 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-50 border-l-2 border-l-blue-500'
                    : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-mono font-semibold text-gray-900 truncate">
                        {sign.mutcd_code || '—'}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {coLocatedCount > 1 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[9px] font-medium" title={`${coLocatedCount} signs on this support`}>
                            <Link size={8} />
                            {coLocatedCount}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 capitalize">{sign.status}</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-600 truncate">
                      {sign.description || 'No description'}
                    </div>
                    {sign.road_name && (
                      <div className="text-[10px] text-gray-400 truncate">{sign.road_name}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
