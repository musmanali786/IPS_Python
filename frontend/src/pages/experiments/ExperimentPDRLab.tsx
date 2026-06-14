import { useState, useRef } from 'react';
import { experimentsApi } from '../../api';
import type { PDRResponse } from '../../api';
import { Footprints, Upload, FileText, Play, Wand2 } from 'lucide-react';
import Plot from 'react-plotly.js';

type IMUData = {
  acc_x: number[];
  acc_y: number[];
  acc_z: number[];
  gyro_z?: number[];
  mag_heading?: number[];
};

/** Parse an IMU CSV with headers (acc_x, acc_y, acc_z, optional gyro_z, mag_heading). */
function parseImuCsv(text: string): IMUData | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const col = (name: string) => headers.indexOf(name);
  const ix = col('acc_x'), iy = col('acc_y'), iz = col('acc_z');
  if (ix < 0 || iy < 0 || iz < 0) return null;
  const ig = col('gyro_z');
  const im = col('mag_heading');

  const data: IMUData = { acc_x: [], acc_y: [], acc_z: [] };
  if (ig >= 0) data.gyro_z = [];
  if (im >= 0) data.mag_heading = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const ax = parseFloat(cells[ix]), ay = parseFloat(cells[iy]), az = parseFloat(cells[iz]);
    if (isNaN(ax) || isNaN(ay) || isNaN(az)) continue;
    data.acc_x.push(ax);
    data.acc_y.push(ay);
    data.acc_z.push(az);
    if (ig >= 0) data.gyro_z!.push(parseFloat(cells[ig]) || 0);
    if (im >= 0) data.mag_heading!.push(parseFloat(cells[im]) || 0);
  }
  return data.acc_x.length > 0 ? data : null;
}

/** Synthetic walk: sinusoidal step bumps at ~2 Hz with a slow turn. */
function generateDemoWalk(sampleRate: number, seconds = 30): IMUData {
  const n = sampleRate * seconds;
  const stepFreq = 2.0; // steps per second
  const data: IMUData = { acc_x: [], acc_y: [], acc_z: [], gyro_z: [] };
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const stepPhase = Math.sin(2 * Math.PI * stepFreq * t);
    const bump = Math.max(0, stepPhase) ** 3 * 4; // sharp positive bumps
    data.acc_x.push(0.3 * Math.sin(2 * Math.PI * 0.5 * t) + (Math.random() - 0.5) * 0.2);
    data.acc_y.push((Math.random() - 0.5) * 0.2);
    data.acc_z.push(9.81 + bump + (Math.random() - 0.5) * 0.4);
    // Slow continuous turn: full circle over the walk
    data.gyro_z!.push((2 * Math.PI) / seconds + (Math.random() - 0.5) * 0.02);
  }
  return data;
}

