/**
 * Common types for all experiment labs
 */

export type ExperimentType = 'trilateration' | 'fingerprint' | 'pdr' | 'ble' | 'ftm' | 'dfp';

export const EXPERIMENT_TYPES: { key: ExperimentType; label: string; icon?: string }[] = [
  { key: 'trilateration', label: 'Trilateration' },
  { key: 'fingerprint', label: 'Fingerprinting' },
  { key: 'pdr', label: 'PDR' },
  { key: 'ble', label: 'BLE' },
  { key: 'ftm', label: 'FTM' },
  { key: 'dfp', label: 'Device-Free' },
];

// ─── Trilateration Types ───────────────────────────────────────

export interface APInfo {
  ssid: string;
  x: number;
  y: number;
  bssid: string;
}

export interface RefPoint {
  id: number;
  x: number;
  y: number;
  filetag: string;
}

export interface LogScan {
  filetag: string;
  fileName: string;
  bssidRssi: Record<string, number>;
  distances: number[];
}

export interface TrilaterationResult {
  est_x: number;
  est_y: number;
  filetag: string;
  error: number | null;
  error_px: number | null;
}

export interface LabTrilaterationResponse {
  results: TrilaterationResult[];
  ref_points: RefPoint[];
  ap_points: APInfo[];
  cdf_x: number[];
  cdf_y: number[];
  stats: {
    mean_error: number;
    median_error: number;
    std_dev: number;
    p75: number;
    p90: number;
  };
}

// ─── Fingerprinting Types ──────────────────────────────────────

export interface FingerprintRefPoint {
  id: number;
  x: number;
  y: number;
  filetag: string;
}

export interface FingerprintTestResult {
  test_id: number;
  test_x: number;
  test_y: number;
  estimated_x: number | null;
  estimated_y: number | null;
  matched_ref_id: number | null;
  error_m: number | null;
}

export interface LabFingerprintingResponse {
  test_results: FingerprintTestResult[];
  ref_points: FingerprintRefPoint[];
  errors_m: number[];
  cdf_x: number[];
  cdf_y: number[];
  stats: {
    mean_error: number;
    median_error: number;
    std_dev: number;
    p75: number;
    p90: number;
  };
}

// ─── Common UI State ───────────────────────────────────────────

export interface ExperimentState {
  loading: boolean;
  error: string | null;
  selectedFile: string | null;
}
