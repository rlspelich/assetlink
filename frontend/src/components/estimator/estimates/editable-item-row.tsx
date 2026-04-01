import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { ConfidenceBadge } from '../confidence-badge';
import { updateEstimateItem, type EstimateItem } from '../../../api/estimator';

export function EditableItemRow({ item, estimateId, onDelete }: {
  item: EstimateItem; estimateId: string; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editPrice, setEditPrice] = useState('');
  const queryClient = useQueryClient();

  const updateMut = useMutation({
    mutationFn: (price: number) => updateEstimateItem(estimateId, item.estimate_item_id, {
      unit_price: price,
      unit_price_source: 'manual',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] });
      setEditing(false);
    },
    onError: (error: Error) => {
      console.error('Failed to update estimate item:', error.message);
    },
  });

  const startEdit = () => {
    setEditPrice(Number(item.unit_price) > 0 ? String(Number(item.unit_price)) : '');
    setEditing(true);
  };

  const submitEdit = () => {
    const price = parseFloat(editPrice);
    if (!isNaN(price) && price >= 0) {
      updateMut.mutate(price);
    }
  };

  const noData = Number(item.unit_price) === 0 && item.unit_price_source !== 'manual';

  return (
    <tr className={`border-b hover:bg-gray-50 ${noData ? 'bg-yellow-50' : ''}`}>
      <td className="px-3 py-2 font-mono text-gray-400 text-[11px]">{item.pay_item_code}</td>
      <td className="px-3 py-2 truncate max-w-[250px]">{item.description}</td>
      <td className="px-3 py-2 text-right font-mono">{Number(item.quantity).toLocaleString()}</td>
      <td className="px-3 py-2 text-gray-500">{item.unit}</td>
      <td className="px-3 py-2 text-right font-mono">
        {editing ? (
          <div className="flex items-center gap-1 justify-end">
            <span className="text-gray-400">$</span>
            <input
              type="number"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus
              className="w-24 px-2 py-0.5 text-xs text-right border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              step="0.01"
            />
            <button onClick={submitEdit} className="text-[10px] text-blue-600 hover:underline">Save</button>
          </div>
        ) : (
          <button
            onClick={startEdit}
            className={`hover:underline cursor-pointer ${noData ? 'text-red-600 font-medium' : ''}`}
            title="Click to edit price"
          >
            {noData ? (
              'Enter price'
            ) : (
              <>
                ${Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                {item.unit_price_source === 'manual' && (
                  <span className="ml-1 text-[9px] text-orange-500">manual</span>
                )}
              </>
            )}
          </button>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono font-semibold">
        ${Number(item.extension).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="px-3 py-2 text-center">
        <ConfidenceBadge percentile={item.confidence_pct} label={item.confidence_label} />
      </td>
      <td className="px-2 py-2">
        <button
          onClick={onDelete}
          className="text-gray-400 hover:text-red-500"
          title="Remove item"
          aria-label="Remove item"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}
