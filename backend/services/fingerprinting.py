"""Fingerprinting engine – kNN and Weighted kNN matching."""

import numpy as np
from typing import List, Tuple, Dict


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
