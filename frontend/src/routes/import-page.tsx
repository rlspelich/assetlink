import { useState, useCallback } from 'react';
import { useImportSignsCsv, useImportSupportsCsv, useImportSignsAndSupportsCsv } from '../hooks/use-signs';
import { Upload, Download, FileText, CheckCircle, AlertCircle, ChevronDown, ChevronRight, Clock, Zap, AlertTriangle, ClipboardList, Link2, HardHat } from 'lucide-react';
import type { SignImportResult } from '../api/types';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB — matches backend limit

type ImportMode = 'signs' | 'signs_and_supports' | 'supports_only';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function estimateRowCount(bytes: number): number {
  // Rough estimate: ~150 bytes per row for a typical sign CSV with 20+ columns
  return Math.round(bytes / 150);
}

const TEMPLATE_CSV = `Asset_ID,MUTCD_Code,Description,Sign_Category,Legend_Text,Latitude,Longitude,Road_Name,Intersection_With,Side_of_Road,Condition_Rating,Status,Install_Date,Sheeting_Type,Sheeting_Manufacturer,Facing_Direction,Mount_Height,Shape,Background_Color,Width,Height,Expected_Life_Years,Location_Notes
SGN-0001,R1-1,Stop Sign,regulatory,STOP,39.7990,-89.6440,S 5th St,E Capitol Ave,W,5,active,06/15/2023,Type III,3M,180,84,octagon,red,30,30,12,NW corner of intersection
SGN-0002,R2-1,Speed Limit 25,regulatory,SPEED LIMIT 25,39.7975,-89.6425,S 6th St,E Monroe St,E,4,active,03/10/2022,Type III,,0,84,rectangle,white,24,30,12,
SGN-0003,W1-1,Turn Warning,warning,,39.7920,-89.6460,Wabash Ave,S Walnut St,N,3,active,08/12/2021,Type III,Avery Dennison,45,84,diamond,yellow,30,30,10,Sharp curve ahead`;

const TEMPLATE_SIGNS_WITH_SUPPORTS_CSV = `latitude,longitude,mutcd_code,description,road_name,status,condition_rating,install_date,support_asset_tag,support_type,support_material,support_condition_rating,support_height_inches,support_status,support_install_date,support_notes
39.7817,-89.6501,R1-1,Stop Sign,Main Street,active,4,2020-06-15,POST-001,u_channel,galvanized_steel,4,96,active,2019-03-10,Corner of Main and Elm
39.7817,-89.6501,R1-2,Speed Limit 25,Main Street,active,3,2021-01-20,POST-001,u_channel,galvanized_steel,4,96,active,2019-03-10,Corner of Main and Elm
39.7825,-89.6510,W1-1,Curve Warning,Oak Avenue,active,5,2022-03-01,POST-002,square_tube,aluminum,5,84,active,2022-03-01,Near Oak Ave curve
39.7830,-89.6520,R2-1,Speed Limit 35,Elm Street,active,2,2018-09-15,POST-003,wood,,3,108,active,2015-06-01,`;

const TEMPLATE_SUPPORTS_CSV = `asset_tag,latitude,longitude,support_type,material,condition_rating,height_inches,status,install_date,notes
POST-001,39.7817,-89.6501,u_channel,galvanized_steel,4,96,active,2019-03-10,Corner of Main and Elm
POST-002,39.7825,-89.6510,square_tube,aluminum,5,84,active,2022-03-01,Near Oak Ave curve
POST-003,39.7830,-89.6520,wood,,3,108,active,2015-06-01,
POST-004,39.7840,-89.6530,round_tube,steel,4,72,active,2020-11-20,Park entrance
POST-005,39.7850,-89.6540,mast_arm,steel,5,240,active,2023-01-15,Traffic signal support`;

