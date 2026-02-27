from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


# Expected column schemas for each data type
DATASET_SCHEMAS = {
    "rssi": {
        "required": ["timestamp", "ap_id", "rssi"],
        "optional": ["x", "y", "mac_address"],
        "description": "RF Scans – RSSI readings from Wi-Fi APs or BLE beacons",
    },
    "imu": {
        "required": ["timestamp", "acc_x", "acc_y", "acc_z"],
        "optional": ["gyro_x", "gyro_y", "gyro_z", "mag_x", "mag_y", "mag_z"],
        "description": "IMU data – Accelerometer and optionally Gyroscope/Magnetometer",
    },
    "fingerprint_radio_map": {
        "required": ["x", "y"],
        "optional": [],  # remaining columns are AP RSSI values
        "description": "Fingerprinting Radio Map – grid coordinates with AP RSSI columns",
    },
    "ftm": {
        "required": ["timestamp", "ap_id", "distance_m"],
        "optional": ["rssi", "rtt_ns", "x", "y"],
        "description": "Fine Timing Measurement – distance estimates from Wi-Fi RTT",
    },
}


class DatasetUploadResponse(BaseModel):
    id: int
    name: str
    data_type: str
    filename: str
    row_count: int
    columns: List[str]
    created_at: datetime

    class Config:
        from_attributes = True


class DatasetValidationResult(BaseModel):
    valid: bool
    data_type: str
    missing_columns: List[str] = []
    extra_columns: List[str] = []
    row_count: int = 0
    message: str = ""


class DatasetListItem(BaseModel):
    id: int
    name: str
    data_type: str
    filename: str
    map_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
