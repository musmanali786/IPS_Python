"""Models for Building → Floor → Path / AP / Calibration hierarchy."""

from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Building(Base):
    __tablename__ = "buildings"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    floors = relationship("Floor", back_populates="building", cascade="all, delete-orphan",
                          order_by="Floor.floor_number")


class Floor(Base):
    __tablename__ = "floors"

    id = Column(Integer, primary_key=True, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id"), nullable=False)
    floor_number = Column(Integer, nullable=False, default=0)
    label = Column(String, nullable=True)  # e.g. "Ground Floor"

    # Image
    filename = Column(String, nullable=True)
    filepath = Column(String, nullable=True)
    width_px = Column(Integer, nullable=True)
    height_px = Column(Integer, nullable=True)

    # Calibration rectangle (two opposite corners in pixels + real size in meters)
    calib_rect_px = Column(JSON, nullable=True)
    # {"x1": ..., "y1": ..., "x2": ..., "y2": ...}
    calib_rect_m = Column(JSON, nullable=True)
    # {"width_m": ..., "height_m": ...}
    pixels_per_meter = Column(Float, nullable=True)

    # Origin in pixel coords
    origin_px = Column(JSON, nullable=True)  # {"x": ..., "y": ...}

    # Geospatial alignment (two anchor points)
    geo_anchors = Column(JSON, nullable=True)
    # [{"px": {"x":..,"y":..}, "lat":..., "lon":...}, ...]

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    building = relationship("Building", back_populates="floors")
    paths = relationship("FloorPath", back_populates="floor", cascade="all, delete-orphan")
    access_points = relationship("AccessPoint", back_populates="floor", cascade="all, delete-orphan")


class FloorPath(Base):
    __tablename__ = "floor_paths"

    id = Column(Integer, primary_key=True, index=True)
    floor_id = Column(Integer, ForeignKey("floors.id"), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String, nullable=True, default="#ef4444")  # red by default

    # Ordered waypoints drawn by user (pixel coordinates)
    waypoints_px = Column(JSON, nullable=False)  # [{"x":..,"y":..}, ...]

    # Discretisation spacing in meters
    spacing_m = Column(Float, nullable=True, default=1.0)

    # Auto-computed discrete test points (meters, relative to origin)
    discrete_points_m = Column(JSON, nullable=True)  # [{"x":..,"y":..,"z":0}, ...]
    # Same in pixel space for rendering
    discrete_points_px = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    floor = relationship("Floor", back_populates="paths")


class AccessPoint(Base):
    __tablename__ = "access_points"

    id = Column(Integer, primary_key=True, index=True)
    floor_id = Column(Integer, ForeignKey("floors.id"), nullable=False)

    bssid = Column(String, nullable=False)
    ssid = Column(String, nullable=True)
    label = Column(String, nullable=True)

    # Position in pixel coordinates on the floor image
    x_px = Column(Float, nullable=False)
    y_px = Column(Float, nullable=False)

    # Position in metres (computed from calibration)
    x_m = Column(Float, nullable=True)
    y_m = Column(Float, nullable=True)

    # AP properties
    frequency_mhz = Column(Integer, nullable=True)
    tx_power_dbm = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    floor = relationship("Floor", back_populates="access_points")
