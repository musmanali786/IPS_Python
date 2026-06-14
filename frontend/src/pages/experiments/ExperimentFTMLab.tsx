import { useState } from 'react';
import { experimentsApi } from '../../api';
import type { PositionResponse } from '../../api';
import { Ruler, Play, Plus, Trash2 } from 'lucide-react';

type FTMAnchor = { x: number; y: number; distance_m: number };

const SPEED_OF_LIGHT = 299_792_458; // m/s
const ANCHOR_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function ExperimentFTMLab() {
  const [anchors, setAnchors] = useState<FTMAnchor[]>([
    { x: 0, y: 0, distance_m: 7.1 },
    { x: 10, y: 0, distance_m: 7.1 },
    { x: 5, y: 10, distance_m: 5.0 },
  ]);
  const [rttInput, setRttInput] = useState('');

  // Results
  const [result, setResult] = useState<PositionResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const updateAnchor = (i: number, field: keyof FTMAnchor, value: number) => {
    setAnchors((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));
    setResult(null);
  };

  const addAnchor = () => {
    setAnchors((prev) => [...prev, { x: 0, y: 0, distance_m: 5 }]);
    setResult(null);
  };

  const removeAnchor = (i: number) => {
    setAnchors((prev) => prev.filter((_, idx) => idx !== i));
    setResult(null);
  };

  const rttToDistance = (rttNs: number) => (rttNs * 1e-9 * SPEED_OF_LIGHT) / 2;

  const run = async () => {
    if (anchors.length < 3) {
      alert('At least 3 FTM anchors are required for multilateration.');
      return;
    }
    setLoading(true);
    try {
      const r = await experimentsApi.ftm({ anchors });
      setResult(r.data);
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      alert(err.response?.data?.detail || 'Error running FTM multilateration');
    }
    setLoading(false);
  };

  // ── SVG view box that fits anchors, circles and estimate ──────
  const SVG_SIZE = 560;
  const MARGIN = 50;
  const xs = anchors.map((a) => a.x);
  const ys = anchors.map((a) => a.y);
  const maxReach = Math.max(...anchors.map((a) => a.distance_m), 1);
  const minX = Math.min(...xs, result ? result.x : Infinity) - maxReach * 0.3;
  const maxX = Math.max(...xs, result ? result.x : -Infinity) + maxReach * 0.3;
  const minY = Math.min(...ys, result ? result.y : Infinity) - maxReach * 0.3;
  const maxY = Math.max(...ys, result ? result.y : -Infinity) + maxReach * 0.3;
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const scale = (SVG_SIZE - 2 * MARGIN) / span;
  const toSvgX = (x: number) => MARGIN + (x - minX) * scale;
  const toSvgY = (y: number) => SVG_SIZE - MARGIN - (y - minY) * scale;

  const inputStyle = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  } as const;

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">FTM Multilateration Lab</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        WiFi 802.11mc Fine Time Measurement gives direct distances — no path-loss model needed.
        Enter anchor positions and measured distances to estimate the device position.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left: Anchor Table ───────────────────────────────── */}
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">FTM Anchors (Responders)</h3>
              <button onClick={addAnchor}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors hover:opacity-80"
                style={{ color: 'var(--accent)' }}>
                <Plus size={13} /> Add
              </button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1fr_1.2fr_28px] gap-2 text-[10px] px-1"
                style={{ color: 'var(--text-secondary)' }}>
                <span>X (m)</span><span>Y (m)</span><span>Distance (m)</span><span />
              </div>
              {anchors.map((a, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1.2fr_28px] gap-2 items-center">
                  <input type="number" step="0.1" value={a.x}
                    onChange={(e) => updateAnchor(i, 'x', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 rounded-lg text-xs" style={inputStyle} />
                  <input type="number" step="0.1" value={a.y}
                    onChange={(e) => updateAnchor(i, 'y', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 rounded-lg text-xs" style={inputStyle} />
                  <input type="number" step="0.1" min="0" value={a.distance_m}
                    onChange={(e) => updateAnchor(i, 'distance_m', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 rounded-lg text-xs" style={inputStyle} />
                  <button onClick={() => removeAnchor(i)} disabled={anchors.length <= 3}
                    className="p-1 rounded transition-colors hover:opacity-70 disabled:opacity-20"
                    title={anchors.length <= 3 ? 'Minimum 3 anchors' : 'Remove anchor'}>
                    <Trash2 size={13} style={{ color: '#ef4444' }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* RTT converter */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Ruler size={14} /> RTT → Distance Converter
            </h3>
            <p className="text-[11px] mb-2" style={{ color: 'var(--text-secondary)' }}>
              d = (RTT × c) / 2 — convert a measured round-trip time to distance.
            </p>
            <div className="flex items-center gap-2">
              <input type="number" value={rttInput} onChange={(e) => setRttInput(e.target.value)}
                placeholder="RTT in ns"
                className="flex-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              <span className="text-sm font-mono font-bold" style={{ color: 'var(--accent)' }}>
                {rttInput && !isNaN(parseFloat(rttInput))
                  ? `${rttToDistance(parseFloat(rttInput)).toFixed(2)} m`
                  : '— m'}
              </span>
            </div>
          </div>

          <button onClick={run} disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ background: 'var(--accent)' }}>
            <Play size={16} />
            {loading ? 'Solving...' : 'Run Multilateration'}
          </button>

          {result && (
            <div className="rounded-xl p-5 text-center" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
              <p className="text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Estimated Position</p>
              <p className="text-2xl font-bold font-mono" style={{ color: '#10b981' }}>
                ({result.x.toFixed(2)}, {result.y.toFixed(2)})
              </p>
            </div>
          )}
        </div>

        {/* ── Right: Visualization ─────────────────────────────── */}
        <div className="xl:col-span-2">
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold text-sm mb-3">Anchor Geometry &amp; Solution</h3>
            <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} className="w-full" style={{ maxHeight: '560px' }}>
              {/* Distance circles */}
              {anchors.map((a, i) => (
                <circle key={`circle-${i}`}
                  cx={toSvgX(a.x)} cy={toSvgY(a.y)} r={a.distance_m * scale}
                  fill={ANCHOR_COLORS[i % ANCHOR_COLORS.length]} fillOpacity={0.05}
                  stroke={ANCHOR_COLORS[i % ANCHOR_COLORS.length]}
                  strokeWidth={1.5} strokeDasharray="6,3" opacity={0.7} />
              ))}

              {/* Lines from anchors to estimate */}
              {result && anchors.map((a, i) => (
                <line key={`line-${i}`}
                  x1={toSvgX(a.x)} y1={toSvgY(a.y)}
                  x2={toSvgX(result.x)} y2={toSvgY(result.y)}
                  stroke="var(--text-secondary)" strokeWidth={1} strokeDasharray="2,3" opacity={0.5} />
              ))}

              {/* Anchors */}
              {anchors.map((a, i) => (
                <g key={`anchor-${i}`}>
                  <rect x={toSvgX(a.x) - 7} y={toSvgY(a.y) - 7} width={14} height={14} rx={3}
                    fill={ANCHOR_COLORS[i % ANCHOR_COLORS.length]} stroke="white" strokeWidth={2} />
                  <text x={toSvgX(a.x)} y={toSvgY(a.y) - 13} textAnchor="middle"
                    fill={ANCHOR_COLORS[i % ANCHOR_COLORS.length]} fontSize={11} fontWeight="bold">
                    AP{i + 1}
                  </text>
                  <text x={toSvgX(a.x)} y={toSvgY(a.y) + 22} textAnchor="middle"
                    fill="var(--text-secondary)" fontSize={9}>
                    ({a.x}, {a.y}) · {a.distance_m}m
                  </text>
                </g>
              ))}

              {/* Estimated position */}
              {result && (
                <g>
                  <circle cx={toSvgX(result.x)} cy={toSvgY(result.y)} r={9}
                    fill="#10b981" stroke="white" strokeWidth={2.5} />
                  <circle cx={toSvgX(result.x)} cy={toSvgY(result.y)} r={16}
                    fill="none" stroke="#10b981" strokeWidth={1.5} opacity={0.5}>
                    <animate attributeName="r" values="12;20;12" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <text x={toSvgX(result.x)} y={toSvgY(result.y) - 22} textAnchor="middle"
                    fill="#10b981" fontSize={12} fontWeight="bold">
                    ({result.x.toFixed(2)}, {result.y.toFixed(2)})
                  </text>
                </g>
              )}

              {/* Legend */}
              <g transform={`translate(${SVG_SIZE - 150}, 15)`}>
                <rect x={-5} y={-5} width={150} height={54} rx={6}
                  fill="var(--bg-primary)" stroke="var(--border)" opacity={0.92} />
                <rect x={2} y={4} width={12} height={12} rx={3} fill="#ef4444" />
                <text x={20} y={14} fill="var(--text-primary)" fontSize={10}>FTM Anchor</text>
                <circle cx={8} cy={34} r={6} fill="#10b981" />
                <text x={20} y={38} fill="var(--text-primary)" fontSize={10}>Estimated Pos</text>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
