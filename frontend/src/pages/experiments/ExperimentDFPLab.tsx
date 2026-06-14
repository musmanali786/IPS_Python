import { useState, useRef } from 'react';
import { experimentsApi } from '../../api';
import type { DFPResponse } from '../../api';
import { RadioTower, Upload, FileText, Play, Wand2 } from 'lucide-react';
import Plot from 'react-plotly.js';

/**
 * Parse a link-matrix CSV: each row is one time sample, each column one
 * TX→RX link's RSSI. A header row (non-numeric) is skipped automatically.
 */
function parseLinkMatrix(text: string): number[][] {
  const rows: number[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = line.split(/[,;]/).map((c) => parseFloat(c.trim()));
    if (cells.some((v) => isNaN(v))) continue; // skip header / malformed rows
    rows.push(cells);
  }
  // Keep only rows matching the most common width
  if (rows.length === 0) return [];
  const width = rows[0].length;
  return rows.filter((r) => r.length === width);
}

function generateDemoData(links = 8, samples = 60): { baseline: number[][]; active: number[][] } {
  const means = Array.from({ length: links }, () => -50 - Math.random() * 20);
  const noise = () => (Math.random() + Math.random() - 1) * 1.5;
  const baseline = Array.from({ length: samples }, () => means.map((m) => Math.round((m + noise()) * 10) / 10));
  // A person standing near links 2 and 3: shifted mean + extra variance
  const disturbed = new Set([2, 3]);
  const active = Array.from({ length: samples }, () =>
    means.map((m, l) => {
      const shadow = disturbed.has(l) ? -7 + (Math.random() - 0.5) * 6 : 0;
      return Math.round((m + shadow + noise()) * 10) / 10;
    }),
  );
  return { baseline, active };
}