export default function ExperimentPDRLab() {
  const [imuData, setImuData] = useState<IMUData | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);

  // Parameters
  const [samplingRate, setSamplingRate] = useState(100);
  const [peakHeight, setPeakHeight] = useState(10.5);
  const [peakDistance, setPeakDistance] = useState(30);
  const [strideMethod, setStrideMethod] = useState<'weinberg' | 'height'>('weinberg');
  const [userHeight, setUserHeight] = useState(1.75);
  const [weinbergK, setWeinbergK] = useState(0.41);
  const [alpha, setAlpha] = useState(0.98);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);

  // Results
  const [result, setResult] = useState<PDRResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const loadCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseImuCsv(String(e.target?.result || ''));
      if (!parsed) {
        alert('Could not parse CSV. Expected headers: acc_x, acc_y, acc_z (optional: gyro_z, mag_heading).');
        return;
      }
      setImuData(parsed);
      setSourceLabel(`${file.name} (${parsed.acc_x.length} samples)`);
    };
    reader.readAsText(file);
  };

  const generateDemo = () => {
    const demo = generateDemoWalk(samplingRate);
    setImuData(demo);
    setSourceLabel(`Synthetic walk (${demo.acc_x.length} samples, 2 steps/s, slow turn)`);
  };

  const run = async () => {
    if (!imuData) {
      alert('Upload an IMU CSV or generate demo data first.');
      return;
    }
    setLoading(true);
    try {
      const r = await experimentsApi.pdr({
        ...imuData,
        sampling_rate: samplingRate,
        peak_height: peakHeight,
        peak_distance: peakDistance,
        stride_method: strideMethod,
        user_height_m: userHeight,
        weinberg_K: weinbergK,
        complementary_alpha: alpha,
        start_x: startX,
        start_y: startY,
      });
      setResult(r.data);
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      alert(err.response?.data?.detail || 'Error running PDR experiment');
    }
    setLoading(false);
  };

  const totalDistance = result
    ? result.stride_lengths.reduce((a, b) => a + b, 0)
    : 0;

  const inputStyle = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  } as const;

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">Pedestrian Dead Reckoning Lab</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Detect steps from accelerometer data, estimate stride lengths, and reconstruct the walking trajectory.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left: Inputs + Parameters ────────────────────────── */}
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Upload size={14} /> IMU Data
            </h3>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
              onChange={(e) => e.target.files?.[0] && loadCsv(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs mb-2 transition-colors hover:opacity-80"
              style={inputStyle}>
              <FileText size={14} className={imuData ? 'text-green-500' : 'opacity-40'} />
              <span className="flex-1 text-left truncate">
                {sourceLabel ?? 'IMU CSV (acc_x, acc_y, acc_z, [gyro_z], [mag_heading])'}
              </span>
              {imuData && <span className="text-green-500 text-[10px]">✓</span>}
            </button>
            <button onClick={generateDemo}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs transition-colors hover:opacity-80"
              style={inputStyle}>
              <Wand2 size={14} className="opacity-60" />
              <span className="flex-1 text-left">Generate synthetic walk data</span>
            </button>
          </div>

          <div className="rounded-xl p-5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold text-sm mb-3">Step Detection</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Sampling Rate (Hz)</label>
                <input type="number" value={samplingRate} onChange={(e) => setSamplingRate(parseFloat(e.target.value) || 100)}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Peak Height (m/s²)</label>
                <input type="number" step="0.5" value={peakHeight} onChange={(e) => setPeakHeight(parseFloat(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Min Peak Distance (samples)</label>
                <input type="number" value={peakDistance} onChange={(e) => setPeakDistance(parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
            </div>
          </div>

          <div className="rounded-xl p-5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold text-sm mb-3">Stride &amp; Heading</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Stride Method</label>
                <select value={strideMethod} onChange={(e) => setStrideMethod(e.target.value as 'weinberg' | 'height')}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                  <option value="weinberg">Weinberg</option>
                  <option value="height">Height-based</option>
                </select>
              </div>
              {strideMethod === 'weinberg' ? (
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Weinberg K</label>
                  <input type="number" step="0.01" value={weinbergK} onChange={(e) => setWeinbergK(parseFloat(e.target.value) || 0.41)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>User Height (m)</label>
                  <input type="number" step="0.01" value={userHeight} onChange={(e) => setUserHeight(parseFloat(e.target.value) || 1.75)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                </div>
              )}
              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Filter α (gyro trust)</label>
                <input type="number" step="0.01" min="0" max="1" value={alpha} onChange={(e) => setAlpha(parseFloat(e.target.value) || 0.98)}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Start X</label>
                  <input type="number" value={startX} onChange={(e) => setStartX(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-2 rounded-lg text-sm" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Start Y</label>
                  <input type="number" value={startY} onChange={(e) => setStartY(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-2 rounded-lg text-sm" style={inputStyle} />
                </div>
              </div>
            </div>
          </div>

          <button onClick={run} disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ background: 'var(--accent)' }}>
            <Play size={16} />
            {loading ? 'Computing Trajectory...' : 'Run PDR'}
          </button>
        </div>

        {/* ── Right: Results ───────────────────────────────────── */}
        <div className="xl:col-span-2">
          {result ? (
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Steps Detected', value: result.step_count },
                  { label: 'Total Distance', value: `${totalDistance.toFixed(2)} m` },
                  {
                    label: 'Avg Stride',
                    value: result.step_count > 0 ? `${(totalDistance / result.step_count).toFixed(2)} m` : '—',
                  },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg px-4 py-3 text-center"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                    <p className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{s.value}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Trajectory plot */}
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <h3 className="font-semibold text-sm mb-3">Reconstructed Trajectory</h3>
                <Plot
                  data={[
                    {
                      x: result.trajectory.map((p) => p[0]),
                      y: result.trajectory.map((p) => p[1]),
                      type: 'scatter',
                      mode: 'lines+markers',
                      name: 'Trajectory',
                      line: { color: '#3b82f6', width: 2 },
                      marker: { size: 5, color: '#3b82f6' },
                    },
                    {
                      x: [result.trajectory[0][0]],
                      y: [result.trajectory[0][1]],
                      type: 'scatter',
                      mode: 'markers',
                      name: 'Start',
                      marker: { size: 14, color: '#10b981', symbol: 'circle' },
                    },
                    {
                      x: [result.trajectory[result.trajectory.length - 1][0]],
                      y: [result.trajectory[result.trajectory.length - 1][1]],
                      type: 'scatter',
                      mode: 'markers',
                      name: 'End',
                      marker: { size: 14, color: '#ef4444', symbol: 'square' },
                    },
                  ]}
                  layout={{
                    xaxis: { title: { text: 'X (m)' }, showgrid: true, scaleanchor: 'y' },
                    yaxis: { title: { text: 'Y (m)' }, showgrid: true },
                    margin: { l: 50, r: 20, t: 30, b: 40 },
                    hovermode: 'closest',
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: 'var(--text-primary)' },
                  }}
                  config={{ responsive: true }}
                  style={{ height: '440px' }}
                />
              </div>

              {/* Stride lengths */}
              {result.stride_lengths.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                  <h3 className="font-semibold text-sm mb-3">Stride Length per Step</h3>
                  <Plot
                    data={[
                      {
                        x: result.stride_lengths.map((_, i) => i + 1),
                        y: result.stride_lengths,
                        type: 'bar',
                        marker: { color: '#8b5cf6' },
                        name: 'Stride (m)',
                      },
                    ]}
                    layout={{
                      xaxis: { title: { text: 'Step #' }, showgrid: false },
                      yaxis: { title: { text: 'Stride Length (m)' } },
                      margin: { l: 50, r: 20, t: 10, b: 40 },
                      paper_bgcolor: 'transparent',
                      plot_bgcolor: 'transparent',
                      font: { color: 'var(--text-primary)' },
                    }}
                    config={{ responsive: true }}
                    style={{ height: '240px' }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl p-16 text-center h-full flex items-center justify-center"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
              <div>
                <Footprints size={56} className="mx-auto mb-4 opacity-15" />
                <p className="text-base font-medium mb-2">Pedestrian Dead Reckoning</p>
                <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
                  Upload accelerometer/gyroscope data (or generate a synthetic walk) to detect steps,
                  estimate stride lengths with the Weinberg model, and reconstruct the walking path.
                </p>
                <div className="mt-6 text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
                  <p><strong>CSV columns:</strong> acc_x, acc_y, acc_z (required)</p>
                  <p><strong>Optional:</strong> gyro_z (rad/s), mag_heading (rad)</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
