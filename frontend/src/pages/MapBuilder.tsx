import { useEffect, useState, useRef, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Line, Text, Group } from 'react-konva';
import { buildingsApi } from '../api';
import type {
  BuildingListItem,
  BuildingResponse,
  FloorResponse,
  PointXY,
} from '../api';
import {
  Plus,
  Trash2,
  Upload,
  Square,
  Waypoints,
  Globe,
  Wifi,
  Crosshair,
  Download,
  ChevronRight,
  Layers,
  Building2,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────
type ToolMode = 'idle' | 'calibrate' | 'origin' | 'path' | 'geo' | 'ap';

// Color scheme per mode
const TOOL_COLORS: Record<ToolMode, string> = {
  idle: '#6b7280',
  calibrate: '#3b82f6', // blue
  origin: '#8b5cf6',    // purple
  path: '#ef4444',      // red
  geo: '#22c55e',       // green
  ap: '#f59e0b',        // amber
};

// ─── MapBuilder Component ──────────────────────────────
export default function MapBuilder() {
  // ── Building / Floor state ──
  const [buildings, setBuildings] = useState<BuildingListItem[]>([]);
  const [activeBuilding, setActiveBuilding] = useState<BuildingResponse | null>(null);
  const [activeFloor, setActiveFloor] = useState<FloorResponse | null>(null);
  const [newBuildingName, setNewBuildingName] = useState('');
  const [newFloorLabel, setNewFloorLabel] = useState('');
  const [newFloorNumber, setNewFloorNumber] = useState(0);

  // ── Canvas state ──
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<ToolMode>('idle');
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Calibration state ──
  const [calibPt1, setCalibPt1] = useState<PointXY | null>(null);
  const [calibPt2, setCalibPt2] = useState<PointXY | null>(null);
  const [calibWidthM, setCalibWidthM] = useState('');
  const [calibHeightM, setCalibHeightM] = useState('');

  // ── Path state ──
  const [pathWaypoints, setPathWaypoints] = useState<PointXY[]>([]);
  const [pathName, setPathName] = useState('');
  const [pathSpacing, setPathSpacing] = useState('1.0');

  // ── AP placement state ──
  const [apBssid, setApBssid] = useState('');
  const [apSsid, setApSsid] = useState('');
  const [apPending, setApPending] = useState<PointXY | null>(null);

  // ── Geo anchor state ──
  const [geoAnchors, setGeoAnchors] = useState<{ px: PointXY; lat: string; lon: string }[]>([]);

  // ── Loading ──
  const [loading, setLoading] = useState(false);

  // ─────────── Data fetching ───────────
  const loadBuildings = useCallback(() => {
    buildingsApi.list().then((r) => setBuildings(r.data)).catch(console.error);
  }, []);

  useEffect(() => { loadBuildings(); }, [loadBuildings]);

  const selectBuilding = async (id: number) => {
    const r = await buildingsApi.get(id);
    setActiveBuilding(r.data);
    setActiveFloor(null);
    setImage(null);
    resetToolState();
  };

  const selectFloor = (floor: FloorResponse) => {
    setActiveFloor(floor);
    resetToolState();
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

  // ─────────── Tool reset ───────────
  const resetToolState = () => {
    setTool('idle');
    setCalibPt1(null);
    setCalibPt2(null);
    setCalibWidthM('');
    setCalibHeightM('');
    setPathWaypoints([]);
    setPathName('');
    setPathSpacing('1.0');
    setApBssid('');
    setApSsid('');
    setApPending(null);
    setGeoAnchors([]);
  };

  // ─────────── CRUD actions ───────────
  const createBuilding = async () => {
    if (!newBuildingName.trim()) return;
    const r = await buildingsApi.create({ name: newBuildingName.trim() });
    setNewBuildingName('');
    loadBuildings();
    setActiveBuilding(r.data);
  };

  const deleteBuilding = async (id: number) => {
    if (!confirm('Delete this building and all its floors?')) return;
    await buildingsApi.delete(id);
    if (activeBuilding?.id === id) {
      setActiveBuilding(null);
      setActiveFloor(null);
      setImage(null);
    }
    loadBuildings();
  };

  const createFloor = async () => {
    if (!activeBuilding) return;
    await buildingsApi.createFloor(activeBuilding.id, {
      floor_number: newFloorNumber,
      label: newFloorLabel || undefined,
    });
    setNewFloorLabel('');
    setNewFloorNumber((activeBuilding.floors?.length || 0));
    // Refresh building
    const b = await buildingsApi.get(activeBuilding.id);
    setActiveBuilding(b.data);
  };

  const uploadFloorImage = async () => {
    if (!activeBuilding || !activeFloor) return;
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      await buildingsApi.uploadFloorImage(activeBuilding.id, activeFloor.id, file);
      // Refresh
      const b = await buildingsApi.get(activeBuilding.id);
      setActiveBuilding(b.data);
      const updatedFloor = b.data.floors.find((f) => f.id === activeFloor.id);
      if (updatedFloor) selectFloor(updatedFloor);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Upload failed');
    }
    setLoading(false);
  };

  const deleteFloor = async (floorId: number) => {
    if (!activeBuilding || !confirm('Delete this floor?')) return;
    await buildingsApi.deleteFloor(activeBuilding.id, floorId);
    if (activeFloor?.id === floorId) {
      setActiveFloor(null);
      setImage(null);
    }
    const b = await buildingsApi.get(activeBuilding.id);
    setActiveBuilding(b.data);
  };

  // ─────────── Canvas click handler ───────────
  const handleCanvasClick = (e: any) => {
    if (!image || !activeFloor) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const ix = pos.x / scale;
    const iy = pos.y / scale;
    const pt: PointXY = { x: Math.round(ix * 100) / 100, y: Math.round(iy * 100) / 100 };

    switch (tool) {
      case 'calibrate':
        if (!calibPt1) setCalibPt1(pt);
        else if (!calibPt2) setCalibPt2(pt);
        break;
      case 'origin':
        submitOrigin(pt);
        break;
      case 'path':
        setPathWaypoints((prev) => [...prev, pt]);
        break;
      case 'ap':
        setApPending(pt);
        break;
      case 'geo':
        if (geoAnchors.length < 2) {
          setGeoAnchors((prev) => [...prev, { px: pt, lat: '', lon: '' }]);
        }
        break;
    }
  };

  // ─────────── Calibrate (area-rect) ───────────
  const submitCalibration = async () => {
    if (!activeBuilding || !activeFloor || !calibPt1 || !calibPt2) return;
    const wm = parseFloat(calibWidthM);
    const hm = parseFloat(calibHeightM);
    if (isNaN(wm) || isNaN(hm) || wm <= 0 || hm <= 0) {
      alert('Enter valid width & height in metres');
      return;
    }
    setLoading(true);
    try {
      await buildingsApi.calibrateFloor(activeBuilding.id, activeFloor.id, {
        calib_rect_px: { x1: calibPt1.x, y1: calibPt1.y, x2: calibPt2.x, y2: calibPt2.y },
        calib_rect_m: { width_m: wm, height_m: hm },
      });
      await refreshFloor();
      setTool('idle');
      setCalibPt1(null);
      setCalibPt2(null);
      setCalibWidthM('');
      setCalibHeightM('');
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Calibration failed');
    }
    setLoading(false);
  };

  // ─────────── Set origin ───────────
  const submitOrigin = async (pt: PointXY) => {
    if (!activeBuilding || !activeFloor) return;
    try {
      await buildingsApi.setFloorOrigin(activeBuilding.id, activeFloor.id, { origin: pt });
      await refreshFloor();
      setTool('idle');
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed');
    }
  };

  // ─────────── Path ───────────
  const submitPath = async () => {
    if (!activeBuilding || !activeFloor || pathWaypoints.length < 2) return;
    const name = pathName.trim() || `Path ${(activeFloor.paths?.length || 0) + 1}`;
    const spacing = parseFloat(pathSpacing) || 1.0;
    setLoading(true);
    try {
      await buildingsApi.createPath(activeBuilding.id, activeFloor.id, {
        name,
        waypoints_px: pathWaypoints,
        spacing_m: spacing,
      });
      await refreshFloor();
      setPathWaypoints([]);
      setPathName('');
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed');
    }
    setLoading(false);
  };

  const deletePath = async (pathId: number) => {
    if (!activeBuilding || !activeFloor) return;
    await buildingsApi.deletePath(activeBuilding.id, activeFloor.id, pathId);
    await refreshFloor();
  };

  // ─────────── AP ───────────
  const submitAP = async () => {
    if (!activeBuilding || !activeFloor || !apPending || !apBssid.trim()) return;
    setLoading(true);
    try {
      await buildingsApi.createAP(activeBuilding.id, activeFloor.id, {
        bssid: apBssid.trim(),
        ssid: apSsid.trim() || undefined,
        x_px: apPending.x,
        y_px: apPending.y,
      });
      await refreshFloor();
      setApPending(null);
      setApBssid('');
      setApSsid('');
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed');
    }
    setLoading(false);
  };

  const deleteAP = async (apId: number) => {
    if (!activeBuilding || !activeFloor) return;
    await buildingsApi.deleteAP(activeBuilding.id, activeFloor.id, apId);
    await refreshFloor();
  };

  // ─────────── Geo anchors ───────────
  const submitGeo = async () => {
    if (!activeBuilding || !activeFloor || geoAnchors.length < 2) return;
    const anchors = geoAnchors.map((a) => ({
      px: a.px,
      lat: parseFloat(a.lat),
      lon: parseFloat(a.lon),
    }));
    if (anchors.some((a) => isNaN(a.lat) || isNaN(a.lon))) {
      alert('Enter valid lat/lon for both anchors');
      return;
    }
    setLoading(true);
    try {
      await buildingsApi.setFloorGeo(activeBuilding.id, activeFloor.id, { anchors });
      await refreshFloor();
      setGeoAnchors([]);
      setTool('idle');
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed');
    }
    setLoading(false);
  };

  // ─────────── Export ───────────
  const exportJSON = async () => {
    if (!activeBuilding) return;
    const r = await buildingsApi.exportJSON(activeBuilding.id);
    const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeBuilding.name.replace(/\s+/g, '_')}_map_config.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─────────── Refresh helper ───────────
  const refreshFloor = async () => {
    if (!activeBuilding) return;
    const b = await buildingsApi.get(activeBuilding.id);
    setActiveBuilding(b.data);
    if (activeFloor) {
      const updated = b.data.floors.find((f) => f.id === activeFloor.id);
      if (updated) setActiveFloor(updated);
    }
  };

  // ─────────── Tool definitions ───────────
  const tools: { mode: ToolMode; icon: typeof Square; label: string; tip: string }[] = [
    { mode: 'calibrate', icon: Square, label: 'Calibrate', tip: 'Click 2 opposite corners of a known area' },
    { mode: 'origin', icon: Crosshair, label: 'Origin', tip: 'Click to set coordinate origin' },
    { mode: 'path', icon: Waypoints, label: 'Path', tip: 'Click waypoints, then save' },
    { mode: 'geo', icon: Globe, label: 'Geo', tip: 'Click 2 points and enter lat/lon' },
    { mode: 'ap', icon: Wifi, label: 'AP', tip: 'Click to place an access point' },
  ];

  // ─────────── Render ───────────
  const showCalibRect = tool === 'calibrate' && calibPt1 && calibPt2;

  return (
    <div className="flex h-full">
      {/* ════════ LEFT SIDEBAR ════════ */}
      <div
        className="w-80 shrink-0 overflow-y-auto flex flex-col"
        style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--border)' }}
      >
        {/* ── Building Management ── */}
        <section className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5"
              style={{ color: 'var(--text-secondary)' }}>
            <Building2 size={14} /> Buildings
          </h3>

          <div className="flex gap-2 mb-3">
            <input
              value={newBuildingName}
              onChange={(e) => setNewBuildingName(e.target.value)}
              placeholder="New building name"
              className="flex-1 px-2 py-1.5 rounded text-xs"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              onKeyDown={(e) => e.key === 'Enter' && createBuilding()}
            />
            <button
              onClick={createBuilding}
              className="px-2 py-1.5 rounded text-xs font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="space-y-1 max-h-40 overflow-y-auto">
            {buildings.map((b) => (
              <div
                key={b.id}
                onClick={() => selectBuilding(b.id)}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer transition-colors
                  ${activeBuilding?.id === b.id ? 'ring-1 ring-blue-500 bg-blue-500/10' : 'hover:bg-white/5'}`}
                style={{ color: 'var(--text-primary)' }}
              >
                <span className="truncate flex items-center gap-1.5">
                  <ChevronRight size={12} className={activeBuilding?.id === b.id ? 'rotate-90 transition-transform' : 'transition-transform'} />
                  {b.name}
                  <span className="text-[10px] opacity-50">({b.floor_count}F)</span>
                </span>
                <button onClick={(e) => { e.stopPropagation(); deleteBuilding(b.id); }}
                        className="p-0.5 hover:text-red-400 opacity-50 hover:opacity-100">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {buildings.length === 0 && (
              <p className="text-[11px] opacity-40 text-center py-2">No buildings yet</p>
            )}
          </div>
        </section>

        {/* ── Floor Management ── */}
        {activeBuilding && (
          <section className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5"
                style={{ color: 'var(--text-secondary)' }}>
              <Layers size={14} /> Floors — {activeBuilding.name}
            </h3>

            <div className="flex gap-2 mb-3">
              <input
                value={newFloorLabel}
                onChange={(e) => setNewFloorLabel(e.target.value)}
                placeholder="Label (e.g. Ground)"
                className="flex-1 px-2 py-1.5 rounded text-xs"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
              <input
                type="number"
                value={newFloorNumber}
                onChange={(e) => setNewFloorNumber(parseInt(e.target.value) || 0)}
                className="w-12 px-2 py-1.5 rounded text-xs text-center"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                title="Floor #"
              />
              <button onClick={createFloor} className="px-2 py-1.5 rounded text-xs font-medium text-white"
                      style={{ background: 'var(--accent)' }}>
                <Plus size={14} />
              </button>
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {activeBuilding.floors.map((f) => (
                <div
                  key={f.id}
                  onClick={() => selectFloor(f)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer transition-colors
                    ${activeFloor?.id === f.id ? 'ring-1 ring-blue-500 bg-blue-500/10' : 'hover:bg-white/5'}`}
                  style={{ color: 'var(--text-primary)' }}
                >
                  <span className="truncate">
                    F{f.floor_number}{f.label ? ` — ${f.label}` : ''}
                    {f.filename && <span className="text-[10px] opacity-50 ml-1">📷</span>}
                    {f.pixels_per_meter && <span className="text-[10px] text-green-400 ml-1">✓cal</span>}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); deleteFloor(f.id); }}
                          className="p-0.5 hover:text-red-400 opacity-50 hover:opacity-100">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {activeBuilding.floors.length === 0 && (
                <p className="text-[11px] opacity-40 text-center py-2">No floors yet</p>
              )}
            </div>

            {/* Floor image upload */}
            {activeFloor && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                  Floor Plan Image
                </label>
                <div className="flex gap-2">
                  <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.bmp" className="flex-1 text-[11px]" />
                  <button onClick={uploadFloorImage} disabled={loading}
                          className="px-2 py-1 rounded text-[11px] font-medium text-white"
                          style={{ background: 'var(--accent)' }}>
                    <Upload size={12} />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Tool Options Panel ── */}
        {activeFloor && image && (
          <section className="p-4 flex-1 overflow-y-auto">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--text-secondary)' }}>
              Tool Options
            </h3>

            {/* Calibration form */}
            {tool === 'calibrate' && (
              <div className="space-y-2 text-xs">
                <p className="opacity-60">Click two opposite corners of a known rectangular area on the map.</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] opacity-60 block mb-0.5">Width (m)</label>
                    <input value={calibWidthM} onChange={(e) => setCalibWidthM(e.target.value)}
                           className="w-full px-2 py-1.5 rounded"
                           style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                           type="number" step="0.1" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] opacity-60 block mb-0.5">Height (m)</label>
                    <input value={calibHeightM} onChange={(e) => setCalibHeightM(e.target.value)}
                           className="w-full px-2 py-1.5 rounded"
                           style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                           type="number" step="0.1" />
                  </div>
                </div>
                {calibPt1 && <p className="opacity-50">Corner 1: ({calibPt1.x.toFixed(0)}, {calibPt1.y.toFixed(0)})</p>}
                {calibPt2 && <p className="opacity-50">Corner 2: ({calibPt2.x.toFixed(0)}, {calibPt2.y.toFixed(0)})</p>}
                <button onClick={submitCalibration}
                        disabled={!calibPt1 || !calibPt2 || !calibWidthM || !calibHeightM || loading}
                        className="w-full py-1.5 rounded font-medium text-white disabled:opacity-40"
                        style={{ background: TOOL_COLORS.calibrate }}>
                  Apply Calibration
                </button>
                {activeFloor.pixels_per_meter && (
                  <p className="text-[11px] text-green-400">
                    Current: {activeFloor.pixels_per_meter.toFixed(2)} px/m
                  </p>
                )}
              </div>
            )}

            {/* Origin info */}
            {tool === 'origin' && (
              <div className="text-xs space-y-2">
                <p className="opacity-60">Click on the map to set the coordinate origin (0,0).</p>
                {activeFloor.origin_px && (
                  <p className="text-purple-400 text-[11px]">
                    Current: ({activeFloor.origin_px.x.toFixed(0)}, {activeFloor.origin_px.y.toFixed(0)}) px
                  </p>
                )}
              </div>
            )}

            {/* Path form */}
            {tool === 'path' && (
              <div className="space-y-2 text-xs">
                <p className="opacity-60">
                  Click waypoints on the map to define a path. Points will be discretized at the spacing you choose.
                </p>
                <input value={pathName} onChange={(e) => setPathName(e.target.value)}
                       placeholder="Path name"
                       className="w-full px-2 py-1.5 rounded"
                       style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                <div>
                  <label className="text-[11px] opacity-60 block mb-0.5">Spacing (m)</label>
                  <input value={pathSpacing} onChange={(e) => setPathSpacing(e.target.value)}
                         className="w-full px-2 py-1.5 rounded"
                         style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                         type="number" step="0.1" min="0.1" />
                </div>
                <p className="opacity-50">{pathWaypoints.length} waypoint(s) placed</p>
                <div className="flex gap-2">
                  <button onClick={submitPath}
                          disabled={pathWaypoints.length < 2 || loading}
                          className="flex-1 py-1.5 rounded font-medium text-white disabled:opacity-40"
                          style={{ background: TOOL_COLORS.path }}>
                    Save Path
                  </button>
                  <button onClick={() => setPathWaypoints([])}
                          className="px-3 py-1.5 rounded text-white/70 hover:text-white"
                          style={{ background: 'rgba(255,255,255,0.1)' }}>
                    Clear
                  </button>
                </div>
                {/* Existing paths */}
                {activeFloor.paths.length > 0 && (
                  <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-[11px] font-medium opacity-60 mb-1">Saved Paths</p>
                    {activeFloor.paths.map((p) => (
                      <div key={p.id} className="flex items-center justify-between py-0.5">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
                          {p.name}
                          <span className="opacity-40">({p.discrete_points_m?.length || 0} pts)</span>
                        </span>
                        <button onClick={() => deletePath(p.id)}
                                className="hover:text-red-400 opacity-50 hover:opacity-100">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AP form */}
            {tool === 'ap' && (
              <div className="space-y-2 text-xs">
                <p className="opacity-60">Click on the map to place an access point, then enter its BSSID.</p>
                {apPending && (
                  <>
                    <p className="text-amber-400">Position: ({apPending.x.toFixed(0)}, {apPending.y.toFixed(0)})</p>
                    <input value={apBssid} onChange={(e) => setApBssid(e.target.value)}
                           placeholder="BSSID (e.g. AA:BB:CC:DD:EE:FF)"
                           className="w-full px-2 py-1.5 rounded"
                           style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                    <input value={apSsid} onChange={(e) => setApSsid(e.target.value)}
                           placeholder="SSID (optional)"
                           className="w-full px-2 py-1.5 rounded"
                           style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                    <button onClick={submitAP} disabled={!apBssid.trim() || loading}
                            className="w-full py-1.5 rounded font-medium text-white disabled:opacity-40"
                            style={{ background: TOOL_COLORS.ap }}>
                      Place AP
                    </button>
                  </>
                )}
                {/* Existing APs */}
                {activeFloor.access_points.length > 0 && (
                  <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-[11px] font-medium opacity-60 mb-1">Placed APs</p>
                    {activeFloor.access_points.map((ap) => (
                      <div key={ap.id} className="flex items-center justify-between py-0.5">
                        <span className="truncate">
                          <Wifi size={10} className="inline mr-1 text-amber-400" />
                          {ap.ssid || ap.bssid}
                        </span>
                        <button onClick={() => deleteAP(ap.id)}
                                className="hover:text-red-400 opacity-50 hover:opacity-100">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Geo form */}
            {tool === 'geo' && (
              <div className="space-y-2 text-xs">
                <p className="opacity-60">Click 2 points on the map and enter their GPS coordinates.</p>
                {geoAnchors.map((a, i) => (
                  <div key={i} className="p-2 rounded" style={{ background: 'var(--bg-secondary)' }}>
                    <p className="text-[11px] font-medium text-green-400 mb-1">
                      Anchor {i + 1} — ({a.px.x.toFixed(0)}, {a.px.y.toFixed(0)}) px
                    </p>
                    <div className="flex gap-2">
                      <input value={a.lat} placeholder="Latitude"
                             onChange={(e) => {
                               const copy = [...geoAnchors];
                               copy[i] = { ...copy[i], lat: e.target.value };
                               setGeoAnchors(copy);
                             }}
                             className="flex-1 px-2 py-1 rounded"
                             style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                      <input value={a.lon} placeholder="Longitude"
                             onChange={(e) => {
                               const copy = [...geoAnchors];
                               copy[i] = { ...copy[i], lon: e.target.value };
                               setGeoAnchors(copy);
                             }}
                             className="flex-1 px-2 py-1 rounded"
                             style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                    </div>
                  </div>
                ))}
                {geoAnchors.length === 2 && (
                  <button onClick={submitGeo} disabled={loading}
                          className="w-full py-1.5 rounded font-medium text-white disabled:opacity-40"
                          style={{ background: TOOL_COLORS.geo }}>
                    Save Geo Anchors
                  </button>
                )}
                {activeFloor.geo_anchors && activeFloor.geo_anchors.length > 0 && (
                  <p className="text-green-400 text-[11px]">✓ Geo anchors set</p>
                )}
              </div>
            )}

            {/* Idle summary */}
            {tool === 'idle' && (
              <div className="text-xs space-y-2 opacity-60">
                <p>Select a tool from the toolbar above the canvas to begin editing.</p>
                {activeFloor.pixels_per_meter && (
                  <p className="text-green-400">✓ Calibrated: {activeFloor.pixels_per_meter.toFixed(2)} px/m</p>
                )}
                {activeFloor.origin_px && (
                  <p className="text-purple-400">✓ Origin set</p>
                )}
                {activeFloor.paths.length > 0 && (
                  <p className="text-red-400">✓ {activeFloor.paths.length} path(s)</p>
                )}
                {activeFloor.access_points.length > 0 && (
                  <p className="text-amber-400">✓ {activeFloor.access_points.length} AP(s)</p>
                )}
                {activeFloor.geo_anchors && activeFloor.geo_anchors.length > 0 && (
                  <p className="text-green-400">✓ Geo-referenced</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Export button */}
        {activeBuilding && (
          <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <button onClick={exportJSON}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded text-xs font-medium text-white"
                    style={{ background: '#059669' }}>
              <Download size={14} /> Export Master JSON
            </button>
          </div>
        )}
      </div>

      {/* ════════ MAIN CANVAS AREA ════════ */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        {activeFloor && image && (
          <div className="flex items-center gap-1 px-4 py-2 border-b"
               style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)' }}>
            {tools.map(({ mode, icon: Icon, label, tip }) => (
              <button
                key={mode}
                onClick={() => { resetToolState(); setTool(mode); }}
                title={tip}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors
                  ${tool === mode ? 'text-white' : 'opacity-60 hover:opacity-100'}`}
                style={tool === mode ? { background: TOOL_COLORS[mode] } : {}}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
            <div className="flex-1" />
            <span className="text-[11px] opacity-40">
              {tool !== 'idle' && tools.find((t) => t.mode === tool)?.tip}
            </span>
          </div>
        )}

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 overflow-hidden relative"
             style={{ background: '#1a1a2e' }}>
          {!activeFloor && (
            <div className="flex items-center justify-center h-full text-sm opacity-40">
              {activeBuilding
                ? 'Select or create a floor to begin'
                : 'Select or create a building to begin'}
            </div>
          )}
          {activeFloor && !image && (
            <div className="flex items-center justify-center h-full text-sm opacity-40">
              Upload a floor plan image to start editing
            </div>
          )}
          {image && (
            <Stage
              width={stageSize.width}
              height={stageSize.height}
              scaleX={scale}
              scaleY={scale}
              onClick={handleCanvasClick}
              style={{ cursor: tool === 'idle' ? 'default' : 'crosshair' }}
            >
              <Layer>
                {/* Floor plan image */}
                <KonvaImage image={image} />

                {/* ── Existing calibration rect ── */}
                {activeFloor?.calib_rect_px && (
                  <Rect
                    x={activeFloor.calib_rect_px.x1}
                    y={activeFloor.calib_rect_px.y1}
                    width={activeFloor.calib_rect_px.x2 - activeFloor.calib_rect_px.x1}
                    height={activeFloor.calib_rect_px.y2 - activeFloor.calib_rect_px.y1}
                    stroke={TOOL_COLORS.calibrate}
                    strokeWidth={2 / scale}
                    dash={[8 / scale, 4 / scale]}
                    listening={false}
                  />
                )}

                {/* ── Drawing calibration rect ── */}
                {tool === 'calibrate' && calibPt1 && (
                  <Circle x={calibPt1.x} y={calibPt1.y} radius={6 / scale}
                          fill={TOOL_COLORS.calibrate} />
                )}
                {tool === 'calibrate' && calibPt2 && (
                  <Circle x={calibPt2.x} y={calibPt2.y} radius={6 / scale}
                          fill={TOOL_COLORS.calibrate} />
                )}
                {showCalibRect && calibPt1 && calibPt2 && (
                  <Rect
                    x={Math.min(calibPt1.x, calibPt2.x)}
                    y={Math.min(calibPt1.y, calibPt2.y)}
                    width={Math.abs(calibPt2.x - calibPt1.x)}
                    height={Math.abs(calibPt2.y - calibPt1.y)}
                    stroke={TOOL_COLORS.calibrate}
                    strokeWidth={2 / scale}
                    fill="rgba(59,130,246,0.1)"
                    listening={false}
                  />
                )}

                {/* ── Origin marker ── */}
                {activeFloor?.origin_px && (
                  <Group x={activeFloor.origin_px.x} y={activeFloor.origin_px.y}>
                    <Line points={[-12 / scale, 0, 12 / scale, 0]}
                          stroke={TOOL_COLORS.origin} strokeWidth={2 / scale} />
                    <Line points={[0, -12 / scale, 0, 12 / scale]}
                          stroke={TOOL_COLORS.origin} strokeWidth={2 / scale} />
                    <Text text="O" x={4 / scale} y={-16 / scale}
                          fill={TOOL_COLORS.origin} fontSize={12 / scale} />
                  </Group>
                )}

                {/* ── Saved paths (red polylines + discrete points) ── */}
                {activeFloor?.paths.map((p) => (
                  <Group key={p.id}>
                    {/* Polyline through waypoints */}
                    <Line
                      points={p.waypoints_px.flatMap((w) => [w.x, w.y])}
                      stroke={p.color}
                      strokeWidth={2 / scale}
                      listening={false}
                    />
                    {/* Waypoint circles */}
                    {p.waypoints_px.map((w, i) => (
                      <Circle key={i} x={w.x} y={w.y} radius={4 / scale}
                              fill={p.color} opacity={0.8} listening={false} />
                    ))}
                    {/* Discrete test points */}
                    {p.discrete_points_px?.map((dp, i) => (
                      <Circle key={`d${i}`} x={dp.x} y={dp.y} radius={2.5 / scale}
                              fill="#ffffff" stroke={p.color} strokeWidth={1 / scale}
                              listening={false} />
                    ))}
                  </Group>
                ))}

                {/* ── Drawing path waypoints ── */}
                {tool === 'path' && pathWaypoints.length > 0 && (
                  <Group>
                    <Line
                      points={pathWaypoints.flatMap((w) => [w.x, w.y])}
                      stroke={TOOL_COLORS.path}
                      strokeWidth={2 / scale}
                      dash={[6 / scale, 3 / scale]}
                      listening={false}
                    />
                    {pathWaypoints.map((w, i) => (
                      <Circle key={i} x={w.x} y={w.y} radius={5 / scale}
                              fill={TOOL_COLORS.path} listening={false} />
                    ))}
                  </Group>
                )}

                {/* ── Access Points ── */}
                {activeFloor?.access_points.map((ap) => (
                  <Group key={ap.id} x={ap.x_px} y={ap.y_px}>
                    <Circle radius={8 / scale} fill={TOOL_COLORS.ap} opacity={0.85} />
                    <Text text={ap.ssid || ap.bssid.slice(-5)}
                          x={10 / scale} y={-6 / scale}
                          fill={TOOL_COLORS.ap} fontSize={10 / scale}
                          listening={false} />
                  </Group>
                ))}

                {/* ── Pending AP placement ── */}
                {tool === 'ap' && apPending && (
                  <Group x={apPending.x} y={apPending.y}>
                    <Circle radius={8 / scale} fill={TOOL_COLORS.ap} opacity={0.5} />
                    <Circle radius={3 / scale} fill="#fff" />
                  </Group>
                )}

                {/* ── Geo anchors ── */}
                {activeFloor?.geo_anchors?.map((a, i) => (
                  <Group key={i} x={a.px.x} y={a.px.y}>
                    <Circle radius={7 / scale} fill={TOOL_COLORS.geo} opacity={0.85} />
                    <Text text={`G${i + 1}`} x={-4 / scale} y={-4 / scale}
                          fill="#fff" fontSize={8 / scale} listening={false} />
                  </Group>
                ))}

                {/* ── Drawing geo anchors ── */}
                {tool === 'geo' && geoAnchors.map((a, i) => (
                  <Group key={i} x={a.px.x} y={a.px.y}>
                    <Circle radius={7 / scale} fill={TOOL_COLORS.geo} opacity={0.6}
                            stroke="#fff" strokeWidth={1 / scale} />
                    <Text text={`G${i + 1}`} x={-4 / scale} y={-4 / scale}
                          fill="#fff" fontSize={8 / scale} listening={false} />
                  </Group>
                ))}
              </Layer>
            </Stage>
          )}
        </div>
      </div>
    </div>
  );
}
