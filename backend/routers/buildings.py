"""Router for Map Builder — Buildings, Floors, Paths, Access Points."""

import io, json, math, os, re, shutil, zipfile
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session, joinedload

from database import get_db
from config import UPLOAD_DIR, ALLOWED_IMAGE_EXTENSIONS
from models.building import Building, Floor, FloorPath, AccessPoint
from schemas.building import (
    BuildingCreate,
    BuildingUpdate,
    BuildingListItem,
    BuildingResponse,
    FloorCreate,
    FloorResponse,
    FloorCalibrate,
    FloorSetOrigin,
    FloorSetGeo,
    PathCreate,
    PathResponse,
    APCreate,
    APResponse,
    MasterMapJSON,
)

router = APIRouter(prefix="/api/buildings", tags=["buildings"])

BUILDINGS_UPLOAD = UPLOAD_DIR / "buildings"
BUILDINGS_UPLOAD.mkdir(exist_ok=True)


# ──────────────────────────────────────────────────
#  BUILDINGS
# ──────────────────────────────────────────────────

@router.get("/", response_model=List[BuildingListItem])
def list_buildings(db: Session = Depends(get_db)):
    buildings = db.query(Building).order_by(Building.created_at.desc()).all()
    items = []
    for b in buildings:
        items.append(BuildingListItem(
            id=b.id,
            name=b.name,
            description=b.description,
            floor_count=len(b.floors) if b.floors else 0,
            created_at=str(b.created_at) if b.created_at else None,
        ))
    return items


@router.post("/", response_model=BuildingResponse, status_code=201)
def create_building(payload: BuildingCreate, db: Session = Depends(get_db)):
    b = Building(name=payload.name, description=payload.description)
    db.add(b)
    db.commit()
    db.refresh(b)
    return _building_response(b)


@router.get("/{building_id}", response_model=BuildingResponse)
def get_building(building_id: int, db: Session = Depends(get_db)):
    b = _get_building(building_id, db)
    return _building_response(b)


@router.patch("/{building_id}", response_model=BuildingResponse)
def update_building(building_id: int, payload: BuildingUpdate, db: Session = Depends(get_db)):
    b = _get_building(building_id, db)
    if payload.name is not None:
        b.name = payload.name
    if payload.description is not None:
        b.description = payload.description
    db.commit()
    db.refresh(b)
    return _building_response(b)


@router.delete("/{building_id}", status_code=204)
def delete_building(building_id: int, db: Session = Depends(get_db)):
    b = _get_building(building_id, db)
    # Clean up floor images
    for f in b.floors:
        if f.filepath and os.path.exists(f.filepath):
            os.remove(f.filepath)
    db.delete(b)
    db.commit()


# ──────────────────────────────────────────────────
#  FLOORS
# ──────────────────────────────────────────────────

@router.post("/{building_id}/floors", response_model=FloorResponse, status_code=201)
def create_floor(building_id: int, payload: FloorCreate, db: Session = Depends(get_db)):
    _get_building(building_id, db)
    f = Floor(building_id=building_id, floor_number=payload.floor_number, label=payload.label)
    db.add(f)
    db.commit()
    db.refresh(f)
    return _floor_response(f)


