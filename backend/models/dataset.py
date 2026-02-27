from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from database import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)

    # Type: "rssi", "imu", "fingerprint_radio_map", "ftm"
    data_type = Column(String, nullable=False)

    # Associated map (optional)
    map_id = Column(Integer, ForeignKey("floor_maps.id"), nullable=True)

    # Schema metadata (column names, row count, etc.)
    metadata_info = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
