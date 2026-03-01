import { useEffect, useState, useRef, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Line, Text, Group } from 'react-konva';
import { buildingsApi, signalApi, datasetsApi } from '../api';
import type {
  BuildingListItem,
  BuildingResponse,
  FloorResponse,
  DiscoveredAP,
  HeatmapPoint,
  BssidStats,
  DatasetListItem,
  PointXY,
} from '../api';
import {
  Radio,
  Search,
  Wifi,
  Square,
  BarChart3,
  RefreshCw,
  Crosshair,
} from 'lucide-react';

// ─── RSSI → Color mapping (MATLAB reference) ────────────
const RSSI_BANDS: { min: number; max: number; color: string; label: string }[] = [
  { min: -40,  max: 0,    color: '#ef4444', label: '0 to −40 dBm (Strong)' },
  { min: -50,  max: -40,  color: '#ec4899', label: '−41 to −50 dBm' },
  { min: -60,  max: -50,  color: '#22c55e', label: '−51 to −60 dBm' },
  { min: -70,  max: -60,  color: '#3b82f6', label: '−61 to −70 dBm' },
  { min: -80,  max: -70,  color: '#eab308', label: '−71 to −80 dBm' },
  { min: -90,  max: -80,  color: '#f97316', label: '−81 to −90 dBm' },
  { min: -100, max: -90,  color: '#6b7280', label: '−91 to −100 dBm' },
  { min: -999, max: -100, color: '#18181b', label: '< −100 dBm (Dead)' },
];

function rssiToColor(rssi: number): string {
  for (const band of RSSI_BANDS) {
    if (rssi > band.min && rssi <= band.max) return band.color;
    if (rssi <= band.min && band.min === -999) return band.color;
  }
  if (rssi > 0) return RSSI_BANDS[0].color;
  return RSSI_BANDS[RSSI_BANDS.length - 1].color;
}

// ─── Simple heat interpolation for smoothed surface ──────
function generateHeatmapImageData(
  points: HeatmapPoint[],
  width: number,
  height: number,
  radius: number,
  toPixel: (x: number, y: number) => { px: number; py: number },
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Accumulation buffers
  const weightSum = new Float32Array(width * height);
  const rssiSum = new Float32Array(width * height);

  for (const pt of points) {
    const { px, py } = toPixel(pt.x, pt.y);
    const cx = Math.round(px);
    const cy = Math.round(py);
    const r = radius;

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const ix = cx + dx;
        const iy = cy + dy;
        if (ix < 0 || ix >= width || iy < 0 || iy >= height) continue;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > r * r) continue;
        const w = 1 - Math.sqrt(dist2) / r;
        const idx = iy * width + ix;
        weightSum[idx] += w;
        rssiSum[idx] += w * pt.rssi;
      }
    }
  }

  const imageData = ctx.createImageData(width, height);
  for (let i = 0; i < width * height; i++) {
    if (weightSum[i] > 0.01) {
      const rssi = rssiSum[i] / weightSum[i];
      const hex = rssiToColor(rssi);
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      imageData.data[i * 4]     = r;
      imageData.data[i * 4 + 1] = g;
      imageData.data[i * 4 + 2] = b;
      imageData.data[i * 4 + 3] = 160; // semi-transparent
    }
  }
  return imageData;
}

