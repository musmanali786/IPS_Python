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

export const experimentsApi = {
  trilateration: (data: TrilaterationRequest) =>
    api.post<PositionResponse>('/experiments/trilateration', data),
  fingerprint: (data: any) => api.post<PositionResponse>('/experiments/fingerprint', data),
  pdr: (data: any) => api.post('/experiments/pdr', data),
  bleSmooth: (data: any) => api.post('/experiments/ble/smooth', data),
  ftm: (data: any) => api.post<PositionResponse>('/experiments/ftm', data),
  dfp: (data: any) => api.post('/experiments/dfp', data),
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
