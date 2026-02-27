"""Dataset management endpoints."""

import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
import pandas as pd

from database import get_db
from config import UPLOAD_DIR, ALLOWED_DATA_EXTENSIONS
from models.dataset import Dataset
from schemas.dataset import (
    DatasetUploadResponse,
    DatasetValidationResult,
    DatasetListItem,
    DATASET_SCHEMAS,
)

router = APIRouter(prefix="/api/datasets", tags=["datasets"])

DATA_DIR = UPLOAD_DIR / "datasets"
DATA_DIR.mkdir(exist_ok=True)


def validate_csv(filepath: str, data_type: str) -> DatasetValidationResult:
    """Validate a CSV file against the expected schema for a data type."""
    if data_type not in DATASET_SCHEMAS:
        return DatasetValidationResult(
            valid=False, data_type=data_type, message=f"Unknown data type: {data_type}"
        )

    schema = DATASET_SCHEMAS[data_type]
    try:
        df = pd.read_csv(filepath, nrows=5)
    except Exception as e:
        return DatasetValidationResult(
            valid=False, data_type=data_type, message=f"Cannot read CSV: {e}"
        )

    columns = [c.strip().lower() for c in df.columns.tolist()]
    required = set(schema["required"])
    missing = required - set(columns)

    if missing:
        return DatasetValidationResult(
            valid=False,
            data_type=data_type,
            missing_columns=list(missing),
            row_count=len(df),
            message=f"Missing required columns: {missing}",
        )

    # Count full rows
    full_df = pd.read_csv(filepath)
    return DatasetValidationResult(
        valid=True,
        data_type=data_type,
        row_count=len(full_df),
        message="Validation passed",
    )


@router.post("/upload", response_model=DatasetUploadResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    name: str = Form(...),
    data_type: str = Form(...),
    map_id: int = Form(None),
    db: Session = Depends(get_db),
):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_DATA_EXTENSIONS:
        raise HTTPException(400, f"Invalid file type. Allowed: {ALLOWED_DATA_EXTENSIONS}")
    if data_type not in DATASET_SCHEMAS:
        raise HTTPException(400, f"Unknown data_type. Allowed: {list(DATASET_SCHEMAS.keys())}")

    safe_name = file.filename.replace(" ", "_")
    dest = DATA_DIR / safe_name
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Validate
    result = validate_csv(str(dest), data_type)
    if not result.valid:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, result.message)

    df = pd.read_csv(str(dest))
    meta = {"columns": df.columns.tolist(), "row_count": len(df)}

    dataset = Dataset(
        name=name,
        filename=safe_name,
        filepath=str(dest),
        data_type=data_type,
        map_id=map_id,
        metadata_info=meta,
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    return DatasetUploadResponse(
        id=dataset.id,
        name=dataset.name,
        data_type=dataset.data_type,
        filename=dataset.filename,
        row_count=meta["row_count"],
        columns=meta["columns"],
        created_at=dataset.created_at,
    )


@router.get("/", response_model=list[DatasetListItem])
def list_datasets(data_type: str = None, db: Session = Depends(get_db)):
    q = db.query(Dataset)
    if data_type:
        q = q.filter(Dataset.data_type == data_type)
    datasets = q.order_by(Dataset.created_at.desc()).all()
    return [
        DatasetListItem(
            id=d.id,
            name=d.name,
            data_type=d.data_type,
            filename=d.filename,
            map_id=d.map_id,
            created_at=d.created_at,
        )
        for d in datasets
    ]


@router.get("/{dataset_id}/preview")
def preview_dataset(dataset_id: int, rows: int = 20, db: Session = Depends(get_db)):
    """Return first N rows of the dataset as JSON."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    df = pd.read_csv(dataset.filepath, nrows=rows)
    return {
        "columns": df.columns.tolist(),
        "data": df.to_dict(orient="records"),
        "total_rows": dataset.metadata_info.get("row_count", 0) if dataset.metadata_info else 0,
    }


@router.get("/schemas")
def get_schemas():
    """Return expected column schemas for each data type."""
    return DATASET_SCHEMAS


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    Path(dataset.filepath).unlink(missing_ok=True)
    db.delete(dataset)
    db.commit()
    return {"status": "deleted"}
