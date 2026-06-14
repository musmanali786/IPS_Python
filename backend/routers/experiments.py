"""Experiment engine endpoints – Trilateration, Fingerprinting, PDR, BLE, FTM, DFP."""

from fastapi import APIRouter, HTTPException, UploadFile, File as FastFile, Form
from pydantic import BaseModel, Field
from typing import List, Tuple, Optional, Dict
import numpy as np
import csv
import io
import tempfile
import os

from services.trilateration import rssi_to_distance, trilaterate_ls, trilaterate_wls
from services.fingerprinting import (
    knn_match,
    weighted_knn_match,
    nearest_match_rssi_dict,
    knn_match_rssi_dict,
    average_wifi_scans,
)
import math
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


# ─── Trilateration Lab (file-based, mirrors Lab01/Main.py) ───────

def _parse_wifi_scan(content: str) -> Dict[str, int]:
    """Parse a GetSensorData logfile and return {bssid: rssi} from the first WIFI scan."""
    list_scans = []
    reader = csv.reader(io.StringIO(content), delimiter=';')
    prv_tag = "NONE"
    bssid_rssi: Dict[str, int] = {}
    for row in reader:
        if len(row) > 4:
            if row[0] == "WIFI":
                bssid = row[4]
                rssi = int(row[5])
                bssid_rssi[bssid] = rssi
            elif prv_tag == "WIFI" and row[0] != "WIFI":
                list_scans.append(dict(bssid_rssi))
                bssid_rssi = {}
                break
            prv_tag = row[0]
    if not list_scans:
        if bssid_rssi:
            list_scans.append(dict(bssid_rssi))
        else:
            raise HTTPException(400, "No WIFI scan found in log file")
    return list_scans[0]


class LabTrilaterationRefResult(BaseModel):
    ref_id: int
    ref_x: float
    ref_y: float
    filetag: str
    distances: List[float]
    estimated_x: Optional[float] = None
    estimated_y: Optional[float] = None
    error: Optional[float] = None


class LabTrilaterationResponse(BaseModel):
    access_points: List[dict]        # [{ssid, x, y, bssid}, ...]
    ref_points: List[dict]           # [{id, x, y, filetag}, ...]
    results: List[LabTrilaterationRefResult]
    skipped_ref_points: List[str] = []   # filetags with no matching uploaded log
    room_width: float
    room_height: float
    rssi0: float
    path_loss_exponent: float
    solver: str


