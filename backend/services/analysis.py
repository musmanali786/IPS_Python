"""Analysis & metrics service – error computation and CDF generation."""

import numpy as np
from typing import List, Tuple, Dict


def euclidean_error(
    estimated: List[Tuple[float, float]],
    ground_truth: List[Tuple[float, float]],
) -> np.ndarray:
    """
    Compute Euclidean distance error between estimated and ground-truth positions.

    E = sqrt((x_est - x_true)^2 + (y_est - y_true)^2)

    Returns:
        Array of error values.
    """
    est = np.array(estimated, dtype=float)
    gt = np.array(ground_truth, dtype=float)
    return np.sqrt(np.sum((est - gt) ** 2, axis=1))


def compute_cdf(errors: np.ndarray, num_bins: int = 200) -> Dict[str, List[float]]:
    """
    Compute CDF (Cumulative Distribution Function) of errors.

    Returns:
        {"x": sorted error values, "y": cumulative probability 0-1}
    """
    sorted_errors = np.sort(errors)
    cdf_y = np.arange(1, len(sorted_errors) + 1) / len(sorted_errors)
    return {
        "x": sorted_errors.tolist(),
        "y": cdf_y.tolist(),
    }


def error_statistics(errors: np.ndarray) -> Dict[str, float]:
    """Summary statistics for positioning error."""
    return {
        "mean": float(np.mean(errors)),
        "median": float(np.median(errors)),
        "std": float(np.std(errors)),
        "min": float(np.min(errors)),
        "max": float(np.max(errors)),
        "p50": float(np.percentile(errors, 50)),
        "p75": float(np.percentile(errors, 75)),
        "p90": float(np.percentile(errors, 90)),
        "p95": float(np.percentile(errors, 95)),
    }
