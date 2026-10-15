# ChronicCare AI — Production Deployment Guide

This guide details deployment options for production environments across cloud providers (Render, Railway, Docker, Vercel, Netlify, and Neon/Supabase PostgreSQL).

---

## 1. Environment Configuration (`.env`)

Create a `.env` file in the project root:

```env
# Application
APP_NAME=ChronicCare AI
APP_VERSION=2.0.0
DEBUG=False

# Security
SECRET_KEY=generate-a-cryptographically-secure-random-string-64-chars
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Database
# Production (Managed PostgreSQL):
DATABASE_URL=postgresql+psycopg2://user:password@host:5432/chroniccare
# Zero-Config Fallback (Automatically used if PostgreSQL is unreachable):
FALLBACK_SQLITE_URL=sqlite:///./chronic_care.db

# File Upload Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_BYTES=15728640
```

---

## 2. Docker Container Deployment

Create a `Dockerfile` for the combined full-stack container:

```dockerfile
# Multi-stage build: Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Multi-stage build: Backend & Final Image
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend and built frontend assets
COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Initialize uploads directory
RUN mkdir -p uploads

# Expose server port
EXPOSE 8000

# Execute database migrations, seeding, and run Uvicorn
CMD ["sh", "-c", "python backend/seed_data.py && uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"]
```

---

## 3. Cloud Provider Deployments

### A. Backend on Render / Railway
1. **Repository Link:** Connect your GitHub repository.
2. **Environment:** Python 3.11+.
3. **Build Command:**
   ```bash
   pip install -r requirements.txt && python backend/seed_data.py
   ```
4. **Start Command:**
   ```bash
   uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
   ```
5. **Database:** Add a Managed PostgreSQL service (e.g. Neon, Render PostgreSQL, or Supabase) and bind `DATABASE_URL`.

### B. Frontend on Vercel / Netlify
1. **Root Directory:** `frontend/`
2. **Build Command:** `npm run build`
3. **Output Directory:** `dist`
4. **Rewrite Rule (`vercel.json`):**
   ```json
   {
     "rewrites": [
       { "source": "/api/(.*)", "destination": "https://your-backend-api.onrender.com/api/$1" },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```

---

## 4. Local Execution & Development

### Option A: Dual-Port Live Dev Server
1. **Start Backend (Terminal 1):**
   ```bash
   python backend/seed_data.py
   uvicorn backend.app.main:app --reload --port 8000
   ```
2. **Start Frontend (Terminal 2):**
   ```bash
   cd frontend
   npm run dev
   ```
   Open `http://localhost:5173`. Requests to `/api` are automatically proxied to port 8000.

### Option B: Single-Port Production Mode
1. **Build Frontend Bundle:**
   ```bash
   cd frontend
   npm run build
   ```
2. **Run FastAPI Server:**
   ```bash
   cd ..
   python backend/seed_data.py
   uvicorn backend.app.main:app --port 8000
   ```
   Open `http://localhost:8000` to access the full-stack platform served directly by FastAPI!
