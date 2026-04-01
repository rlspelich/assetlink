import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calculator, Plus } from 'lucide-react';
import { US_STATES } from '../estimator-constants';
import { EstimateDetailView } from './estimate-detail';
import {
  listEstimates, createEstimate,
  type Estimate,
} from '../../../api/estimator';

export function EstimatesTab() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: listData } = useQuery({
    queryKey: ['estimates'],
    queryFn: () => listEstimates(),
  });

  const createMut = useMutation({
    mutationFn: createEstimate,
    onSuccess: (est) => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      setSelectedId(est.estimate_id);
      setShowNewForm(false);
    },
    onError: (error: Error) => {
      console.error('Failed to create estimate:', error.message);
    },
  });

  if (selectedId) {
    return (
      <EstimateDetailView
        estimateId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Estimates</h2>
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            <Plus size={16} />
            New Estimate
          </button>
        </div>

        {/* New estimate form */}
        {showNewForm && (
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <NewEstimateForm
              onSubmit={(data) => createMut.mutate(data)}
              onCancel={() => setShowNewForm(false)}
              isLoading={createMut.isPending}
            />
          </div>
        )}

        {/* Estimate list */}
        {!listData?.estimates.length && !showNewForm ? (
          <div className="text-center py-16 text-gray-400">
            <Calculator size={48} className="mx-auto mb-3" />
            <p className="text-lg">No estimates yet</p>
            <p className="text-sm mt-1">Create your first estimate to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {listData?.estimates.map((est) => (
              <EstimateRow
                key={est.estimate_id}
                estimate={est}
                onClick={() => setSelectedId(est.estimate_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EstimateRow({ estimate, onClick }: { estimate: Estimate; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
    >
      <div>
        <div className="font-medium text-gray-900">{estimate.name}</div>
        <div className="text-xs text-gray-500 mt-1">
          {estimate.item_count} items |
          {' '}{US_STATES.find(s => s.code === estimate.target_state)?.name || estimate.target_state} |
          {' '}{estimate.status}
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold text-gray-900">
          ${Number(estimate.total_with_regional || estimate.total_adjusted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        {estimate.confidence_low != null && estimate.confidence_high != null && (
          <div className="text-xs text-gray-500">
            ${Number(estimate.confidence_low).toLocaleString(undefined, { maximumFractionDigits: 0 })} –
            ${Number(estimate.confidence_high).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        )}
      </div>
    </div>
  );
}

function NewEstimateForm({ onSubmit, onCancel, isLoading }: {
  onSubmit: (data: { name: string; target_state: string }) => void; onCancel: () => void; isLoading: boolean;
}) {
  const [name, setName] = useState('');
  const [targetState, setTargetState] = useState('IL');

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Estimate Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., I-55 Resurfacing Bid"
          className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
        <select
          value={targetState}
          onChange={(e) => setTargetState(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-md"
        >
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.factor.toFixed(2)})
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-100">
          Cancel
        </button>
        <button
          onClick={() => onSubmit({ name, target_state: targetState })}
          disabled={!name.trim() || isLoading}
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Creating...' : 'Create Estimate'}
        </button>
      </div>
    </div>
  );
}
