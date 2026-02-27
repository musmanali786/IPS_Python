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

export default api;
