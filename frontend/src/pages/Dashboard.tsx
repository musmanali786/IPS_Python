import { useEffect, useState } from 'react';
import { mapsApi, datasetsApi } from '../api';
import type { FloorMapListItem, DatasetListItem } from '../api';
import { Map, Database, FlaskConical, CheckCircle2 } from 'lucide-react';

export default function Dashboard() {
  const [maps, setMaps] = useState<FloorMapListItem[]>([]);
  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);

  useEffect(() => {
    mapsApi.list().then((r) => setMaps(r.data)).catch(() => {});
    datasetsApi.list().then((r) => setDatasets(r.data)).catch(() => {});
  }, []);

  const calibratedCount = maps.filter((m) => m.is_calibrated).length;

  const cards = [
    { label: 'Floor Maps', value: maps.length, icon: Map, color: '#3b82f6' },
    { label: 'Calibrated', value: calibratedCount, icon: CheckCircle2, color: '#22c55e' },
    { label: 'Datasets', value: datasets.length, icon: Database, color: '#a855f7' },
    { label: 'Experiments', value: '—', icon: FlaskConical, color: '#f59e0b' },
  ];

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl p-5 shadow-sm"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {label}
              </span>
              <Icon size={20} style={{ color }} />
            </div>
            <p className="text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-6 shadow-sm" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
        <h3 className="text-lg font-semibold mb-4">Getting Started</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <li>Go to <strong>Map Setup</strong> to upload and calibrate a floor plan.</li>
          <li>Upload sensor datasets via the <strong>Dataset Manager</strong>.</li>
          <li>Head to the <strong>Experiment Lab</strong> to run positioning algorithms.</li>
          <li>Compare results in the <strong>Results Gallery</strong>.</li>
        </ol>
      </div>
    </div>
  );
}
