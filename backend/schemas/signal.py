"""Pydantic schemas for the Signal Analyzer / Heatmap endpoints."""

from pydantic import BaseModel
from typing import Optional


class DiscoveredAP(BaseModel):
    """An AP discovered from RSSI dataset rows."""
    bssid: str
    ssid: Optional[str] = None
    count: int = 0          # number of readings
    avg_rssi: float = 0.0   # mean RSSI across all readings


class HeatmapPoint(BaseModel):
    """A single signal-strength sample positioned on a map."""
    x: float       # local x coordinate (metres or raw)
    y: float       # local y coordinate
    rssi: float    # dBm


class HeatmapResponse(BaseModel):
    bssid: str
    floor_id: int
    point_count: int
    points: list[HeatmapPoint]
