import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// ─── Maps ────────────────────────────────────────────────────────

export interface PointSchema {
  x: number;
  y: number;
}

export interface CalibrationResponse {
  map_id: number;
  point1: PointSchema;
  point2: PointSchema;
  real_distance_m: number;
  pixels_per_meter: number;
  pixel_distance: number;
  origin: PointSchema | null;
}

export interface FloorMapResponse {
  id: number;
  name: string;
  filename: string;
  width_px: number;
  height_px: number;
  created_at: string;
  calibration: CalibrationResponse | null;
}

export interface FloorMapListItem {
  id: number;
  name: string;
  filename: string;
  width_px: number;
  height_px: number;
  is_calibrated: boolean;
  created_at: string;
}

export const mapsApi = {
  list: () => api.get<FloorMapListItem[]>('/maps/'),
  get: (id: number) => api.get<FloorMapResponse>(`/maps/${id}`),
  upload: (file: File, name: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('name', name);
    return api.post<FloorMapResponse>('/maps/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  calibrate: (data: {
    map_id: number;
    point1: PointSchema;
    point2: PointSchema;
    real_distance_m: number;
  }) => api.post<CalibrationResponse>('/maps/calibrate', data),
  setOrigin: (data: { map_id: number; origin: PointSchema }) =>
    api.post<CalibrationResponse>('/maps/origin', data),
  getImage: (id: number) => `/api/maps/${id}/image`,
  delete: (id: number) => api.delete(`/maps/${id}`),
};

// ─── Datasets ────────────────────────────────────────────────────

export interface DatasetListItem {
  id: number;
  name: string;
  data_type: string;
  filename: string;
  map_id: number | null;
  created_at: string;
}

export interface DatasetUploadResponse {
  id: number;
  name: string;
  data_type: string;
  filename: string;
  row_count: number;
  columns: string[];
  created_at: string;
}

