import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "ChronicCare AI"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    
    # Security & JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-clinical-ai-jwt-key-2026-production-grade")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    ADMIN_ACCESS_CODE: str = os.getenv("ADMIN_ACCESS_CODE", "ADMIN-2026-CHRONIC-CARE")
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./chronic_care.db")
    FALLBACK_SQLITE_URL: str = "sqlite:///./chronic_care.db"
    
    # Storage
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    MAX_FILE_SIZE_BYTES: int = 15 * 1024 * 1024 # 15MB
    ALLOWED_MIME_TYPES: List[str] = ["application/pdf", "image/png", "image/jpeg", "image/jpg"]
    
    # Clinical Triage Thresholds
    # Heart Disease
    BP_EMERGENCY_SYS: float = 180.0
    BP_EMERGENCY_DIA: float = 120.0
    BP_URGENT_SYS_MIN: float = 160.0
    BP_URGENT_SYS_MAX: float = 179.9
    BP_URGENT_DIA_MIN: float = 100.0
    BP_URGENT_DIA_MAX: float = 119.9
    BP_HIGH_SYS_MIN: float = 140.0
    BP_HIGH_SYS_MAX: float = 159.9
    BP_HIGH_DIA_MIN: float = 90.0
    BP_HIGH_DIA_MAX: float = 99.9
    
    HR_EMERGENCY_HIGH: float = 140.0
    HR_EMERGENCY_LOW: float = 40.0
    HR_URGENT_HIGH_MIN: float = 115.0
    HR_URGENT_HIGH_MAX: float = 139.9
    HR_URGENT_LOW_MIN: float = 41.0
    HR_URGENT_LOW_MAX: float = 50.0
    
    # Diabetes
    GLUCOSE_EMERGENCY_LOW: float = 54.0
    GLUCOSE_EMERGENCY_HIGH: float = 400.0
    GLUCOSE_URGENT_LOW_MIN: float = 55.0
    GLUCOSE_URGENT_LOW_MAX: float = 69.9
    GLUCOSE_URGENT_HIGH_MIN: float = 250.0
    GLUCOSE_URGENT_HIGH_MAX: float = 399.9
    GLUCOSE_HIGH_MIN: float = 180.0
    GLUCOSE_HIGH_MAX: float = 249.9
    
    # CKD
    EGFR_EMERGENCY_LOW: float = 15.0
    EGFR_URGENT_LOW_MIN: float = 15.0
    EGFR_URGENT_LOW_MAX: float = 29.9
    CREATININE_RISE_URGENT_THRESHOLD: float = 0.4 # mg/dL over baseline
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
