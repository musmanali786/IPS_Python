"""Map management & calibration endpoints."""

import os
import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from PIL import Image

from database import get_db
from config import UPLOAD_DIR, ALLOWED_IMAGE_EXTENSIONS
from models.map import FloorMap, MapCalibration
from schemas.map import (
    CalibrationRequest,
    CalibrationResponse,
    OriginRequest,
    FloorMapResponse,
    FloorMapListItem,
    PointSchema,
)
from services.calibration import compute_pixels_per_meter

router = APIRouter(prefix="/api/maps", tags=["maps"])

MAPS_DIR = UPLOAD_DIR / "maps"
MAPS_DIR.mkdir(exist_ok=True)


@router.post("/upload", response_model=FloorMapResponse)
async def upload_map(
    file: UploadFile = File(...),
    name: str = Form(...),
    db: Session = Depends(get_db),
):
    """Upload a floor-plan image."""
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(400, f"Invalid file type. Allowed: {ALLOWED_IMAGE_EXTENSIONS}")

    # Save file
    safe_name = file.filename.replace(" ", "_")
    dest = MAPS_DIR / safe_name
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Get dimensions
    with Image.open(dest) as img:
        w, h = img.size

    floor_map = FloorMap(
        name=name,
        filename=safe_name,
        filepath=str(dest),
        width_px=w,
        height_px=h,
    )
    db.add(floor_map)
    db.commit()
    db.refresh(floor_map)

    return FloorMapResponse(
        id=floor_map.id,
        name=floor_map.name,
        filename=floor_map.filename,
        width_px=floor_map.width_px,
        height_px=floor_map.height_px,
        created_at=floor_map.created_at,
    )


@router.get("/", response_model=list[FloorMapListItem])
def list_maps(db: Session = Depends(get_db)):
    maps = db.query(FloorMap).order_by(FloorMap.created_at.desc()).all()
    result = []
    for m in maps:
        result.append(FloorMapListItem(
            id=m.id,
            name=m.name,
            filename=m.filename,
            width_px=m.width_px,
            height_px=m.height_px,
            is_calibrated=m.calibration is not None,
            created_at=m.created_at,
        ))
    return result


@router.get("/{map_id}", response_model=FloorMapResponse)
def get_map(map_id: int, db: Session = Depends(get_db)):
    floor_map = db.query(FloorMap).filter(FloorMap.id == map_id).first()
    if not floor_map:
        raise HTTPException(404, "Map not found")

    calib = None
    if floor_map.calibration:
        c = floor_map.calibration
        calib = CalibrationResponse(
            map_id=c.map_id,
            point1=PointSchema(**c.point1_px),
            point2=PointSchema(**c.point2_px),
            real_distance_m=c.real_distance_m,
            pixels_per_meter=c.pixels_per_meter,
            pixel_distance=compute_pixels_per_meter(
                PointSchema(**c.point1_px), PointSchema(**c.point2_px), c.real_distance_m
            )[1],
            origin=PointSchema(**c.origin_px) if c.origin_px else None,
        )

    return FloorMapResponse(
        id=floor_map.id,
        name=floor_map.name,
        filename=floor_map.filename,
        width_px=floor_map.width_px,
        height_px=floor_map.height_px,
        created_at=floor_map.created_at,
        calibration=calib,
    )


@router.get("/{map_id}/image")
def get_map_image(map_id: int, db: Session = Depends(get_db)):
    floor_map = db.query(FloorMap).filter(FloorMap.id == map_id).first()
    if not floor_map:
        raise HTTPException(404, "Map not found")
    if not os.path.exists(floor_map.filepath):
        raise HTTPException(404, "Image file missing")
    return FileResponse(floor_map.filepath)


@router.post("/calibrate", response_model=CalibrationResponse)
def calibrate_map(req: CalibrationRequest, db: Session = Depends(get_db)):
    """
    Set two calibration points and the real-world distance between them.
    Computes and stores the pixels-per-meter ratio.
    """
    floor_map = db.query(FloorMap).filter(FloorMap.id == req.map_id).first()
    if not floor_map:
        raise HTTPException(404, "Map not found")

    ppm, pixel_dist = compute_pixels_per_meter(req.point1, req.point2, req.real_distance_m)

    # Upsert calibration
    calib = db.query(MapCalibration).filter(MapCalibration.map_id == req.map_id).first()
    if calib:
        calib.point1_px = req.point1.model_dump()
        calib.point2_px = req.point2.model_dump()
        calib.real_distance_m = req.real_distance_m
        calib.pixels_per_meter = ppm
    else:
        calib = MapCalibration(
            map_id=req.map_id,
            point1_px=req.point1.model_dump(),
            point2_px=req.point2.model_dump(),
            real_distance_m=req.real_distance_m,
            pixels_per_meter=ppm,
        )
        db.add(calib)

    db.commit()
    db.refresh(calib)

    return CalibrationResponse(
        map_id=calib.map_id,
        point1=req.point1,
        point2=req.point2,
        real_distance_m=req.real_distance_m,
        pixels_per_meter=ppm,
        pixel_distance=pixel_dist,
        origin=PointSchema(**calib.origin_px) if calib.origin_px else None,
    )


@router.post("/origin", response_model=CalibrationResponse)
def set_origin(req: OriginRequest, db: Session = Depends(get_db)):
    """Set the (0,0) origin point on the map."""
    calib = db.query(MapCalibration).filter(MapCalibration.map_id == req.map_id).first()
    if not calib:
        raise HTTPException(400, "Map must be calibrated first before setting origin")

    calib.origin_px = req.origin.model_dump()
    db.commit()
    db.refresh(calib)

    return CalibrationResponse(
        map_id=calib.map_id,
        point1=PointSchema(**calib.point1_px),
        point2=PointSchema(**calib.point2_px),
        real_distance_m=calib.real_distance_m,
        pixels_per_meter=calib.pixels_per_meter,
        pixel_distance=compute_pixels_per_meter(
            PointSchema(**calib.point1_px), PointSchema(**calib.point2_px), calib.real_distance_m
        )[1],
        origin=req.origin,
    )


@router.delete("/{map_id}")
def delete_map(map_id: int, db: Session = Depends(get_db)):
    floor_map = db.query(FloorMap).filter(FloorMap.id == map_id).first()
    if not floor_map:
        raise HTTPException(404, "Map not found")

    # Delete calibration first
    db.query(MapCalibration).filter(MapCalibration.map_id == map_id).delete()
    # Delete file
    if os.path.exists(floor_map.filepath):
        os.remove(floor_map.filepath)
    db.delete(floor_map)
    db.commit()

    return {"status": "deleted"}
