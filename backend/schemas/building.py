"""Pydantic schemas for the Map Builder (Building → Floor → Path → AP)."""

from pydantic import BaseModel, Field
from typing import Optional


# ─── Shared ────────────────────────────────────────────────────────

class PointSchema(BaseModel):
    x: float
    y: float


class GeoAnchorSchema(BaseModel):
    px: PointSchema
    lat: float
    lon: float


# ─── Access Point ──────────────────────────────────────────────────

class APCreate(BaseModel):
    bssid: str
    ssid: Optional[str] = None
    label: Optional[str] = None
    x_px: float
    y_px: float
    frequency_mhz: Optional[int] = None
    tx_power_dbm: Optional[float] = None


class APResponse(APCreate):
    id: int
    floor_id: int
    x_m: Optional[float] = None
    y_m: Optional[float] = None

    class Config:
        from_attributes = True


# ─── Path ──────────────────────────────────────────────────────────

class PathCreate(BaseModel):
    name: str
    color: str = "#ef4444"
    waypoints_px: list[PointSchema]
    spacing_m: float = 1.0


class PathResponse(BaseModel):
    id: int
    floor_id: int
    name: str
    color: str
    waypoints_px: list[PointSchema]
    spacing_m: float
    discrete_points_m: Optional[list[dict]] = None
    discrete_points_px: Optional[list[PointSchema]] = None

    class Config:
        from_attributes = True


# ─── Floor ─────────────────────────────────────────────────────────

class CalibRectPx(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class CalibRectM(BaseModel):
    width_m: float
    height_m: float


class FloorCreate(BaseModel):
    floor_number: int = 0
    label: Optional[str] = None


class FloorCalibrate(BaseModel):
    calib_rect_px: CalibRectPx
    calib_rect_m: CalibRectM


class FloorSetOrigin(BaseModel):
    origin: PointSchema


class FloorSetGeo(BaseModel):
    anchors: list[GeoAnchorSchema] = Field(..., min_length=2, max_length=2)


class FloorResponse(BaseModel):
    id: int
    building_id: int
    floor_number: int
    label: Optional[str] = None
    filename: Optional[str] = None
    width_px: Optional[int] = None
    height_px: Optional[int] = None
    calib_rect_px: Optional[CalibRectPx] = None
    calib_rect_m: Optional[CalibRectM] = None
    pixels_per_meter: Optional[float] = None
    origin_px: Optional[PointSchema] = None
    geo_anchors: Optional[list[GeoAnchorSchema]] = None
    paths: list[PathResponse] = []
    access_points: list[APResponse] = []

    class Config:
        from_attributes = True


# ─── Building ──────────────────────────────────────────────────────

class BuildingCreate(BaseModel):
    name: str
    description: Optional[str] = None


class BuildingUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class BuildingListItem(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    floor_count: int = 0
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class BuildingResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    floors: list[FloorResponse] = []
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Master JSON export ───────────────────────────────────────────

class MasterMapJSON(BaseModel):
    """The unified config consumed by experiment modules."""
    building_id: int
    building_name: str
    floors: list[FloorResponse]
