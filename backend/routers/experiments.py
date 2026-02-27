"""Experiment engine endpoints – Trilateration, Fingerprinting, PDR, BLE, FTM, DFP."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Tuple, Optional
import numpy as np

from services.trilateration import rssi_to_distance, trilaterate_ls, trilaterate_wls
from services.fingerprinting import knn_match, weighted_knn_match
from services.pdr import (
    detect_steps,
    weinberg_stride_length,
    height_based_stride,
    complementary_filter,
    compute_trajectory,
)
from services.ble import smooth_rssi_kalman, smooth_rssi_moving_average
from services.ftm import multilaterate, rtt_to_distance
from services.device_free import compute_baseline, detect_anomaly
from services.analysis import euclidean_error, compute_cdf, error_statistics

router = APIRouter(prefix="/api/experiments", tags=["experiments"])


# ─── Trilateration ───────────────────────────────────────────────

class AnchorInput(BaseModel):
    x: float
    y: float
    rssi: float


class TrilaterationRequest(BaseModel):
    anchors: List[AnchorInput]
    A: float = Field(-40.0, description="Reference RSSI at 1 m (dBm)")
    n: float = Field(2.0, description="Path loss exponent")
    solver: str = Field("ls", description="'ls' or 'wls'")


class PositionResponse(BaseModel):
    x: float
    y: float
    distances: Optional[List[float]] = None


@router.post("/trilateration", response_model=PositionResponse)
def run_trilateration(req: TrilaterationRequest):
    if len(req.anchors) < 3:
        raise HTTPException(400, "Need at least 3 anchors")

    anchors = [(a.x, a.y) for a in req.anchors]
    distances = [rssi_to_distance(a.rssi, req.A, req.n) for a in req.anchors]

    if req.solver == "wls":
        x, y = trilaterate_wls(anchors, distances)
    else:
        x, y = trilaterate_ls(anchors, distances)

    return PositionResponse(x=x, y=y, distances=distances)


# ─── Fingerprinting ──────────────────────────────────────────────

class FingerprintRequest(BaseModel):
    radio_map: List[List[float]]       # M rows × N APs
    radio_map_coords: List[List[float]]  # M rows × 2 (x, y)
    test_scan: List[float]              # N values
    k: int = 3
    algorithm: str = "knn"              # "knn" or "wknn"


@router.post("/fingerprint", response_model=PositionResponse)
def run_fingerprint(req: FingerprintRequest):
    rm = np.array(req.radio_map, dtype=float)
    coords = np.array(req.radio_map_coords, dtype=float)
    scan = np.array(req.test_scan, dtype=float)

    if rm.shape[1] != len(scan):
        raise HTTPException(400, "Radio map AP count must match test scan length")

    if req.algorithm == "wknn":
        x, y = weighted_knn_match(rm, coords, scan, req.k)
    else:
        x, y = knn_match(rm, coords, scan, req.k)

    return PositionResponse(x=x, y=y)


# ─── PDR ──────────────────────────────────────────────────────────

class PDRRequest(BaseModel):
    acc_x: List[float]
    acc_y: List[float]
    acc_z: List[float]
    gyro_z: Optional[List[float]] = None
    mag_heading: Optional[List[float]] = None
    sampling_rate: float = 100.0
    peak_height: float = 1.0
    peak_distance: int = 30
    stride_method: str = "weinberg"  # "weinberg" or "height"
    user_height_m: float = 1.75
    weinberg_K: float = 0.41
    complementary_alpha: float = 0.98
    start_x: float = 0.0
    start_y: float = 0.0


class PDRResponse(BaseModel):
    trajectory: List[List[float]]
    step_count: int
    stride_lengths: List[float]


@router.post("/pdr", response_model=PDRResponse)
def run_pdr(req: PDRRequest):
    acc = np.sqrt(
        np.array(req.acc_x)**2 +
        np.array(req.acc_y)**2 +
        np.array(req.acc_z)**2
    )

    steps = detect_steps(acc, req.sampling_rate, req.peak_height, req.peak_distance)

    if req.stride_method == "height":
        sl = np.full(len(steps), height_based_stride(req.user_height_m))
    else:
        sl = weinberg_stride_length(acc, steps, req.weinberg_K)

    # Heading
    dt = 1.0 / req.sampling_rate
    if req.gyro_z and req.mag_heading:
        headings = complementary_filter(
            np.array(req.gyro_z),
            np.array(req.mag_heading),
            dt,
            req.complementary_alpha,
        )
    elif req.mag_heading:
        headings = np.array(req.mag_heading)
    else:
        headings = np.zeros(len(acc))

    traj = compute_trajectory(steps, sl, headings, req.start_x, req.start_y)

    return PDRResponse(
        trajectory=[list(p) for p in traj],
        step_count=len(steps),
        stride_lengths=sl.tolist(),
    )


# ─── BLE Smoothing ───────────────────────────────────────────────

class BLESmoothRequest(BaseModel):
    rssi_values: List[float]
    method: str = "kalman"  # "kalman" or "moving_average"
    process_noise: float = 1.0
    measurement_noise: float = 5.0
    window_size: int = 5


class BLESmoothResponse(BaseModel):
    original: List[float]
    smoothed: List[float]


@router.post("/ble/smooth", response_model=BLESmoothResponse)
def run_ble_smooth(req: BLESmoothRequest):
    if req.method == "moving_average":
        smoothed = smooth_rssi_moving_average(req.rssi_values, req.window_size)
    else:
        smoothed = smooth_rssi_kalman(req.rssi_values, req.process_noise, req.measurement_noise)
    return BLESmoothResponse(original=req.rssi_values, smoothed=smoothed)


# ─── FTM ──────────────────────────────────────────────────────────

class FTMAnchorInput(BaseModel):
    x: float
    y: float
    distance_m: float


class FTMRequest(BaseModel):
    anchors: List[FTMAnchorInput]


@router.post("/ftm", response_model=PositionResponse)
def run_ftm(req: FTMRequest):
    if len(req.anchors) < 3:
        raise HTTPException(400, "Need at least 3 FTM anchors")

    anchors = [(a.x, a.y) for a in req.anchors]
    distances = [a.distance_m for a in req.anchors]

    x, y = multilaterate(anchors, distances)
    return PositionResponse(x=x, y=y, distances=distances)


# ─── Device-Free Positioning ─────────────────────────────────────

class DFPRequest(BaseModel):
    baseline_rssi: List[List[float]]  # (T_base, L) matrix
    active_rssi: List[List[float]]    # (T_active, L) matrix
    threshold_sigma: float = 2.0


class DFPResponse(BaseModel):
    affected_links: List[int]
    variance_ratio: List[float]
    z_scores: List[float]


@router.post("/dfp", response_model=DFPResponse)
def run_dfp(req: DFPRequest):
    baseline = np.array(req.baseline_rssi, dtype=float)
    active = np.array(req.active_rssi, dtype=float)

    b_mean, b_std = compute_baseline(baseline)
    result = detect_anomaly(active, b_mean, b_std, req.threshold_sigma)

    return DFPResponse(**result)


# ─── Error Analysis ──────────────────────────────────────────────

class ErrorAnalysisRequest(BaseModel):
    estimated: List[List[float]]      # [(x, y), ...]
    ground_truth: List[List[float]]   # [(x, y), ...]


class ErrorAnalysisResponse(BaseModel):
    errors: List[float]
    statistics: dict
    cdf: dict


@router.post("/analysis/error", response_model=ErrorAnalysisResponse)
def run_error_analysis(req: ErrorAnalysisRequest):
    if len(req.estimated) != len(req.ground_truth):
        raise HTTPException(400, "estimated and ground_truth must have equal length")

    est = [(p[0], p[1]) for p in req.estimated]
    gt = [(p[0], p[1]) for p in req.ground_truth]

    errors = euclidean_error(est, gt)
    stats = error_statistics(errors)
    cdf = compute_cdf(errors)

    return ErrorAnalysisResponse(
        errors=errors.tolist(),
        statistics=stats,
        cdf=cdf,
    )
