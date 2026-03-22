import { useState, useCallback } from 'react';
import { useImportSignsCsv } from '../hooks/use-signs';
import { Upload } from 'lucide-react';
import type { SignImportResult } from '../api/types';

export function ImportPage() {
  const importMutation = useImportSignsCsv();
  const [result, setResult] = useState<SignImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setResult(null);
    const res = await importMutation.mutateAsync(file);
    setResult(res);
  }, [importMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto py-8 px-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Import Signs from CSV</h2>

        {/* Upload zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
          }`}
        >
          <Upload className="mx-auto mb-4 text-gray-400" size={40} />
          <p className="text-gray-600 mb-2">Drag and drop a CSV file here, or</p>
          <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700 text-sm">
            Choose File
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
          <p className="text-xs text-gray-400 mt-3">
            CSV must include latitude and longitude columns. MUTCD codes will be validated against the lookup table.
          </p>
        </div>

        {importMutation.isPending && (
          <div className="mt-6 text-center text-gray-500">Importing...</div>
        )}

        {/* Results */}
        {result && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-700">{result.created}</div>
                <div className="text-sm text-green-600">Created</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-700">{result.skipped}</div>
                <div className="text-sm text-yellow-600">Skipped</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-700">{result.total_rows}</div>
                <div className="text-sm text-gray-600">Total Rows</div>
              </div>
            </div>

            {/* Column mapping */}
            {Object.keys(result.column_mapping).length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Column Mapping</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.column_mapping).map(([csv, field]) => (
                    <span key={csv} className="text-xs bg-gray-100 rounded px-2 py-1">
                      <span className="text-gray-500">{csv}</span>
                      <span className="text-gray-400 mx-1">&rarr;</span>
                      <span className="text-gray-700 font-medium">{field}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {result.errors.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-red-700 mb-2">
                  {result.errors.length} issue{result.errors.length !== 1 ? 's' : ''}
                </h3>
                <div className="bg-red-50 rounded-lg divide-y divide-red-100 text-sm max-h-60 overflow-auto">
                  {result.errors.map((err, i) => (
                    <div key={i} className="px-4 py-2">
                      <span className="text-red-500">Row {err.row}</span>
                      <span className="text-red-300 mx-1">|</span>
                      <span className="text-red-400">{err.field}</span>
                      <span className="text-red-300 mx-1">—</span>
                      <span className="text-red-700">{err.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
