import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchPayItems, type PayItem } from '../../../api/estimator';

let _addItemTimer: ReturnType<typeof setTimeout>;

export function AddItemForm({ onAdd, onCancel, isLoading }: {
  onAdd: (items: { pay_item_code: string; quantity: number; description?: string; unit?: string }[]) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [mode, setMode] = useState<'search' | 'custom'>('search');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<PayItem | null>(null);
  const [quantity, setQuantity] = useState('');
  // Custom item fields
  const [customDesc, setCustomDesc] = useState('');
  const [customUnit, setCustomUnit] = useState('');

  const handleSearch = (value: string) => {
    setSearch(value);
    setSelectedItem(null);
    clearTimeout(_addItemTimer);
    _addItemTimer = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const { data } = useQuery({
    queryKey: ['payItemsAddForm', debouncedSearch],
    queryFn: () => searchPayItems({ search: debouncedSearch, page_size: 10 }),
    enabled: debouncedSearch.length >= 2 && !selectedItem && mode === 'search',
  });

  const handleAdd = () => {
    if (mode === 'search' && selectedItem && quantity) {
      onAdd([{
        pay_item_code: selectedItem.code,
        quantity: Number(quantity),
        description: selectedItem.description,
        unit: selectedItem.unit,
      }]);
      setSelectedItem(null);
      setSearch('');
      setQuantity('');
    } else if (mode === 'custom' && customDesc && quantity) {
      onAdd([{
        pay_item_code: `CUSTOM_${Date.now()}`,
        quantity: Number(quantity),
        description: customDesc,
        unit: customUnit || 'EACH',
      }]);
      setCustomDesc('');
      setCustomUnit('');
      setQuantity('');
    }
  };

  const canAdd = mode === 'search'
    ? !!selectedItem && !!quantity
    : !!customDesc && !!quantity;

  return (
    <div className="mb-4 p-3 border rounded-lg bg-blue-50">
      {/* Mode toggle */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setMode('search')}
          className={`px-3 py-1 text-xs rounded-full border ${mode === 'search' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          Search Database
        </button>
        <button
          onClick={() => setMode('custom')}
          className={`px-3 py-1 text-xs rounded-full border ${mode === 'custom' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          Custom Item
        </button>
      </div>

      {mode === 'search' ? (
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <label className="block text-[10px] font-medium text-gray-600 mb-1">Search Pay Item</label>
            <input
              type="text"
              value={selectedItem ? selectedItem.description : search}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => { if (selectedItem) { setSearch(selectedItem.description); setSelectedItem(null); } }}
              placeholder="Type to search by description..."
              className="w-full px-3 py-2 text-sm border rounded-md"
            />
            {data && !selectedItem && debouncedSearch.length >= 2 && (
              <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
                {data.pay_items.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-400">No items found</div>
                ) : (
                  data.pay_items.map((item) => (
                    <div
                      key={`${item.agency}-${item.code}`}
                      onClick={() => { setSelectedItem(item); setSearch(''); setDebouncedSearch(''); }}
                      className="px-3 py-2 text-xs cursor-pointer hover:bg-blue-50 border-b last:border-b-0"
                    >
                      <span className="font-mono text-gray-400 mr-2">{item.code}</span>
                      <span className="font-medium">{item.description}</span>
                      <span className="text-gray-400 ml-2">{item.unit}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="w-40">
            <label className="block text-[10px] font-medium text-gray-600 mb-1">
              Quantity{selectedItem ? ` (${selectedItem.unit})` : ''}
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={selectedItem ? `0 ${selectedItem.unit}` : '0'}
              className="w-full px-3 py-2 text-sm border rounded-md"
            />
          </div>
          <button onClick={handleAdd} disabled={!canAdd || isLoading}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {isLoading ? 'Adding...' : 'Add'}
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-100">Cancel</button>
        </div>
      ) : (
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-gray-600 mb-1">Description</label>
            <input
              type="text"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              placeholder="e.g., Subcontractor — Traffic Control"
              className="w-full px-3 py-2 text-sm border rounded-md"
            />
          </div>
          <div className="w-24">
            <label className="block text-[10px] font-medium text-gray-600 mb-1">Unit</label>
            <select
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value)}
              className="w-full px-2 py-2 text-sm border rounded-md"
            >
              <option value="EACH">EACH</option>
              <option value="L SUM">L SUM</option>
              <option value="TON">TON</option>
              <option value="CU YD">CU YD</option>
              <option value="SQ YD">SQ YD</option>
              <option value="FOOT">FOOT</option>
              <option value="LB">LB</option>
              <option value="GAL">GAL</option>
              <option value="HOUR">HOUR</option>
              <option value="DAY">DAY</option>
              <option value="MILE">MILE</option>
              <option value="ACRE">ACRE</option>
            </select>
          </div>
          <div className="w-32">
            <label className="block text-[10px] font-medium text-gray-600 mb-1">Quantity</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-sm border rounded-md"
            />
          </div>
          <button onClick={handleAdd} disabled={!canAdd || isLoading}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {isLoading ? 'Adding...' : 'Add'}
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-100">Cancel</button>
        </div>
      )}
    </div>
  );
}