const SIGN_FIELD_REFERENCE: Array<{
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

const SUPPORT_FIELD_REFERENCE: Array<{
  field: string;
  required: boolean;
  description: string;
  example: string;
  aliases: string;
}> = [
  { field: 'Support_Tag', required: false, description: 'Unique identifier for the support post', example: 'POST-001', aliases: 'post_id, pole_id, support_barcode, support_asset_tag, asset_tag' },
  { field: 'Support_Type', required: false, description: 'Type of support structure', example: 'u_channel', aliases: 'post_type, pole_type. Values: u_channel, square_tube, round_tube, wood, mast_arm, span_wire, bridge_mount' },
  { field: 'Support_Material', required: false, description: 'Material of the support', example: 'galvanized_steel', aliases: 'post_material. Values: aluminum, steel, galvanized_steel, wood, fiberglass' },
  { field: 'Support_Condition', required: false, description: 'Condition rating 1 (critical) to 5 (excellent)', example: '4', aliases: 'post_condition, support_condition_rating' },
  { field: 'Support_Height', required: false, description: 'Height of the support in inches', example: '96', aliases: 'post_height, pole_height, support_height_inches' },
  { field: 'Support_Status', required: false, description: 'Current support status', example: 'active', aliases: 'post_status. Values: active, damaged, leaning, missing, removed' },
  { field: 'Support_Install_Date', required: false, description: 'Date the support was installed', example: '2019-03-10', aliases: 'post_install_date' },
  { field: 'Support_Notes', required: false, description: 'Free-text notes about the support', example: 'Corner of Main and Elm', aliases: 'post_notes' },
];

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File too large (${formatFileSize(file.size)}). Maximum is ${formatFileSize(MAX_FILE_SIZE)}.`;
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return 'File must be a .csv file.';
  }
  return null;
}

interface FileDropZoneProps {
  label: string;
  hint?: string;
  file: File | null;
  onFile: (file: File) => void;
  error: string | null;
  dragOver: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

function FileDropZone({ label, hint, file, onFile, error, dragOver, onDragOver, onDragLeave, onDrop }: FileDropZoneProps) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-xs font-medium text-gray-600 mb-2">{label}</div>
      <div
        onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          file ? 'border-green-400 bg-green-50' : dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
        }`}
      >
        {file ? (
          <div>
            <CheckCircle className="mx-auto mb-2 text-green-500" size={24} />
            <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
            <p className="text-xs text-gray-500 mt-1">
              {formatFileSize(file.size)} — ~{estimateRowCount(file.size).toLocaleString()} rows
            </p>
            <label className="inline-block mt-2 px-3 py-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
              Change file
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </label>
          </div>
        ) : (
          <>
            <Upload className="mx-auto mb-2 text-gray-400" size={28} />
            <p className="text-gray-600 mb-2 text-xs">{hint || 'Drag and drop a CSV file here, or'}</p>
            <label className="inline-block px-3 py-1.5 bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700 text-xs">
              Choose File
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </label>
          </>
        )}
      </div>
      {error && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function FieldReferenceTable({ fields, title }: { fields: typeof SIGN_FIELD_REFERENCE; title: string }) {
  return (
    <div className="mb-4">
      <h5 className="text-xs font-semibold text-gray-700 mb-2">{title}</h5>
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
            {fields.map((f) => (
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
    </div>
  );
}

export function ImportPage() {
  const importSignsMutation = useImportSignsCsv();
  const importSupportsMutation = useImportSupportsCsv();
  const importCombinedMutation = useImportSignsAndSupportsCsv();

  const [mode, setMode] = useState<ImportMode>('signs');
  const [result, setResult] = useState<SignImportResult | null>(null);
  const [showFieldRef, setShowFieldRef] = useState(false);

  // Signs mode state
  const [signsFile, setSignsFile] = useState<File | null>(null);
  const [signsFileError, setSignsFileError] = useState<string | null>(null);
  const [signsDragOver, setSignsDragOver] = useState(false);

  // Two-file mode: supports file
  const [supportsFile, setSupportsFile] = useState<File | null>(null);
  const [supportsFileError, setSupportsFileError] = useState<string | null>(null);
  const [supportsDragOver, setSupportsDragOver] = useState(false);

  // Two-file mode: signs file (separate from single-file signs)
  const [twoFileSignsFile, setTwoFileSignsFile] = useState<File | null>(null);
  const [twoFileSignsError, setTwoFileSignsError] = useState<string | null>(null);
  const [twoFileSignsDragOver, setTwoFileSignsDragOver] = useState(false);

  // Supports-only mode
  const [supportsOnlyFile, setSupportsOnlyFile] = useState<File | null>(null);
  const [supportsOnlyError, setSupportsOnlyError] = useState<string | null>(null);
  const [supportsOnlyDragOver, setSupportsOnlyDragOver] = useState(false);

  const isPending = importSignsMutation.isPending || importSupportsMutation.isPending || importCombinedMutation.isPending;

  const handleModeChange = useCallback((newMode: ImportMode) => {
    setMode(newMode);
    setResult(null);
  }, []);

  const handleSignsFile = useCallback((file: File) => {
    setSignsFileError(null);
    setResult(null);
    const err = validateFile(file);
    if (err) {
      setSignsFileError(err);
      setSignsFile(null);
      return;
    }
    setSignsFile(file);
  }, []);

  const handleSupportsFile = useCallback((file: File) => {
    setSupportsFileError(null);
    setResult(null);
    const err = validateFile(file);
    if (err) {
      setSupportsFileError(err);
      setSupportsFile(null);
      return;
    }
    setSupportsFile(file);
  }, []);

  const handleTwoFileSignsFile = useCallback((file: File) => {
    setTwoFileSignsError(null);
    setResult(null);
    const err = validateFile(file);
    if (err) {
      setTwoFileSignsError(err);
      setTwoFileSignsFile(null);
      return;
    }
    setTwoFileSignsFile(file);
  }, []);

  const handleSupportsOnlyFile = useCallback((file: File) => {
    setSupportsOnlyError(null);
    setResult(null);
    const err = validateFile(file);
    if (err) {
      setSupportsOnlyError(err);
      setSupportsOnlyFile(null);
      return;
    }
    setSupportsOnlyFile(file);
  }, []);

  const handleImport = useCallback(async () => {
    setResult(null);
    try {
      if (mode === 'signs' && signsFile) {
        const res = await importSignsMutation.mutateAsync(signsFile);
        setResult(res);
      } else if (mode === 'signs_and_supports' && supportsFile && twoFileSignsFile) {
        const res = await importCombinedMutation.mutateAsync({
          signsFile: twoFileSignsFile,
          supportsFile: supportsFile,
        });
        setResult(res);
      } else if (mode === 'supports_only' && supportsOnlyFile) {
        const res = await importSupportsMutation.mutateAsync(supportsOnlyFile);
        setResult(res);
      }
    } catch {
      // Error state is handled by the mutation hooks
    }
  }, [mode, signsFile, supportsFile, twoFileSignsFile, supportsOnlyFile, importSignsMutation, importSupportsMutation, importCombinedMutation]);

  const canImport = (() => {
    if (isPending) return false;
    if (mode === 'signs') return !!signsFile && !signsFileError;
    if (mode === 'signs_and_supports') return !!supportsFile && !!twoFileSignsFile && !supportsFileError && !twoFileSignsError;
    if (mode === 'supports_only') return !!supportsOnlyFile && !supportsOnlyError;
    return false;
  })();

  const activeFileEstimate = (() => {
    if (mode === 'signs' && signsFile) return estimateRowCount(signsFile.size);
    if (mode === 'signs_and_supports') {
      const total = (supportsFile?.size ?? 0) + (twoFileSignsFile?.size ?? 0);
      return estimateRowCount(total);
    }
    if (mode === 'supports_only' && supportsOnlyFile) return estimateRowCount(supportsOnlyFile.size);
    return 0;
  })();

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto py-8 px-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Import from CSV</h2>
        <p className="text-sm text-gray-500 mb-6">
          Upload CSV files with your sign and support inventory. Column names are automatically matched. Choose an import mode below.
        </p>

        {/* Step 1: Mode selector */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
            Choose Import Mode
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Signs (Auto-detect) */}
            <button
              onClick={() => handleModeChange('signs')}
              className={`text-left rounded-lg border-2 p-4 transition-all ${
                mode === 'signs'
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList size={18} className={mode === 'signs' ? 'text-blue-600' : 'text-gray-400'} />
                <span className="text-sm font-semibold text-gray-900">Signs</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Single CSV file. If support columns are included, they are auto-detected and supports are created.
              </p>
              <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                Most Common
              </span>
            </button>

            {/* Signs + Supports (Two Files) */}
            <button
              onClick={() => handleModeChange('signs_and_supports')}
              className={`text-left rounded-lg border-2 p-4 transition-all ${
                mode === 'signs_and_supports'
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Link2 size={18} className={mode === 'signs_and_supports' ? 'text-blue-600' : 'text-gray-400'} />
                <span className="text-sm font-semibold text-gray-900">Signs + Supports</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Separate CSVs for signs and supports linked by a shared support ID.
              </p>
              <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                From GIS Export
              </span>
            </button>

            {/* Supports Only */}
            <button
              onClick={() => handleModeChange('supports_only')}
              className={`text-left rounded-lg border-2 p-4 transition-all ${
                mode === 'supports_only'
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <HardHat size={18} className={mode === 'supports_only' ? 'text-blue-600' : 'text-gray-400'} />
                <span className="text-sm font-semibold text-gray-900">Supports Only</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Import support posts/structures before importing signs that reference them.
              </p>
              <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                Advanced
              </span>
            </button>
          </div>
        </div>

        {/* Step 2: Download template */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
            Download Template
          </h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-4">
            <FileText size={24} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              {mode === 'signs' && (
                <>
                  <p className="text-sm text-gray-700 mb-2">
                    Start with our template CSV. It includes all supported columns with example data.
                    Only <strong>Latitude</strong> and <strong>Longitude</strong> are required.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => downloadCsv(TEMPLATE_CSV, 'assetlink_sign_import_template.csv')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                    >
                      <Download size={14} />
                      Signs Template
                    </button>
                    <button
                      onClick={() => downloadCsv(TEMPLATE_SIGNS_WITH_SUPPORTS_CSV, 'assetlink_signs_with_supports_template.csv')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-300 text-blue-700 rounded text-xs font-medium hover:bg-blue-100 transition-colors"
                    >
                      <Download size={14} />
                      Signs + Support Columns Template
                    </button>
                  </div>
                </>
              )}
              {mode === 'signs_and_supports' && (
                <>
                  <p className="text-sm text-gray-700 mb-2">
                    Download both templates. The supports file defines posts/poles, and the signs file references them by support ID.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => downloadCsv(TEMPLATE_SUPPORTS_CSV, 'assetlink_supports_template.csv')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                    >
                      <Download size={14} />
                      Supports Template
                    </button>
                    <button
                      onClick={() => downloadCsv(TEMPLATE_CSV, 'assetlink_sign_import_template.csv')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                    >
                      <Download size={14} />
                      Signs Template
                    </button>
                  </div>
                </>
              )}
              {mode === 'supports_only' && (
                <>
                  <p className="text-sm text-gray-700 mb-2">
                    Import support structures first. Then import signs that reference these supports by their asset tag.
                    <strong> Latitude</strong> and <strong>Longitude</strong> are required.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadCsv(TEMPLATE_SUPPORTS_CSV, 'assetlink_supports_template.csv')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                    >
                      <Download size={14} />
                      Supports Template
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Upload */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
            Upload Your CSV{mode === 'signs_and_supports' ? 's' : ''}
          </h3>

          {/* Signs mode: single file upload */}
          {mode === 'signs' && (
            <FileDropZone
              label="Signs CSV"
              hint="Drag and drop a CSV file here, or"
              file={signsFile}
              onFile={handleSignsFile}
              error={signsFileError}
              dragOver={signsDragOver}
              onDragOver={() => setSignsDragOver(true)}
              onDragLeave={() => setSignsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setSignsDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleSignsFile(f);
              }}
            />
          )}

          {/* Two files mode */}
          {mode === 'signs_and_supports' && (
            <div className="flex flex-col sm:flex-row gap-4">
              <FileDropZone
                label="Supports CSV (upload first)"
                hint="Drop supports CSV here"
                file={supportsFile}
                onFile={handleSupportsFile}
                error={supportsFileError}
                dragOver={supportsDragOver}
                onDragOver={() => setSupportsDragOver(true)}
                onDragLeave={() => setSupportsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setSupportsDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleSupportsFile(f);
                }}
              />
              <FileDropZone
                label="Signs CSV (references support IDs)"
                hint="Drop signs CSV here"
                file={twoFileSignsFile}
                onFile={handleTwoFileSignsFile}
                error={twoFileSignsError}
                dragOver={twoFileSignsDragOver}
                onDragOver={() => setTwoFileSignsDragOver(true)}
                onDragLeave={() => setTwoFileSignsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setTwoFileSignsDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleTwoFileSignsFile(f);
                }}
              />
            </div>
          )}

          {/* Supports only mode */}
          {mode === 'supports_only' && (
            <FileDropZone
              label="Supports CSV"
              hint="Drag and drop a CSV file here, or"
              file={supportsOnlyFile}
              onFile={handleSupportsOnlyFile}
              error={supportsOnlyError}
              dragOver={supportsOnlyDragOver}
              onDragOver={() => setSupportsOnlyDragOver(true)}
              onDragLeave={() => setSupportsOnlyDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setSupportsOnlyDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleSupportsOnlyFile(f);
              }}
            />
          )}

          {/* Helpful hints below upload area */}
          <div className="mt-3 text-xs text-gray-400 space-y-1">
            <p>Column names are automatically matched (e.g., &quot;lat&quot; &rarr; Latitude, &quot;street&quot; &rarr; Road Name)</p>
            <p>Unrecognized columns are stored in custom fields &mdash; no data is lost</p>
            <p>Maximum file size: 50 MB. Supports 20,000+ rows.</p>
          </div>

          {/* Import button */}
          <div className="mt-4">
            <button
              onClick={handleImport}
              disabled={!canImport}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded text-sm font-medium transition-colors ${
                canImport
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Upload size={16} />
              {mode === 'signs' && 'Import Signs'}
              {mode === 'signs_and_supports' && 'Import Signs & Supports'}
              {mode === 'supports_only' && 'Import Supports'}
            </button>
          </div>
        </div>

        {/* Loading */}
        {isPending && (
          <div className="mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="inline-flex items-center gap-2 text-blue-700 text-sm font-medium">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                {activeFileEstimate > 0
                  ? `Processing ~${activeFileEstimate.toLocaleString()} rows... This may take a moment for large files.`
                  : 'Importing...'}
              </div>
              {activeFileEstimate > 5000 && (
                <p className="text-xs text-blue-500 mt-2">
                  Large imports are processed in batches of 500 for reliability. Please do not close this page.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Mutation error */}
        {(importSignsMutation.isError || importSupportsMutation.isError || importCombinedMutation.isError) && !result && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Import failed</p>
              <p className="text-xs text-red-600 mt-1">
                {(importSignsMutation.error ?? importSupportsMutation.error ?? importCombinedMutation.error)?.message || 'An unexpected error occurred. Please try again.'}
              </p>
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
              {/* Result cards — mode-dependent */}
              {result.import_mode === 'signs_and_supports' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-700">{result.signs_created.toLocaleString()}</div>
                    <div className="text-xs text-green-600">Signs Created</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-700">{result.signs_linked_to_supports.toLocaleString()}</div>
                    <div className="text-xs text-blue-600">Signs Linked</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-700">{result.supports_created.toLocaleString()}</div>
                    <div className="text-xs text-emerald-600">Supports Created</div>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-indigo-700">{result.support_groups.toLocaleString()}</div>
                    <div className="text-xs text-indigo-600">Support Groups</div>
                  </div>
                </div>
              ) : result.import_mode === 'supports_only' ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-700">{result.supports_created.toLocaleString()}</div>
                    <div className="text-sm text-green-600">Supports Created</div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-700">{result.supports_skipped.toLocaleString()}</div>
                    <div className="text-sm text-yellow-600">Skipped</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-700">{result.supports_total_rows.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Total Rows</div>
                  </div>
                </div>
              ) : (
                /* signs_only — backward compatible with old response shape */
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-700">{result.created.toLocaleString()}</div>
                      <div className="text-sm text-green-600">Created</div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-700">{result.skipped.toLocaleString()}</div>
                      <div className="text-sm text-yellow-600">Skipped</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-gray-700">{result.total_rows.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Total Rows</div>
                    </div>
                  </div>

                  {/* If auto-detected supports, show extra row */}
                  {result.supports_created > 0 && (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-emerald-700">{result.supports_created.toLocaleString()}</div>
                        <div className="text-sm text-emerald-600">Supports Created</div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-blue-700">{result.signs_linked_to_supports.toLocaleString()}</div>
                        <div className="text-sm text-blue-600">Signs Linked</div>
                      </div>
                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-indigo-700">{result.support_groups.toLocaleString()}</div>
                        <div className="text-sm text-indigo-600">Support Groups</div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Skipped rows for combined mode */}
              {result.import_mode === 'signs_and_supports' && (result.signs_skipped > 0 || result.supports_skipped > 0) && (
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {result.signs_skipped > 0 && (
                    <span className="text-yellow-600">{result.signs_skipped} sign row{result.signs_skipped !== 1 ? 's' : ''} skipped</span>
                  )}
                  {result.supports_skipped > 0 && (
                    <span className="text-yellow-600">{result.supports_skipped} support row{result.supports_skipped !== 1 ? 's' : ''} skipped</span>
                  )}
                  <span className="text-gray-400">
                    ({result.signs_total_rows} sign rows, {result.supports_total_rows} support rows total)
                  </span>
                </div>
              )}

              {/* Timing info */}
              {result.duration_seconds != null && (
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} />
                    {result.duration_seconds < 1
                      ? `${(result.duration_seconds * 1000).toFixed(0)}ms`
                      : `${result.duration_seconds.toFixed(1)}s`}
                  </span>
                  {result.rows_per_second != null && (
                    <span className="inline-flex items-center gap-1">
                      <Zap size={12} />
                      {result.rows_per_second.toLocaleString()} rows/sec
                    </span>
                  )}
                </div>
              )}

              {/* Unmapped columns warning */}
              {result.unmapped_columns.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-amber-800">
                        {result.unmapped_columns.length} unmapped column{result.unmapped_columns.length !== 1 ? 's' : ''} stored in custom fields:
                      </span>
                      <span className="text-amber-700 ml-1">
                        {result.unmapped_columns.join(', ')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Column mapping */}
              {Object.keys(result.column_mapping).length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-600 mb-2">
                    {result.import_mode === 'supports_only' ? 'Column Mapping' : 'Sign Column Mapping'}
                    {' '}(your column &rarr; our field)
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(result.column_mapping).map(([csv, field]) => (
                      <span key={csv} className="text-xs bg-green-50 border border-green-200 rounded px-2 py-1">
                        <span className="text-gray-500">{csv}</span>
                        <span className="text-gray-400 mx-1">&rarr;</span>
                        <span className="text-green-700 font-medium">{field}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Support column mapping */}
              {Object.keys(result.support_column_mapping).length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-600 mb-2">Support Column Mapping (your column &rarr; our field)</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(result.support_column_mapping).map(([csv, field]) => (
                      <span key={csv} className="text-xs bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                        <span className="text-gray-500">{csv}</span>
                        <span className="text-gray-400 mx-1">&rarr;</span>
                        <span className="text-emerald-700 font-medium">{field}</span>
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
                        <span className="text-red-300 mx-1">--</span>
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
                Column names are fuzzy-matched -- "Street Name", "street_name", "street", and "road" all map to the same field.
                Unrecognized columns are preserved in the record's custom fields (no data is lost).
              </p>

              <FieldReferenceTable fields={SIGN_FIELD_REFERENCE} title="Sign Fields" />
              <FieldReferenceTable fields={SUPPORT_FIELD_REFERENCE} title="Support Fields" />

              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <strong>Tip for data wrangling:</strong> If your existing data uses different column names (e.g., "Sign Type" instead of "MUTCD_Code"),
                the import will try to match them automatically. If a column can't be matched, it will be stored in the record's custom fields.
                For best results, rename your columns to match the template before importing.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
