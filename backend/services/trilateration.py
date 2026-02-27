"""Trilateration engine – RSSI → distance → position estimation."""

import numpy as np
from scipy.optimize import least_squares
from typing import List, Tuple


def rssi_to_distance(rssi: float, A: float = -40.0, n: float = 2.0) -> float:
    """
    Log-Distance Path Loss Model.
    d = 10 ^ ((A - RSSI) / (10 * n))

    Args:
        rssi: Received signal strength in dBm.
        A: Reference RSSI at 1 meter distance (dBm).
        n: Path loss exponent.
    Returns:
        Estimated distance in meters.
    """
    return 10 ** ((A - rssi) / (10 * n))


def trilaterate_ls(
    anchors: List[Tuple[float, float]],
    distances: List[float],
) -> Tuple[float, float]:
    """
    Least-Squares trilateration.

    Linearises the system by subtracting the last circle equation from all others,
    then solves via numpy.linalg.lstsq.

    Args:
        anchors: List of (x, y) anchor coordinates in meters.
        distances: Corresponding distance estimates in meters.
    Returns:
        (x, y) estimated position.
    """
    n = len(anchors)
    if n < 3:
        raise ValueError("At least 3 anchors required for trilateration")

    anchors = np.array(anchors, dtype=float)
    distances = np.array(distances, dtype=float)

    # Linearise: subtract last equation from each of the first (n-1)
    A_mat = np.zeros((n - 1, 2))
    b_vec = np.zeros(n - 1)
    xn, yn = anchors[-1]
    dn = distances[-1]

    for i in range(n - 1):
        xi, yi = anchors[i]
        di = distances[i]
        A_mat[i, 0] = 2 * (xi - xn)
        A_mat[i, 1] = 2 * (yi - yn)
        b_vec[i] = (di**2 - dn**2) - (xi**2 - xn**2) - (yi**2 - yn**2)

    result, _, _, _ = np.linalg.lstsq(A_mat, b_vec, rcond=None)
    return float(result[0]), float(result[1])


def trilaterate_wls(
    anchors: List[Tuple[float, float]],
    distances: List[float],
    weights: List[float] | None = None,
) -> Tuple[float, float]:
    """
    Weighted Least-Squares trilateration using scipy.optimize.

    Args:
        anchors: List of (x, y) anchor coordinates in meters.
        distances: Corresponding distance estimates in meters.
        weights: Optional weights (higher = more trusted). Defaults to 1/d.
    Returns:
        (x, y) estimated position.
    """
    n = len(anchors)
    if n < 3:
        raise ValueError("At least 3 anchors required")

    anchors_arr = np.array(anchors, dtype=float)
    distances_arr = np.array(distances, dtype=float)

    if weights is None:
        weights_arr = 1.0 / np.maximum(distances_arr, 0.1)
    else:
        weights_arr = np.array(weights, dtype=float)

    # Initial guess: centroid of anchors
    x0 = np.mean(anchors_arr, axis=0)

    def residuals(pos):
        diffs = anchors_arr - pos
        estimated_d = np.sqrt(np.sum(diffs**2, axis=1))
        return weights_arr * (estimated_d - distances_arr)

    result = least_squares(residuals, x0)
    return float(result.x[0]), float(result.x[1])
