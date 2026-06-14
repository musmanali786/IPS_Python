import { useState, useRef, useMemo } from 'react';
import { experimentsApi } from '../../api';
import type { BLESmoothResponse } from '../../api';
import { Bluetooth, Upload, FileText, Play, Wand2 } from 'lucide-react';
import Plot from 'react-plotly.js';

/** Parse RSSI values from CSV/text: accepts an 'rssi' column or one number per line. */
function parseRssiFile(text: string): number[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rssiCol = headers.indexOf('rssi');
  const values: number[] = [];

  if (rssiCol >= 0) {
    for (let i = 1; i < lines.length; i++) {
      const v = parseFloat(lines[i].split(',')[rssiCol]);
      if (!isNaN(v)) values.push(v);
    }
  } else {
    // Plain list: one value per line (or comma-separated)
    for (const line of lines) {
      for (const cell of line.split(/[,;\s]+/)) {
        const v = parseFloat(cell);
        if (!isNaN(v)) values.push(v);
      }
    }
  }
  return values;
}

function generateNoisyRssi(n = 120): number[] {
  // Beacon at ~3 m, walking closer then away, with heavy Gaussian-ish noise
  const values: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const trueRssi = -55 - 20 * Math.abs(Math.sin(Math.PI * t)); // -55 → -75 → -55
    const noise = (Math.random() + Math.random() + Math.random() - 1.5) * 6;
    values.push(Math.round((trueRssi + noise) * 10) / 10);
  }
  return values;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
}

