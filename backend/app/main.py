import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.app.config import settings
from backend.app.database import init_db
from backend.app.routers import (
    auth, patient, doctor, monitoring, assessment, consultation, admin
)

# Initialize database schema
init_db()

# Ensure uploads directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Production-grade AI-Powered Chronic Disease Prediction, Remote Patient Monitoring & Doctor Consultation Platform"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to configured domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register modular routers under /api
app.include_router(auth.router, prefix="/api")
app.include_router(patient.router, prefix="/api")
app.include_router(doctor.router, prefix="/api")
app.include_router(monitoring.router, prefix="/api")
app.include_router(assessment.router, prefix="/api")
app.include_router(consultation.router, prefix="/api")
app.include_router(admin.router, prefix="/api")

# Mount uploads directory for authenticated/protected document downloads
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

from backend.app.mongodb import mongo_manager
from backend.app.database import SessionLocal

@app.on_event("startup")
def startup_event():
    # If MongoDB Atlas is connected, synchronize existing records
    if mongo_manager.is_connected:
        db = SessionLocal()
        try:
            mongo_manager.sync_from_sqlite(db)
        finally:
            db.close()

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "engine": "FastAPI + Hybrid Relational/MongoDB Atlas + Scikit-Learn Triage",
        "mongodb": mongo_manager.check_health()
    }


# Serve frontend build if dist directory exists
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
