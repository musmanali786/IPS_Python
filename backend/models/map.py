from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class FloorMap(Base):
    __tablename__ = "floor_maps"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    width_px = Column(Integer, nullable=False)
    height_px = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    calibration = relationship("MapCalibration", back_populates="floor_map", uselist=False)


class MapCalibration(Base):
    __tablename__ = "map_calibrations"

    id = Column(Integer, primary_key=True, index=True)
    map_id = Column(Integer, ForeignKey("floor_maps.id"), unique=True, nullable=False)

    # Two calibration points in pixel coordinates
    point1_px = Column(JSON, nullable=False)  # {"x": ..., "y": ...}
    point2_px = Column(JSON, nullable=False)  # {"x": ..., "y": ...}

    # Real-world distance between the two points (meters)
    real_distance_m = Column(Float, nullable=False)

    # Computed pixels-per-meter ratio
    pixels_per_meter = Column(Float, nullable=False)

    # Origin point in pixel coordinates
    origin_px = Column(JSON, nullable=True)  # {"x": ..., "y": ...}

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    floor_map = relationship("FloorMap", back_populates="calibration")
