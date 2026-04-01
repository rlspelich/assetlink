import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Upload, X } from 'lucide-react';
import { bulkImportEstimateItems } from '../../../api/estimator';

export function BulkImportModal({ estimateId, onClose, onSuccess }: {
  estimateId: string; onClose: () => void; onSuccess: () => void;
}) {
  const [textData, setTextData] = useState('');
  const [importResult, setImportResult] = useState<{ count: number; error?: string } | null>(null);

  const importMut = useMutation({
    mutationFn: (text: string) => bulkImportEstimateItems(estimateId, text),
    onSuccess: (items) => {
      setImportResult({ count: items.length });
      setTimeout(() => onSuccess(), 1500);
    },
    onError: (err: Error) => {
      setImportResult({ count: 0, error: err.message });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === 'string') {
        setTextData(content);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!textData.trim()) return;
    importMut.mutate(textData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-sm font-semibold text-gray-900">Bulk Import Items</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Paste tab-separated or comma-separated data
            </label>
            <div className="text-[10px] text-gray-400 mb-2">
              Format: pay_item_code, quantity, description (optional), unit (optional) -- one item per line
            </div>
            <textarea
              value={textData}
              onChange={(e) => setTextData(e.target.value)}
              rows={8}
              placeholder={"40201000\t500\tHOT-MIX ASPHALT SURFACE COURSE\tTON\n48101400\t1200\tPORTLAND CEMENT CONCRETE\tSQ YD"}
              className="w-full px-3 py-2 text-xs font-mono border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Or upload CSV</label>
            <input
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileUpload}
              className="text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-gray-300 file:text-xs file:font-medium file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
            />
          </div>
          {importResult && (
            <div className={`p-3 rounded-md text-xs ${importResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {importResult.error
                ? `Import failed: ${importResult.error}`
                : `Successfully imported ${importResult.count} item${importResult.count !== 1 ? 's' : ''}.`
              }
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs border rounded-md hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!textData.trim() || importMut.isPending}
            className="flex items-center gap-1 px-4 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Upload size={14} />
            {importMut.isPending ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
