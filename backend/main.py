"""IPS Research Platform – FastAPI entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from database import init_db
from routers import maps, datasets, experiments, buildings, signal, ingest

app = FastAPI(
    title="IPS Research Platform",
    description="Indoor Positioning System experimentation backend",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(maps.router)
app.include_router(datasets.router)
app.include_router(experiments.router)
app.include_router(buildings.router)
app.include_router(signal.router)
app.include_router(ingest.router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}
