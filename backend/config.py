import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Database (SQLite for development, swap to PostgreSQL for production)
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'ips_dev.db'}")

# CORS origins
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# JWT settings
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Upload limits
MAX_UPLOAD_SIZE_MB = 50
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".svg", ".bmp", ".gif"}
ALLOWED_DATA_EXTENSIONS = {".csv", ".json"}