export default function ExperimentDFPLab() {
  const [baseline, setBaseline] = useState<number[][]>([]);
  const [active, setActive] = useState<number[][]>([]);
  const [baselineLabel, setBaselineLabel] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const [thresholdSigma, setThresholdSigma] = useState(2.0);

  const [result, setResult] = useState<DFPResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const baselineRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLInputElement>(null);

  const loadFile = (file: File, target: 'baseline' | 'active') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const matrix = parseLinkMatrix(String(e.target?.result || ''));
      if (matrix.length === 0) {
        alert('Could not parse CSV. Expected numeric rows: one time sample per row, one link per column.');
        return;
      }
      const label = `${file.name} (${matrix.length} samples × ${matrix[0].length} links)`;
      if (target === 'baseline') {
        setBaseline(matrix);
        setBaselineLabel(label);
      } else {
        setActive(matrix);
        setActiveLabel(label);
      }
    };
    reader.readAsText(file);
  };

  const generateDemo = () => {
    const demo = generateDemoData();
    setBaseline(demo.baseline);
    setActive(demo.active);
    setBaselineLabel(`Synthetic empty room (${demo.baseline.length} × ${demo.baseline[0].length})`);
    setActiveLabel(`Synthetic occupied room (${demo.active.length} × ${demo.active[0].length}, links 3 & 4 disturbed)`);
  };

  const run = async () => {
    if (baseline.length === 0 || active.length === 0) {
      alert('Provide both baseline (empty room) and active (occupied) captures.');
      return;
    }
    if (baseline[0].length !== active[0].length) {
      alert(`Link count mismatch: baseline has ${baseline[0].length} links, active has ${active[0].length}.`);
      return;
    }
    setLoading(true);
    try {
      const r = await experimentsApi.dfp({
        baseline_rssi: baseline,
        active_rssi: active,
        threshold_sigma: thresholdSigma,
      });
      setResult(r.data);
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      alert(err.response?.data?.detail || 'Error running device-free positioning analysis');
    }
    setLoading(false);
  };

  const inputStyle = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  } as const;

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">Device-Free Positioning Lab</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Detect human presence without a carried device by comparing RSSI link statistics
        between an empty-room baseline and an active capture.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left: Inputs + Parameters ────────────────────────── */}
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Upload size={14} /> Link RSSI Captures
            </h3>
            <input ref={baselineRef} type="file" accept=".csv,.txt" className="hidden"
              onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0], 'baseline')} />
            <button onClick={() => baselineRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs mb-2 transition-colors hover:opacity-80"
              style={inputStyle}>
              <FileText size={14} className={baseline.length > 0 ? 'text-green-500' : 'opacity-40'} />
              <span className="flex-1 text-left truncate">
                {baselineLabel ?? 'Baseline CSV (empty room, rows×links)'}
              </span>
              {baseline.length > 0 && <span className="text-green-500 text-[10px]">✓</span>}
            </button>
            <input ref={activeRef} type="file" accept=".csv,.txt" className="hidden"
              onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0], 'active')} />
            <button onClick={() => activeRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs mb-2 transition-colors hover:opacity-80"
              style={inputStyle}>
              <FileText size={14} className={active.length > 0 ? 'text-green-500' : 'opacity-40'} />
              <span className="flex-1 text-left truncate">
                {activeLabel ?? 'Active CSV (occupied room, rows×links)'}
              </span>
              {active.length > 0 && <span className="text-green-500 text-[10px]">✓</span>}
            </button>
            <button onClick={generateDemo}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs transition-colors hover:opacity-80"
              style={inputStyle}>
              <Wand2 size={14} className="opacity-60" />
              <span className="flex-1 text-left">Generate demo captures (8 links)</span>
            </button>
          </div>

          <div className="rounded-xl p-5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold text-sm mb-3">Detection Parameters</h3>
            <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>
              Threshold (σ) — z-score above which a link is flagged
            </label>
            <input type="number" step="0.1" min="0.5" value={thresholdSigma}
              onChange={(e) => setThresholdSigma(parseFloat(e.target.value) || 2)}
              className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          </div>

          <button onClick={run} disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ background: 'var(--accent)' }}>
            <Play size={16} />
            {loading ? 'Analyzing Links...' : 'Detect Presence'}
          </button>

          {result && (
            <div className="rounded-xl p-5 text-center"
              style={{
                background: 'var(--bg-primary)',
                border: `1px solid ${result.affected_links.length > 0 ? '#ef4444' : '#10b981'}`,
              }}>
              <p className="text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Detection Result</p>
              {result.affected_links.length > 0 ? (
                <>
                  <p className="text-lg font-bold" style={{ color: '#ef4444' }}>Presence Detected</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Affected links: {result.affected_links.map((l) => `#${l + 1}`).join(', ')}
                  </p>
                </>
              ) : (
                <p className="text-lg font-bold" style={{ color: '#10b981' }}>No Presence Detected</p>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Results ───────────────────────────────────── */}
        <div className="xl:col-span-2">
          {result ? (
            <div className="space-y-4">
              {/* Z-scores per link */}
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <h3 className="font-semibold text-sm mb-3">Z-Score per Link (mean shift vs. baseline)</h3>
                <Plot
                  data={[
                    {
                      x: result.z_scores.map((_, i) => `Link ${i + 1}`),
                      y: result.z_scores,
                      type: 'bar',
                      marker: {
                        color: result.z_scores.map((z) => (z > thresholdSigma ? '#ef4444' : '#3b82f6')),
                      },
                      name: 'Z-score',
                    },
                    {
                      x: result.z_scores.map((_, i) => `Link ${i + 1}`),
                      y: result.z_scores.map(() => thresholdSigma),
                      type: 'scatter',
                      mode: 'lines',
                      name: `Threshold (${thresholdSigma}σ)`,
                      line: { color: '#f59e0b', width: 2, dash: 'dash' },
                    },
                  ]}
                  layout={{
                    yaxis: { title: { text: 'Z-score' } },
                    margin: { l: 50, r: 20, t: 10, b: 60 },
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: 'var(--text-primary)' },
                    legend: { orientation: 'h', y: 1.12 },
                  }}
                  config={{ responsive: true }}
                  style={{ height: '320px' }}
                />
              </div>

              {/* Variance ratio per link */}
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <h3 className="font-semibold text-sm mb-3">Variance Ratio per Link (active / baseline)</h3>
                <Plot
                  data={[
                    {
                      x: result.variance_ratio.map((_, i) => `Link ${i + 1}`),
                      y: result.variance_ratio,
                      type: 'bar',
                      marker: { color: '#8b5cf6' },
                      name: 'Variance ratio',
                    },
                    {
                      x: result.variance_ratio.map((_, i) => `Link ${i + 1}`),
                      y: result.variance_ratio.map(() => 1),
                      type: 'scatter',
                      mode: 'lines',
                      name: 'Baseline (1.0)',
                      line: { color: 'var(--text-secondary)', width: 1.5, dash: 'dot' },
                    },
                  ]}
                  layout={{
                    yaxis: { title: { text: 'σ²(active) / σ²(baseline)' } },
                    margin: { l: 50, r: 20, t: 10, b: 60 },
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: 'var(--text-primary)' },
                    legend: { orientation: 'h', y: 1.12 },
                  }}
                  config={{ responsive: true }}
                  style={{ height: '320px' }}
                />
              </div>

              {/* Per-link table */}
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <h3 className="font-semibold text-sm mb-3">Per-Link Summary</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th className="text-left py-2 px-2">Link</th>
                        <th className="text-left py-2 px-2">Z-Score</th>
                        <th className="text-left py-2 px-2">Variance Ratio</th>
                        <th className="text-left py-2 px-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.z_scores.map((z, i) => {
                        const affected = result.affected_links.includes(i);
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td className="py-2 px-2 font-medium">Link {i + 1}</td>
                            <td className="py-2 px-2 font-mono">{z.toFixed(2)}</td>
                            <td className="py-2 px-2 font-mono">{result.variance_ratio[i].toFixed(2)}</td>
                            <td className="py-2 px-2 font-bold" style={{ color: affected ? '#ef4444' : '#10b981' }}>
                              {affected ? 'AFFECTED' : 'normal'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-16 text-center h-full flex items-center justify-center"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
              <div>
                <RadioTower size={56} className="mx-auto mb-4 opacity-15" />
                <p className="text-base font-medium mb-2">Device-Free Positioning</p>
                <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
                  A human body attenuates RF links (typically 3–10 dB of shadowing). Upload an
                  empty-room baseline and an active capture to find which links are disturbed.
                </p>
                <div className="mt-6 text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
                  <p><strong>CSV format:</strong> one time sample per row, one link (TX→RX pair) per column</p>
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
