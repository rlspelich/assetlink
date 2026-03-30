import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, GitCompareArrows, ChevronLeft, ChevronRight, Trophy, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import {
  listContractors,
  getCompetitors,
  getHeadToHead,
  getHeadToHeadItems,
  type Contractor,
} from '../../api/estimator';
import { downloadCSV, downloadTXT, exportCurrency } from '../../utils/export';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function HeadToHead() {
  const [contractorA, setContractorA] = useState<Contractor | null>(null);
  const [contractorB, setContractorB] = useState<Contractor | null>(null);
  const [comparing, setComparing] = useState(false);
  const [itemPage, setItemPage] = useState(1);

  const canCompare = contractorA && contractorB && contractorA.contractor_pk !== contractorB.contractor_pk;

  const { data: h2h, isLoading: h2hLoading, refetch: refetchH2h } = useQuery({
    queryKey: ['headToHead', contractorA?.contractor_pk, contractorB?.contractor_pk],
    queryFn: () => getHeadToHead(contractorA!.contractor_pk, contractorB!.contractor_pk),
    enabled: false,
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['headToHeadItems', contractorA?.contractor_pk, contractorB?.contractor_pk, itemPage],
    queryFn: () => getHeadToHeadItems(contractorA!.contractor_pk, contractorB!.contractor_pk, { page: itemPage, page_size: 25 }),
    enabled: comparing && !!contractorA && !!contractorB,
  });

  const handleCompare = () => {
    if (!canCompare) return;
    setComparing(true);
    setItemPage(1);
    refetchH2h();
  };

  const itemTotalPages = items ? Math.ceil(items.total / 25) : 0;

  return (
    <div className="h-full overflow-auto bg-gray-50 p-4 space-y-4">
      {/* Picker row */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Contractor A</label>
            <ContractorPicker
              selected={contractorA}
              onSelect={(c) => { setContractorA(c); setContractorB(null); setComparing(false); }}
              excludePk={contractorB?.contractor_pk}
            />
          </div>
          <div className="pt-5">
            <GitCompareArrows size={20} className="text-gray-400" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
              Contractor B {contractorA ? '(known competitors)' : ''}
            </label>
            {contractorA ? (
              <CompetitorPicker
                contractorAPk={contractorA.contractor_pk}
                selected={contractorB}
                onSelect={(c) => { setContractorB(c); setComparing(false); }}
              />
            ) : (
              <div className="px-3 py-2 text-sm text-gray-400 border rounded-md bg-gray-50">
                Select Contractor A first
              </div>
            )}
          </div>
          <div className="pt-5">
            <button
              disabled={!canCompare}
              onClick={handleCompare}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Compare
            </button>
          </div>
        </div>
      </div>

      {h2hLoading && (
        <div className="flex items-center justify-center p-8 text-gray-400">Loading...</div>
      )}

      {h2h && comparing && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-xs text-gray-500 uppercase mb-1">Shared Contracts</div>
              <div className="text-2xl font-bold text-gray-900">{h2h.shared_contracts}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-xs text-gray-500 uppercase mb-1">{h2h.contractor_a_name} Wins</div>
              <div className="text-2xl font-bold text-blue-600">{h2h.a_wins_vs_b}</div>
              <div className="text-xs text-gray-400">({h2h.a_total_wins} total wins)</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-xs text-gray-500 uppercase mb-1">{h2h.contractor_b_name} Wins</div>
              <div className="text-2xl font-bold text-indigo-600">{h2h.b_wins_vs_a}</div>
              <div className="text-xs text-gray-400">({h2h.b_total_wins} total wins)</div>
            </div>
          </div>

          {/* Wins chart */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Head-to-Head Wins</h3>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: h2h.contractor_a_name.length > 20 ? h2h.contractor_a_name.slice(0, 20) + '...' : h2h.contractor_a_name, wins: h2h.a_wins_vs_b },
                    { name: h2h.contractor_b_name.length > 20 ? h2h.contractor_b_name.slice(0, 20) + '...' : h2h.contractor_b_name, wins: h2h.b_wins_vs_a },
                  ]}
                  margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="wins" name="Wins" radius={[4, 4, 0, 0]}>
                    <Cell fill="#3b82f6" />
                    <Cell fill="#6366f1" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Contract comparison table */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-medium text-gray-700">Contract Comparison</h3>
            </div>
            {h2h.contracts.length === 0 ? (
              <div className="p-4 text-sm text-gray-400">No shared contracts found.</div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Contract</th>
                      <th className="px-3 py-2">County</th>
                      <th className="px-3 py-2 text-right">A Rank</th>
                      <th className="px-3 py-2 text-right">A Total</th>
                      <th className="px-3 py-2 text-right">B Rank</th>
                      <th className="px-3 py-2 text-right">B Total</th>
                      <th className="px-3 py-2 text-center">Winner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {h2h.contracts.map((c) => (
                      <tr key={c.contract_id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600">{c.letting_date}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{c.contract_number}</td>
                        <td className="px-3 py-2 text-gray-600">{c.county}</td>
                        <td className={`px-3 py-2 text-right ${c.winner === 'A' ? 'font-bold text-blue-600' : 'text-gray-600'}`}>
                          #{c.contractor_a_rank}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${c.winner === 'A' ? 'font-bold text-blue-600' : 'text-gray-600'}`}>
                          {fmt.format(c.contractor_a_total)}
                        </td>
                        <td className={`px-3 py-2 text-right ${c.winner === 'B' ? 'font-bold text-indigo-600' : 'text-gray-600'}`}>
                          #{c.contractor_b_rank}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${c.winner === 'B' ? 'font-bold text-indigo-600' : 'text-gray-600'}`}>
                          {fmt.format(c.contractor_b_total)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {c.winner === 'A' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                              <Trophy size={10} /> A
                            </span>
                          ) : c.winner === 'B' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">
                              <Trophy size={10} /> B
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Export buttons */}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                const lines = [
                  'HEAD-TO-HEAD COMPARISON',
                  `Date: ${new Date().toISOString().slice(0, 10)}`,
                  '',
                  `Contractor A: ${h2h.contractor_a_name}`,
                  `Contractor B: ${h2h.contractor_b_name}`,
                  '',
                  `Shared Contracts: ${h2h.shared_contracts}`,
                  `A Wins vs B: ${h2h.a_wins_vs_b}`,
                  `B Wins vs A: ${h2h.b_wins_vs_a}`,
                  `A Total Wins: ${h2h.a_total_wins}`,
                  `B Total Wins: ${h2h.b_total_wins}`,
                  '',
                  'CONTRACT RESULTS',
                  '-'.repeat(90),
                  ...h2h.contracts.map((c) =>
                    `${c.letting_date}  ${c.contract_number.padEnd(12)}  ${c.county.padEnd(15)}  A:#${c.contractor_a_rank} $${exportCurrency(c.contractor_a_total)}  B:#${c.contractor_b_rank} $${exportCurrency(c.contractor_b_total)}  Winner: ${c.winner || '-'}`
                  ),
                ];
                downloadTXT(lines.join('\n'), 'head_to_head_summary.txt');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              <Download size={12} /> Export Summary
            </button>
          </div>

          {/* Item comparison table */}
          <div className="bg-white rounded-lg shadow">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <h3 className="text-sm font-medium text-gray-700">Item Price Comparison</h3>
                <p className="text-xs text-gray-400 mt-0.5">Average unit prices across shared pay items</p>
              </div>
              {items && items.items.length > 0 && (
                <button
                  onClick={() => {
                    downloadCSV(
                      items.items.map((item) => ({
                        code: item.pay_item_code,
                        description: item.description,
                        unit: item.unit,
                        a_avg_price: exportCurrency(item.contractor_a_avg_price),
                        b_avg_price: exportCurrency(item.contractor_b_avg_price),
                        variance_pct: item.variance_pct.toFixed(1),
                        samples: item.sample_count,
                      })),
                      'head_to_head_items.csv',
                      [
                        { key: 'code', header: 'Pay Item Code' },
                        { key: 'description', header: 'Description' },
                        { key: 'unit', header: 'Unit' },
                        { key: 'a_avg_price', header: `${h2h.contractor_a_name} Avg` },
                        { key: 'b_avg_price', header: `${h2h.contractor_b_name} Avg` },
                        { key: 'variance_pct', header: 'Variance %' },
                        { key: 'samples', header: 'Samples' },
                      ],
                    );
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  <Download size={12} /> Export CSV
                </button>
              )}
            </div>
            {itemsLoading ? (
              <div className="flex items-center justify-center p-8 text-gray-400">Loading...</div>
            ) : !items || items.items.length === 0 ? (
              <div className="p-4 text-sm text-gray-400">No shared pay items found.</div>
            ) : (
              <>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                      <tr>
                        <th className="px-3 py-2">Code</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2">Unit</th>
                        <th className="px-3 py-2 text-right">A Avg Price</th>
                        <th className="px-3 py-2 text-right">B Avg Price</th>
                        <th className="px-3 py-2 text-right">Variance</th>
                        <th className="px-3 py-2 text-right">Samples</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.items.map((item) => {
                        const varianceColor = item.variance_pct > 5
                          ? 'text-red-600'
                          : item.variance_pct < -5
                            ? 'text-green-600'
                            : 'text-gray-600';
                        return (
                          <tr key={item.pay_item_code} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-mono text-gray-700">{item.pay_item_code}</td>
                            <td className="px-3 py-2 text-gray-900 max-w-[200px] truncate">{item.description}</td>
                            <td className="px-3 py-2 text-gray-500">{item.unit}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-900">{fmt.format(item.contractor_a_avg_price)}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-900">{fmt.format(item.contractor_b_avg_price)}</td>
                            <td className={`px-3 py-2 text-right font-medium ${varianceColor}`}>
                              {item.variance_pct > 0 ? '+' : ''}{item.variance_pct.toFixed(1)}%
                            </td>
                            <td className="px-3 py-2 text-right text-gray-500">{item.sample_count}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {itemTotalPages > 1 && (
                  <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-gray-500">
                    <span>{items.total.toLocaleString()} items — Page {itemPage} of {itemTotalPages}</span>
                    <div className="flex gap-1">
                      <button disabled={itemPage <= 1} onClick={() => setItemPage(itemPage - 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={14} /></button>
                      <button disabled={itemPage >= itemTotalPages} onClick={() => setItemPage(itemPage + 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={14} /></button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {!comparing && !h2hLoading && (
        <div className="flex items-center justify-center p-12 text-gray-400 text-sm">
          Select two contractors and click Compare to see head-to-head analysis
        </div>
      )}
    </div>
  );
}

// ============================================================
// Contractor Picker (type-ahead search dropdown for Contractor A)
// ============================================================

function ContractorPicker({ selected, onSelect, excludePk }: {
  selected: Contractor | null;
  onSelect: (c: Contractor) => void;
  excludePk?: string;
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['contractorPicker', debouncedSearch],
    queryFn: () => listContractors({ search: debouncedSearch, page_size: 15 }),
    enabled: debouncedSearch.length >= 2,
  });

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout((window as any).__contractorPickerTimer);
    (window as any).__contractorPickerTimer = setTimeout(() => setDebouncedSearch(value), 300);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredContractors = data?.contractors.filter((c) => c.contractor_pk !== excludePk) || [];

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder={selected ? selected.name : 'Search contractors...'}
          value={open ? search : (selected ? selected.name : '')}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => { setOpen(true); setSearch(''); }}
          className={`w-full pl-8 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            selected ? 'font-medium' : ''
          }`}
        />
      </div>
      {open && debouncedSearch.length >= 2 && filteredContractors.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredContractors.map((c) => (
            <button
              key={c.contractor_pk}
              onClick={() => { onSelect(c); setOpen(false); setSearch(''); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between"
            >
              <span className="truncate font-medium text-gray-900">{c.name}</span>
              <span className="text-xs text-gray-400 ml-2 shrink-0">{c.bid_count} bids</span>
            </button>
          ))}
        </div>
      )}
      {open && debouncedSearch.length >= 2 && filteredContractors.length === 0 && data && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded-md shadow-lg p-3 text-sm text-gray-400">
          No contractors found
        </div>
      )}
    </div>
  );
}


// ============================================================
// Competitor Picker (dropdown of known competitors for Contractor B)
// ============================================================

function CompetitorPicker({ contractorAPk, selected, onSelect }: {
  contractorAPk: string;
  selected: Contractor | null;
  onSelect: (c: Contractor) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: competitors, isLoading } = useQuery({
    queryKey: ['competitors', contractorAPk],
    queryFn: () => getCompetitors(contractorAPk, 100),
    enabled: !!contractorAPk,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Filter competitors by search text
  const filtered = (competitors || []).filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder={
            isLoading ? 'Loading competitors...'
              : selected ? selected.name
              : `${competitors?.length || 0} known competitors — type to filter...`
          }
          value={open ? search : (selected ? selected.name : '')}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => { setOpen(true); setSearch(''); }}
          className={`w-full pl-8 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            selected ? 'font-medium' : ''
          }`}
        />
      </div>
      {open && !isLoading && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded-md shadow-lg max-h-72 overflow-auto">
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-gray-400">
              {search ? 'No matching competitors' : 'No competitors found'}
            </div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.contractor_pk}
                onClick={() => {
                  onSelect({
                    contractor_pk: c.contractor_pk,
                    name: c.name,
                    contractor_id_code: c.contractor_id_code,
                    bid_count: c.shared_contracts,
                    win_count: 0,
                    created_at: '',
                    updated_at: '',
                  });
                  setOpen(false);
                  setSearch('');
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between"
              >
                <span className="truncate font-medium text-gray-900">{c.name}</span>
                <span className="text-xs text-gray-400 ml-2 shrink-0">{c.shared_contracts} shared</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
