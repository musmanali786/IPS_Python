# IPS Platform - Build & Setup Guide

Complete setup and deployment guide for the Indoor Positioning System (IPS) Research Platform.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [Production Deployment](#production-deployment)

---

## Prerequisites

### System Requirements

- **OS**: macOS, Linux, or Windows (WSL2)
- **Python**: 3.10 or higher
- **Node.js**: 18 or higher
- **npm**: 9 or higher
- **Git**: For version control

### Required Tools

```bash
# Check Python version
python3 --version

# Check Node.js version
node --version

# Check npm version
npm --version
```

---

## Quick Start

If you want to get the application running quickly:

```bash
# Clone the repository (if needed)
cd /path/to/IPS_Python

# Install backend dependencies
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend
npm install

# In one terminal: Start the backend
cd ../backend
source venv/bin/activate
python3 -m uvicorn main:app --reload --port 8000

# In another terminal: Start the frontend
cd frontend
npm run dev

# Open browser to http://localhost:3000
```

---

## Backend Setup

### 1. Create Virtual Environment

```bash
cd backend
python3 -m venv venv
```

Activate the virtual environment:

**macOS/Linux:**
```bash
source venv/bin/activate
```

**Windows (CMD):**
```bash
venv\Scripts\activate
```

**Windows (PowerShell):**
```bash
venv\Scripts\Activate.ps1
```

### 2. Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configure Environment

Create a `.env` file in the `backend/` directory (optional, uses defaults):

```bash
# Database configuration
DATABASE_URL=sqlite:///./ips_dev.db

# Secret key for JWT tokens
SECRET_KEY=your-secure-secret-key-here

# CORS allowed origins
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Upload limits (in MB)
MAX_UPLOAD_SIZE_MB=50
```

### 4. Initialize Database

The database is automatically initialized on first startup. No manual setup required!

### 5. Run Backend Development Server

```bash
python3 -m uvicorn main:app --reload --port 8000
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started server process [12345]
```

### 6. Verify Backend is Running

```bash
# In another terminal, test the health endpoint
curl http://localhost:8000/api/health

# Response should be:
# {"status":"ok","version":"0.1.0"}
```

---

## Frontend Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

This will install:
- React 19
- React Router for navigation
- Axios for API calls
- Tailwind CSS for styling
- Plotly for data visualization
- Konva for canvas operations
- TypeScript for type safety

### 2. Configure API Server

The frontend automatically proxies API requests to `http://localhost:8000`. This is configured in `vite.config.ts`:

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
  },
}
```

If you need to change the backend URL for production, update `src/api.ts`.

### 3. Run Frontend Development Server

```bash
npm run dev
```

Expected output:
```
  VITE v6.4.1  ready in 456 ms

  ➜  Local:   http://localhost:3000/
  ➜  press h to show help
```

### 4. Build for Production

```bash
npm run build

