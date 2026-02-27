"""BLE service – Kalman filter for RSSI smoothing."""

import numpy as np
from typing import List


class KalmanFilterRSSI:
    """
    Simple 1-D Kalman filter for smoothing RSSI readings.

    State: estimated RSSI value
    Measurement: raw RSSI reading
    """

    def __init__(
        self,
        process_noise: float = 1.0,
        measurement_noise: float = 5.0,
        initial_estimate: float = -60.0,
        initial_error: float = 10.0,
    ):
        self.Q = process_noise       # Process noise covariance
        self.R = measurement_noise   # Measurement noise covariance
        self.x = initial_estimate    # State estimate
        self.P = initial_error       # Estimate error covariance

    def update(self, measurement: float) -> float:
        """Process one RSSI measurement and return the filtered value."""
        # Prediction step (state model is constant)
        x_pred = self.x
        P_pred = self.P + self.Q

        # Update step
        K = P_pred / (P_pred + self.R)       # Kalman gain
        self.x = x_pred + K * (measurement - x_pred)
        self.P = (1 - K) * P_pred

        return self.x

    def reset(self, initial_estimate: float = -60.0):
        self.x = initial_estimate
        self.P = 10.0


def smooth_rssi_kalman(
    rssi_values: List[float],
    process_noise: float = 1.0,
    measurement_noise: float = 5.0,
) -> List[float]:
    """
    Apply Kalman filter to a sequence of RSSI values.

    Args:
        rssi_values: Raw RSSI time series.
        process_noise: Q parameter.
        measurement_noise: R parameter.
    Returns:
        Smoothed RSSI time series.
    """
    if not rssi_values:
        return []
    kf = KalmanFilterRSSI(
        process_noise=process_noise,
        measurement_noise=measurement_noise,
        initial_estimate=rssi_values[0],
    )
    return [kf.update(r) for r in rssi_values]


def smooth_rssi_moving_average(
    rssi_values: List[float],
    window_size: int = 5,
) -> List[float]:
    """Simple moving-average filter for RSSI data."""
    if not rssi_values or window_size < 1:
        return rssi_values
    arr = np.array(rssi_values, dtype=float)
    kernel = np.ones(window_size) / window_size
    smoothed = np.convolve(arr, kernel, mode="same")
    return smoothed.tolist()
