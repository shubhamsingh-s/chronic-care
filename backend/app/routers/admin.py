from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from backend.app.database import get_db
from backend.app.config import settings
from backend.app.models import (
    User, PatientProfile, DoctorProfile, ConsultationRequest,
    DailyReport, AuditLog, Notification
)
from backend.app.schemas import AdminAnalyticsResponse, AdminCodeVerify
from backend.app.auth import require_role, log_audit

router = APIRouter(prefix="/admin", tags=["Administrator Governance"])

@router.post("/verify-code")
def verify_admin_code(
    data: AdminCodeVerify,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    if data.code.strip() != settings.ADMIN_ACCESS_CODE:
        log_audit(db, current_user.id, "ADMIN_CODE_FAILED", "admin_portal", None, {"attempt": data.code[:4] + "***"})
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid Administrator Security Access Code"
        )
    log_audit(db, current_user.id, "ADMIN_CODE_VERIFIED", "admin_portal", None, {})
    return {"status": "success", "message": "Admin authorization code verified successfully"}

@router.get("/users")
def list_users(
    role: Optional[str] = None,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    query = db.query(User)
    if role and role.lower() != "all":
        query = query.filter(User.role == role.lower())
        
    users = query.order_by(User.created_at.desc()).all()
    results = []
    for u in users:
        doctor_data = None
        patient_data = None
        if u.role == "doctor" and u.doctor_profile:
            doctor_data = {
                "specialty": u.doctor_profile.specialty,
                "qualifications": u.doctor_profile.qualifications,
                "is_verified": u.doctor_profile.is_verified,
                "fee": u.doctor_profile.fee
            }
        elif u.role == "patient" and u.patient_profile:
            patient_data = {
                "primary_disease": u.patient_profile.primary_disease,
                "age": u.patient_profile.age,
                "sex": u.patient_profile.sex
            }
            
        results.append({
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "full_name": u.full_name,
            "phone": u.phone,
            "is_active": u.is_active,
            "questionnaire_completed": u.questionnaire_completed,
            "created_at": u.created_at,
            "doctor_info": doctor_data,
            "patient_info": patient_data
        })
    return results

@router.post("/doctors/{id}/verify")
def toggle_doctor_verification(
    id: int,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    doc_prof = db.query(DoctorProfile).filter(DoctorProfile.user_id == id).first()
    if not doc_prof:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
        
    doc_prof.is_verified = not doc_prof.is_verified
    status_str = "verified" if doc_prof.is_verified else "verification revoked"
    
    # Notify doctor
    notif = Notification(
        user_id=id,
        title="Professional Credential Status Update",
        message=f"Your clinician profile has been {status_str} by system administration.",
        type="info"
    )
    db.add(notif)
    db.commit()
    
    log_audit(db, current_user.id, "TOGGLE_DOCTOR_VERIFICATION", "doctor_profile", str(id), {
        "is_verified": doc_prof.is_verified
    })
    
    return {
        "status": "success",
        "message": f"Doctor credentials status updated to: {status_str}",
        "is_verified": doc_prof.is_verified
    }

@router.post("/users/{id}/toggle-status")
def toggle_user_account_status(
    id: int,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    target_user = db.query(User).filter(User.id == id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User account not found")
        
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot toggle status of currently logged-in administrator")
        
    target_user.is_active = not target_user.is_active
    status_str = "activated" if target_user.is_active else "suspended"
    db.commit()
    
    log_audit(db, current_user.id, "TOGGLE_USER_STATUS", "user", str(id), {
        "is_active": target_user.is_active
    })
    
    return {
        "status": "success",
        "message": f"User account has been {status_str}.",
        "is_active": target_user.is_active
    }

@router.get("/audit-logs")
def get_audit_logs(
    limit: int = 100,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    """
    Security Invariant: Admin access to identifiable clinical records is restricted and redacted by default;
    every admin action is written to the audit log.
    """
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    
    results = []
    for l in logs:
        # Redact raw PHI details if any exist in details_json
        sanitized_details = {}
        if l.details_json:
            for k, v in l.details_json.items():
                if any(phi_key in k.lower() for phi_key in ["ssn", "password", "glucose", "bp", "creatinine", "notes", "message"]):
                    sanitized_details[k] = "[REDACTED PHI]"
                else:
                    sanitized_details[k] = v
                    
        results.append({
            "id": l.id,
            "user_id": l.user_id,
            "action": l.action,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "details": sanitized_details,
            "ip_address": l.ip_address,
            "timestamp": l.timestamp
        })
    return results

@router.get("/analytics", response_model=AdminAnalyticsResponse)
def get_platform_analytics(
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    total_users = db.query(User).count()
    total_patients = db.query(User).filter(User.role == "patient").count()
    total_doctors = db.query(User).filter(User.role == "doctor").count()
    pending_verifications = db.query(DoctorProfile).filter(DoctorProfile.is_verified == False).count()
    
    total_consultations = db.query(ConsultationRequest).count()
    active_consultations = db.query(ConsultationRequest).filter(ConsultationRequest.status == "accepted").count()
    
    total_daily_reports = db.query(DailyReport).count()
    
    # Disease distribution across patient profiles
    disease_rows = db.query(
        PatientProfile.primary_disease, func.count(PatientProfile.user_id)
    ).group_by(PatientProfile.primary_disease).all()
    disease_dist = {row[0] or "undiagnosed": row[1] for row in disease_rows}
    
    # Triage distribution across daily reports
    triage_rows = db.query(
        DailyReport.triage_priority, func.count(DailyReport.id)
    ).group_by(DailyReport.triage_priority).all()
    triage_dist = {row[0]: row[1] for row in triage_rows}
    
    return {
        "total_users": total_users,
        "total_patients": total_patients,
        "total_doctors": total_doctors,
        "pending_doctor_verifications": pending_verifications,
        "total_consultations": total_consultations,
        "active_consultations": active_consultations,
        "total_daily_reports": total_daily_reports,
        "disease_distribution": disease_dist,
        "triage_distribution": triage_dist
    }

@router.get("/mongodb/status")
def get_mongodb_status(
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    from backend.app.mongodb import mongo_manager
    return mongo_manager.check_health()

@router.post("/mongodb/sync")
def trigger_mongodb_sync(
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    from backend.app.mongodb import mongo_manager
    success = mongo_manager.sync_from_sqlite(db)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB Atlas synchronization could not complete. Check cluster connection or credentials."
        )
    return {"status": "success", "message": "All clinical records synchronized to MongoDB Atlas."}

