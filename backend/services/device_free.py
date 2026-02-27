"""Device-Free Positioning – baseline vs. active variance detection."""

import numpy as np
from typing import List, Dict, Tuple


def compute_baseline(
    rssi_matrix: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Compute baseline statistics from an empty-room RSSI capture.

    Args:
        rssi_matrix: (T, L) matrix – T time samples, L links.
    Returns:
        (mean_per_link, std_per_link) each of shape (L,).
    """
    return rssi_matrix.mean(axis=0), rssi_matrix.std(axis=0)


def detect_anomaly(
    active_rssi: np.ndarray,
    baseline_mean: np.ndarray,
    baseline_std: np.ndarray,
    threshold_sigma: float = 2.0,
) -> Dict[str, object]:
    """
    Compare active readings against baseline to detect human presence.

    Args:
        active_rssi: (T, L) matrix of readings during the active phase.
        baseline_mean: (L,) baseline means per link.
        baseline_std: (L,) baseline stds per link.
        threshold_sigma: Number of standard deviations for anomaly flag.
    Returns:
        Dict with:
          - "affected_links": list of link indices with anomaly
          - "variance_ratio": per-link variance ratio (active / baseline)
          - "z_scores": per-link average z-score
    """
    active_mean = active_rssi.mean(axis=0)
    active_std = active_rssi.std(axis=0)

    # Z-score of the active mean relative to baseline
    safe_std = np.maximum(baseline_std, 1e-6)
    z_scores = np.abs(active_mean - baseline_mean) / safe_std

    # Variance ratio
    variance_ratio = (active_std**2) / np.maximum(baseline_std**2, 1e-6)

    affected = np.where(z_scores > threshold_sigma)[0].tolist()

    return {
        "affected_links": affected,
        "variance_ratio": variance_ratio.tolist(),
        "z_scores": z_scores.tolist(),
    }


def simple_attenuation_model(
    free_space_rssi: float,
    body_loss_db: float = 6.0,
) -> float:
    """
    Simple human-body RF attenuation: attenuated RSSI = free_space - body_loss.
    Typical body shadowing loss: 3–10 dB.
    """
    return free_space_rssi - body_loss_db
