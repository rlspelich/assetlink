import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { searchPayItems, type PayItem } from '../../api/estimator';
import { InlineLoading, EmptyState } from '../ui/states';

interface Props {
  onSelect: (item: PayItem) => void;
  selectedCode?: string;
}

export function PayItemSearch({ onSelect, selectedCode }: Props) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  // Debounce search
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
    clearTimeout((window as any).__payItemSearchTimer);
    (window as any).__payItemSearchTimer = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['payItems', debouncedSearch, page],
    queryFn: () => searchPayItems({ search: debouncedSearch, page, page_size: 25 }),
    enabled: debouncedSearch.length >= 2,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search pay items by code or description..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {data && (
          <div className="mt-1 text-xs text-gray-500">
            {data.total.toLocaleString()} results
          </div>
        )}
      </div>

      {/* Results table */}
      <div className="flex-1 overflow-auto">
        {isLoading && debouncedSearch.length >= 2 && (
          <InlineLoading message="Searching pay items..." />
        )}
        {!debouncedSearch || debouncedSearch.length < 2 ? (
          <div className="p-4 text-sm text-gray-400">
            Type at least 2 characters to search pay items
          </div>
        ) : data?.pay_items.length === 0 ? (
          <EmptyState
            title="No pay items found"
            message="Try a different search term, code, or description keyword"
          />
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">Code</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Unit</th>
              </tr>
            </thead>
            <tbody>
              {data?.pay_items.map((item) => (
                <tr
                  key={`${item.agency}-${item.code}`}
                  onClick={() => onSelect(item)}
                  className={`cursor-pointer border-b hover:bg-blue-50 transition-colors ${
                    selectedCode === item.code ? 'bg-blue-100' : ''
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-gray-400 text-[11px]">{item.code}</td>
                  <td className="px-3 py-2">{item.description}</td>
                  <td className="px-3 py-2 text-gray-500">{item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > 25 && (
        <div className="p-2 border-t flex items-center justify-between text-xs">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-2 py-1 rounded border disabled:opacity-30 hover:bg-gray-50"
          >
            Prev
          </button>
          <span className="text-gray-500">
            Page {page} of {Math.ceil(data.total / 25)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 25 >= data.total}
            className="px-2 py-1 rounded border disabled:opacity-30 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
