"""Fingerprinting engine – kNN and Weighted kNN matching."""

import math
import numpy as np
from typing import List, Tuple, Dict, Optional
from collections import defaultdict


def knn_match(
    radio_map: np.ndarray,
    radio_map_coords: np.ndarray,
    test_scan: np.ndarray,
    k: int = 3,
) -> Tuple[float, float]:
    """
    k-Nearest Neighbor fingerprint matching.

    Args:
        radio_map: (M, N) array – M reference points, N APs, values are RSSI.
        radio_map_coords: (M, 2) array – (x, y) coordinates for each reference point.
        test_scan: (N,) array – RSSI vector from a live scan.
        k: Number of nearest neighbors.
    Returns:
        (x, y) estimated position.
    """
    # Euclidean distance in signal space
    diffs = radio_map - test_scan
    signal_distances = np.sqrt(np.sum(diffs**2, axis=1))

    # Find k smallest
    k = min(k, len(signal_distances))
    nearest_idx = np.argpartition(signal_distances, k)[:k]

    # Average the coordinates
    position = np.mean(radio_map_coords[nearest_idx], axis=0)
    return float(position[0]), float(position[1])


def weighted_knn_match(
    radio_map: np.ndarray,
    radio_map_coords: np.ndarray,
    test_scan: np.ndarray,
    k: int = 3,
) -> Tuple[float, float]:
    """
    Weighted k-Nearest Neighbor – closer signal matches get higher weight.

    Args:
        radio_map: (M, N) RSSI matrix.
        radio_map_coords: (M, 2) coordinate matrix.
        test_scan: (N,) RSSI vector.
        k: Number of neighbors.
    Returns:
        (x, y) estimated position.
    """
    diffs = radio_map - test_scan
    signal_distances = np.sqrt(np.sum(diffs**2, axis=1))

    k = min(k, len(signal_distances))
    nearest_idx = np.argpartition(signal_distances, k)[:k]

    nearest_dists = signal_distances[nearest_idx]
    nearest_coords = radio_map_coords[nearest_idx]

    # Weights: inverse of distance (avoid division by zero)
    weights = 1.0 / np.maximum(nearest_dists, 1e-6)
    weights /= weights.sum()

    position = np.average(nearest_coords, axis=0, weights=weights)
    return float(position[0]), float(position[1])


# ─── Dict-based matching (for log-file fingerprinting) ───────────


def nearest_match_rssi_dict(
    fp_db: Dict[str, Dict[str, float]],
    fp_coords: Dict[str, Tuple[float, float]],
    online_scan: Dict[str, float],
    max_aps: int = 0,
) -> Tuple[Optional[str], float, float, float]:
    """
    Lab02-style nearest-match: find the reference point whose fingerprint
    has the lowest average absolute RSSI error vs. the online scan.

    Args:
        fp_db:        {ref_id: {bssid: rssi}} fingerprint database.
        fp_coords:    {ref_id: (x, y)} coordinates of each reference point.
        online_scan:  {bssid: rssi} from a live/test scan.
        max_aps:      Cap the number of common BSSIDs to compare (0 = all).

    Returns:
        (matched_ref_id, est_x, est_y, avg_rssi_error)
    """
    candidates: list = []
    for ref_id, ref_scan in fp_db.items():
        common = sorted(set(ref_scan.keys()) & set(online_scan.keys()))
        if max_aps > 0:
            common = common[:max_aps]
        if not common:
            continue
        errors = [abs(ref_scan[b] - online_scan[b]) for b in common]
        avg_err = sum(errors) / len(errors)
        candidates.append((ref_id, avg_err))

    if not candidates:
        return None, 0.0, 0.0, float("inf")

    candidates.sort(key=lambda x: x[1])
    best_id = candidates[0][0]
    return best_id, fp_coords[best_id][0], fp_coords[best_id][1], candidates[0][1]


def knn_match_rssi_dict(
    fp_db: Dict[str, Dict[str, float]],
    fp_coords: Dict[str, Tuple[float, float]],
    online_scan: Dict[str, float],
    k: int = 3,
    max_aps: int = 0,
    weighted: bool = False,
) -> Tuple[Optional[str], float, float, float]:
    """
    kNN / WkNN matching over RSSI dictionaries.

    Uses RMSE in RSSI space as the distance metric.

    Args:
        fp_db:        {ref_id: {bssid: rssi}}.
        fp_coords:    {ref_id: (x, y)}.
        online_scan:  {bssid: rssi}.
        k:            Number of neighbours.
        max_aps:      Cap the number of common BSSIDs (0 = all).
        weighted:     If True, use inverse-distance weighting.

    Returns:
        (best_ref_id, est_x, est_y, signal_distance)
    """
    candidates: list = []
    for ref_id, ref_scan in fp_db.items():
        common = sorted(set(ref_scan.keys()) & set(online_scan.keys()))
        if max_aps > 0:
            common = common[:max_aps]
        if not common:
            continue
        sq_sum = sum((ref_scan[b] - online_scan[b]) ** 2 for b in common)
        dist = math.sqrt(sq_sum / len(common))
        candidates.append((ref_id, dist))

    if not candidates:
        return None, 0.0, 0.0, float("inf")

    candidates.sort(key=lambda x: x[1])
    k_actual = min(k, len(candidates))
    top_k = candidates[:k_actual]

    if weighted:
        weights = [1.0 / max(d, 1e-6) for _, d in top_k]
        total_w = sum(weights)
        est_x = sum(fp_coords[rid][0] * w for (rid, _), w in zip(top_k, weights)) / total_w
        est_y = sum(fp_coords[rid][1] * w for (rid, _), w in zip(top_k, weights)) / total_w
    else:
        est_x = sum(fp_coords[rid][0] for rid, _ in top_k) / k_actual
        est_y = sum(fp_coords[rid][1] for rid, _ in top_k) / k_actual

    return top_k[0][0], est_x, est_y, top_k[0][1]


def average_wifi_scans(scans: List[Dict[str, int]]) -> Dict[str, float]:
    """Average RSSI values across multiple WiFi scans per BSSID."""
    totals: Dict[str, List[int]] = defaultdict(list)
    for scan in scans:
        for bssid, rssi in scan.items():
            totals[bssid].append(rssi)
    return {bssid: sum(vals) / len(vals) for bssid, vals in totals.items()}