@router.post("/trilateration-lab", response_model=LabTrilaterationResponse)
async def run_trilateration_lab(
    aps_csv: UploadFile = FastFile(..., description="APs CSV: ssid,x,y,bssid"),
    refpts_csv: UploadFile = FastFile(..., description="RefPts CSV: id,x,y,filetag"),
    log_files: List[UploadFile] = FastFile(..., description="Dataset log files (one per ref point)"),
    rssi0: float = Form(-32.0),
    path_loss_exponent: float = Form(2.45),
    solver: str = Form("ls"),
    room_width: float = Form(13.0),
    room_height: float = Form(13.0),
):
    # ── Parse APs CSV ─────────────────────────────────────────────
    aps_content = (await aps_csv.read()).decode('utf-8')
    ap_infos = []
    for row in csv.reader(io.StringIO(aps_content)):
        if not row or row[0].startswith('#'):
            continue
        ssid, x, y, bssid = row[0].strip(), float(row[1]), float(row[2]), row[3].strip()
        ap_infos.append({"ssid": ssid, "x": x, "y": y, "bssid": bssid})

    if len(ap_infos) < 3:
        raise HTTPException(400, "Need at least 3 APs in the CSV")

    # ── Parse Ref Points CSV ──────────────────────────────────────
    ref_content = (await refpts_csv.read()).decode('utf-8')
    ref_ptsinfo = []
    for row in csv.reader(io.StringIO(ref_content)):
        if not row or row[0].startswith('#'):
            continue
        refno, x, y, filetag = int(row[0]), float(row[1]), float(row[2]), row[3].strip()
        ref_ptsinfo.append({"id": refno, "x": x, "y": y, "filetag": filetag})

    # ── Index log files by filetag ────────────────────────────────
    log_contents: Dict[str, str] = {}
    for lf in log_files:
        fname = lf.filename or ""
        content = (await lf.read()).decode('utf-8', errors='replace')
        # Index by full filename and also by matching ref tags
        log_contents[fname] = content

    # ── Process each reference point ──────────────────────────────
    results: List[LabTrilaterationRefResult] = []
    skipped_ref_points: List[str] = []
    for ref in ref_ptsinfo:
        # Find matching log file by filetag in filename
        filetag = ref["filetag"]
        matched_content = None
        for fname, content in log_contents.items():
            if filetag in fname:
                matched_content = content
                break

        if matched_content is None:
            # No log uploaded for this ref point — skip it rather than failing the run
            skipped_ref_points.append(filetag)
            continue

        bssid_rssi = _parse_wifi_scan(matched_content)

        # Compute distances from each AP
        distances = []
        for ap in ap_infos:
            bssid = ap["bssid"]
            if bssid not in bssid_rssi:
                raise HTTPException(400, f"BSSID {bssid} (AP {ap['ssid']}) not found in log for {filetag}")
            rssi = bssid_rssi[bssid]
            rssi_diff = rssi0 - rssi
            d = 10 ** (rssi_diff / (10 * path_loss_exponent))
            distances.append(round(d, 3))

        # Trilaterate
        anchors = [(ap["x"], ap["y"]) for ap in ap_infos]
        try:
            if solver == "wls":
                est_x, est_y = trilaterate_wls(anchors, distances)
            else:
                est_x, est_y = trilaterate_ls(anchors, distances)
            error = float(np.sqrt((est_x - ref["x"])**2 + (est_y - ref["y"])**2))
        except Exception:
            est_x, est_y, error = None, None, None

        results.append(LabTrilaterationRefResult(
            ref_id=ref["id"],
            ref_x=ref["x"],
            ref_y=ref["y"],
            filetag=filetag,
            distances=distances,
            estimated_x=round(est_x, 3) if est_x is not None else None,
            estimated_y=round(est_y, 3) if est_y is not None else None,
            error=round(error, 3) if error is not None else None,
        ))

    if not results:
        raise HTTPException(
            400,
            "No uploaded log file matched any reference point filetag. "
            f"Filetags in CSV: {[r['filetag'] for r in ref_ptsinfo]}; "
            f"uploaded files: {list(log_contents.keys())}",
        )

    return LabTrilaterationResponse(
        access_points=ap_infos,
        ref_points=[{"id": r["id"], "x": r["x"], "y": r["y"], "filetag": r["filetag"]}
                    for r in ref_ptsinfo if r["filetag"] not in skipped_ref_points],
        results=results,
        skipped_ref_points=skipped_ref_points,
        room_width=room_width,
        room_height=room_height,
        rssi0=rssi0,
        path_loss_exponent=path_loss_exponent,
        solver=solver,
    )


# ─── Fingerprinting Lab (file-based, mirrors Lab02) ──────────────

def _parse_all_wifi_scans(content: str) -> List[Dict[str, int]]:
    """Parse ALL WiFi scan blocks from a GetSensorData log file."""
    scans: List[Dict[str, int]] = []
    reader = csv.reader(io.StringIO(content), delimiter=';')
    prv_tag = "NONE"
    bssid_rssi: Dict[str, int] = {}
    for row in reader:
        if len(row) > 4:
            if row[0] == "WIFI":
                bssid_rssi[row[4]] = int(row[5])
            elif prv_tag == "WIFI" and row[0] != "WIFI":
                if bssid_rssi:
                    scans.append(dict(bssid_rssi))
                    bssid_rssi = {}
            prv_tag = row[0]
    if bssid_rssi:
        scans.append(dict(bssid_rssi))
    return scans


class LabFPTestResult(BaseModel):
    test_id: str
    test_x: float
    test_y: float
    filetag: str
    estimated_x: Optional[float] = None
    estimated_y: Optional[float] = None
    error_px: Optional[float] = None
    error_m: Optional[float] = None
    matched_ref: Optional[str] = None
    rssi_error: Optional[float] = None


class LabFPRefPoint(BaseModel):
    id: str
    x: float
    y: float
    filetag: str
    num_bssids: int


