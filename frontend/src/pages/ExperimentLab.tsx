import { useState } from 'react';
import { experimentsApi } from '../api';
import type { TrilaterationRequest, PositionResponse } from '../api';
import { FlaskConical } from 'lucide-react';

type Tab = 'trilateration' | 'fingerprint' | 'pdr' | 'ble' | 'ftm' | 'dfp';

const TABS: { key: Tab; label: string }[] = [
  { key: 'trilateration', label: 'Trilateration' },
  { key: 'fingerprint', label: 'Fingerprinting' },
  { key: 'pdr', label: 'PDR' },
  { key: 'ble', label: 'BLE' },
  { key: 'ftm', label: 'FTM' },
  { key: 'dfp', label: 'Device-Free' },
];

export default function ExperimentLab() {
  const [tab, setTab] = useState<Tab>('trilateration');

  return (
    <div className="flex h-full">
      {/* Tabs */}
      <div
        className="w-52 shrink-0 p-3 space-y-1 overflow-y-auto"
        style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--border)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
          Modules
        </p>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              tab === key ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'
            }`}
            style={tab !== key ? { color: 'var(--text-primary)' } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {tab === 'trilateration' && <TrilaterationPanel />}
        {tab === 'fingerprint' && <PlaceholderPanel name="Fingerprinting" />}
        {tab === 'pdr' && <PlaceholderPanel name="Pedestrian Dead Reckoning" />}
        {tab === 'ble' && <PlaceholderPanel name="BLE Kalman Smoothing" />}
        {tab === 'ftm' && <PlaceholderPanel name="FTM Multilateration" />}
        {tab === 'dfp' && <PlaceholderPanel name="Device-Free Positioning" />}
      </div>
    </div>
  );
}

// ─── Trilateration Panel ─────────────────────────────────────────

function TrilaterationPanel() {
  const [anchors, setAnchors] = useState([
    { x: 0, y: 0, rssi: -45 },
    { x: 10, y: 0, rssi: -55 },
    { x: 5, y: 8, rssi: -50 },
  ]);
  const [A, setA] = useState(-40);
  const [n, setN] = useState(2.0);
  const [solver, setSolver] = useState<'ls' | 'wls'>('ls');
  const [result, setResult] = useState<PositionResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const r = await experimentsApi.trilateration({ anchors, A, n, solver });
      setResult(r.data);
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Error');
    }
    setLoading(false);
  };

  const updateAnchor = (i: number, field: string, val: string) => {
    setAnchors((prev) =>
      prev.map((a, j) => (j === i ? { ...a, [field]: parseFloat(val) || 0 } : a))
    );
  };

  const addAnchor = () => setAnchors((prev) => [...prev, { x: 0, y: 0, rssi: -50 }]);
  const removeAnchor = (i: number) => setAnchors((prev) => prev.filter((_, j) => j !== i));

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">Trilateration</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        RSSI-based position estimation using the Log-Distance Path Loss Model.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Parameters */}
        <div className="space-y-5">
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
          >
            <h3 className="font-semibold text-sm mb-3">Path Loss Parameters</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Reference Power A (dBm)
                </label>
                <input
                  type="number"
                  value={A}
                  onChange={(e) => setA(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Path Loss Exponent (n)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={n}
                  onChange={(e) => setN(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Solver</label>
              <select
                value={solver}
                onChange={(e) => setSolver(e.target.value as 'ls' | 'wls')}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              >
                <option value="ls">Least Squares</option>
                <option value="wls">Weighted Least Squares</option>
              </select>
            </div>
          </div>

          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Anchors</h3>
              <button onClick={addAnchor} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--accent)' }}>
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {anchors.map((a, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 items-center">
                  <input
                    type="number"
                    value={a.x}
                    onChange={(e) => updateAnchor(i, 'x', e.target.value)}
                    placeholder="X"
                    className="px-2 py-1.5 rounded text-xs"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="number"
                    value={a.y}
                    onChange={(e) => updateAnchor(i, 'y', e.target.value)}
                    placeholder="Y"
                    className="px-2 py-1.5 rounded text-xs"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="number"
                    value={a.rssi}
                    onChange={(e) => updateAnchor(i, 'rssi', e.target.value)}
                    placeholder="RSSI"
                    className="px-2 py-1.5 rounded text-xs"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                  <button
                    onClick={() => removeAnchor(i)}
                    disabled={anchors.length <= 3}
                    className="text-xs text-red-500 disabled:opacity-30"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={run}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ background: 'var(--accent)' }}
          >
            <FlaskConical size={16} />
            {loading ? 'Computing...' : 'Run Trilateration'}
          </button>
        </div>

        {/* Result */}
        <div>
          {result && (
            <div
              className="rounded-xl p-5"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
            >
              <h3 className="font-semibold text-sm mb-4">Result</h3>
              <div className="text-center mb-4">
                <p className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>
                  ({result.x.toFixed(3)}, {result.y.toFixed(3)})
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Estimated position (meters)
                </p>
              </div>
              {result.distances && (
                <div className="mt-4">
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Estimated Distances (m):
                  </p>
                  <div className="space-y-1">
                    {result.distances.map((d, i) => (
                      <div
                        key={i}
                        className="flex justify-between px-3 py-1.5 rounded text-xs"
                        style={{ background: 'var(--bg-secondary)' }}
                      >
                        <span>Anchor {i + 1}</span>
                        <span className="font-mono">{d.toFixed(3)} m</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!result && (
            <div
              className="rounded-xl p-12 text-center"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
            >
              <FlaskConical size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Configure parameters and run the experiment
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Placeholder ─────────────────────────────────────────────────

function PlaceholderPanel({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <FlaskConical size={48} className="mx-auto mb-3 opacity-20" />
        <p className="text-lg font-medium">{name}</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Backend API is ready. UI coming soon.
        </p>
      </div>
    </div>
  );
}
