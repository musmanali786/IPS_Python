import { useEffect, useState } from 'react';
import { datasetsApi } from '../api';
import type { DatasetListItem } from '../api';
import { Upload, FileSpreadsheet, Trash2, Eye } from 'lucide-react';

const DATA_TYPES = [
  { value: 'rssi', label: 'RF Scans (RSSI)' },
  { value: 'imu', label: 'IMU (Acc/Gyro)' },
  { value: 'fingerprint_radio_map', label: 'Fingerprinting Radio Map' },
  { value: 'ftm', label: 'FTM (Distance)' },
];

export default function DatasetManager() {
  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);

  // Upload form
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [dataType, setDataType] = useState('rssi');
  const [uploading, setUploading] = useState(false);
  const [schemas, setSchemas] = useState<any>(null);

  const load = () => datasetsApi.list().then((r) => setDatasets(r.data)).catch(() => {});

  useEffect(() => {
    load();
    datasetsApi.schemas().then((r) => setSchemas(r.data)).catch(() => {});
  }, []);

  const handleUpload = async () => {
    if (!file || !name.trim()) return;
    setUploading(true);
    try {
      await datasetsApi.upload(file, name.trim(), dataType);
      load();
      setFile(null);
      setName('');
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Upload failed');
    }
    setUploading(false);
  };

  const handlePreview = async (id: number) => {
    if (previewId === id) {
      setPreview(null);
      setPreviewId(null);
      return;
    }
    const r = await datasetsApi.preview(id);
    setPreview(r.data);
    setPreviewId(id);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this dataset?')) return;
    await datasetsApi.delete(id);
    if (previewId === id) { setPreview(null); setPreviewId(null); }
    load();
  };

  return (
    <div className="p-8 max-w-5xl">
      <h2 className="text-2xl font-bold mb-6">Dataset Manager</h2>

      {/* Upload form */}
      <div
        className="rounded-xl p-6 mb-8 shadow-sm"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
      >
        <h3 className="text-lg font-semibold mb-4">Upload Dataset</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>CSV File</label>
            <input
              type="file"
              accept=".csv,.json"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dataset name"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Type</label>
            <select
              value={dataType}
              onChange={(e) => setDataType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              {DATA_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            <Upload size={16} />
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>

        {/* Schema info */}
        {schemas && schemas[dataType] && (
          <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <p className="font-medium mb-1">{schemas[dataType].description}</p>
            <p>Required columns: <code>{schemas[dataType].required.join(', ')}</code></p>
            {schemas[dataType].optional.length > 0 && (
              <p>Optional: <code>{schemas[dataType].optional.join(', ')}</code></p>
            )}
          </div>
        )}
      </div>

      {/* Dataset list */}
      <div className="space-y-3">
        {datasets.map((d) => (
          <div key={d.id}>
            <div
              className="flex items-center justify-between px-5 py-4 rounded-xl shadow-sm"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={20} style={{ color: 'var(--accent)' }} />
                <div>
                  <p className="font-medium text-sm">{d.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {d.data_type} · {d.filename}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePreview(d.id)}
                  className="p-2 rounded-lg hover:bg-blue-50 text-blue-500"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Preview table */}
            {previewId === d.id && preview && (
              <div className="mt-2 rounded-lg overflow-x-auto text-xs" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      {preview.columns.map((c: string) => (
                        <th key={c} className="px-3 py-2 text-left font-medium">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.data.map((row: any, i: number) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        {preview.columns.map((c: string) => (
                          <td key={c} className="px-3 py-1.5">{String(row[c] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Showing {preview.data.length} of {preview.total_rows} rows
                </p>
              </div>
            )}
          </div>
        ))}

        {datasets.length === 0 && (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--text-secondary)' }}>
            No datasets uploaded yet. Upload a CSV file above.
          </p>
        )}
      </div>
    </div>
  );
}
