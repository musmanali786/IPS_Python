"""FTM (Fine Timing Measurement) service – ToF-based multilateration."""

import numpy as np
from scipy.optimize import least_squares
from typing import List, Tuple

SPEED_OF_LIGHT = 299_792_458  # m/s


def rtt_to_distance(rtt_ns: float) -> float:
    """
    Convert round-trip time to one-way distance.
    distance = (RTT * c) / 2
    """
    return (rtt_ns * 1e-9 * SPEED_OF_LIGHT) / 2.0


def multilaterate(
    anchors: List[Tuple[float, float]],
    distances: List[float],
) -> Tuple[float, float]:
    """
    Non-linear least-squares multilateration for FTM distances.

    Unlike RSSI-based trilateration, FTM distances are direct measurements
    so no path-loss model is needed.

    Args:
        anchors: (x, y) positions of FTM-capable APs in meters.
        distances: Measured distances from each AP in meters.
    Returns:
        (x, y) estimated position.
    """
    n = len(anchors)
    if n < 3:
        raise ValueError("At least 3 anchors required for multilateration")

    anchors_arr = np.array(anchors, dtype=float)
    distances_arr = np.array(distances, dtype=float)

    x0 = np.mean(anchors_arr, axis=0)

    def residuals(pos):
        diffs = anchors_arr - pos
        estimated_d = np.sqrt(np.sum(diffs**2, axis=1))
        return estimated_d - distances_arr

    result = least_squares(residuals, x0)
    return float(result.x[0]), float(result.x[1])