// ─── Component ───────────────────────────────────────────
export default function SignalAnalyzer() {
  // ── Selection state ──
  const [buildings, setBuildings] = useState<BuildingListItem[]>([]);
  const [activeBuilding, setActiveBuilding] = useState<BuildingResponse | null>(null);
  const [activeFloor, setActiveFloor] = useState<FloorResponse | null>(null);
  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);

  // ── AP list ──
  const [aps, setAps] = useState<DiscoveredAP[]>([]);
  const [apSearch, setApSearch] = useState('');
  const [selectedBssid, setSelectedBssid] = useState<string | null>(null);
  const [bssidStats, setBssidStats] = useState<BssidStats | null>(null);
  const [loadingAps, setLoadingAps] = useState(false);

  // ── Heatmap data ──
  const [heatPoints, setHeatPoints] = useState<HeatmapPoint[]>([]);
  const [, setLoadingHeat] = useState(false);
  const [viewMode, setViewMode] = useState<'points' | 'smooth'>('points');
  const [smoothImage, setSmoothImage] = useState<HTMLImageElement | null>(null);

  // ── Canvas state ──
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Calibration (getrect-style) ──
  const [calibMode, setCalibMode] = useState(false);
  const [calibPt1, setCalibPt1] = useState<PointXY | null>(null);
  const [calibPt2, setCalibPt2] = useState<PointXY | null>(null);
  const [calibWidthM, setCalibWidthM] = useState('');
  const [calibHeightM, setCalibHeightM] = useState('');
  const [showCalibModal, setShowCalibModal] = useState(false);

  // ── Origin mode ──
  const [originMode, setOriginMode] = useState(false);

  // ─────────── Data fetching ───────────
  useEffect(() => {
    buildingsApi.list().then((r) => setBuildings(r.data)).catch(console.error);
    datasetsApi.list('rssi').then((r) => setDatasets(r.data)).catch(console.error);
  }, []);

  const selectBuilding = async (id: number) => {
    const r = await buildingsApi.get(id);
    setActiveBuilding(r.data);
    setActiveFloor(null);
    setImage(null);
    setAps([]);
    setHeatPoints([]);
    setSelectedBssid(null);
  };

  const selectFloor = (floor: FloorResponse) => {
    setActiveFloor(floor);
    setAps([]);
    setHeatPoints([]);
    setSelectedBssid(null);
    setSmoothImage(null);
    if (floor.filename) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.src = buildingsApi.getFloorImage(floor.building_id, floor.id);
      img.onload = () => {
        setImage(img);
        fitImage(img);
      };
    } else {
      setImage(null);
    }
  };

  // ─────────── Image fitting ───────────
  const fitImage = useCallback((img: HTMLImageElement) => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const s = Math.min(cw / img.width, ch / img.height, 1);
    setScale(s);
    setStageSize({ width: cw, height: ch });
  }, []);

  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (containerRef.current && image) fitImage(image);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [image, fitImage]);

  // ─────────── Load APs ───────────
  const loadAPs = async () => {
    setLoadingAps(true);
    try {
      const params: Record<string, number> = {};
      if (activeFloor) params.floor_id = activeFloor.id;
      if (selectedDatasetId) params.dataset_id = selectedDatasetId;
      const r = await signalApi.getAPs(params);
      setAps(r.data);
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed to load APs');
    }
    setLoadingAps(false);
  };

  // ─────────── Select AP → load heatmap ───────────
  const selectAP = async (bssid: string) => {
    setSelectedBssid(bssid);
    setLoadingHeat(true);
    setSmoothImage(null);
    try {
      const params: Record<string, number> = {};
      if (activeFloor) params.floor_id = activeFloor.id;
      if (selectedDatasetId) params.dataset_id = selectedDatasetId;
      const [heatResp, statsResp] = await Promise.all([
        signalApi.getHeatmap(bssid, params),
        signalApi.getStats(bssid, params),
      ]);
      setHeatPoints(heatResp.data.points);
      setBssidStats(statsResp.data);
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed to load heatmap');
      setHeatPoints([]);
      setBssidStats(null);
    }
    setLoadingHeat(false);
  };

  // ─────────── Coordinate transform ───────────
  const toPixel = useCallback((x: number, y: number): { px: number; py: number } => {
    const ppm = activeFloor?.pixels_per_meter || 1;
    const origin = activeFloor?.origin_px || { x: 0, y: 0 };
    return {
      px: origin.x + x * ppm,
      py: origin.y - y * ppm, // y-axis inverted
    };
  }, [activeFloor]);

  // ─────────── Generate smoothed surface ───────────
  useEffect(() => {
    if (viewMode !== 'smooth' || heatPoints.length === 0 || !image) {
      setSmoothImage(null);
      return;
    }
    // Compute on a smaller bitmap for performance
    const w = image.width;
    const h = image.height;
    const factor = Math.max(1, Math.floor(Math.max(w, h) / 400));
    const sw = Math.ceil(w / factor);
    const sh = Math.ceil(h / factor);
    const ppm = activeFloor?.pixels_per_meter || 1;
    const radius = Math.max(10, Math.round(2 * ppm / factor));

    const toPixelSmall = (x: number, y: number) => {
      const full = toPixel(x, y);
      return { px: full.px / factor, py: full.py / factor };
    };

    const imageData = generateHeatmapImageData(heatPoints, sw, sh, radius, toPixelSmall);
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);

    const img = new window.Image();
    img.src = canvas.toDataURL();
    img.onload = () => setSmoothImage(img);
  }, [viewMode, heatPoints, image, activeFloor, toPixel]);

  // ─────────── Canvas click ───────────
  const handleCanvasClick = (e: any) => {
    if (!image) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const ix = pos.x / scale;
    const iy = pos.y / scale;
    const pt: PointXY = { x: Math.round(ix * 100) / 100, y: Math.round(iy * 100) / 100 };

    if (calibMode) {
      if (!calibPt1) {
        setCalibPt1(pt);
      } else if (!calibPt2) {
        setCalibPt2(pt);
        setShowCalibModal(true);
      }
      return;
    }

    if (originMode) {
      submitOrigin(pt);
      return;
    }
  };

  // ─────────── Calibrate ───────────
  const submitCalibration = async () => {
    if (!activeBuilding || !activeFloor || !calibPt1 || !calibPt2) return;
    const wm = parseFloat(calibWidthM);
    const hm = parseFloat(calibHeightM);
    if (isNaN(wm) || isNaN(hm) || wm <= 0 || hm <= 0) {
      alert('Enter valid width & height in metres');
      return;
    }
    try {
      await buildingsApi.calibrateFloor(activeBuilding.id, activeFloor.id, {
        calib_rect_px: { x1: calibPt1.x, y1: calibPt1.y, x2: calibPt2.x, y2: calibPt2.y },
        calib_rect_m: { width_m: wm, height_m: hm },
      });
      await refreshFloor();
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Calibration failed');
    }
    setCalibMode(false);
    setCalibPt1(null);
    setCalibPt2(null);
    setCalibWidthM('');
    setCalibHeightM('');
    setShowCalibModal(false);
  };

  const submitOrigin = async (pt: PointXY) => {
    if (!activeBuilding || !activeFloor) return;
    try {
      await buildingsApi.setFloorOrigin(activeBuilding.id, activeFloor.id, { origin: pt });
      await refreshFloor();
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed');
    }
    setOriginMode(false);
  };

  const refreshFloor = async () => {
    if (!activeBuilding) return;
    const b = await buildingsApi.get(activeBuilding.id);
    setActiveBuilding(b.data);
    if (activeFloor) {
      const updated = b.data.floors.find((f) => f.id === activeFloor.id);
      if (updated) setActiveFloor(updated);
    }
  };

  // ─────────── Filtered APs ───────────
  const filteredAps = aps.filter((ap) => {
    const q = apSearch.toLowerCase();
    return (
      ap.bssid.toLowerCase().includes(q) ||
      (ap.ssid && ap.ssid.toLowerCase().includes(q))
    );
  });

  // ─────────── Render ───────────
  return (
    <div className="flex flex-col h-full">
      {/* ════════ TOP BAR ════════ */}
      <div
        className="flex items-center gap-4 px-4 py-2.5 border-b shrink-0"
        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-1.5">
          <Radio size={18} style={{ color: 'var(--accent)' }} />
          <span className="font-semibold text-sm">Signal Analyzer</span>
        </div>

        {/* Building selector */}
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] opacity-60">Building:</label>
          <select
            value={activeBuilding?.id ?? ''}
            onChange={(e) => e.target.value && selectBuilding(Number(e.target.value))}
            className="px-2 py-1 rounded text-xs"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="">Select...</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Floor selector */}
        {activeBuilding && (
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] opacity-60">Floor:</label>
            <select
              value={activeFloor?.id ?? ''}
              onChange={(e) => {
                const f = activeBuilding.floors.find((fl) => fl.id === Number(e.target.value));
                if (f) selectFloor(f);
              }}
              className="px-2 py-1 rounded text-xs"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="">Select...</option>
              {activeBuilding.floors.map((f) => (
                <option key={f.id} value={f.id}>
                  F{f.floor_number}{f.label ? ` — ${f.label}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Dataset selector */}
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] opacity-60">Dataset:</label>
          <select
            value={selectedDatasetId ?? ''}
            onChange={(e) => setSelectedDatasetId(e.target.value ? Number(e.target.value) : null)}
            className="px-2 py-1 rounded text-xs"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="">All RSSI datasets</option>
            {datasets.map((ds) => (
              <option key={ds.id} value={ds.id}>{ds.name} ({ds.data_type})</option>
            ))}
          </select>
        </div>

        <div className="flex-1" />

        {/* View mode toggle */}
        {heatPoints.length > 0 && (
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('points')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'points' ? 'bg-blue-600 text-white' : 'opacity-60 hover:opacity-100'
              }`}
            >
              Raw Points
            </button>
            <button
              onClick={() => setViewMode('smooth')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'smooth' ? 'bg-blue-600 text-white' : 'opacity-60 hover:opacity-100'
              }`}
            >
              Smoothed
            </button>
          </div>
        )}
      </div>

      {/* ════════ MAIN AREA ════════ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ──── LEFT SIDEBAR: AP Manager ──── */}
        <div
          className="w-72 shrink-0 flex flex-col overflow-hidden"
          style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--border)' }}
        >
          {/* Load APs */}
          <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={loadAPs}
              disabled={loadingAps}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-white transition-colors"
              style={{ background: 'var(--accent)' }}
            >
              {loadingAps ? <RefreshCw size={14} className="animate-spin" /> : <Wifi size={14} />}
              {loadingAps ? 'Loading...' : 'Load Access Points'}
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded"
                 style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <Search size={13} className="opacity-40" />
              <input
                value={apSearch}
                onChange={(e) => setApSearch(e.target.value)}
                placeholder="Search BSSID or SSID..."
                className="flex-1 bg-transparent text-xs outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
            <p className="text-[10px] opacity-40 mt-1">{filteredAps.length} AP(s) found</p>
          </div>

          {/* AP list */}
          <div className="flex-1 overflow-y-auto">
            {filteredAps.map((ap) => (
              <button
                key={ap.bssid}
                onClick={() => selectAP(ap.bssid)}
                className={`w-full text-left px-3 py-2 border-b text-xs transition-colors hover:bg-white/5
                  ${selectedBssid === ap.bssid ? 'bg-blue-600/15 border-l-2 border-l-blue-500' : ''}`}
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono truncate text-[11px]">
                    {ap.bssid}
                  </span>
                  <span
                    className="ml-1 w-2 h-2 rounded-full shrink-0"
                    style={{ background: rssiToColor(ap.avg_rssi) }}
                  />
                </div>
                {ap.ssid && (
                  <span className="opacity-50 text-[10px]">{ap.ssid}</span>
                )}
                <div className="flex items-center gap-2 mt-0.5 opacity-40 text-[10px]">
                  <span>{ap.count} readings</span>
                  <span>avg {ap.avg_rssi} dBm</span>
                </div>
              </button>
            ))}
            {aps.length === 0 && (
              <p className="text-center py-8 text-xs opacity-30">
                Click "Load Access Points" to discover APs from your datasets
              </p>
            )}
          </div>

          {/* Stats panel */}
          {bssidStats && (
            <div className="p-3 border-t text-xs space-y-1"
                 style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart3 size={13} style={{ color: 'var(--accent)' }} />
                <span className="font-semibold text-[11px]">AP Statistics</span>
              </div>
              <p className="font-mono text-[10px] truncate opacity-60">{bssidStats.bssid}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                <span className="opacity-50">Readings:</span><span>{bssidStats.count}</span>
                <span className="opacity-50">Min RSSI:</span><span>{bssidStats.min_rssi} dBm</span>
                <span className="opacity-50">Max RSSI:</span><span>{bssidStats.max_rssi} dBm</span>
                <span className="opacity-50">Mean:</span><span>{bssidStats.mean_rssi} dBm</span>
                <span className="opacity-50">Median:</span><span>{bssidStats.median_rssi} dBm</span>
                <span className="opacity-50">Std Dev:</span><span>{bssidStats.std_rssi}</span>
              </div>
            </div>
          )}
        </div>

        {/* ──── CENTER: Canvas ──── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Canvas toolbar */}
          {activeFloor && image && (
            <div className="flex items-center gap-1 px-3 py-1.5 border-b"
                 style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)' }}>
              <button
                onClick={() => { setCalibMode(!calibMode); setOriginMode(false); setCalibPt1(null); setCalibPt2(null); }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors
                  ${calibMode ? 'bg-blue-600 text-white' : 'opacity-60 hover:opacity-100'}`}
                title="Draw calibration rectangle"
              >
                <Square size={13} /> Calibrate
              </button>
              <button
                onClick={() => { setOriginMode(!originMode); setCalibMode(false); }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors
                  ${originMode ? 'bg-purple-600 text-white' : 'opacity-60 hover:opacity-100'}`}
                title="Set coordinate origin"
              >
                <Crosshair size={13} /> Origin
              </button>
              <div className="flex-1" />
              {activeFloor.pixels_per_meter && (
                <span className="text-[10px] text-green-400">✓ {activeFloor.pixels_per_meter.toFixed(1)} px/m</span>
              )}
              {heatPoints.length > 0 && (
                <span className="text-[10px] opacity-40 ml-2">{heatPoints.length} data points</span>
              )}
            </div>
          )}

          {/* Canvas area */}
          <div ref={containerRef} className="flex-1 overflow-hidden relative"
               style={{ background: '#1a1a2e' }}>
            {!image && (
              <div className="flex items-center justify-center h-full text-sm opacity-40">
                {activeBuilding
                  ? activeFloor ? 'Upload a floor plan image to the floor in Map Builder' : 'Select a floor'
                  : 'Select a building and floor to begin'}
              </div>
            )}
            {image && (
              <Stage
                width={stageSize.width}
                height={stageSize.height}
                scaleX={scale}
                scaleY={scale}
                onClick={handleCanvasClick}
                style={{ cursor: calibMode || originMode ? 'crosshair' : 'default' }}
              >
                <Layer>
                  {/* Floor plan */}
                  <KonvaImage image={image} />

                  {/* Smoothed heatmap overlay */}
                  {viewMode === 'smooth' && smoothImage && (
                    <KonvaImage
                      image={smoothImage}
                      width={image.width}
                      height={image.height}
                      opacity={0.65}
                      listening={false}
                    />
                  )}

                  {/* Raw data points */}
                  {viewMode === 'points' && heatPoints.map((pt, i) => {
                    const { px, py } = toPixel(pt.x, pt.y);
                    return (
                      <Circle
                        key={i}
                        x={px}
                        y={py}
                        radius={4 / scale}
                        fill={rssiToColor(pt.rssi)}
                        opacity={0.85}
                        listening={false}
                      />
                    );
                  })}

                  {/* Existing calibration rect */}
                  {activeFloor?.calib_rect_px && (
                    <Rect
                      x={activeFloor.calib_rect_px.x1}
                      y={activeFloor.calib_rect_px.y1}
                      width={activeFloor.calib_rect_px.x2 - activeFloor.calib_rect_px.x1}
                      height={activeFloor.calib_rect_px.y2 - activeFloor.calib_rect_px.y1}
                      stroke="#3b82f6"
                      strokeWidth={1.5 / scale}
                      dash={[6 / scale, 3 / scale]}
                      listening={false}
                    />
                  )}

                  {/* Drawing calibration */}
                  {calibMode && calibPt1 && (
                    <Circle x={calibPt1.x} y={calibPt1.y} radius={5 / scale} fill="#3b82f6" />
                  )}
                  {calibMode && calibPt1 && calibPt2 && (
                    <Rect
                      x={Math.min(calibPt1.x, calibPt2.x)}
                      y={Math.min(calibPt1.y, calibPt2.y)}
                      width={Math.abs(calibPt2.x - calibPt1.x)}
                      height={Math.abs(calibPt2.y - calibPt1.y)}
                      stroke="#3b82f6"
                      strokeWidth={2 / scale}
                      fill="rgba(59,130,246,0.1)"
                      listening={false}
                    />
                  )}

                  {/* Origin marker */}
                  {activeFloor?.origin_px && (
                    <Group x={activeFloor.origin_px.x} y={activeFloor.origin_px.y}>
                      <Line points={[-12 / scale, 0, 12 / scale, 0]}
                            stroke="#8b5cf6" strokeWidth={2 / scale} />
                      <Line points={[0, -12 / scale, 0, 12 / scale]}
                            stroke="#8b5cf6" strokeWidth={2 / scale} />
                      <Text text="O" x={4 / scale} y={-16 / scale}
                            fill="#8b5cf6" fontSize={12 / scale} />
                    </Group>
                  )}

                  {/* Placed APs */}
                  {activeFloor?.access_points.map((ap) => (
                    <Group key={ap.id} x={ap.x_px} y={ap.y_px}>
                      <Circle radius={6 / scale} fill="#f59e0b" opacity={0.8} />
                      <Text text={ap.ssid || ap.bssid.slice(-5)}
                            x={8 / scale} y={-5 / scale}
                            fill="#f59e0b" fontSize={9 / scale} listening={false} />
                    </Group>
                  ))}
                </Layer>
              </Stage>
            )}
          </div>

          {/* ──── BOTTOM: RSSI Legend ──── */}
          <div
            className="flex items-center gap-3 px-4 py-2 border-t shrink-0"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)' }}
          >
            <span className="text-[10px] font-semibold opacity-50 uppercase tracking-wider mr-1">RSSI Scale</span>
            {RSSI_BANDS.map((band) => (
              <div key={band.label} className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ background: band.color }}
                />
                <span className="text-[10px] opacity-60 whitespace-nowrap">{band.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════ CALIBRATION MODAL ════════ */}
      {showCalibModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-xl p-6 w-96 shadow-2xl"
               style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <h3 className="text-sm font-bold mb-3">Enter Real-World Dimensions</h3>
            <p className="text-xs opacity-60 mb-4">
              You drew a rectangle on the map. Enter its physical size to calibrate the scale.
            </p>
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="text-[11px] opacity-60 block mb-1">Width (m)</label>
                <input
                  value={calibWidthM}
                  onChange={(e) => setCalibWidthM(e.target.value)}
                  type="number"
                  step="0.1"
                  className="w-full px-3 py-2 rounded text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  autoFocus
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] opacity-60 block mb-1">Height (m)</label>
                <input
                  value={calibHeightM}
                  onChange={(e) => setCalibHeightM(e.target.value)}
                  type="number"
                  step="0.1"
                  className="w-full px-3 py-2 rounded text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCalibModal(false);
                  setCalibMode(false);
                  setCalibPt1(null);
                  setCalibPt2(null);
                }}
                className="px-4 py-2 rounded text-xs"
                style={{ background: 'var(--bg-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={submitCalibration}
                className="px-4 py-2 rounded text-xs font-medium text-white"
                style={{ background: 'var(--accent)' }}
              >
                Apply Calibration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