# Output will be in the `dist/` directory
```

### 5. Preview Production Build

```bash
npm run preview
```

---

## Running the Application

### Complete Setup (Both Backend & Frontend)

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # or appropriate activation command for your OS
python3 -m uvicorn main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 (Optional) - Monitor logs:**
```bash
# Watch for any errors or activity
tail -f backend/logs/*.log  # if logging is configured
```

### Access the Application

- **Frontend UI**: http://localhost:3000
- **API Server**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs (Swagger UI)
- **ReDoc**: http://localhost:8000/redoc

---

## API Documentation

### Interactive Documentation

Once the backend is running, view the auto-generated documentation:

**Swagger UI**: http://localhost:8000/docs
**ReDoc**: http://localhost:8000/redoc

### Main API Endpoints

```
Maps & Building Management
  POST   /maps/upload              - Upload floor map
  GET    /maps                     - List maps
  DELETE /maps/{map_id}            - Delete map

Datasets
  POST   /datasets/upload          - Upload sensor data
  GET    /datasets                 - List datasets
  GET    /datasets/{dataset_id}    - Get dataset details

Experiments
  POST   /experiments/trilateration-lab      - Run trilateration
  POST   /experiments/fingerprinting-lab     - Run fingerprinting
  POST   /experiments/pdr                    - Pedestrian dead reckoning
  POST   /experiments/ble/smooth             - BLE Kalman smoothing
  POST   /experiments/ftm                    - FTM multilateration
  POST   /experiments/dfp                    - Device-free positioning

Signal Analysis
  GET    /signal/stats/{bssid}     - Get signal statistics
  POST   /signal/analyze           - Analyze signal data

Health
  GET    /api/health               - Health check
```

---

## Project Structure

### Backend

```
backend/
├── main.py                    # FastAPI application entry point
├── config.py                  # Configuration settings
├── database.py                # Database setup and models
├── requirements.txt           # Python dependencies
├── routers/
│   ├── maps.py               # Map management endpoints
│   ├── datasets.py           # Dataset upload/management
│   ├── experiments.py        # Experiment execution endpoints
│   ├── buildings.py          # Building data endpoints
│   └── signal.py             # Signal analysis endpoints
├── services/
│   ├── algorithms.py         # Positioning algorithms
│   ├── analysis.py           # Statistical analysis
│   └── file_handlers.py      # File parsing utilities
├── models/
│   └── database.py           # SQLAlchemy models
├── uploads/                  # User-uploaded files
└── ips_dev.db               # SQLite database
```

### Frontend

```
frontend/
├── src/
│   ├── App.tsx              # Main application component
│   ├── api.ts               # API client and types
│   ├── types/
│   │   └── experiment.ts    # Experiment type definitions
│   ├── hooks/
│   │   └── useFileUpload.ts # File upload custom hook
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── ExperimentLab.tsx        # Lab layout
│   │   ├── experiments/
│   │   │   ├── ExperimentTrilaterationLab.tsx
│   │   │   ├── ExperimentFingerprintingLab.tsx
│   │   │   ├── PlaceholderLab.tsx
│   │   │   └── index.ts
│   │   └── ... other pages
│   └── main.tsx             # React entry point
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts           # Vite bundler config
├── eslint.config.js
└── dist/                    # Production build output
```

---

## Development Workflow

### Code Changes

**Backend:**
- The `--reload` flag automatically restarts the server on file changes
- Check http://localhost:8000/docs for API changes

**Frontend:**
- Vite's HMR (Hot Module Replacement) updates the browser automatically
- TypeScript will show errors in the terminal

### Linting & Format

**Frontend:**
```bash
npm run lint
```

**Backend:**
```bash
# Install linting tools
pip install pylint black

# Format code
black backend/

# Lint
pylint backend/
```

---

## Troubleshooting

### Backend Issues

#### Port 8000 already in use
```bash
# Kill the process using port 8000
lsof -i :8000
kill -9 <PID>

# Or use a different port
python3 -m uvicorn main:app --reload --port 8001
```

#### Database errors
```bash
# Reset the database
rm backend/ips_dev.db

# It will be recreated automatically on startup
python3 -m uvicorn main:app --reload --port 8000
```

#### Import errors
```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
pip install --upgrade --force-reinstall -r requirements.txt
```

### Frontend Issues

#### Port 3000 already in use
```bash
# Kill the process using port 3000
lsof -i :3000
kill -9 <PID>

# Or configure a different port in vite.config.ts
```

#### Dependencies not found
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### API calls failing (CORS errors)
```bash
# Ensure backend CORS config includes your frontend origin
# In backend/config.py:
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Then restart the backend
```

#### Build errors
```bash
# Check TypeScript
npm run build

# If errors persist, check the error messages carefully
# Common issues:
# - Missing type definitions
# - Unused variables (turn off strict mode temporarily)
# - Missing environment variables
```

---

## Production Deployment

### Backend Deployment

#### Using Gunicorn (Recommended)

```bash
# Install production server
pip install gunicorn

# Run with multiple workers
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000
```

#### Using Docker

```bash
# Build image
docker build -t ips-backend .

# Run container
docker run -p 8000:8000 ips-backend
```

### Frontend Deployment

#### Build for Production

```bash
# Create production build
npm run build

# The `dist/` folder contains optimized files
```

#### Deploy to Web Server

Option 1: Serve with Node.js
```bash
npm install -g serve
serve -s dist -l 3000
```

Option 2: Serve with Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

### Database (Production)

For production, use PostgreSQL instead of SQLite:

```bash
# Install PostgreSQL driver
pip install psycopg2-binary

# Set environment variable
export DATABASE_URL="postgresql://user:password@localhost/ips_db"

# Run migrations if needed
alembic upgrade head
```

### Environment Variables (Production)

Create `.env` file with production values:

```bash
# backend/.env
DATABASE_URL=postgresql://user:password@localhost/ips_db
SECRET_KEY=your-production-secret-key
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
MAX_UPLOAD_SIZE_MB=100
```

---

## Performance Optimization

### Backend

- Use connection pooling for database
- Enable query caching
- Use async operations for I/O
- Monitor with APM tools (e.g., New Relic)

### Frontend

- Code splitting with React.lazy()
- Image optimization
- Minification (automatic with `npm run build`)
- Caching strategies
- CDN for static assets

---

## Monitoring & Logging

### Backend Logs

```bash
# View logs in real-time
tail -f backend/logs/app.log

# With timestamps
tail -f backend/logs/app.log | grep -i error
```

### Frontend Logs

```bash
# Browser console (Ctrl+Shift+I or Cmd+Option+I)
# Check for errors in the Network tab for API failures
```

---

## Testing

### Backend

```bash
# Install testing dependencies
pip install pytest pytest-asyncio

# Run tests
pytest backend/tests/
```

### Frontend

```bash
# Coming soon - add test framework (Vitest, Jest)
```

---

## Getting Help

- **API Documentation**: http://localhost:8000/docs
- **Issues**: Check troubleshooting section above
- **Code**: Review source files in `backend/` and `frontend/`
- **Documentation**: Check README.md

---

## Quick Reference Commands

```bash
# Backend
cd backend && source venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm install
npm run dev                    # Dev server
npm run build                  # Production build
npm run preview                # Preview build
npm run lint                   # Check code

# Database
sqlite3 backend/ips_dev.db     # Inspect SQLite database

# Health checks
curl http://localhost:8000/api/health
curl http://localhost:3000
```

---

**Last Updated**: March 2025  
**Version**: 1.0  
**Platform**: macOS, Linux, Windows (WSL2)
