"""Ingest endpoints for the mobile IPS Collector app.

Authenticated with an API key sent in the `X-API-Key` header (keys configured
via INGEST_API_KEYS). Provides:
  - POST /api/ingest/location   live position updates (kept in memory)
  - GET  /api/ingest/locations  most-recent positions (for the web dashboard)
  - POST /api/ingest/logfile    upload a completed GetSensorData log file
"""

import time
from pathlib import Path
from typing import Dict, Optional

import shutil
from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from config import UPLOAD_DIR, INGEST_API_KEYS

router = APIRouter(prefix="/api/ingest", tags=["ingest"])

INGEST_DIR = UPLOAD_DIR / "ingest"
INGEST_DIR.mkdir(exist_ok=True)


def require_api_key(x_api_key: Optional[str] = Header(None)) -> str:
    """FastAPI dependency enforcing a valid X-API-Key header."""
    if not x_api_key or x_api_key not in INGEST_API_KEYS:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return x_api_key


class LiveLocation(BaseModel):
    lat: float
    lon: float
    accuracy: Optional[float] = None
    building_id: Optional[int] = None
    floor_id: Optional[int] = None
    map_name: Optional[str] = None
    surveyor: Optional[str] = None
    ts: Optional[str] = None


# In-memory store of the latest position per surveyor (dev-grade; swap for
# Redis / a table if you need persistence or multi-process sharing).
_LIVE: Dict[str, dict] = {}


@router.post("/location")
def post_location(loc: LiveLocation, _: str = Depends(require_api_key)):
    key = loc.surveyor or "anonymous"
    record = loc.model_dump()
    record["received_at"] = time.time()
    _LIVE[key] = record
    return {"status": "ok"}


@router.get("/locations")
def get_locations(_: str = Depends(require_api_key)):
    """Return the most-recent position for every surveyor."""
    return list(_LIVE.values())


@router.post("/logfile")
async def upload_logfile(
    file: UploadFile = File(...),
    building_id: Optional[int] = Form(None),
    floor_id: Optional[int] = Form(None),
    _: str = Depends(require_api_key),
):
    """Receive a completed log file from the collector app."""
    name = (file.filename or "upload.txt").replace("/", "_").replace(" ", "_")
    if not name.endswith((".txt", ".log", ".csv")):
        raise HTTPException(400, "Only .txt/.log/.csv log files are accepted")

    # Avoid clobbering: prefix with a timestamp if the name already exists.
    dest = INGEST_DIR / name
    if dest.exists():
        dest = INGEST_DIR / f"{int(time.time())}_{name}"

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    size = Path(dest).stat().st_size
    return {
        "status": "ok",
        "filename": dest.name,
        "size_bytes": size,
        "building_id": building_id,
        "floor_id": floor_id,
    }