@router.post("/{building_id}/floors/{floor_id}/image", response_model=FloorResponse)
async def upload_floor_image(
    building_id: int,
    floor_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    f = _get_floor(building_id, floor_id, db)
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(400, f"Extension {ext} not allowed")

    dest = BUILDINGS_UPLOAD / f"floor_{floor_id}{ext}"
    with open(dest, "wb") as buf:
        shutil.copyfileobj(file.file, buf)

    # Read dimensions
    from PIL import Image as PILImage
    img = PILImage.open(dest)
    w, h = img.size
    img.close()

    f.filename = file.filename
    f.filepath = str(dest)
    f.width_px = w
    f.height_px = h
    db.commit()
    db.refresh(f)
    return _floor_response(f)


@router.get("/{building_id}/floors/{floor_id}/image")
def get_floor_image(building_id: int, floor_id: int, db: Session = Depends(get_db)):
    f = _get_floor(building_id, floor_id, db)
    if not f.filepath or not os.path.exists(f.filepath):
        raise HTTPException(404, "No image uploaded for this floor")
    return FileResponse(f.filepath)


@router.post("/{building_id}/floors/{floor_id}/calibrate", response_model=FloorResponse)
def calibrate_floor(
    building_id: int,
    floor_id: int,
    payload: FloorCalibrate,
    db: Session = Depends(get_db),
):
    f = _get_floor(building_id, floor_id, db)
    rect = payload.calib_rect_px
    meters = payload.calib_rect_m

    px_w = abs(rect.x2 - rect.x1)
    px_h = abs(rect.y2 - rect.y1)
    if px_w == 0 or px_h == 0:
        raise HTTPException(400, "Calibration rectangle has zero dimension")

    ppm_x = px_w / meters.width_m
    ppm_y = px_h / meters.height_m
    ppm = (ppm_x + ppm_y) / 2.0

    f.calib_rect_px = payload.calib_rect_px.model_dump()
    f.calib_rect_m = payload.calib_rect_m.model_dump()
    f.pixels_per_meter = ppm

    # Re-compute AP positions in meters
    _recompute_ap_meters(f)
    # Re-discretize paths
    _rediscretize_paths(f)

    db.commit()
    db.refresh(f)
    return _floor_response(f)


@router.post("/{building_id}/floors/{floor_id}/origin", response_model=FloorResponse)
def set_floor_origin(
    building_id: int,
    floor_id: int,
    payload: FloorSetOrigin,
    db: Session = Depends(get_db),
):
    f = _get_floor(building_id, floor_id, db)
    f.origin_px = payload.origin.model_dump()

    _recompute_ap_meters(f)
    _rediscretize_paths(f)

    db.commit()
    db.refresh(f)
    return _floor_response(f)


@router.post("/{building_id}/floors/{floor_id}/geo", response_model=FloorResponse)
def set_geo_anchors(
    building_id: int,
    floor_id: int,
    payload: FloorSetGeo,
    db: Session = Depends(get_db),
):
    f = _get_floor(building_id, floor_id, db)
    f.geo_anchors = [a.model_dump() for a in payload.anchors]
    db.commit()
    db.refresh(f)
    return _floor_response(f)


@router.delete("/{building_id}/floors/{floor_id}", status_code=204)
def delete_floor(building_id: int, floor_id: int, db: Session = Depends(get_db)):
    f = _get_floor(building_id, floor_id, db)
    if f.filepath and os.path.exists(f.filepath):
        os.remove(f.filepath)
    db.delete(f)
    db.commit()


# ──────────────────────────────────────────────────
#  PATHS
# ──────────────────────────────────────────────────

@router.post("/{building_id}/floors/{floor_id}/paths", response_model=PathResponse, status_code=201)
def create_path(
    building_id: int,
    floor_id: int,
    payload: PathCreate,
    db: Session = Depends(get_db),
):
    f = _get_floor(building_id, floor_id, db)
    waypoints = [p.model_dump() for p in payload.waypoints_px]

    p = FloorPath(
        floor_id=f.id,
        name=payload.name,
        color=payload.color,
        waypoints_px=waypoints,
        spacing_m=payload.spacing_m,
    )

    # Discretize if calibration exists
    if f.pixels_per_meter and f.origin_px:
        _discretize_path(p, f)

    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{building_id}/floors/{floor_id}/paths/{path_id}", status_code=204)
def delete_path(building_id: int, floor_id: int, path_id: int, db: Session = Depends(get_db)):
    _get_floor(building_id, floor_id, db)
    p = db.query(FloorPath).filter(FloorPath.id == path_id, FloorPath.floor_id == floor_id).first()
    if not p:
        raise HTTPException(404, "Path not found")
    db.delete(p)
    db.commit()


# ──────────────────────────────────────────────────
#  ACCESS POINTS
# ──────────────────────────────────────────────────

@router.post("/{building_id}/floors/{floor_id}/aps", response_model=APResponse, status_code=201)
def create_ap(
    building_id: int,
    floor_id: int,
    payload: APCreate,
    db: Session = Depends(get_db),
):
    f = _get_floor(building_id, floor_id, db)
    ap = AccessPoint(
        floor_id=f.id,
        bssid=payload.bssid,
        ssid=payload.ssid,
        label=payload.label,
        x_px=payload.x_px,
        y_px=payload.y_px,
        frequency_mhz=payload.frequency_mhz,
        tx_power_dbm=payload.tx_power_dbm,
    )
    if f.pixels_per_meter and f.origin_px:
        ox = f.origin_px["x"]
        oy = f.origin_px["y"]
        ap.x_m = (ap.x_px - ox) / f.pixels_per_meter
        ap.y_m = (oy - ap.y_px) / f.pixels_per_meter  # y-axis inverted
    db.add(ap)
    db.commit()
    db.refresh(ap)
    return ap


@router.delete("/{building_id}/floors/{floor_id}/aps/{ap_id}", status_code=204)
def delete_ap(building_id: int, floor_id: int, ap_id: int, db: Session = Depends(get_db)):
    _get_floor(building_id, floor_id, db)
    ap = db.query(AccessPoint).filter(AccessPoint.id == ap_id, AccessPoint.floor_id == floor_id).first()
    if not ap:
        raise HTTPException(404, "AP not found")
    db.delete(ap)
    db.commit()


# ──────────────────────────────────────────────────
#  MASTER JSON EXPORT
# ──────────────────────────────────────────────────

@router.get("/{building_id}/export", response_model=MasterMapJSON)
def export_master_json(building_id: int, db: Session = Depends(get_db)):
    b = _get_building(building_id, db)
    return MasterMapJSON(
        building_id=b.id,
        building_name=b.name,
        floors=[_floor_response(f) for f in b.floors],
    )


@router.get("/{building_id}/export.zip")
def export_master_zip(building_id: int, db: Session = Depends(get_db)):
    """Bundle the master map JSON + floor-plan images into a ZIP for the
    mobile collector app to import.

    Layout:
      map.json
      images/floor_<floor_id><ext>
    """
    b = _get_building(building_id, db)
    master = MasterMapJSON(
        building_id=b.id,
        building_name=b.name,
        floors=[_floor_response(f) for f in b.floors],
    )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(
            "map.json",
            json.dumps(master.model_dump(), default=str, indent=2),
        )
        for f in b.floors:
            if f.filepath and os.path.exists(f.filepath):
                ext = os.path.splitext(f.filepath)[1] or ".png"
                z.write(f.filepath, f"images/floor_{f.id}{ext}")
    buf.seek(0)

    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", b.name).strip("_") or f"building_{b.id}"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe}_map.zip"'},
    )


