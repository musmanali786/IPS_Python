import { useEffect, useState, useRef, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Line, Text } from 'react-konva';
import { mapsApi } from '../api';
import type {
  FloorMapResponse,
  FloorMapListItem,
  PointSchema,
} from '../api';
import { Upload, MousePointer2, Ruler, Crosshair, Trash2 } from 'lucide-react';

type Mode = 'idle' | 'calibrate' | 'origin';

export default function MapSetup() {
  const [maps, setMaps] = useState<FloorMapListItem[]>([]);
  const [activeMap, setActiveMap] = useState<FloorMapResponse | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [calibPoints, setCalibPoints] = useState<PointSchema[]>([]);
  const [distance, setDistance] = useState('');
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [mapName, setMapName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load map list
  const loadMaps = useCallback(() => {
    mapsApi.list().then((r) => setMaps(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    loadMaps();
  }, [loadMaps]);

  // Load active map image
  useEffect(() => {
    if (!activeMap) return;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = mapsApi.getImage(activeMap.id);
    img.onload = () => {
      setImage(img);
      fitImage(img);
    };
  }, [activeMap]);

  // Resize handler
  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (containerRef.current && image) fitImage(image);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [image]);

  const fitImage = (img: HTMLImageElement) => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const s = Math.min(cw / img.width, ch / img.height, 1);
    setScale(s);
    setStageSize({ width: cw, height: ch });
  };

  const selectMap = async (id: number) => {
    const r = await mapsApi.get(id);
    setActiveMap(r.data);
    setCalibPoints([]);
    setMode('idle');
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !mapName.trim()) return;
    setUploading(true);
    try {
      const r = await mapsApi.upload(file, mapName.trim());
      loadMaps();
      setActiveMap(r.data);
      setMapName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Upload failed');
    }
    setUploading(false);
  };

  const handleStageClick = (e: any) => {
    if (!image) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Convert to image-space coordinates
    const ix = pos.x / scale;
    const iy = pos.y / scale;
    const pt: PointSchema = { x: ix, y: iy };

    if (mode === 'calibrate') {
      if (calibPoints.length < 2) {
        setCalibPoints((prev) => [...prev, pt]);
      }
    } else if (mode === 'origin') {
      submitOrigin(pt);
    }
  };

  const submitCalibration = async () => {
    if (!activeMap || calibPoints.length < 2 || !distance) return;
    const d = parseFloat(distance);
    if (isNaN(d) || d <= 0) return alert('Enter valid distance > 0');
    try {
      const r = await mapsApi.calibrate({
        map_id: activeMap.id,
        point1: calibPoints[0],
        point2: calibPoints[1],
        real_distance_m: d,
      });
      setActiveMap((prev) => prev ? { ...prev, calibration: r.data } : prev);
      setMode('idle');
      setCalibPoints([]);
      setDistance('');
      loadMaps();
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Calibration failed');
    }
  };

  const submitOrigin = async (pt: PointSchema) => {
    if (!activeMap) return;
    try {
      const r = await mapsApi.setOrigin({ map_id: activeMap.id, origin: pt });
      setActiveMap((prev) => prev ? { ...prev, calibration: r.data } : prev);
      setMode('idle');
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Set origin failed');
    }
  };

  const deleteMap = async (id: number) => {
    if (!confirm('Delete this map?')) return;
    await mapsApi.delete(id);
    if (activeMap?.id === id) {
      setActiveMap(null);
      setImage(null);
    }
    loadMaps();
  };

  const calib = activeMap?.calibration;

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div
        className="w-80 shrink-0 overflow-y-auto p-5 space-y-6"
        style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--border)' }}
      >
        {/* Upload */}
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
            Upload Floor Plan
          </h3>
          <input
            ref={fileRef}
            type="file"
            accept=".png,.jpg,.jpeg,.svg,.bmp"
            className="block w-full text-xs mb-2"
          />
          <input
            value={mapName}
            onChange={(e) => setMapName(e.target.value)}
            placeholder="Map name"
            className="w-full px-3 py-2 rounded-lg text-sm mb-2"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ background: 'var(--accent)' }}
          >
            <Upload size={16} />
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </section>

        {/* Map list */}
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
            Maps ({maps.length})
          </h3>
          <div className="space-y-2">
            {maps.map((m) => (
              <div
                key={m.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                  activeMap?.id === m.id ? 'ring-2 ring-blue-500' : ''
                }`}
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                onClick={() => selectMap(m.id)}
              >
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {m.width_px}×{m.height_px}px
                    {m.is_calibrated && ' · ✓ calibrated'}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMap(m.id); }}
                  className="p-1 rounded hover:bg-red-100 text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Calibration tools */}
        {activeMap && (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
              Calibration Tools
            </h3>

            <div className="space-y-2">
              <button
                onClick={() => { setMode('calibrate'); setCalibPoints([]); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  mode === 'calibrate' ? 'bg-blue-600 text-white' : ''
                }`}
                style={mode !== 'calibrate' ? { background: 'var(--bg-secondary)', border: '1px solid var(--border)' } : {}}
              >
                <Ruler size={16} />
                Set Scale (2 Points)
              </button>

              <button
                onClick={() => setMode('origin')}
                disabled={!calib}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  mode === 'origin' ? 'bg-blue-600 text-white' : ''
                } ${!calib ? 'opacity-40 cursor-not-allowed' : ''}`}
                style={mode !== 'origin' ? { background: 'var(--bg-secondary)', border: '1px solid var(--border)' } : {}}
              >
                <Crosshair size={16} />
                Set Origin (0,0)
              </button>
            </div>

            {/* Calibration input */}
            {mode === 'calibrate' && (
              <div className="mt-4 p-3 rounded-lg space-y-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Click two points on the map, then enter the real-world distance.
                </p>
                <p className="text-xs">Points: {calibPoints.length}/2</p>
                {calibPoints.length === 2 && (
                  <>
                    <input
                      type="number"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                      placeholder="Distance (meters)"
                      step="0.1"
                      min="0.01"
                      className="w-full px-3 py-2 rounded text-sm"
                      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                    <button
                      onClick={submitCalibration}
                      className="w-full px-3 py-2 rounded text-sm font-medium text-white"
                      style={{ background: 'var(--success)' }}
                    >
                      Apply Calibration
                    </button>
                  </>
                )}
                <button
                  onClick={() => { setCalibPoints([]); setMode('idle'); }}
                  className="w-full px-3 py-1.5 rounded text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
              </div>
            )}

            {mode === 'origin' && (
              <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Click on the map to set the coordinate origin (0,0).
                </p>
                <button
                  onClick={() => setMode('idle')}
                  className="mt-2 w-full px-3 py-1.5 rounded text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Current calibration info */}
            {calib && (
              <div className="mt-4 p-3 rounded-lg text-xs space-y-1" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <p className="font-semibold text-sm mb-2">Current Calibration</p>
                <p>Pixels/meter: <strong>{calib.pixels_per_meter.toFixed(2)}</strong></p>
                <p>Real distance: <strong>{calib.real_distance_m} m</strong></p>
                <p>Pixel distance: <strong>{calib.pixel_distance.toFixed(1)} px</strong></p>
                {calib.origin && (
                  <p>Origin: <strong>({calib.origin.x.toFixed(0)}, {calib.origin.y.toFixed(0)}) px</strong></p>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {!activeMap && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
            <div className="text-center">
              <MousePointer2 size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">No map selected</p>
              <p className="text-sm">Upload or select a floor plan to get started</p>
            </div>
          </div>
        )}

        {image && (
          <Stage
            width={stageSize.width}
            height={stageSize.height}
            onClick={handleStageClick}
            style={{ cursor: mode !== 'idle' ? 'crosshair' : 'default' }}
          >
            <Layer>
              <KonvaImage image={image} scaleX={scale} scaleY={scale} />

              {/* Calibration points */}
              {calibPoints.map((pt, i) => (
                <Circle
                  key={`calib-${i}`}
                  x={pt.x * scale}
                  y={pt.y * scale}
                  radius={8}
                  fill="#ef4444"
                  stroke="#fff"
                  strokeWidth={2}
                />
              ))}

              {/* Calibration line */}
              {calibPoints.length === 2 && (
                <Line
                  points={[
                    calibPoints[0].x * scale,
                    calibPoints[0].y * scale,
                    calibPoints[1].x * scale,
                    calibPoints[1].y * scale,
                  ]}
                  stroke="#ef4444"
                  strokeWidth={2}
                  dash={[8, 4]}
                />
              )}

              {/* Saved calibration markers */}
              {calib && mode === 'idle' && (
                <>
                  <Circle
                    x={calib.point1.x * scale}
                    y={calib.point1.y * scale}
                    radius={6}
                    fill="#3b82f6"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                  <Circle
                    x={calib.point2.x * scale}
                    y={calib.point2.y * scale}
                    radius={6}
                    fill="#3b82f6"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                  <Line
                    points={[
                      calib.point1.x * scale,
                      calib.point1.y * scale,
                      calib.point2.x * scale,
                      calib.point2.y * scale,
                    ]}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dash={[6, 3]}
                  />
                  <Text
                    x={(calib.point1.x + calib.point2.x) / 2 * scale - 30}
                    y={(calib.point1.y + calib.point2.y) / 2 * scale - 20}
                    text={`${calib.real_distance_m} m`}
                    fill="#3b82f6"
                    fontSize={14}
                    fontStyle="bold"
                  />
                </>
              )}

              {/* Origin marker */}
              {calib?.origin && mode === 'idle' && (
                <>
                  <Circle
                    x={calib.origin.x * scale}
                    y={calib.origin.y * scale}
                    radius={10}
                    stroke="#22c55e"
                    strokeWidth={3}
                  />
                  <Line
                    points={[
                      calib.origin.x * scale - 15,
                      calib.origin.y * scale,
                      calib.origin.x * scale + 15,
                      calib.origin.y * scale,
                    ]}
                    stroke="#22c55e"
                    strokeWidth={2}
                  />
                  <Line
                    points={[
                      calib.origin.x * scale,
                      calib.origin.y * scale - 15,
                      calib.origin.x * scale,
                      calib.origin.y * scale + 15,
                    ]}
                    stroke="#22c55e"
                    strokeWidth={2}
                  />
                  <Text
                    x={calib.origin.x * scale + 14}
                    y={calib.origin.y * scale - 20}
                    text="(0, 0)"
                    fill="#22c55e"
                    fontSize={13}
                    fontStyle="bold"
                  />
                </>
              )}
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
}
