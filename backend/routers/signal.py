"""Signal Analyzer endpoints — discover APs and serve heatmap data.

Works with the 'rssi' and 'fingerprint_radio_map' dataset types stored in
the Datasets table.  No new DB models needed — everything is computed on
the fly from uploaded CSV files.
"""

from typing import List, Optional
import os

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import pandas as pd

from database import get_db
from models.dataset import Dataset
from models.building import Floor
from schemas.signal import DiscoveredAP, HeatmapPoint, HeatmapResponse

router = APIRouter(prefix="/api/signal", tags=["signal-analyzer"])


# ──────────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────────

def _load_rssi_datasets(db: Session,
                        building_id: Optional[int] = None,
                        floor_id: Optional[int] = None) -> pd.DataFrame:
    """Load & concatenate all RSSI-type datasets, optionally scoped to a floor."""
    query = db.query(Dataset).filter(
        Dataset.data_type.in_(["rssi", "fingerprint_radio_map"])
    )

    # If floor_id is provided we can use map_id on the dataset to filter
    # (map_id was originally floor_maps.id; we also accept floor IDs)
    if floor_id is not None:
        query = query.filter(
            (Dataset.map_id == floor_id) | (Dataset.map_id.is_(None))
        )

    datasets = query.all()
    if not datasets:
        return pd.DataFrame()

    frames = []
    for ds in datasets:
        if not os.path.exists(ds.filepath):
            continue
        try:
            df = pd.read_csv(ds.filepath)
            df.columns = [c.strip().lower() for c in df.columns]
            # Tag with dataset id so we can trace origin
            df["_dataset_id"] = ds.id
            df["_dataset_name"] = ds.name
            frames.append(df)
        except Exception:
            continue

    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)


def _extract_aps_from_rssi(df: pd.DataFrame) -> List[DiscoveredAP]:
    """Extract unique APs from long-form RSSI data (columns: ap_id/bssid, rssi)."""
    # Normalise column names — accept ap_id, bssid, mac_address
    bssid_col = None
    for candidate in ["bssid", "ap_id", "mac_address"]:
        if candidate in df.columns:
            bssid_col = candidate
            break
    if bssid_col is None:
        return []

    rssi_col = "rssi" if "rssi" in df.columns else None

    grouped = df.groupby(bssid_col)
    aps = []
    for bssid_val, grp in grouped:
        ssid = None
        if "ssid" in grp.columns:
            ssids = grp["ssid"].dropna().unique()
            if len(ssids):
                ssid = str(ssids[0])
        avg_rssi = grp[rssi_col].mean() if rssi_col else 0.0
        aps.append(DiscoveredAP(
            bssid=str(bssid_val),
            ssid=ssid,
            count=len(grp),
            avg_rssi=round(float(avg_rssi), 2),
        ))

    # Sort by count descending
    aps.sort(key=lambda a: a.count, reverse=True)
    return aps


def _extract_aps_from_fingerprint(df: pd.DataFrame) -> List[DiscoveredAP]:
    """Extract APs from wide-form fingerprint radio maps.

    In these CSVs the first couple columns are x, y (and maybe z)
    and every remaining column header is a BSSID, with cells containing RSSI.
    """
    skip = {"x", "y", "z", "timestamp", "_dataset_id", "_dataset_name"}
    ap_cols = [c for c in df.columns if c not in skip]

    aps = []
    for col in ap_cols:
        series = pd.to_numeric(df[col], errors="coerce").dropna()
        if series.empty:
            continue
        aps.append(DiscoveredAP(
            bssid=col,
            ssid=None,
            count=int(series.count()),
            avg_rssi=round(float(series.mean()), 2),
        ))
    aps.sort(key=lambda a: a.count, reverse=True)
    return aps


# ──────────────────────────────────────────────────
#  GET /api/signal/aps  — discover APs
# ──────────────────────────────────────────────────

