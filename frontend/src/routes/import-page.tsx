import { useState, useCallback } from 'react';
import { useImportSignsCsv } from '../hooks/use-signs';
import { Upload, Download, FileText, CheckCircle, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { SignImportResult } from '../api/types';

const TEMPLATE_CSV = `Asset_ID,MUTCD_Code,Description,Sign_Category,Legend_Text,Latitude,Longitude,Road_Name,Intersection_With,Side_of_Road,Condition_Rating,Status,Install_Date,Sheeting_Type,Sheeting_Manufacturer,Facing_Direction,Mount_Height,Shape,Background_Color,Width,Height,Expected_Life_Years,Location_Notes
SGN-0001,R1-1,Stop Sign,regulatory,STOP,39.7990,-89.6440,S 5th St,E Capitol Ave,W,5,active,06/15/2023,Type III,3M,180,84,octagon,red,30,30,12,NW corner of intersection
SGN-0002,R2-1,Speed Limit 25,regulatory,SPEED LIMIT 25,39.7975,-89.6425,S 6th St,E Monroe St,E,4,active,03/10/2022,Type III,,0,84,rectangle,white,24,30,12,
SGN-0003,W1-1,Turn Warning,warning,,39.7920,-89.6460,Wabash Ave,S Walnut St,N,3,active,08/12/2021,Type III,Avery Dennison,45,84,diamond,yellow,30,30,10,Sharp curve ahead`;

const FIELD_REFERENCE: Array<{
  field: string;
  required: boolean;
  description: string;
  example: string;
  aliases: string;
}> = [
  { field: 'Latitude', required: true, description: 'WGS84 latitude (decimal degrees)', example: '39.7990', aliases: 'lat, y' },
  { field: 'Longitude', required: true, description: 'WGS84 longitude (decimal degrees)', example: '-89.6440', aliases: 'long, lon, lng, x' },
  { field: 'Asset_ID', required: false, description: 'Municipality asset tag / barcode number', example: 'SGN-0001', aliases: 'asset_tag, barcode, tag, inventory_id, sign_id' },
  { field: 'MUTCD_Code', required: false, description: 'Federal MUTCD sign code. Validated against lookup table.', example: 'R1-1', aliases: 'mutcd, sign_code, code, type_code' },
  { field: 'Description', required: false, description: 'Human-readable sign description', example: 'Stop Sign', aliases: 'desc, sign_description, sign_name' },
  { field: 'Sign_Category', required: false, description: 'Sign type category', example: 'regulatory', aliases: 'category. Values: regulatory, warning, guide, school, construction, recreation, temporary' },
  { field: 'Legend_Text', required: false, description: 'Text shown on the sign face', example: 'SPEED LIMIT 25', aliases: 'legend' },
  { field: 'Road_Name', required: false, description: 'Street the sign is on', example: 'S 5th St', aliases: 'road, street, street_name' },
  { field: 'Intersection_With', required: false, description: 'Cross street at the nearest intersection', example: 'E Capitol Ave', aliases: 'intersection, cross_street' },
  { field: 'Side_of_Road', required: false, description: 'Side of the road the sign is on', example: 'W', aliases: 'side. Values: N, S, E, W' },
  { field: 'Condition_Rating', required: false, description: 'Overall condition 1 (critical) to 5 (excellent)', example: '4', aliases: 'condition, rating' },
  { field: 'Status', required: false, description: 'Current sign status. Defaults to "active"', example: 'active', aliases: 'sign_status. Values: active, damaged, faded, missing, obscured, replaced, removed' },
  { field: 'Install_Date', required: false, description: 'Date the sign was installed. Multiple formats accepted.', example: '06/15/2023', aliases: 'installed, date_installed. Formats: MM/DD/YYYY, YYYY-MM-DD, M/D/YY' },
  { field: 'Sheeting_Type', required: false, description: 'Retroreflective sheeting type', example: 'Type III', aliases: 'sheeting. Values: Type I, Type III, Type IX, Type XI' },
  { field: 'Sheeting_Manufacturer', required: false, description: 'Sheeting manufacturer name', example: '3M', aliases: 'manufacturer' },
  { field: 'Facing_Direction', required: false, description: 'Direction the sign faces in degrees (0-360)', example: '180', aliases: 'facing, direction' },
  { field: 'Mount_Height', required: false, description: 'Height of the bottom of the sign in inches', example: '84', aliases: 'mount_height_inches' },
  { field: 'Shape', required: false, description: 'Sign shape', example: 'octagon', aliases: 'Values: octagon, diamond, rectangle, circle, pentagon, triangle' },
  { field: 'Background_Color', required: false, description: 'Sign background color', example: 'red', aliases: 'color' },
  { field: 'Width', required: false, description: 'Sign width in inches', example: '30', aliases: 'size_width_inches, width_inches' },
  { field: 'Height', required: false, description: 'Sign height in inches', example: '30', aliases: 'size_height_inches, height_inches' },
  { field: 'Expected_Life_Years', required: false, description: 'Expected sign life in years', example: '12', aliases: 'life_years' },
  { field: 'Location_Notes', required: false, description: 'Free-text location description', example: 'NW corner of intersection', aliases: '' },
];

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'assetlink_sign_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportPage() {
  const importMutation = useImportSignsCsv();
  const [result, setResult] = useState<SignImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showFieldRef, setShowFieldRef] = useState(false);

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
      <div className="max-w-4xl mx-auto py-8 px-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Import Signs from CSV</h2>
        <p className="text-sm text-gray-500 mb-6">
          Upload a CSV file with your sign inventory. Column names are automatically matched — use the template below for best results.
        </p>

        {/* Step 1: Download template */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
            Download Template
          </h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-4">
            <FileText size={24} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-700 mb-2">
                Start with our template CSV file. It includes all supported columns with example data.
                Format your existing data to match this structure.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  <Download size={14} />
                  Download Template CSV
                </button>
                <span className="text-xs text-gray-500">
                  Only <strong>Latitude</strong> and <strong>Longitude</strong> are required. All other columns are optional.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Upload */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
            Upload Your CSV
          </h3>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
            }`}
          >
            <Upload className="mx-auto mb-3 text-gray-400" size={36} />
            <p className="text-gray-600 mb-2 text-sm">Drag and drop a CSV file here, or</p>
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
            <div className="mt-3 text-xs text-gray-400 space-y-1">
              <p>Column names are automatically matched (e.g., "lat" → Latitude, "street" → Road Name)</p>
              <p>Unrecognized columns are stored in custom fields — no data is lost</p>
            </div>
          </div>
        </div>

        {importMutation.isPending && (
          <div className="mb-6 text-center text-gray-500 text-sm">
            <div className="inline-flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Importing signs...
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                <CheckCircle size={14} />
              </span>
              Import Results
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-700">{result.created}</div>
                  <div className="text-sm text-green-600">Created</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-700">{result.skipped}</div>
                  <div className="text-sm text-yellow-600">Skipped</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-700">{result.total_rows}</div>
                  <div className="text-sm text-gray-600">Total Rows</div>
                </div>
              </div>

              {/* Column mapping */}
              {Object.keys(result.column_mapping).length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-600 mb-2">Column Mapping (your column → our field)</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(result.column_mapping).map(([csv, field]) => (
                      <span key={csv} className="text-xs bg-green-50 border border-green-200 rounded px-2 py-1">
                        <span className="text-gray-500">{csv}</span>
                        <span className="text-gray-400 mx-1">→</span>
                        <span className="text-green-700 font-medium">{field}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {result.errors.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-red-700 mb-2 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {result.errors.length} issue{result.errors.length !== 1 ? 's' : ''}
                  </h4>
                  <div className="bg-red-50 border border-red-200 rounded-lg divide-y divide-red-100 text-sm max-h-60 overflow-auto">
                    {result.errors.map((err, i) => (
                      <div key={i} className="px-4 py-2">
                        <span className="text-red-500 font-mono">Row {err.row}</span>
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
          </div>
        )}

        {/* Field Reference */}
        <div className="border-t border-gray-200 pt-6">
          <button
            onClick={() => setShowFieldRef(!showFieldRef)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
          >
            {showFieldRef ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            Field Reference Guide
          </button>

          {showFieldRef && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-3">
                Column names are fuzzy-matched — "Street Name", "street_name", "street", and "road" all map to the same field.
                Unrecognized columns are preserved in the sign's custom fields (no data is lost).
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-3 py-2 font-medium">Field</th>
                      <th className="px-3 py-2 font-medium w-12">Req?</th>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium">Example</th>
                      <th className="px-3 py-2 font-medium">Also accepts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {FIELD_REFERENCE.map((f) => (
                      <tr key={f.field} className={f.required ? 'bg-blue-50/50' : ''}>
                        <td className="px-3 py-2 font-mono font-medium text-gray-900">{f.field}</td>
                        <td className="px-3 py-2">
                          {f.required ? (
                            <span className="text-red-600 font-bold">Yes</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{f.description}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">{f.example}</td>
                        <td className="px-3 py-2 text-gray-400">{f.aliases}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <strong>Tip for data wrangling:</strong> If your existing data uses different column names (e.g., "Sign Type" instead of "MUTCD_Code"),
                the import will try to match them automatically. If a column can't be matched, it will be stored in the sign's custom fields.
                For best results, rename your columns to match the template before importing.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
