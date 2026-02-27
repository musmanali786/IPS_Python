"""Pedestrian Dead Reckoning (PDR) engine."""

import numpy as np
from scipy.signal import find_peaks
from typing import List, Tuple, Optional


def detect_steps(
    acc_magnitude: np.ndarray,
    sampling_rate: float = 100.0,
    height: float = 1.0,
    distance: int = 30,
) -> np.ndarray:
    """
    Detect steps from accelerometer magnitude using peak detection.

    Args:
        acc_magnitude: 1-D array of accelerometer magnitude values.
        sampling_rate: Sampling rate in Hz.
        height: Minimum peak height threshold (in g or m/s²).
        distance: Minimum number of samples between peaks.
    Returns:
        Array of sample indices where steps were detected.
    """
    peaks, _ = find_peaks(acc_magnitude, height=height, distance=distance)
    return peaks


def weinberg_stride_length(
    acc_magnitude: np.ndarray,
    step_indices: np.ndarray,
    K: float = 0.41,
) -> np.ndarray:
    """
    Weinberg model: stride_length = K * (a_max - a_min)^(1/4)
    Computed per step using a window around each step peak.

    Args:
        acc_magnitude: Accelerometer magnitude time series.
        step_indices: Detected step peak indices.
        K: Weinberg constant (typically 0.35–0.50).
    Returns:
        Array of stride lengths for each step.
    """
    strides = []
    half_window = 15  # samples around peak

    for idx in step_indices:
        start = max(0, idx - half_window)
        end = min(len(acc_magnitude), idx + half_window)
        window = acc_magnitude[start:end]
        a_max = np.max(window)
        a_min = np.min(window)
        stride = K * (a_max - a_min) ** 0.25
        strides.append(stride)

    return np.array(strides)


def height_based_stride(user_height_m: float) -> float:
    """Simple stride estimation: stride ≈ 0.415 × height."""
    return 0.415 * user_height_m


def complementary_filter(
    gyro_z: np.ndarray,
    mag_heading: np.ndarray,
    dt: float,
    alpha: float = 0.98,
) -> np.ndarray:
    """
    Complementary filter for heading estimation.

    heading[k] = alpha * (heading[k-1] + gyro_z[k]*dt) + (1-alpha) * mag_heading[k]

    Args:
        gyro_z: Gyroscope yaw rate (rad/s).
        mag_heading: Magnetometer-derived heading (rad).
        dt: Sampling period in seconds.
        alpha: Filter coefficient (0–1). Higher = more gyro trust.
    Returns:
        Fused heading time series (rad).
    """
    n = len(gyro_z)
    heading = np.zeros(n)
    heading[0] = mag_heading[0]

    for i in range(1, n):
        heading[i] = alpha * (heading[i - 1] + gyro_z[i] * dt) + (1 - alpha) * mag_heading[i]

    return heading


def compute_trajectory(
    step_indices: np.ndarray,
    stride_lengths: np.ndarray,
    headings: np.ndarray,
    start_x: float = 0.0,
    start_y: float = 0.0,
) -> List[Tuple[float, float]]:
    """
    Dead-reckoning trajectory from steps + headings.

    Args:
        step_indices: Sample indices of detected steps.
        stride_lengths: Stride length per step (meters).
        headings: Heading at each sample (rad).
        start_x, start_y: Starting coordinates.
    Returns:
        List of (x, y) positions including the start.
    """
    trajectory = [(start_x, start_y)]
    x, y = start_x, start_y

    for i, idx in enumerate(step_indices):
        h = headings[idx] if idx < len(headings) else headings[-1]
        sl = stride_lengths[i] if i < len(stride_lengths) else stride_lengths[-1]
        x += sl * np.cos(h)
        y += sl * np.sin(h)
        trajectory.append((float(x), float(y)))

    return trajectory
