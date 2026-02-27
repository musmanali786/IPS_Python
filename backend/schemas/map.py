from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PointSchema(BaseModel):
    x: float
    y: float


class CalibrationRequest(BaseModel):
    map_id: int
    point1: PointSchema
    point2: PointSchema
    real_distance_m: float = Field(..., gt=0, description="Real-world distance in meters")


class OriginRequest(BaseModel):
    map_id: int
    origin: PointSchema


class CalibrationResponse(BaseModel):
    map_id: int
    point1: PointSchema
    point2: PointSchema
    real_distance_m: float
    pixels_per_meter: float
    pixel_distance: float
    origin: Optional[PointSchema] = None

    class Config:
        from_attributes = True


class FloorMapResponse(BaseModel):
    id: int
    name: str
    filename: str
    width_px: int
    height_px: int
    created_at: datetime
    calibration: Optional[CalibrationResponse] = None

    class Config:
        from_attributes = True


class FloorMapListItem(BaseModel):
    id: int
    name: str
    filename: str
    width_px: int
    height_px: int
    is_calibrated: bool
    created_at: datetime

    class Config:
        from_attributes = True
