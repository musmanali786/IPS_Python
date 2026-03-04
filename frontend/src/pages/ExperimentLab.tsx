import { useState, useRef, useMemo } from 'react';
import { experimentsApi } from '../api';
import type { LabTrilaterationResponse, LabFingerprintingResponse } from '../api';
import { FlaskConical, Upload, FileText, Wifi, MapPin, Play, Eye, Database, Search } from 'lucide-react';
import Plot from 'react-plotly.js';

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
        {tab === 'fingerprint' && <FingerprintPanel />}
        {tab === 'pdr' && <PlaceholderPanel name="Pedestrian Dead Reckoning" />}
        {tab === 'ble' && <PlaceholderPanel name="BLE Kalman Smoothing" />}
        {tab === 'ftm' && <PlaceholderPanel name="FTM Multilateration" />}
        {tab === 'dfp' && <PlaceholderPanel name="Device-Free Positioning" />}
      </div>
    </div>
  );
}

// ─── Trilateration Panel (Lab01-style file-based) ────────────────

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

function TrilaterationPanel() {
  // File state
  const [apsCsv, setApsCsv] = useState<File | null>(null);
  const [refPtsCsv, setRefPtsCsv] = useState<File | null>(null);
  const [logFiles, setLogFiles] = useState<File[]>([]);
  const [mapImage, setMapImage] = useState<File | null>(null);
  const [mapUrl, setMapUrl] = useState<string | null>(null);

  // Parameters
  const [rssi0, setRssi0] = useState(-32);
  const [pathLossExp, setPathLossExp] = useState(2.45);
  const [solver, setSolver] = useState<'ls' | 'wls'>('ls');
  const [roomWidth, setRoomWidth] = useState(13);
  const [roomHeight, setRoomHeight] = useState(13);

  // Results
  const [result, setResult] = useState<LabTrilaterationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRef, setSelectedRef] = useState<number | null>(null);
  const [showCircles, setShowCircles] = useState(true);

  // Refs for hidden file inputs
  const apsRef = useRef<HTMLInputElement>(null);
  const refRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLInputElement>(null);

  const handleMapFile = (f: File) => {
    setMapImage(f);
    setMapUrl(URL.createObjectURL(f));
  };

  const run = async () => {
    if (!apsCsv || !refPtsCsv || logFiles.length === 0) {
      alert('Please upload APs CSV, Reference Points CSV, and at least one log file.');
      return;
    }
    setLoading(true);
    try {
      const r = await experimentsApi.trilaterationLab({
        apsCsv,
        refPtsCsv,
        logFiles,
        rssi0,
        pathLossExponent: pathLossExp,
        solver,
        roomWidth,
        roomHeight,
      });
      setResult(r.data);
      setSelectedRef(null);
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Error running experiment');
    }
    setLoading(false);
  };

  // SVG coordinate helpers
  const SVG_SIZE = 560;
  const MARGIN = 40;
  const scaleX = (x: number) => MARGIN + (x / roomWidth) * (SVG_SIZE - 2 * MARGIN);
  const scaleY = (y: number) => SVG_SIZE - MARGIN - (y / roomHeight) * (SVG_SIZE - 2 * MARGIN);
  const scaleDist = (d: number) => (d / Math.max(roomWidth, roomHeight)) * (SVG_SIZE - 2 * MARGIN);

  const avgError = useMemo(() => {
    if (!result) return 0;
    const errs = result.results.filter((r) => r.error !== null).map((r) => r.error!);
    return errs.length > 0 ? errs.reduce((a, b) => a + b, 0) / errs.length : 0;
  }, [result]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">Trilateration Lab</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Upload APs, reference points, and sensor log files to evaluate RSSI-based positioning.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left: File Uploads + Parameters ─────────────────── */}
        <div className="space-y-4">
          {/* File Uploads */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Upload size={14} /> Input Files
            </h3>

            {/* APs CSV */}
            <input ref={apsRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && setApsCsv(e.target.files[0])} />
            <button onClick={() => apsRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs mb-2 transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <Wifi size={14} className={apsCsv ? 'text-green-500' : 'opacity-40'} />
              <span className="flex-1 text-left truncate">{apsCsv ? apsCsv.name : 'Access Points CSV (ssid,x,y,bssid)'}</span>
              {apsCsv && <span className="text-green-500 text-[10px]">✓</span>}
            </button>

            {/* Ref Points CSV */}
            <input ref={refRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && setRefPtsCsv(e.target.files[0])} />
            <button onClick={() => refRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs mb-2 transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <MapPin size={14} className={refPtsCsv ? 'text-green-500' : 'opacity-40'} />
              <span className="flex-1 text-left truncate">{refPtsCsv ? refPtsCsv.name : 'Reference Points CSV (id,x,y,filetag)'}</span>
              {refPtsCsv && <span className="text-green-500 text-[10px]">✓</span>}
            </button>

            {/* Log Files */}
            <input ref={logRef} type="file" accept=".txt,.csv,.log" multiple className="hidden"
              onChange={(e) => e.target.files && setLogFiles(Array.from(e.target.files))} />
            <button onClick={() => logRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs mb-2 transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <FileText size={14} className={logFiles.length > 0 ? 'text-green-500' : 'opacity-40'} />
              <span className="flex-1 text-left truncate">
                {logFiles.length > 0 ? `${logFiles.length} log file(s)` : 'Sensor Log Files (one per ref point)'}
              </span>
              {logFiles.length > 0 && <span className="text-green-500 text-[10px]">✓</span>}
            </button>

            {/* Map Image (optional) */}
            <input ref={mapRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleMapFile(e.target.files[0])} />
            <button onClick={() => mapRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <Eye size={14} className={mapImage ? 'text-green-500' : 'opacity-40'} />
              <span className="flex-1 text-left truncate">{mapImage ? mapImage.name : 'Floor Plan Image (optional)'}</span>
              {mapImage && <span className="text-green-500 text-[10px]">✓</span>}
            </button>
          </div>

          {/* Parameters */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold text-sm mb-3">Path Loss Parameters</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>RSSI₀ (dBm)</label>
                <input type="number" value={rssi0} onChange={(e) => setRssi0(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Path Loss Exp (n)</label>
                <input type="number" step="0.05" value={pathLossExp} onChange={(e) => setPathLossExp(parseFloat(e.target.value) || 2)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Room Width (m)</label>
                <input type="number" value={roomWidth} onChange={(e) => setRoomWidth(parseFloat(e.target.value) || 13)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Room Height (m)</label>
                <input type="number" value={roomHeight} onChange={(e) => setRoomHeight(parseFloat(e.target.value) || 13)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Solver</label>
              <select value={solver} onChange={(e) => setSolver(e.target.value as 'ls' | 'wls')}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <option value="ls">Least Squares</option>
                <option value="wls">Weighted Least Squares</option>
              </select>
            </div>
          </div>

          <button onClick={run} disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ background: 'var(--accent)' }}>
            <Play size={16} />
            {loading ? 'Processing Files...' : 'Run Trilateration Lab'}
          </button>
        </div>

        {/* ── Center: SVG Visualization ───────────────────────── */}
        <div className="xl:col-span-2">
          {result ? (
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Access Points', value: result.access_points.length },
                  { label: 'Reference Points', value: result.ref_points.length },
                  { label: 'Avg Error', value: `${avgError.toFixed(2)} m` },
                  { label: 'Solver', value: result.solver.toUpperCase() },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg px-4 py-3 text-center"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                    <p className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{s.value}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Visualization */}
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Floor Plan Visualization</h3>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={showCircles} onChange={(e) => setShowCircles(e.target.checked)} />
                      Show Circles
                    </label>
                    <button onClick={() => setSelectedRef(null)} className="text-xs px-2 py-1 rounded"
                      style={{ color: 'var(--accent)' }}>
                      Show All
                    </button>
                  </div>
                </div>
                <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} className="w-full" style={{ maxHeight: '520px' }}>
                  {/* Background image */}
                  {mapUrl && (
                    <image href={mapUrl} x={MARGIN} y={MARGIN}
                      width={SVG_SIZE - 2 * MARGIN} height={SVG_SIZE - 2 * MARGIN}
                      preserveAspectRatio="none" opacity={0.3} />
                  )}

                  {/* Grid */}
                  {Array.from({ length: Math.floor(roomWidth) + 1 }).map((_, i) => (
                    <line key={`gx${i}`} x1={scaleX(i)} y1={scaleY(0)} x2={scaleX(i)} y2={scaleY(roomHeight)}
                      stroke="var(--border)" strokeWidth={0.5} strokeDasharray="2,4" />
                  ))}
                  {Array.from({ length: Math.floor(roomHeight) + 1 }).map((_, i) => (
                    <line key={`gy${i}`} x1={scaleX(0)} y1={scaleY(i)} x2={scaleX(roomWidth)} y2={scaleY(i)}
                      stroke="var(--border)" strokeWidth={0.5} strokeDasharray="2,4" />
                  ))}

                  {/* Axis labels */}
                  {Array.from({ length: Math.floor(roomWidth) + 1 }).filter((_, i) => i % 2 === 0).map((_, idx) => {
                    const i = idx * 2;
                    return (
                      <text key={`lx${i}`} x={scaleX(i)} y={SVG_SIZE - 10} textAnchor="middle"
                        fill="var(--text-secondary)" fontSize={10}>{i}</text>
                    );
                  })}
                  {Array.from({ length: Math.floor(roomHeight) + 1 }).filter((_, i) => i % 2 === 0).map((_, idx) => {
                    const i = idx * 2;
                    return (
                      <text key={`ly${i}`} x={15} y={scaleY(i) + 3} textAnchor="middle"
                        fill="var(--text-secondary)" fontSize={10}>{i}</text>
                    );
                  })}

                  {/* Room boundary */}
                  <rect x={scaleX(0)} y={scaleY(roomHeight)}
                    width={scaleX(roomWidth) - scaleX(0)} height={scaleY(0) - scaleY(roomHeight)}
                    fill="none" stroke="var(--text-primary)" strokeWidth={2} strokeDasharray="8,4" />

                  {/* Distance circles for selected (or all) ref points */}
                  {showCircles && result.results
                    .filter((r) => selectedRef === null || r.ref_id === selectedRef)
                    .map((r, ri) => (
                      <g key={`circles-${r.ref_id}`} opacity={selectedRef === null ? 0.25 : 0.4}>
                        {r.distances.map((d, di) => {
                          const ap = result.access_points[di];
                          return (
                            <circle key={`c-${r.ref_id}-${di}`}
                              cx={scaleX(ap.x)} cy={scaleY(ap.y)} r={scaleDist(d)}
                              fill="none" stroke={COLORS[ri % COLORS.length]}
                              strokeWidth={1.2} strokeDasharray="6,3" />
                          );
                        })}
                      </g>
                    ))}

                  {/* Error lines: ground truth → estimated */}
                  {result.results
                    .filter((r) => r.estimated_x !== null && (selectedRef === null || r.ref_id === selectedRef))
                    .map((r) => (
                      <line key={`err-${r.ref_id}`}
                        x1={scaleX(r.ref_x)} y1={scaleY(r.ref_y)}
                        x2={scaleX(r.estimated_x!)} y2={scaleY(r.estimated_y!)}
                        stroke="#f97316" strokeWidth={1.5} strokeDasharray="3,3" />
                    ))}

                  {/* Access Points (red dots) */}
                  {result.access_points.map((ap, i) => (
                    <g key={`ap-${i}`}>
                      <circle cx={scaleX(ap.x)} cy={scaleY(ap.y)} r={8}
                        fill="#ef4444" stroke="white" strokeWidth={2} />
                      <text x={scaleX(ap.x)} y={scaleY(ap.y) - 12}
                        textAnchor="middle" fill="#ef4444" fontSize={10} fontWeight="bold">
                        {ap.ssid}
                      </text>
                    </g>
                  ))}

                  {/* Reference Points (blue crosses) */}
                  {result.ref_points.map((rp, i) => (
                    <g key={`rp-${i}`} style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedRef(selectedRef === rp.id ? null : rp.id)}>
                      <line x1={scaleX(rp.x) - 6} y1={scaleY(rp.y) - 6}
                        x2={scaleX(rp.x) + 6} y2={scaleY(rp.y) + 6}
                        stroke="#3b82f6" strokeWidth={2.5} />
                      <line x1={scaleX(rp.x) + 6} y1={scaleY(rp.y) - 6}
                        x2={scaleX(rp.x) - 6} y2={scaleY(rp.y) + 6}
                        stroke="#3b82f6" strokeWidth={2.5} />
                      <text x={scaleX(rp.x)} y={scaleY(rp.y) + 16}
                        textAnchor="middle" fill="#3b82f6" fontSize={9}>
                        Ref {rp.id}
                      </text>
                    </g>
                  ))}

                  {/* Estimated positions (green diamonds) */}
                  {result.results
                    .filter((r) => r.estimated_x !== null)
                    .map((r) => (
                      <g key={`est-${r.ref_id}`}>
                        <rect x={scaleX(r.estimated_x!) - 5} y={scaleY(r.estimated_y!) - 5}
                          width={10} height={10} fill="#10b981" stroke="white" strokeWidth={1.5}
                          transform={`rotate(45,${scaleX(r.estimated_x!)},${scaleY(r.estimated_y!)})`} />
                      </g>
                    ))}

                  {/* Legend */}
                  <g transform={`translate(${SVG_SIZE - 150}, 15)`}>
                    <rect x={-5} y={-5} width={150} height={72} rx={6}
                      fill="var(--bg-primary)" stroke="var(--border)" opacity={0.9} />
                    <circle cx={8} cy={10} r={5} fill="#ef4444" />
                    <text x={20} y={14} fill="var(--text-primary)" fontSize={10}>Access Point</text>
                    <line x1={3} y1={27} x2={13} y2={37} stroke="#3b82f6" strokeWidth={2} />
                    <line x1={13} y1={27} x2={3} y2={37} stroke="#3b82f6" strokeWidth={2} />
                    <text x={20} y={36} fill="var(--text-primary)" fontSize={10}>Ground Truth</text>
                    <rect x={3} y={48} width={10} height={10} fill="#10b981"
                      transform="rotate(45,8,53)" />
                    <text x={20} y={58} fill="var(--text-primary)" fontSize={10}>Estimated Pos</text>
                  </g>
                </svg>
              </div>

              {/* Results Table */}
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <h3 className="font-semibold text-sm mb-3">Results per Reference Point</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th className="text-left py-2 px-2">Ref</th>
                        <th className="text-left py-2 px-2">Ground Truth</th>
                        <th className="text-left py-2 px-2">Estimated</th>
                        {result.access_points.map((ap, i) => (
                          <th key={i} className="text-left py-2 px-2">d({ap.ssid})</th>
                        ))}
                        <th className="text-left py-2 px-2">Error (m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.results.map((r) => (
                        <tr key={r.ref_id}
                          onClick={() => setSelectedRef(selectedRef === r.ref_id ? null : r.ref_id)}
                          className="cursor-pointer transition-colors hover:opacity-80"
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: selectedRef === r.ref_id ? 'var(--bg-secondary)' : undefined,
                          }}>
                          <td className="py-2 px-2 font-medium">{r.filetag}</td>
                          <td className="py-2 px-2 font-mono">({r.ref_x}, {r.ref_y})</td>
                          <td className="py-2 px-2 font-mono" style={{ color: '#10b981' }}>
                            {r.estimated_x !== null ? `(${r.estimated_x}, ${r.estimated_y})` : '—'}
                          </td>
                          {r.distances.map((d, di) => (
                            <td key={di} className="py-2 px-2 font-mono">{d.toFixed(2)}</td>
                          ))}
                          <td className="py-2 px-2 font-mono font-bold"
                            style={{ color: r.error !== null && r.error < 3 ? '#10b981' : '#f97316' }}>
                            {r.error !== null ? r.error.toFixed(2) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-16 text-center h-full flex items-center justify-center"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
              <div>
                <FlaskConical size={56} className="mx-auto mb-4 opacity-15" />
                <p className="text-base font-medium mb-2">Trilateration Lab Experiment</p>
                <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
                  Upload your Access Points CSV, Reference Points CSV, and
                  sensor log files to visualize RSSI-based trilateration results
                  on a floor plan.
                </p>
                <div className="mt-6 text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
                  <p><strong>APs CSV:</strong> ssid, x, y, bssid</p>
                  <p><strong>RefPts CSV:</strong> id, x, y, filetag</p>
                  <p><strong>Logs:</strong> GetSensorData format, filename must contain the filetag</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Fingerprinting Panel (Lab02-style file-based) ───────────────

function FingerprintPanel() {
  // File state
  const [refPtsCsv, setRefPtsCsv] = useState<File | null>(null);
  const [testPtsCsv, setTestPtsCsv] = useState<File | null>(null);
  const [trainLogFiles, setTrainLogFiles] = useState<File[]>([]);
  const [testLogFiles, setTestLogFiles] = useState<File[]>([]);
  const [mapImage, setMapImage] = useState<File | null>(null);
  const [mapUrl, setMapUrl] = useState<string | null>(null);

  // Parameters
  const [k, setK] = useState(1);
  const [algorithm, setAlgorithm] = useState<'nearest' | 'knn' | 'wknn'>('nearest');
  const [maxAps, setMaxAps] = useState(0);
  const [pixelsPerMeter, setPixelsPerMeter] = useState(20);
  const [scanMode, setScanMode] = useState<'first' | 'average'>('average');

  // Results
  const [result, setResult] = useState<LabFingerprintingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);

  // File input refs
  const refRef = useRef<HTMLInputElement>(null);
  const testPtsRef = useRef<HTMLInputElement>(null);
  const trainLogRef = useRef<HTMLInputElement>(null);
  const testLogRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLInputElement>(null);

  const handleMapFile = (f: File) => {
    setMapImage(f);
    setMapUrl(URL.createObjectURL(f));
  };

  const run = async () => {
    if (!refPtsCsv || !testPtsCsv || trainLogFiles.length === 0 || testLogFiles.length === 0) {
      alert('Please upload: Reference Points CSV, Test Points CSV, training log files, and test log files.');
      return;
    }
    setLoading(true);
    try {
      const r = await experimentsApi.fingerprintingLab({
        refPtsCsv,
        testPtsCsv,
        trainLogFiles,
        testLogFiles,
        k,
        algorithm,
        maxAps,
        pixelsPerMeter,
        scanMode,
      });
      setResult(r.data);
      setSelectedTest(null);
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Error running fingerprinting experiment');
    }
    setLoading(false);
  };

  // SVG coordinate helpers - auto-scale from pixel coordinates
  const SVG_W = 640;
  const SVG_H = 400;
  const MARGIN = 40;

  const bounds = useMemo(() => {
    if (!result) return { minX: 0, maxX: 1000, minY: 0, maxY: 400 };
    const allX = [
      ...result.ref_points.map((r) => r.x),
      ...result.test_results.map((t) => t.test_x),
      ...result.test_results.filter((t) => t.estimated_x !== null).map((t) => t.estimated_x!),
    ];
    const allY = [
      ...result.ref_points.map((r) => r.y),
      ...result.test_results.map((t) => t.test_y),
      ...result.test_results.filter((t) => t.estimated_y !== null).map((t) => t.estimated_y!),
    ];
    const pad = 30;
    return {
      minX: Math.min(...allX) - pad,
      maxX: Math.max(...allX) + pad,
      minY: Math.min(...allY) - pad,
      maxY: Math.max(...allY) + pad,
    };
  }, [result]);

  const scaleX = (x: number) =>
    MARGIN + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * (SVG_W - 2 * MARGIN);
  const scaleY = (y: number) =>
    MARGIN + ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * (SVG_H - 2 * MARGIN);

  const avgError = useMemo(() => {
    if (!result || result.errors_m.length === 0) return 0;
    return result.errors_m.reduce((a, b) => a + b, 0) / result.errors_m.length;
  }, [result]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">Fingerprinting Lab</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Upload reference fingerprints and test scans to evaluate WiFi fingerprint-based positioning (Lab02).
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left: File Uploads + Parameters ─────────────────── */}
        <div className="space-y-4">
          {/* File Uploads */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Upload size={14} /> Input Files
            </h3>

            {/* Ref Points CSV */}
            <input ref={refRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && setRefPtsCsv(e.target.files[0])} />
            <button onClick={() => refRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs mb-2 transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <MapPin size={14} className={refPtsCsv ? 'text-green-500' : 'opacity-40'} />
              <span className="flex-1 text-left truncate">{refPtsCsv ? refPtsCsv.name : 'Ref Points CSV (ID,X,Y,File)'}</span>
              {refPtsCsv && <span className="text-green-500 text-[10px]">✓</span>}
            </button>

            {/* Training Log Files */}
            <input ref={trainLogRef} type="file" accept=".txt,.csv,.log" multiple className="hidden"
              onChange={(e) => e.target.files && setTrainLogFiles(Array.from(e.target.files))} />
            <button onClick={() => trainLogRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs mb-2 transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <Database size={14} className={trainLogFiles.length > 0 ? 'text-green-500' : 'opacity-40'} />
              <span className="flex-1 text-left truncate">
                {trainLogFiles.length > 0 ? `${trainLogFiles.length} training log(s)` : 'Training Log Files (fingerprint DB)'}
              </span>
              {trainLogFiles.length > 0 && <span className="text-green-500 text-[10px]">✓</span>}
            </button>

            {/* Test Points CSV */}
            <input ref={testPtsRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && setTestPtsCsv(e.target.files[0])} />
            <button onClick={() => testPtsRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs mb-2 transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <Search size={14} className={testPtsCsv ? 'text-green-500' : 'opacity-40'} />
              <span className="flex-1 text-left truncate">{testPtsCsv ? testPtsCsv.name : 'Test Points CSV (ID,X,Y,File)'}</span>
              {testPtsCsv && <span className="text-green-500 text-[10px]">✓</span>}
            </button>

            {/* Test Log Files */}
            <input ref={testLogRef} type="file" accept=".txt,.csv,.log" multiple className="hidden"
              onChange={(e) => e.target.files && setTestLogFiles(Array.from(e.target.files))} />
            <button onClick={() => testLogRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs mb-2 transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <FileText size={14} className={testLogFiles.length > 0 ? 'text-green-500' : 'opacity-40'} />
              <span className="flex-1 text-left truncate">
                {testLogFiles.length > 0 ? `${testLogFiles.length} test log(s)` : 'Test Log Files (online scans)'}
              </span>
              {testLogFiles.length > 0 && <span className="text-green-500 text-[10px]">✓</span>}
            </button>

            {/* Map Image (optional) */}
            <input ref={mapRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleMapFile(e.target.files[0])} />
            <button onClick={() => mapRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <Eye size={14} className={mapImage ? 'text-green-500' : 'opacity-40'} />
              <span className="flex-1 text-left truncate">{mapImage ? mapImage.name : 'Floor Plan Image (optional)'}</span>
              {mapImage && <span className="text-green-500 text-[10px]">✓</span>}
            </button>
          </div>

          {/* Parameters */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold text-sm mb-3">Fingerprinting Parameters</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Algorithm</label>
                <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value as 'nearest' | 'knn' | 'wknn')}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <option value="nearest">Nearest (1-NN)</option>
                  <option value="knn">k-NN</option>
                  <option value="wknn">Weighted k-NN</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>k (neighbours)</label>
                <input type="number" min={1} value={k} onChange={(e) => setK(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  disabled={algorithm === 'nearest'} />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Max APs (0=all)</label>
                <input type="number" min={0} value={maxAps} onChange={(e) => setMaxAps(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Pixels / Meter</label>
                <input type="number" min={0.1} step={0.1} value={pixelsPerMeter}
                  onChange={(e) => setPixelsPerMeter(parseFloat(e.target.value) || 20)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Scan Mode</label>
              <select value={scanMode} onChange={(e) => setScanMode(e.target.value as 'first' | 'average')}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <option value="average">Average all scans</option>
                <option value="first">First scan only</option>
              </select>
            </div>
          </div>

          <button onClick={run} disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ background: 'var(--accent)' }}>
            <Play size={16} />
            {loading ? 'Building DB & Matching...' : 'Run Fingerprinting Lab'}
          </button>
        </div>

        {/* ── Center + Right: Visualization & Results ─────────── */}
        <div className="xl:col-span-2">
          {result ? (
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: 'Ref Points', value: result.fp_db_size },
                  { label: 'Unique BSSIDs', value: result.total_unique_bssids },
                  { label: 'Test Points', value: result.test_results.length },
                  { label: 'Avg Error', value: `${avgError.toFixed(2)} m` },
                  { label: 'Algorithm', value: result.algorithm === 'wknn' ? 'WkNN' : result.algorithm === 'knn' ? `${result.k}-NN` : 'Nearest' },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg px-3 py-3 text-center"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                    <p className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{s.value}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Floor Plan Visualization */}
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Floor Plan &amp; Positioning Results</h3>
                  <button onClick={() => setSelectedTest(null)} className="text-xs px-2 py-1 rounded"
                    style={{ color: 'var(--accent)' }}>Show All</button>
                </div>
                <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ maxHeight: '440px' }}>
                  {/* Background image */}
                  {mapUrl && (
                    <image href={mapUrl} x={MARGIN} y={MARGIN}
                      width={SVG_W - 2 * MARGIN} height={SVG_H - 2 * MARGIN}
                      preserveAspectRatio="none" opacity={0.25} />
                  )}

                  {/* Error lines: ground truth → estimated */}
                  {result.test_results
                    .filter((t) => t.estimated_x !== null && (selectedTest === null || t.test_id === selectedTest))
                    .map((t) => (
                      <line key={`err-${t.test_id}`}
                        x1={scaleX(t.test_x)} y1={scaleY(t.test_y)}
                        x2={scaleX(t.estimated_x!)} y2={scaleY(t.estimated_y!)}
                        stroke="#f97316" strokeWidth={2} strokeDasharray="4,3" />
                    ))}

                  {/* Matched ref highlight */}
                  {selectedTest && result.test_results
                    .filter((t) => t.test_id === selectedTest && t.matched_ref !== null)
                    .map((t) => {
                      const matchedPt = result.ref_points.find((r) => r.id === t.matched_ref);
                      if (!matchedPt) return null;
                      return (
                        <circle key={`match-${t.test_id}`}
                          cx={scaleX(matchedPt.x)} cy={scaleY(matchedPt.y)} r={12}
                          fill="none" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="4,2" />
                      );
                    })}

                  {/* Reference points (blue circles) */}
                  {result.ref_points.map((rp) => (
                    <g key={`rp-${rp.id}`}>
                      <circle cx={scaleX(rp.x)} cy={scaleY(rp.y)} r={5}
                        fill="#3b82f6" stroke="white" strokeWidth={1.5} opacity={0.7} />
                    </g>
                  ))}

                  {/* Test ground truth (red crosses) */}
                  {result.test_results
                    .filter((t) => selectedTest === null || t.test_id === selectedTest)
                    .map((t) => (
                      <g key={`gt-${t.test_id}`} style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedTest(selectedTest === t.test_id ? null : t.test_id)}>
                        <line x1={scaleX(t.test_x) - 7} y1={scaleY(t.test_y) - 7}
                          x2={scaleX(t.test_x) + 7} y2={scaleY(t.test_y) + 7}
                          stroke="#ef4444" strokeWidth={2.5} />
                        <line x1={scaleX(t.test_x) + 7} y1={scaleY(t.test_y) - 7}
                          x2={scaleX(t.test_x) - 7} y2={scaleY(t.test_y) + 7}
                          stroke="#ef4444" strokeWidth={2.5} />
                        <text x={scaleX(t.test_x)} y={scaleY(t.test_y) - 12}
                          textAnchor="middle" fill="#ef4444" fontSize={9} fontWeight="bold">
                          {t.filetag}
                        </text>
                      </g>
                    ))}

                  {/* Estimated positions (green diamonds) */}
                  {result.test_results
                    .filter((t) => t.estimated_x !== null && (selectedTest === null || t.test_id === selectedTest))
                    .map((t) => (
                      <g key={`est-${t.test_id}`}>
                        <rect x={scaleX(t.estimated_x!) - 6} y={scaleY(t.estimated_y!) - 6}
                          width={12} height={12} fill="#10b981" stroke="white" strokeWidth={1.5}
                          transform={`rotate(45,${scaleX(t.estimated_x!)},${scaleY(t.estimated_y!)})`} />
                      </g>
                    ))}

                  {/* Legend */}
                  <g transform={`translate(${SVG_W - 160}, 10)`}>
                    <rect x={-5} y={-5} width={155} height={82} rx={6}
                      fill="var(--bg-primary)" stroke="var(--border)" opacity={0.92} />
                    <circle cx={8} cy={10} r={5} fill="#3b82f6" />
                    <text x={20} y={14} fill="var(--text-primary)" fontSize={10}>Reference Point</text>
                    <line x1={3} y1={27} x2={13} y2={37} stroke="#ef4444" strokeWidth={2} />
                    <line x1={13} y1={27} x2={3} y2={37} stroke="#ef4444" strokeWidth={2} />
                    <text x={20} y={36} fill="var(--text-primary)" fontSize={10}>Test Ground Truth</text>
                    <rect x={3} y={48} width={10} height={10} fill="#10b981"
                      transform="rotate(45,8,53)" />
                    <text x={20} y={58} fill="var(--text-primary)" fontSize={10}>Estimated Position</text>
                    <line x1={3} y1={70} x2={13} y2={70} stroke="#f97316" strokeWidth={2} strokeDasharray="3,2" />
                    <text x={20} y={74} fill="var(--text-primary)" fontSize={10}>Error Vector</text>
                  </g>
                </svg>
              </div>

              {/* CDF Plot */}
              {result.cdf.x.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                  <h3 className="font-semibold text-sm mb-3">Cumulative Distribution Function (CDF)</h3>
                  <Plot
                    data={[
                      {
                        x: result.cdf.x,
                        y: result.cdf.y,
                        type: 'scatter',
                        mode: 'lines',
                        name: 'CDF',
                        line: { color: '#3b82f6', width: 2.5 },
                      },
                    ]}
                    layout={{
                      height: 280,
                      margin: { l: 55, r: 20, t: 10, b: 45 },
                      xaxis: {
                        title: { text: 'Positioning Error (m)', font: { size: 12 } },
                        gridcolor: 'rgba(128,128,128,0.15)',
                      },
                      yaxis: {
                        title: { text: 'Cumulative Probability', font: { size: 12 } },
                        range: [0, 1.05],
                        gridcolor: 'rgba(128,128,128,0.15)',
                      },
                      paper_bgcolor: 'transparent',
                      plot_bgcolor: 'transparent',
                      font: { color: 'var(--text-primary)', size: 11 },
                      shapes: [
                        {
                          type: 'line',
                          x0: result.statistics.median ?? 0,
                          x1: result.statistics.median ?? 0,
                          y0: 0,
                          y1: 1,
                          line: { color: '#f59e0b', width: 1.5, dash: 'dash' },
                        },
                      ],
                      annotations: [
                        {
                          x: result.statistics.median ?? 0,
                          y: 0.5,
                          text: `Median: ${(result.statistics.median ?? 0).toFixed(2)}m`,
                          showarrow: true,
                          arrowhead: 2,
                          ax: 50,
                          ay: -25,
                          font: { size: 10, color: '#f59e0b' },
                        },
                      ],
                    }}
                    config={{ displayModeBar: false }}
                    style={{ width: '100%' }}
                  />

                  {/* Error statistics */}
                  {result.statistics && Object.keys(result.statistics).length > 0 && (
                    <div className="grid grid-cols-5 gap-2 mt-3">
                      {[
                        { label: 'Mean', val: result.statistics.mean },
                        { label: 'Median', val: result.statistics.median },
                        { label: 'Std Dev', val: result.statistics.std },
                        { label: 'P75', val: result.statistics.p75 },
                        { label: 'P90', val: result.statistics.p90 },
                      ].map((s) => (
                        <div key={s.label} className="rounded-lg px-2 py-2 text-center"
                          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                          <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
                            {s.val !== undefined ? s.val.toFixed(2) : '—'} m
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Results Table */}
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <h3 className="font-semibold text-sm mb-3">Results per Test Point</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th className="text-left py-2 px-2">Test</th>
                        <th className="text-left py-2 px-2">Ground Truth (px)</th>
                        <th className="text-left py-2 px-2">Estimated (px)</th>
                        <th className="text-left py-2 px-2">Matched Ref</th>
                        <th className="text-left py-2 px-2">RSSI Err</th>
                        <th className="text-left py-2 px-2">Error (px)</th>
                        <th className="text-left py-2 px-2">Error (m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.test_results.map((t) => (
                        <tr key={t.test_id}
                          onClick={() => setSelectedTest(selectedTest === t.test_id ? null : t.test_id)}
                          className="cursor-pointer transition-colors hover:opacity-80"
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: selectedTest === t.test_id ? 'var(--bg-secondary)' : undefined,
                          }}>
                          <td className="py-2 px-2 font-medium">{t.filetag}</td>
                          <td className="py-2 px-2 font-mono">({t.test_x}, {t.test_y})</td>
                          <td className="py-2 px-2 font-mono" style={{ color: '#10b981' }}>
                            {t.estimated_x !== null ? `(${t.estimated_x}, ${t.estimated_y})` : '—'}
                          </td>
                          <td className="py-2 px-2">{t.matched_ref ?? '—'}</td>
                          <td className="py-2 px-2 font-mono">{t.rssi_error !== null ? t.rssi_error.toFixed(1) : '—'}</td>
                          <td className="py-2 px-2 font-mono">{t.error_px !== null ? t.error_px.toFixed(1) : '—'}</td>
                          <td className="py-2 px-2 font-mono font-bold"
                            style={{ color: t.error_m !== null && t.error_m < 5 ? '#10b981' : '#f97316' }}>
                            {t.error_m !== null ? t.error_m.toFixed(2) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-16 text-center h-full flex items-center justify-center"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
              <div>
                <FlaskConical size={56} className="mx-auto mb-4 opacity-15" />
                <p className="text-base font-medium mb-2">Fingerprinting Lab Experiment</p>
                <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
                  Upload reference point fingerprints and test scans to evaluate
                  WiFi fingerprint-based indoor positioning. Based on the Lab02
                  kNN fingerprinting workflow.
                </p>
                <div className="mt-6 text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
                  <p><strong>Ref Points CSV:</strong> ID, X, Y, File — reference positions &amp; log file tags</p>
                  <p><strong>Training Logs:</strong> GetSensorData format — one per reference point (fingerprint DB)</p>
                  <p><strong>Test Points CSV:</strong> ID, X, Y, File — test ground truth positions &amp; file tags</p>
                  <p><strong>Test Logs:</strong> GetSensorData format — one per test point (online scans)</p>
                </div>
              </div>
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
