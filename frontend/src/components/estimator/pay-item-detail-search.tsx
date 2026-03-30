import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import {
  searchPayItemOccurrences,
  searchPayItems,
  listContractors,
  getContractFilterOptions,
  type PayItemOccurrence,
  type PayItemSearchStats,
} from '../../api/estimator';
import { downloadCSV, exportCurrency } from '../../utils/export';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

interface PayItemDetailSearchProps {
  onSelectContract?: (contractId: string) => void;
}

export function PayItemDetailSearch({ onSelectContract }: PayItemDetailSearchProps) {
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [county, setCounty] = useState('');
  const [district, setDistrict] = useState('');
  const [contractor, setContractor] = useState('');
  const [minDate, setMinDate] = useState('');
  const [maxDate, setMaxDate] = useState('');
  const [minQty, setMinQty] = useState('');
  const [maxQty, setMaxQty] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [activeSearch, setActiveSearch] = useState<Record<string, unknown> | null>(null);

  const pageSize = 50;

  const { data: filterOpts } = useQuery({
    queryKey: ['contractFilterOptions'],
    queryFn: getContractFilterOptions,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['payItemOccurrences', activeSearch, page],
    queryFn: () => searchPayItemOccurrences({
      pay_item_code: activeSearch?.code as string | undefined,
      description: activeSearch?.description as string | undefined,
      county: activeSearch?.county as string | undefined,
      district: activeSearch?.district as string | undefined,
      contractor: activeSearch?.contractor as string | undefined,
      min_date: activeSearch?.minDate as string | undefined,
      max_date: activeSearch?.maxDate as string | undefined,
      min_quantity: activeSearch?.minQty ? Number(activeSearch.minQty) : undefined,
      max_quantity: activeSearch?.maxQty ? Number(activeSearch.maxQty) : undefined,
      low_bids_only: activeSearch?.lowOnly as boolean | undefined,
      page,
      page_size: pageSize,
    }),
    enabled: activeSearch !== null,
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const handleSearch = () => {
    setPage(1);
    setActiveSearch({
      code: code || undefined,
      description: description || undefined,
      county: county || undefined,
      district: district || undefined,
      contractor: contractor || undefined,
      minDate: minDate || undefined,
      maxDate: maxDate || undefined,
      minQty: minQty || undefined,
      maxQty: maxQty || undefined,
      lowOnly: lowOnly || undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Filter form */}
      <div className="border-b bg-gray-50 px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <TypeAheadField
            label="Pay Item Code"
            value={code}
            onChange={setCode}
            onKeyDown={handleKeyDown}
            placeholder="Type code..."
            width="w-36"
            queryKey="payItemCodeSearch"
            queryFn={async (q) => {
              const res = await searchPayItems({ search: q, page_size: 10 });
              return res.pay_items.map((p) => ({ value: p.code, label: `${p.code} — ${p.description}`, secondary: p.unit }));
            }}
          />
          <TypeAheadField
            label="Description"
            value={description}
            onChange={setDescription}
            onKeyDown={handleKeyDown}
            placeholder="e.g. asphalt..."
            width="w-52"
            queryKey="payItemDescSearch"
            queryFn={async (q) => {
              const res = await searchPayItems({ search: q, page_size: 10 });
              return res.pay_items.map((p) => ({ value: p.description, label: p.description, secondary: p.code }));
            }}
          />
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">County</label>
            <select value={county} onChange={(e) => setCounty(e.target.value)} className="px-2 py-1.5 text-sm border rounded-md w-36 bg-white">
              <option value="">All</option>
              {filterOpts?.counties.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">District</label>
            <select value={district} onChange={(e) => setDistrict(e.target.value)} className="px-2 py-1.5 text-sm border rounded-md w-28 bg-white">
              <option value="">All</option>
              {filterOpts?.districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <TypeAheadField
            label="Contractor"
            value={contractor}
            onChange={setContractor}
            onKeyDown={handleKeyDown}
            placeholder="Type name..."
            width="w-48"
            queryKey="contractorNameSearch"
            queryFn={async (q) => {
              const res = await listContractors({ search: q, page_size: 10 });
              return res.contractors.map((c) => ({ value: c.name, label: c.name, secondary: `${c.bid_count} bids` }));
            }}
          />
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={minDate} onChange={(e) => setMinDate(e.target.value)} className="px-2 py-1.5 text-sm border rounded-md" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={maxDate} onChange={(e) => setMaxDate(e.target.value)} className="px-2 py-1.5 text-sm border rounded-md" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Min Qty</label>
            <input type="number" value={minQty} onChange={(e) => setMinQty(e.target.value)} className="px-2 py-1.5 text-sm border rounded-md w-20" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Max Qty</label>
            <input type="number" value={maxQty} onChange={(e) => setMaxQty(e.target.value)} className="px-2 py-1.5 text-sm border rounded-md w-20" />
          </div>
          <label className="flex items-center gap-1.5 pb-0.5">
            <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="rounded" />
            <span className="text-xs text-gray-600">Low Bids Only</span>
          </label>
          <button
            onClick={handleSearch}
            disabled={isFetching}
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isFetching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {data?.stats && <StatsBar stats={data.stats} />}

      {/* Scatter chart */}
      {data && data.results.length > 0 && (
        <div className="border-b bg-white px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-gray-500 uppercase">Unit Price over Time</h3>
            <button
              onClick={() => {
                downloadCSV(
                  data.results.map((r) => ({
                    letting_date: r.letting_date,
                    contract_number: r.contract_number,
                    county: r.county,
                    district: r.district,
                    contractor: r.contractor_name,
                    rank: r.rank,
                    quantity: r.quantity,
                    unit: r.unit,
                    unit_price: exportCurrency(r.unit_price),
                    extension: exportCurrency(r.extension),
                    is_low: r.is_low ? 'Yes' : 'No',
                  })),
                  'pay_item_search.csv',
                  [
                    { key: 'letting_date', header: 'Date' },
                    { key: 'contract_number', header: 'Contract #' },
                    { key: 'county', header: 'County' },
                    { key: 'district', header: 'District' },
                    { key: 'contractor', header: 'Contractor' },
                    { key: 'rank', header: 'Rank' },
                    { key: 'quantity', header: 'Qty' },
                    { key: 'unit', header: 'Unit' },
                    { key: 'unit_price', header: 'Unit Price' },
                    { key: 'extension', header: 'Extension' },
                    { key: 'is_low', header: 'Low Bid' },
                  ],
                );
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              <Download size={12} /> Export CSV
            </button>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(v: number) => new Date(v).toLocaleDateString('en-US', { year: '2-digit', month: 'short' })}
                  tick={{ fontSize: 10 }}
                  name="Date"
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `$${v.toLocaleString()}`}
                  name="Unit Price"
                />
                { /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ }
                <Tooltip
                  formatter={(value: any, name: any) => {
                    const v = Number(value);
                    if (name === 'Date') return new Date(v).toLocaleDateString();
                    return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                  }}
                />
                <Scatter
                  data={data.results.map((r) => ({
                    x: new Date(r.letting_date).getTime(),
                    y: r.unit_price,
                    is_low: r.is_low,
                  }))}
                  name="Unit Price"
                >
                  {data.results.map((r, i) => (
                    <Cell key={i} fill={r.is_low ? '#22c55e' : '#9ca3af'} fillOpacity={0.7} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <div className="w-2 h-2 rounded-full bg-green-500" /> Low bid
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <div className="w-2 h-2 rounded-full bg-gray-400" /> Other
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {!activeSearch && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Search size={48} className="mb-3" />
            <p className="text-lg">Bid Price Search</p>
            <p className="text-sm mt-1">Search every occurrence of a pay item across all bids</p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center h-full text-gray-400">Searching...</div>
        )}

        {data && (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase sticky top-0">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Contract #</th>
                  <th className="px-3 py-2">County</th>
                  <th className="px-3 py-2">Dist</th>
                  <th className="px-3 py-2">Contractor</th>
                  <th className="px-3 py-2 text-center">Rank</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2 text-right">Unit Price</th>
                  <th className="px-3 py-2 text-right">Extension</th>
                  <th className="px-3 py-2 text-center">Low</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.results.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-gray-400">No results found.</td>
                  </tr>
                ) : (
                  data.results.map((r) => (
                    <OccurrenceRow key={r.bid_item_id} item={r} onSelectContract={onSelectContract} />
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-gray-500 sticky bottom-0 bg-white">
                <span>{data.total.toLocaleString()} results — Page {page} of {totalPages}</span>
                <div className="flex gap-1">
                  <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={14} /></button>
                  <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={14} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatsBar({ stats }: { stats: PayItemSearchStats }) {
  const cards = [
    { label: 'Count', value: stats.count.toLocaleString() },
    { label: 'Weighted Avg', value: stats.weighted_avg != null ? fmt.format(stats.weighted_avg) : '--' },
    { label: 'Straight Avg', value: stats.straight_avg != null ? fmt.format(stats.straight_avg) : '--' },
    { label: 'Median', value: stats.median != null ? fmt.format(stats.median) : '--' },
    { label: 'High', value: stats.high != null ? fmt.format(stats.high) : '--' },
    { label: 'Low', value: stats.low != null ? fmt.format(stats.low) : '--' },
    { label: 'Total Qty', value: stats.total_quantity != null ? stats.total_quantity.toLocaleString() : '--' },
  ];

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b bg-blue-50 overflow-x-auto">
      {cards.map((c) => (
        <div key={c.label} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[10px] font-medium text-blue-500 uppercase">{c.label}:</span>
          <span className="text-xs font-semibold text-gray-900">{c.value}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// TypeAheadField — reusable autocomplete dropdown
// ============================================================

interface TypeAheadOption {
  value: string;
  label: string;
  secondary?: string;
}

function TypeAheadField({
  label, value, onChange, onKeyDown, placeholder, width, queryKey, queryFn,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder: string;
  width: string;
  queryKey: string;
  queryFn: (query: string) => Promise<TypeAheadOption[]>;
}) {
  const [inputVal, setInputVal] = useState(value);
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value changes
  useEffect(() => { setInputVal(value); }, [value]);

  const { data: options } = useQuery({
    queryKey: [queryKey, debounced],
    queryFn: () => queryFn(debounced),
    enabled: debounced.length >= 2 && open,
    staleTime: 30_000,
  });

  const handleInput = (v: string) => {
    setInputVal(v);
    setOpen(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebounced(v), 250);
  };

  const handleSelect = (opt: TypeAheadOption) => {
    setInputVal(opt.value);
    onChange(opt.value);
    setOpen(false);
  };

  const handleClear = () => {
    setInputVal('');
    onChange('');
    setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        // Commit whatever is typed
        if (inputVal !== value) onChange(inputVal);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [inputVal, value, onChange]);

  return (
    <div className="relative" ref={ref}>
      <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (inputVal.length >= 2) setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { setOpen(false); onChange(inputVal); }
            onKeyDown(e);
          }}
          placeholder={placeholder}
          className={`px-2 py-1.5 text-sm border rounded-md ${width} ${inputVal ? 'pr-6' : ''}`}
        />
        {inputVal && (
          <button
            onClick={handleClear}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={12} />
          </button>
        )}
      </div>
      {open && options && options.length > 0 && (
        <div className="absolute z-30 mt-1 w-72 bg-white border rounded-md shadow-lg max-h-52 overflow-auto">
          {options.map((opt, i) => (
            <button
              key={`${opt.value}-${i}`}
              onClick={() => handleSelect(opt)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between"
            >
              <span className="truncate text-gray-900">{opt.label}</span>
              {opt.secondary && (
                <span className="text-[10px] text-gray-400 ml-2 shrink-0">{opt.secondary}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {open && debounced.length >= 2 && options && options.length === 0 && (
        <div className="absolute z-30 mt-1 w-72 bg-white border rounded-md shadow-lg p-2 text-xs text-gray-400">
          No matches found
        </div>
      )}
    </div>
  );
}


function OccurrenceRow({ item, onSelectContract }: { item: PayItemOccurrence; onSelectContract?: (id: string) => void }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{item.letting_date}</td>
      <td className="px-3 py-2">
        {onSelectContract ? (
          <button
            onClick={() => onSelectContract(item.contract_id)}
            className="text-blue-600 hover:underline font-medium"
          >
            {item.contract_number}
          </button>
        ) : (
          <span className="font-medium text-gray-900">{item.contract_number}</span>
        )}
      </td>
      <td className="px-3 py-2 text-gray-600">{item.county}</td>
      <td className="px-3 py-2 text-gray-600">{item.district}</td>
      <td className="px-3 py-2 text-gray-900 truncate max-w-[180px]">{item.contractor_name}</td>
      <td className="px-3 py-2 text-center text-gray-600">{item.rank}</td>
      <td className="px-3 py-2 text-right font-mono text-gray-600">{Number(item.quantity).toLocaleString()}</td>
      <td className="px-3 py-2 text-gray-500">{item.unit}</td>
      <td className="px-3 py-2 text-right font-mono text-gray-900">
        {fmt.format(item.unit_price)}
      </td>
      <td className="px-3 py-2 text-right font-mono text-gray-600">
        {fmt.format(item.extension)}
      </td>
      <td className="px-3 py-2 text-center">
        {item.is_low && (
          <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-green-100 text-green-700">LOW</span>
        )}
      </td>
    </tr>
  );
}
