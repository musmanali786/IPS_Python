import { useState, useRef, useMemo } from 'react';
import { experimentsApi } from '../../api';
import type { LabTrilaterationResponse } from '../../api';
import { FlaskConical, Upload, FileText, Wifi, MapPin, Play, Eye } from 'lucide-react';
import Plot from 'react-plotly.js';

type APInfo = { ssid: string; x: number; y: number; bssid: string };
type RefPoint = { id: number; x: number; y: number; filetag: string };
type LogScan = {
  filetag: string;
  fileName: string;
  bssidRssi: Record<string, number>;
  distances: number[];
};

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function ExperimentTrilaterationLab() {
  // File state
  const [apsCsv, setApsCsv] = useState<File | null>(null);
  const [refPtsCsv, setRefPtsCsv] = useState<File | null>(null);
  const [logFiles, setLogFiles] = useState<File[]>([]);
  const [mapImage, setMapImage] = useState<File | null>(null);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [apPoints, setApPoints] = useState<APInfo[]>([]);
    // @ts-ignore
  const [refPoints, setRefPoints] = useState<RefPoint[]>([]);
    // @ts-ignore
  const [logScans, setLogScans] = useState<LogScan[]>([]);
    // @ts-ignore
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
    // @ts-ignore
  const [selectedRefId, setSelectedRefId] = useState<number | null>(null);
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

    // @ts-ignore
  const pathLossDistance = (rssi: number, rssi0: number, n: number) => {
    const diff = rssi0 - rssi;
    return 10 ** (diff / (10 * n));
  };

    // @ts-ignore
  const parseWifiScan = (content: string): Record<string, number> => {
    const lines = content.split(/\r?\n/);
    let lastTag = 'NONE';
    let bssidRssi: Record<string, number> = {};
    const scans: Record<string, number>[] = [];

    for (const line of lines) {
      const cells = line.split(';');
      if (cells.length > 4) {
        const tag = cells[0];
        if (tag === 'WIFI') {
          bssidRssi[cells[4]] = Number(cells[5]);
        } else if (lastTag === 'WIFI' && tag !== 'WIFI') {
          if (Object.keys(bssidRssi).length > 0) {
            scans.push({ ...bssidRssi });
            bssidRssi = {};
          }
        }
        lastTag = tag;
      }
    }
    if (Object.keys(bssidRssi).length > 0) scans.push({ ...bssidRssi });
    return scans.length > 0 ? scans[0] : {};
  };

  const loadApsCsv = (file: File) => {
    setApsCsv(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      const parsed: APInfo[] = [];
      text.split(/\r?\n/).forEach((line) => {
        const row = line.trim().split(',').map((v) => v.trim());
        if (row.length >= 4 && row[0]) {
          parsed.push({ ssid: row[0], x: Number(row[1]), y: Number(row[2]), bssid: row[3] });
        }
      });
      setApPoints(parsed);
    };
    reader.readAsText(file);
  };

  const loadRefPtsCsv = (file: File) => {
    setRefPtsCsv(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      const parsed: RefPoint[] = [];
      text.split(/\r?\n/).forEach((line) => {
        const row = line.trim().split(',').map((v) => v.trim());
        if (row.length >= 4 && row[0]) {
          parsed.push({ id: Number(row[0]), x: Number(row[1]), y: Number(row[2]), filetag: row[3] });
        }
      });
      setRefPoints(parsed);
    };
    reader.readAsText(file);
  };

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

  const statsData = useMemo(() => {
    return null;
  }, []);

  const cdfData = useMemo(() => {
    return { x: [], y: [] };
  }, []);

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
              onChange={(e) => e.target.files?.[0] && loadApsCsv(e.target.files[0])} />
            <button onClick={() => apsRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs mb-2 transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <Wifi size={14} className={apPoints.length > 0 ? 'text-green-500' : 'opacity-40'} />
              <span className="flex-1 text-left truncate">{apPoints.length > 0 ? `${apPoints.length} AP(s) uploaded` : 'Access Points CSV (ssid,x,y,bssid)'}</span>
              {apPoints.length > 0 && <span className="text-green-500 text-[10px]">✓</span>}
            </button>

            {/* Ref Points CSV */}
            <input ref={refRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && loadRefPtsCsv(e.target.files[0])} />
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

              {/* CDF Plot - Not available for trilateration yet */}
              {false && cdfData.x && cdfData.x.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                  <h3 className="font-semibold text-sm mb-3">Cumulative Distribution Function (CDF)</h3>
                  {/* @ts-ignore - react-plotly.js typing issues */}
                  <Plot
                    data={[
                      {
                        x: [0],
                        y: [0],
                        type: 'scatter' as const,
                        mode: 'lines',
                        name: 'CDF',
                        line: { color: '#3b82f6', width: 2 },
                      },
                    ]}
                    layout={{
                      xaxis: { title: 'Positioning Error (m)', showgrid: true },
                      yaxis: { title: 'Cumulative Probability', range: [0, 1] },
                      margin: { l: 50, r: 20, t: 30, b: 40 },
                      hovermode: 'closest',
                      paper_bgcolor: 'transparent',
                      plot_bgcolor: 'transparent',
                      font: { color: 'var(--text-primary)' },
                    }}
                    config={{ responsive: true }}
                    style={{ height: '350px' }}
                  />
                </div>
              )}

              {/* Stats Cards - Not available for trilateration yet */}
              {false && statsData && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: 'Mean Error', key: 'mean' },
                    { label: 'Median Error', key: 'median' },
                    { label: 'Std Dev', key: 'std_dev' },
                    { label: '75th %ile', key: 'p75' },
                    { label: '90th %ile', key: 'p90' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg px-3 py-2 text-center"
                      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                      <p className="text-sm font-bold">{(statsData?.[s.key] ?? 0).toFixed(2)} m</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

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
                            {r.estimated_x !== null ? `(${r.estimated_x.toFixed(2)}, ${r.estimated_y?.toFixed(2)})` : '—'}
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
