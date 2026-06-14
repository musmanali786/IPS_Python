import { useState, useRef, useMemo } from 'react';
import { experimentsApi } from '../../api';
import type { LabFingerprintingResponse } from '../../api';
import { FlaskConical, Upload, FileText, MapPin, Play, Eye, Database, Search } from 'lucide-react';
import Plot from 'react-plotly.js';

export default function ExperimentFingerprintingLab() {
  // File state
  const [refPtsCsv, setRefPtsCsv] = useState<File | null>(null);
  const [testPtsCsv, setTestPtsCsv] = useState<File | null>(null);
  const [trainLogFiles, setTrainLogFiles] = useState<File[]>([]);
  const [testLogFiles, setTestLogFiles] = useState<File[]>([]);
  const [mapImage, setMapImage] = useState<File | null>(null);
  const [mapUrl, setMapUrl] = useState<string | null>(null);

  // Parameters
  const [k, setK] = useState(3);
  const [algorithm, setAlgorithm] = useState<'nearest' | 'knn' | 'wknn'>('nearest');
  const [maxAps, setMaxAps] = useState(10);
  const [pixelsPerMeter, setPixelsPerMeter] = useState(20);
  const [scanMode, setScanMode] = useState<'first' | 'average'>('first');

  // Results
  const [result, setResult] = useState<LabFingerprintingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);

  // Refs for hidden file inputs
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
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      alert(err.response?.data?.detail || 'Error running fingerprinting experiment');
    }
    setLoading(false);
  };

  // SVG coordinate helpers
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

  const statsData = useMemo(() => {
    if (!result || !result.statistics) return null;
    return result.statistics as Record<string, number>;
  }, [result]);

  const cdfData = useMemo(() => {
    if (!result || !result.cdf) return { x: [], y: [] };
    return result.cdf;
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
                <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>k (neighbors)</label>
                <input type="number" min="1" max="20" value={k} onChange={(e) => setK(parseInt(e.target.value) || 3)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Max APs</label>
                <input type="number" min="1" max="50" value={maxAps} onChange={(e) => setMaxAps(parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>px/meter</label>
                <input type="number" value={pixelsPerMeter} onChange={(e) => setPixelsPerMeter(parseInt(e.target.value) || 20)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>Scan Mode</label>
              <select value={scanMode} onChange={(e) => setScanMode(e.target.value as 'first' | 'average')}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                <option value="first">First Scan</option>
                <option value="average">Average Scan</option>
              </select>
            </div>
          </div>

          <button onClick={run} disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ background: 'var(--accent)' }}>
            <Play size={16} />
            {loading ? 'Processing Files...' : 'Run Fingerprinting Lab'}
          </button>
        </div>

        {/* ── Right: Results ───────────────────────────────────── */}
        <div className="xl:col-span-2">
          {result ? (
            <div className="space-y-4">
              {/* Skipped points notice */}
              {(result.skipped_ref_points.length > 0 || result.skipped_test_points.length > 0) && (
                <div className="rounded-lg px-4 py-3 text-xs"
                  style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid #f59e0b', color: '#f59e0b' }}>
                  {result.skipped_ref_points.length > 0 && (
                    <p>Skipped {result.skipped_ref_points.length} reference point(s) with no matching training log:{' '}
                      <strong>{result.skipped_ref_points.join(', ')}</strong></p>
                  )}
                  {result.skipped_test_points.length > 0 && (
                    <p>Skipped {result.skipped_test_points.length} test point(s) with no matching test log:{' '}
                      <strong>{result.skipped_test_points.join(', ')}</strong></p>
                  )}
                </div>
              )}

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
                    <rect x={3} y={48} width={12} height={12} fill="#10b981"
                      transform="rotate(45,9,54)" />
                    <text x={20} y={58} fill="var(--text-primary)" fontSize={10}>Estimated Pos</text>
                  </g>
                </svg>
              </div>

              {/* CDF Plot */}
              {cdfData.x && cdfData.x.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                  <h3 className="font-semibold text-sm mb-3">Cumulative Distribution Function (CDF)</h3>
                  <Plot
                    data={[
                      {
                        x: cdfData.x,
                        y: cdfData.y,
                        type: 'scatter',
                        mode: 'lines',
                        name: 'CDF',
                        line: { color: '#3b82f6', width: 2 },
                      },
                      ...(statsData?.['median'] ? [{
                        x: [statsData['median'], statsData['median']],
                        y: [0, 1],
                        type: 'scatter' as const,
                        mode: 'lines' as const,
                        name: `Median: ${statsData['median'].toFixed(2)}m`,
                        line: { color: '#10b981', width: 2, dash: 'dash' as const },
                      }] : []),
                    ]}
                    layout={{
                      xaxis: { title: { text: 'Positioning Error (m)' }, showgrid: true },
                      yaxis: { title: { text: 'Cumulative Probability' }, range: [0, 1] },
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

              {/* Stats Cards */}
              {statsData && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: 'Mean Error', key: 'mean' },
                    { label: 'Median Error', key: 'median' },
                    { label: 'Std Dev', key: 'std' },
                    { label: '75th %ile', key: 'p75' },
                    { label: '90th %ile', key: 'p90' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg px-3 py-2 text-center"
                      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                      <p className="text-sm font-bold">{(statsData[s.key] ?? 0).toFixed(2)} m</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Results Table */}
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <h3 className="font-semibold text-sm mb-3">Test Results</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th className="text-left py-2 px-2">Test ID</th>
                        <th className="text-left py-2 px-2">Ground Truth</th>
                        <th className="text-left py-2 px-2">Estimated</th>
                        <th className="text-left py-2 px-2">Matched Ref</th>
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
                          <td className="py-2 px-2 font-medium">{t.test_id}</td>
                          <td className="py-2 px-2 font-mono">({t.test_x.toFixed(1)}, {t.test_y.toFixed(1)})</td>
                          <td className="py-2 px-2 font-mono" style={{ color: '#10b981' }}>
                            {t.estimated_x !== null ? `(${t.estimated_x.toFixed(1)}, ${t.estimated_y!.toFixed(1)})` : '—'}
                          </td>
                          <td className="py-2 px-2 text-center">{t.matched_ref ?? '—'}</td>
                          <td className="py-2 px-2 font-mono font-bold"
                            style={{ color: t.error_m !== null && t.error_m < 3 ? '#10b981' : '#f97316' }}>
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
                  Upload reference point fingerprints and test scan files to evaluate WiFi
                  fingerprint-based positioning using nearest-neighbor or k-NN algorithms.
                </p>
                <div className="mt-6 text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
                  <p><strong>RefPts CSV:</strong> id, x, y, filetag</p>
                  <p><strong>TestPts CSV:</strong> id, x, y, filetag</p>
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