@router.get("/aps", response_model=List[DiscoveredAP])
def get_aps(
    building_id: Optional[int] = Query(None),
    floor_id: Optional[int] = Query(None),
    dataset_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Return a list of APs found in uploaded RSSI / fingerprint datasets."""

    # If a specific dataset is requested, load only that one
    if dataset_id is not None:
        ds = db.query(Dataset).get(dataset_id)
        if not ds:
            raise HTTPException(404, "Dataset not found")
        if not os.path.exists(ds.filepath):
            raise HTTPException(404, "Dataset file missing")
        df = pd.read_csv(ds.filepath)
        df.columns = [c.strip().lower() for c in df.columns]
    else:
        df = _load_rssi_datasets(db, building_id=building_id, floor_id=floor_id)

    if df.empty:
        return []

    # Detect data shape — wide (fingerprint) vs long (rssi)
    has_bssid_col = any(c in df.columns for c in ["bssid", "ap_id", "mac_address"])
    if has_bssid_col:
        return _extract_aps_from_rssi(df)
    else:
        return _extract_aps_from_fingerprint(df)


# ──────────────────────────────────────────────────
#  GET /api/signal/heatmap/{bssid}  — RSSI scatter
# ──────────────────────────────────────────────────

@router.get("/heatmap/{bssid}", response_model=HeatmapResponse)
def get_heatmap(
    bssid: str,
    floor_id: Optional[int] = Query(None),
    dataset_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Return {x, y, rssi} for every reading of the given BSSID."""

    if dataset_id is not None:
        ds = db.query(Dataset).get(dataset_id)
        if not ds:
            raise HTTPException(404, "Dataset not found")
        df = pd.read_csv(ds.filepath)
        df.columns = [c.strip().lower() for c in df.columns]
    else:
        df = _load_rssi_datasets(db, floor_id=floor_id)

    if df.empty:
        raise HTTPException(404, "No data available")

    # --- Long-form (rssi) ---
    has_bssid_col = any(c in df.columns for c in ["bssid", "ap_id", "mac_address"])
    if has_bssid_col:
        bssid_col = next(c for c in ["bssid", "ap_id", "mac_address"] if c in df.columns)
        subset = df[df[bssid_col].astype(str) == bssid].copy()
        if subset.empty:
            raise HTTPException(404, f"No readings for BSSID {bssid}")

        # Need x, y columns — fall back to lat/lon
        x_col = next((c for c in ["x", "lon", "longitude"] if c in subset.columns), None)
        y_col = next((c for c in ["y", "lat", "latitude"] if c in subset.columns), None)
        if x_col is None or y_col is None:
            raise HTTPException(422, "Dataset lacks x/y (or lat/lon) columns")

        rssi_col = "rssi" if "rssi" in subset.columns else None
        if rssi_col is None:
            raise HTTPException(422, "Dataset lacks rssi column")

        points = []
        for _, row in subset.iterrows():
            try:
                points.append(HeatmapPoint(
                    x=float(row[x_col]),
                    y=float(row[y_col]),
                    rssi=float(row[rssi_col]),
                ))
            except (ValueError, TypeError):
                continue

    # --- Wide-form (fingerprint radio map) ---
    else:
        if bssid not in df.columns:
            raise HTTPException(404, f"BSSID column '{bssid}' not found in dataset")

        x_col = "x" if "x" in df.columns else None
        y_col = "y" if "y" in df.columns else None
        if x_col is None or y_col is None:
            raise HTTPException(422, "Fingerprint map lacks x/y columns")

        points = []
        for _, row in df.iterrows():
            rssi_val = row.get(bssid)
            try:
                rssi_f = float(rssi_val)
            except (ValueError, TypeError):
                continue
            if pd.isna(rssi_f):
                continue
            points.append(HeatmapPoint(
                x=float(row[x_col]),
                y=float(row[y_col]),
                rssi=rssi_f,
            ))

    fid = floor_id or 0
    return HeatmapResponse(
        bssid=bssid,
        floor_id=fid,
        point_count=len(points),
        points=points,
    )


# ──────────────────────────────────────────────────
#  GET /api/signal/stats/{bssid}  — quick summary
# ──────────────────────────────────────────────────

@router.get("/stats/{bssid}")
def get_bssid_stats(
    bssid: str,
    dataset_id: Optional[int] = Query(None),
    floor_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Quick statistics for a single BSSID."""
    resp = get_heatmap(bssid, floor_id=floor_id, dataset_id=dataset_id, db=db)
    if not resp.points:
        return {"bssid": bssid, "count": 0}
    rssis = [p.rssi for p in resp.points]
    import statistics
    return {
        "bssid": bssid,
        "count": len(rssis),
        "min_rssi": round(min(rssis), 2),
        "max_rssi": round(max(rssis), 2),
        "mean_rssi": round(statistics.mean(rssis), 2),
        "median_rssi": round(statistics.median(rssis), 2),
        "std_rssi": round(statistics.stdev(rssis), 2) if len(rssis) > 1 else 0,
    }