export default function ExperimentBLELab() {
  const [rssiValues, setRssiValues] = useState<number[]>([]);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');

  // Parameters
  const [method, setMethod] = useState<'kalman' | 'moving_average'>('kalman');
  const [processNoise, setProcessNoise] = useState(1.0);
  const [measurementNoise, setMeasurementNoise] = useState(5.0);
  const [windowSize, setWindowSize] = useState(5);

  // Results
  const [result, setResult] = useState<BLESmoothResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const values = parseRssiFile(String(e.target?.result || ''));
      if (values.length === 0) {
        alert("Could not parse RSSI values. Provide a CSV with an 'rssi' column or one value per line.");
        return;
      }
      setRssiValues(values);
      setSourceLabel(`${file.name} (${values.length} readings)`);
      setRawText('');
    };
    reader.readAsText(file);
  };

  const applyRawText = (text: string) => {
    setRawText(text);
    const values = parseRssiFile(text);
    setRssiValues(values);
    setSourceLabel(values.length > 0 ? `Pasted values (${values.length} readings)` : null);
  };

  const generateDemo = () => {
    const values = generateNoisyRssi();
    setRssiValues(values);
    setSourceLabel(`Synthetic BLE beacon (${values.length} readings)`);
    setRawText('');
  };

  const run = async () => {
    if (rssiValues.length === 0) {
      alert('Provide RSSI values first (upload, paste, or generate demo data).');
      return;
    }
    setLoading(true);
    try {
      const r = await experimentsApi.bleSmooth({
        rssi_values: rssiValues,
        method,
        process_noise: processNoise,
        measurement_noise: measurementNoise,
        window_size: windowSize,
      });
      setResult(r.data);
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      alert(err.response?.data?.detail || 'Error running BLE smoothing');
    }
    setLoading(false);
  };

  const stats = useMemo(() => {
    if (!result) return null;
    return {
      rawStd: stdDev(result.original),
      smoothStd: stdDev(result.smoothed),
      mean: result.original.reduce((a, b) => a + b, 0) / result.original.length,
    };
  }, [result]);

  const inputStyle = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  } as const;

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">BLE Kalman Smoothing Lab</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Filter noisy BLE RSSI time series with a 1-D Kalman filter or a moving average.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left: Inputs + Parameters ────────────────────────── */}
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Upload size={14} /> RSSI Data
            </h3>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
              onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs mb-2 transition-colors hover:opacity-80"
              style={inputStyle}>
              <FileText size={14} className={rssiValues.length > 0 ? 'text-green-500' : 'opacity-40'} />
              <span className="flex-1 text-left truncate">
                {sourceLabel ?? "RSSI CSV ('rssi' column or one value/line)"}
              </span>
              {rssiValues.length > 0 && <span className="text-green-500 text-[10px]">✓</span>}
            </button>
            <button onClick={generateDemo}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs mb-3 transition-colors hover:opacity-80"
              style={inputStyle}>
              <Wand2 size={14} className="opacity-60" />
              <span className="flex-1 text-left">Generate noisy beacon data</span>
            </button>
            <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>
              Or paste values (comma / newline separated)
            </label>
            <textarea value={rawText} onChange={(e) => applyRawText(e.target.value)}
              rows={3} placeholder="-61, -65, -58, -70, ..."
              className="w-full px-3 py-2 rounded-lg text-xs font-mono resize-y" style={inputStyle} />
          </div>

          <div className="rounded-xl p-5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold text-sm mb-3">Filter Parameters</h3>
            <div className="mb-3">
              <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value as 'kalman' | 'moving_average')}
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                <option value="kalman">Kalman Filter</option>
                <option value="moving_average">Moving Average</option>
              </select>
            </div>
            {method === 'kalman' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Process Noise (Q)</label>
                  <input type="number" step="0.1" min="0" value={processNoise}
                    onChange={(e) => setProcessNoise(parseFloat(e.target.value) || 0.1)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Measurement Noise (R)</label>
                  <input type="number" step="0.5" min="0" value={measurementNoise}
                    onChange={(e) => setMeasurementNoise(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                </div>
                <p className="col-span-2 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                  Lower Q / higher R → smoother but slower to react. Higher Q / lower R → follows raw signal closely.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Window Size</label>
                <input type="number" min="1" max="50" value={windowSize}
                  onChange={(e) => setWindowSize(parseInt(e.target.value) || 5)}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
            )}
          </div>

          <button onClick={run} disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ background: 'var(--accent)' }}>
            <Play size={16} />
            {loading ? 'Smoothing...' : 'Run Smoothing'}
          </button>
        </div>

        {/* ── Right: Results ───────────────────────────────────── */}
        <div className="xl:col-span-2">
          {result && stats ? (
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Readings', value: result.original.length },
                  { label: 'Mean RSSI', value: `${stats.mean.toFixed(1)} dBm` },
                  { label: 'Raw Std Dev', value: `${stats.rawStd.toFixed(2)} dB` },
                  { label: 'Smoothed Std Dev', value: `${stats.smoothStd.toFixed(2)} dB` },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg px-4 py-3 text-center"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                    <p className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{s.value}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Signal plot */}
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <h3 className="font-semibold text-sm mb-3">Raw vs. Smoothed RSSI</h3>
                <Plot
                  data={[
                    {
                      y: result.original,
                      type: 'scatter',
                      mode: 'lines+markers',
                      name: 'Raw RSSI',
                      line: { color: '#94a3b8', width: 1 },
                      marker: { size: 4, color: '#94a3b8' },
                    },
                    {
                      y: result.smoothed,
                      type: 'scatter',
                      mode: 'lines',
                      name: method === 'kalman' ? 'Kalman' : `Moving Avg (${windowSize})`,
                      line: { color: '#3b82f6', width: 2.5 },
                    },
                  ]}
                  layout={{
                    xaxis: { title: { text: 'Sample #' }, showgrid: true },
                    yaxis: { title: { text: 'RSSI (dBm)' } },
                    margin: { l: 50, r: 20, t: 30, b: 40 },
                    hovermode: 'x unified',
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: 'var(--text-primary)' },
                    legend: { orientation: 'h', y: 1.1 },
                  }}
                  config={{ responsive: true }}
                  style={{ height: '420px' }}
                />
              </div>

              {/* Noise reduction summary */}
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <h3 className="font-semibold text-sm mb-2">Noise Reduction</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Standard deviation reduced from <strong style={{ color: 'var(--text-primary)' }}>{stats.rawStd.toFixed(2)} dB</strong> to{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{stats.smoothStd.toFixed(2)} dB</strong>
                  {stats.rawStd > 0 && (
                    <> — a <strong style={{ color: '#10b981' }}>
                      {(100 * (1 - stats.smoothStd / stats.rawStd)).toFixed(0)}%
                    </strong> reduction in signal variance.</>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-16 text-center h-full flex items-center justify-center"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
              <div>
                <Bluetooth size={56} className="mx-auto mb-4 opacity-15" />
                <p className="text-base font-medium mb-2">BLE RSSI Smoothing</p>
                <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
                  BLE RSSI readings are notoriously noisy. Upload or paste a sequence of readings
                  and compare a Kalman filter against a simple moving average.
                </p>
                <div className="mt-6 text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
                  <p><strong>Input:</strong> CSV with an 'rssi' column, or plain numbers</p>
                  <p><strong>Tip:</strong> use the demo generator to try it instantly</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