class LabFingerprintingResponse(BaseModel):
    ref_points: List[LabFPRefPoint]
    test_results: List[LabFPTestResult]
    skipped_ref_points: List[str] = []    # filetags with no matching training log
    skipped_test_points: List[str] = []   # filetags with no matching test log
    fp_db_size: int
    total_unique_bssids: int
    algorithm: str
    k: int
    max_aps: int
    pixels_per_meter: float
    scan_mode: str
    errors_m: List[float]
    cdf: dict
    statistics: dict


@router.post("/fingerprinting-lab", response_model=LabFingerprintingResponse)
async def run_fingerprinting_lab(
    refpts_csv: UploadFile = FastFile(..., description="Ref Points CSV: ID,X,Y,File"),
    testpts_csv: UploadFile = FastFile(..., description="Test Points CSV: ID,X,Y,File"),
    train_log_files: List[UploadFile] = FastFile(..., description="Training log files"),
    test_log_files: List[UploadFile] = FastFile(..., description="Test log files"),
    k: int = Form(1),
    algorithm: str = Form("nearest"),
    max_aps: int = Form(0),
    pixels_per_meter: float = Form(20.0),
    scan_mode: str = Form("average"),
):
    # ── Parse Reference Points CSV ────────────────────────────────
    ref_content = (await refpts_csv.read()).decode("utf-8")
    ref_infos: List[dict] = []
    for row in csv.reader(io.StringIO(ref_content)):
        if not row or row[0].strip().upper() == "ID" or row[0].startswith("#"):
            continue
        ref_infos.append({
            "id": row[0].strip(),
            "x": float(row[1]),
            "y": float(row[2]),
            "filetag": row[3].strip(),
        })

    # ── Index training log files ──────────────────────────────────
    train_contents: Dict[str, str] = {}
    for lf in train_log_files:
        content = (await lf.read()).decode("utf-8", errors="replace")
        train_contents[lf.filename or ""] = content

    # ── Build Fingerprint Database ────────────────────────────────
    fp_db: Dict[str, Dict[str, float]] = {}
    fp_coords: Dict[str, Tuple[float, float]] = {}
    ref_point_models: List[LabFPRefPoint] = []

    skipped_ref_points: List[str] = []
    for ref in ref_infos:
        filetag = ref["filetag"]
        matched_content = None
        for fname, content in train_contents.items():
            if filetag in fname:
                matched_content = content
                break
        if matched_content is None:
            # No training log for this ref point — skip it rather than failing the run
            skipped_ref_points.append(filetag)
            continue

        all_scans = _parse_all_wifi_scans(matched_content)
        if not all_scans:
            raise HTTPException(400, f"No WiFi scans in training file for '{filetag}'")

        if scan_mode == "first":
            fingerprint = {b: float(r) for b, r in all_scans[0].items()}
        else:
            fingerprint = average_wifi_scans(all_scans)

        rid = ref["id"]
        fp_db[rid] = fingerprint
        fp_coords[rid] = (ref["x"], ref["y"])
        ref_point_models.append(LabFPRefPoint(
            id=rid, x=ref["x"], y=ref["y"],
            filetag=filetag, num_bssids=len(fingerprint),
        ))

    if not fp_db:
        raise HTTPException(
            400,
            "No uploaded training log matched any reference point filetag. "
            f"Filetags in CSV: {[r['filetag'] for r in ref_infos]}; "
            f"uploaded files: {list(train_contents.keys())}",
        )

    # ── Parse Test Points CSV ─────────────────────────────────────
    test_content = (await testpts_csv.read()).decode("utf-8")
    test_infos: List[dict] = []
    for row in csv.reader(io.StringIO(test_content)):
        if not row or row[0].strip().upper() == "ID" or row[0].startswith("#"):
            continue
        test_infos.append({
            "id": row[0].strip(),
            "x": float(row[1]),
            "y": float(row[2]),
            "filetag": row[3].strip(),
        })

    # ── Index test log files ──────────────────────────────────────
    test_contents: Dict[str, str] = {}
    for lf in test_log_files:
        content = (await lf.read()).decode("utf-8", errors="replace")
        test_contents[lf.filename or ""] = content

    # ── Match each test point ─────────────────────────────────────
    all_unique_bssids: set = set()
    for fp in fp_db.values():
        all_unique_bssids.update(fp.keys())

    test_results: List[LabFPTestResult] = []
    errors_m: List[float] = []

    skipped_test_points: List[str] = []
    for tp in test_infos:
        filetag = tp["filetag"]
        matched_content = None
        for fname, content in test_contents.items():
            if filetag in fname:
                matched_content = content
                break
        if matched_content is None:
            # No test log for this point — skip it rather than failing the run
            skipped_test_points.append(filetag)
            continue

        all_scans = _parse_all_wifi_scans(matched_content)
        if not all_scans:
            raise HTTPException(400, f"No WiFi scans in test file for '{filetag}'")

        if scan_mode == "first":
            online_scan: Dict[str, float] = {b: float(r) for b, r in all_scans[0].items()}
        else:
            online_scan = average_wifi_scans(all_scans)

        # Run matching
        if algorithm == "nearest":
            matched_id, est_x, est_y, rssi_err = nearest_match_rssi_dict(
                fp_db, fp_coords, online_scan, max_aps,
            )
        elif algorithm == "wknn":
            matched_id, est_x, est_y, rssi_err = knn_match_rssi_dict(
                fp_db, fp_coords, online_scan, k, max_aps, weighted=True,
            )
        else:  # knn
            matched_id, est_x, est_y, rssi_err = knn_match_rssi_dict(
                fp_db, fp_coords, online_scan, k, max_aps, weighted=False,
            )

        if matched_id is not None:
            err_px = math.sqrt((est_x - tp["x"]) ** 2 + (est_y - tp["y"]) ** 2)
            err_m = err_px / pixels_per_meter if pixels_per_meter > 0 else err_px
            errors_m.append(err_m)
        else:
            est_x, est_y, err_px, err_m, rssi_err = None, None, None, None, None

        test_results.append(LabFPTestResult(
            test_id=tp["id"],
            test_x=tp["x"],
            test_y=tp["y"],
            filetag=filetag,
            estimated_x=round(est_x, 2) if est_x is not None else None,
            estimated_y=round(est_y, 2) if est_y is not None else None,
            error_px=round(err_px, 2) if err_px is not None else None,
            error_m=round(err_m, 3) if err_m is not None else None,
            matched_ref=matched_id,
            rssi_error=round(rssi_err, 2) if rssi_err is not None else None,
        ))

    if not test_results:
        raise HTTPException(
            400,
            "No uploaded test log matched any test point filetag. "
            f"Filetags in CSV: {[t['filetag'] for t in test_infos]}; "
            f"uploaded files: {list(test_contents.keys())}",
        )

    # ── CDF & statistics ──────────────────────────────────────────
    if errors_m:
        err_arr = np.array(errors_m)
        cdf = compute_cdf(err_arr)
        stats = error_statistics(err_arr)
    else:
        cdf = {"x": [], "y": []}
        stats = {}

    return LabFingerprintingResponse(
        ref_points=ref_point_models,
        test_results=test_results,
        skipped_ref_points=skipped_ref_points,
        skipped_test_points=skipped_test_points,
        fp_db_size=len(fp_db),
        total_unique_bssids=len(all_unique_bssids),
        algorithm=algorithm,
        k=k,
        max_aps=max_aps,
        pixels_per_meter=pixels_per_meter,
        scan_mode=scan_mode,
        errors_m=errors_m,
        cdf=cdf,
        statistics=stats,
    )


# ─── Fingerprinting (JSON) ───────────────────────────────────────

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
    elif req.gyro_z:
        # Gyro-only: integrate yaw rate to get heading
        headings = np.cumsum(np.array(req.gyro_z) * dt)
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
    try:
        baseline = np.array(req.baseline_rssi, dtype=float)
        active = np.array(req.active_rssi, dtype=float)
    except ValueError:
        raise HTTPException(400, "baseline_rssi and active_rssi rows must all have the same length")

    if baseline.ndim != 2 or active.ndim != 2:
        raise HTTPException(400, "baseline_rssi and active_rssi must be non-empty 2-D matrices (time × links)")
    if baseline.shape[1] != active.shape[1]:
        raise HTTPException(
            400,
            f"Link count mismatch: baseline has {baseline.shape[1]} links, active has {active.shape[1]}",
        )

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
    if not req.estimated:
        raise HTTPException(400, "estimated and ground_truth must not be empty")

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