export const datasetsApi = {
  list: (dataType?: string) =>
    api.get<DatasetListItem[]>('/datasets/', { params: dataType ? { data_type: dataType } : {} }),
  upload: (file: File, name: string, dataType: string, mapId?: number) => {
    const form = new FormData();
    form.append('file', file);
    form.append('name', name);
    form.append('data_type', dataType);
    if (mapId) form.append('map_id', mapId.toString());
    return api.post<DatasetUploadResponse>('/datasets/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  preview: (id: number, rows?: number) =>
    api.get(`/datasets/${id}/preview`, { params: rows ? { rows } : {} }),
  schemas: () => api.get('/datasets/schemas'),
  delete: (id: number) => api.delete(`/datasets/${id}`),
};

// ─── Experiments ─────────────────────────────────────────────────

export interface TrilaterationRequest {
  anchors: { x: number; y: number; rssi: number }[];
  A: number;
  n: number;
  solver: 'ls' | 'wls';
}

export interface PositionResponse {
  x: number;
  y: number;
  distances?: number[];
}

// ─── Trilateration Lab (file-based) ─────────────────────────────

export interface LabAPInfo {
  ssid: string;
  x: number;
  y: number;
  bssid: string;
}

export interface LabRefPoint {
  id: number;
  x: number;
  y: number;
  filetag: string;
}

export interface LabRefResult {
  ref_id: number;
  ref_x: number;
  ref_y: number;
  filetag: string;
  distances: number[];
  estimated_x: number | null;
  estimated_y: number | null;
  error: number | null;
}

export interface LabTrilaterationResponse {
  access_points: LabAPInfo[];
  ref_points: LabRefPoint[];
  results: LabRefResult[];
  skipped_ref_points: string[];
  room_width: number;
  room_height: number;
  rssi0: number;
  path_loss_exponent: number;
  solver: string;
}

// ─── Fingerprinting Lab (file-based) ────────────────────────────

export interface LabFPRefPoint {
  id: string;
  x: number;
  y: number;
  filetag: string;
  num_bssids: number;
}

export interface LabFPTestResult {
  test_id: string;
  test_x: number;
  test_y: number;
  filetag: string;
  estimated_x: number | null;
  estimated_y: number | null;
  error_px: number | null;
  error_m: number | null;
  matched_ref: string | null;
  rssi_error: number | null;
}

export interface LabFingerprintingResponse {
  ref_points: LabFPRefPoint[];
  test_results: LabFPTestResult[];
  skipped_ref_points: string[];
  skipped_test_points: string[];
  fp_db_size: number;
  total_unique_bssids: number;
  algorithm: string;
  k: number;
  max_aps: number;
  pixels_per_meter: number;
  scan_mode: string;
  errors_m: number[];
  cdf: { x: number[]; y: number[] };
  statistics: Record<string, number>;
}

// ─── PDR / BLE / FTM / DFP ──────────────────────────────────────

export interface FingerprintRequest {
  radio_map: number[][];
  radio_map_coords: number[][];
  test_scan: number[];
  k?: number;
  algorithm?: 'knn' | 'wknn';
}

export interface PDRRequest {
  acc_x: number[];
  acc_y: number[];
  acc_z: number[];
  gyro_z?: number[];
  mag_heading?: number[];
  sampling_rate: number;
  peak_height: number;
  peak_distance: number;
  stride_method: 'weinberg' | 'height';
  user_height_m: number;
  weinberg_K: number;
  complementary_alpha: number;
  start_x: number;
  start_y: number;
}

export interface PDRResponse {
  trajectory: number[][];
  step_count: number;
  stride_lengths: number[];
}

export interface BLESmoothRequest {
  rssi_values: number[];
  method: 'kalman' | 'moving_average';
  process_noise: number;
  measurement_noise: number;
  window_size: number;
}

export interface BLESmoothResponse {
  original: number[];
  smoothed: number[];
}

export interface FTMRequest {
  anchors: { x: number; y: number; distance_m: number }[];
}

export interface DFPRequest {
  baseline_rssi: number[][];
  active_rssi: number[][];
  threshold_sigma: number;
}

export interface DFPResponse {
  affected_links: number[];
  variance_ratio: number[];
  z_scores: number[];
}

export const experimentsApi = {
  trilateration: (data: TrilaterationRequest) =>
    api.post<PositionResponse>('/experiments/trilateration', data),
  trilaterationLab: (data: {
    apsCsv: File;
    refPtsCsv: File;
    logFiles: File[];
    rssi0: number;
    pathLossExponent: number;
    solver: string;
    roomWidth: number;
    roomHeight: number;
  }) => {
    const form = new FormData();
    form.append('aps_csv', data.apsCsv);
    form.append('refpts_csv', data.refPtsCsv);
    data.logFiles.forEach((f) => form.append('log_files', f));
    form.append('rssi0', data.rssi0.toString());
    form.append('path_loss_exponent', data.pathLossExponent.toString());
    form.append('solver', data.solver);
    form.append('room_width', data.roomWidth.toString());
    form.append('room_height', data.roomHeight.toString());
    return api.post<LabTrilaterationResponse>('/experiments/trilateration-lab', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // ─── Fingerprinting Lab (file-based, mirrors Lab02) ─────────
  fingerprintingLab: (data: {
    refPtsCsv: File;
    testPtsCsv: File;
    trainLogFiles: File[];
    testLogFiles: File[];
    k: number;
    algorithm: string;
    maxAps: number;
    pixelsPerMeter: number;
    scanMode: string;
  }) => {
    const form = new FormData();
    form.append('refpts_csv', data.refPtsCsv);
    form.append('testpts_csv', data.testPtsCsv);
    data.trainLogFiles.forEach((f) => form.append('train_log_files', f));
    data.testLogFiles.forEach((f) => form.append('test_log_files', f));
    form.append('k', data.k.toString());
    form.append('algorithm', data.algorithm);
    form.append('max_aps', data.maxAps.toString());
    form.append('pixels_per_meter', data.pixelsPerMeter.toString());
    form.append('scan_mode', data.scanMode);
    return api.post<LabFingerprintingResponse>('/experiments/fingerprinting-lab', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  fingerprint: (data: FingerprintRequest) => api.post<PositionResponse>('/experiments/fingerprint', data),
  pdr: (data: PDRRequest) => api.post<PDRResponse>('/experiments/pdr', data),
  bleSmooth: (data: BLESmoothRequest) => api.post<BLESmoothResponse>('/experiments/ble/smooth', data),
  ftm: (data: FTMRequest) => api.post<PositionResponse>('/experiments/ftm', data),
  dfp: (data: DFPRequest) => api.post<DFPResponse>('/experiments/dfp', data),
  errorAnalysis: (data: { estimated: number[][]; ground_truth: number[][] }) =>
    api.post('/experiments/analysis/error', data),
};

// ─── Buildings / Map Builder ─────────────────────────────────────

export interface PointXY {
  x: number;
  y: number;
}

export interface GeoAnchor {
  px: PointXY;
  lat: number;
  lon: number;
}

export interface CalibRectPx {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface CalibRectM {
  width_m: number;
  height_m: number;
}

export interface APResponse {
  id: number;
  floor_id: number;
  bssid: string;
  ssid?: string | null;
  label?: string | null;
  x_px: number;
  y_px: number;
  x_m?: number | null;
  y_m?: number | null;
  frequency_mhz?: number | null;
  tx_power_dbm?: number | null;
}

export interface PathResponse {
  id: number;
  floor_id: number;
  name: string;
  color: string;
  waypoints_px: PointXY[];
  spacing_m: number;
  discrete_points_m?: { x: number; y: number; z: number }[] | null;
  discrete_points_px?: PointXY[] | null;
}

export interface FloorResponse {
  id: number;
  building_id: number;
  floor_number: number;
  label?: string | null;
  filename?: string | null;
  width_px?: number | null;
  height_px?: number | null;
  calib_rect_px?: CalibRectPx | null;
  calib_rect_m?: CalibRectM | null;
  pixels_per_meter?: number | null;
  origin_px?: PointXY | null;
  geo_anchors?: GeoAnchor[] | null;
  paths: PathResponse[];
  access_points: APResponse[];
}

export interface BuildingListItem {
  id: number;
  name: string;
  description?: string | null;
  floor_count: number;
  created_at?: string | null;
}

export interface BuildingResponse {
  id: number;
  name: string;
  description?: string | null;
  floors: FloorResponse[];
  created_at?: string | null;
}

export interface MasterMapJSON {
  building_id: number;
  building_name: string;
  floors: FloorResponse[];
}

export const buildingsApi = {
  // Buildings
  list: () => api.get<BuildingListItem[]>('/buildings/'),
  create: (data: { name: string; description?: string }) =>
    api.post<BuildingResponse>('/buildings/', data),
  get: (id: number) => api.get<BuildingResponse>(`/buildings/${id}`),
  update: (id: number, data: { name?: string; description?: string }) =>
    api.patch<BuildingResponse>(`/buildings/${id}`, data),
  delete: (id: number) => api.delete(`/buildings/${id}`),

  // Floors
  createFloor: (buildingId: number, data: { floor_number: number; label?: string }) =>
    api.post<FloorResponse>(`/buildings/${buildingId}/floors`, data),
  uploadFloorImage: (buildingId: number, floorId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<FloorResponse>(
      `/buildings/${buildingId}/floors/${floorId}/image`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },
  getFloorImage: (buildingId: number, floorId: number) =>
    `/api/buildings/${buildingId}/floors/${floorId}/image`,
  calibrateFloor: (buildingId: number, floorId: number, data: {
    calib_rect_px: CalibRectPx;
    calib_rect_m: CalibRectM;
  }) => api.post<FloorResponse>(`/buildings/${buildingId}/floors/${floorId}/calibrate`, data),
  setFloorOrigin: (buildingId: number, floorId: number, data: { origin: PointXY }) =>
    api.post<FloorResponse>(`/buildings/${buildingId}/floors/${floorId}/origin`, data),
  setFloorGeo: (buildingId: number, floorId: number, data: { anchors: GeoAnchor[] }) =>
    api.post<FloorResponse>(`/buildings/${buildingId}/floors/${floorId}/geo`, data),
  deleteFloor: (buildingId: number, floorId: number) =>
    api.delete(`/buildings/${buildingId}/floors/${floorId}`),

  // Paths
  createPath: (buildingId: number, floorId: number, data: {
    name: string;
    color?: string;
    waypoints_px: PointXY[];
    spacing_m?: number;
  }) => api.post<PathResponse>(`/buildings/${buildingId}/floors/${floorId}/paths`, data),
  deletePath: (buildingId: number, floorId: number, pathId: number) =>
    api.delete(`/buildings/${buildingId}/floors/${floorId}/paths/${pathId}`),

  // Access Points
  createAP: (buildingId: number, floorId: number, data: {
    bssid: string;
    ssid?: string;
    label?: string;
    x_px: number;
    y_px: number;
    frequency_mhz?: number;
    tx_power_dbm?: number;
  }) => api.post<APResponse>(`/buildings/${buildingId}/floors/${floorId}/aps`, data),
  deleteAP: (buildingId: number, floorId: number, apId: number) =>
    api.delete(`/buildings/${buildingId}/floors/${floorId}/aps/${apId}`),

  // Export
  exportJSON: (buildingId: number) =>
    api.get<MasterMapJSON>(`/buildings/${buildingId}/export`),
  // Direct download URL for the ZIP bundle (map.json + floor images) consumed
  // by the mobile collector app.
  exportZipUrl: (buildingId: number) =>
    `/api/buildings/${buildingId}/export.zip`,
};

// ─── Signal Analyzer / Heatmap ───────────────────────────────────

export interface DiscoveredAP {
  bssid: string;
  ssid?: string | null;
  count: number;
  avg_rssi: number;
}

export interface HeatmapPoint {
  x: number;
  y: number;
  rssi: number;
}

export interface HeatmapResponse {
  bssid: string;
  floor_id: number;
  point_count: number;
  points: HeatmapPoint[];
}

export interface BssidStats {
  bssid: string;
  count: number;
  min_rssi: number;
  max_rssi: number;
  mean_rssi: number;
  median_rssi: number;
  std_rssi: number;
}

export const signalApi = {
  getAPs: (params?: { building_id?: number; floor_id?: number; dataset_id?: number }) =>
    api.get<DiscoveredAP[]>('/signal/aps', { params }),
  getHeatmap: (bssid: string, params?: { floor_id?: number; dataset_id?: number }) =>
    api.get<HeatmapResponse>(`/signal/heatmap/${encodeURIComponent(bssid)}`, { params }),
  getStats: (bssid: string, params?: { floor_id?: number; dataset_id?: number }) =>
    api.get<BssidStats>(`/signal/stats/${encodeURIComponent(bssid)}`, { params }),
};

export default api;