# ──────────────────────────────────────────────────
#  HELPERS
# ──────────────────────────────────────────────────

def _get_building(building_id: int, db: Session) -> Building:
    b = (
        db.query(Building)
        .options(joinedload(Building.floors).joinedload(Floor.paths),
                 joinedload(Building.floors).joinedload(Floor.access_points))
        .filter(Building.id == building_id)
        .first()
    )
    if not b:
        raise HTTPException(404, "Building not found")
    return b


def _get_floor(building_id: int, floor_id: int, db: Session) -> Floor:
    f = (
        db.query(Floor)
        .options(joinedload(Floor.paths), joinedload(Floor.access_points))
        .filter(Floor.id == floor_id, Floor.building_id == building_id)
        .first()
    )
    if not f:
        raise HTTPException(404, "Floor not found")
    return f


def _building_response(b: Building) -> BuildingResponse:
    return BuildingResponse(
        id=b.id,
        name=b.name,
        description=b.description,
        floors=[_floor_response(f) for f in (b.floors or [])],
        created_at=str(b.created_at) if b.created_at else None,
    )


def _floor_response(f: Floor) -> FloorResponse:
    return FloorResponse(
        id=f.id,
        building_id=f.building_id,
        floor_number=f.floor_number,
        label=f.label,
        filename=f.filename,
        width_px=f.width_px,
        height_px=f.height_px,
        calib_rect_px=f.calib_rect_px,
        calib_rect_m=f.calib_rect_m,
        pixels_per_meter=f.pixels_per_meter,
        origin_px=f.origin_px,
        geo_anchors=f.geo_anchors,
        paths=[PathResponse.model_validate(p) for p in (f.paths or [])],
        access_points=[APResponse.model_validate(ap) for ap in (f.access_points or [])],
    )


def _recompute_ap_meters(f: Floor):
    if not f.pixels_per_meter or not f.origin_px:
        return
    ox = f.origin_px["x"]
    oy = f.origin_px["y"]
    for ap in (f.access_points or []):
        ap.x_m = (ap.x_px - ox) / f.pixels_per_meter
        ap.y_m = (oy - ap.y_px) / f.pixels_per_meter


def _discretize_path(p: FloorPath, f: Floor):
    """Discretize waypoints into evenly spaced points along the polyline."""
    ppm = f.pixels_per_meter
    origin = f.origin_px
    if not ppm or not origin:
        return

    waypoints = p.waypoints_px  # list of {"x":..,"y":..}
    if len(waypoints) < 2:
        return

    spacing_px = p.spacing_m * ppm if p.spacing_m else ppm

    # Build discrete points in pixel space along the polyline
    discrete_px = [waypoints[0]]
    remaining = spacing_px

    for i in range(1, len(waypoints)):
        prev = waypoints[i - 1]
        curr = waypoints[i]
        dx = curr["x"] - prev["x"]
        dy = curr["y"] - prev["y"]
        seg_len = math.sqrt(dx * dx + dy * dy)
        if seg_len == 0:
            continue
        ux, uy = dx / seg_len, dy / seg_len

        consumed = 0.0
        start_x, start_y = prev["x"], prev["y"]

        while consumed + remaining <= seg_len:
            consumed += remaining
            start_x = prev["x"] + ux * consumed
            start_y = prev["y"] + uy * consumed
            discrete_px.append({"x": round(start_x, 2), "y": round(start_y, 2)})
            remaining = spacing_px

        remaining -= (seg_len - consumed)

    # Convert to metres
    ox, oy = origin["x"], origin["y"]
    discrete_m = []
    for pt in discrete_px:
        discrete_m.append({
            "x": round((pt["x"] - ox) / ppm, 4),
            "y": round((oy - pt["y"]) / ppm, 4),
            "z": 0,
        })

    p.discrete_points_px = discrete_px
    p.discrete_points_m = discrete_m


def _rediscretize_paths(f: Floor):
    for p in (f.paths or []):
        _discretize_path(p, f)
