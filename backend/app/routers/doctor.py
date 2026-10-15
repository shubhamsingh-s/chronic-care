import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import case
from typing import List, Optional

from backend.app.database import get_db
from backend.app.models import (
    User, PatientProfile, DoctorProfile, ConsultationRequest,
    DailyReport, AIAssessment, Appointment, Notification, MedicalDocument
)
from backend.app.schemas import (
    ConsultationRequestAction, DailyReportReview
)
from backend.app.auth import require_role, log_audit

router = APIRouter(prefix="/doctor", tags=["Doctor Clinical Workspace"])

@router.get("/overview")
def get_doctor_overview(
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db)
):
    # Pending requests
    pending_count = db.query(ConsultationRequest).filter(
        ConsultationRequest.doctor_id == current_user.id,
        ConsultationRequest.status == "pending"
    ).count()
    
    # Active accepted patient IDs
    accepted_reqs = db.query(ConsultationRequest).filter(
        ConsultationRequest.doctor_id == current_user.id,
        ConsultationRequest.status == "accepted"
    ).all()
    active_patient_ids = list(set(r.patient_id for r in accepted_reqs))
    
    # Priority alerts (emergency + urgent) across doctor's panel OR clinic
    if active_patient_ids:
        priority_alerts_count = db.query(DailyReport).filter(
            DailyReport.patient_id.in_(active_patient_ids),
            DailyReport.triage_priority.in_(["emergency", "urgent"]),
            DailyReport.doctor_reviewed == False
        ).count()
        
        unreviewed_reports_count = db.query(DailyReport).filter(
            DailyReport.patient_id.in_(active_patient_ids),
            DailyReport.doctor_reviewed == False
        ).count()
    else:
        # If doctor panel is new, show alerts across clinic so doctor has oversight
        priority_alerts_count = db.query(DailyReport).filter(
            DailyReport.triage_priority.in_(["emergency", "urgent"]),
            DailyReport.doctor_reviewed == False
        ).count()
        unreviewed_reports_count = db.query(DailyReport).filter(
            DailyReport.doctor_reviewed == False
        ).count()
        
    # Today's appointments
    today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + datetime.timedelta(days=1)
    today_appointments = db.query(Appointment).filter(
        Appointment.doctor_id == current_user.id,
        Appointment.scheduled_time >= today_start,
        Appointment.scheduled_time < today_end,
        Appointment.status == "scheduled"
    ).count()
    
    total_clinic_patients = db.query(User).filter(User.role == "patient").count()

    return {
        "pending_requests_count": pending_count,
        "active_patients_count": len(active_patient_ids),
        "total_clinic_patients": total_clinic_patients,
        "priority_alerts_count": priority_alerts_count,
        "unreviewed_reports_count": unreviewed_reports_count,
        "today_appointments_count": today_appointments
    }


@router.get("/pending-requests")
def get_pending_requests(
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db)
):
    """
    CRITICAL REQUIREMENT: Immediate Patient Name Visibility & Pre-Acceptance Privacy Gating.
    Doctor immediately sees patient full name, age, primary condition, intro message.
    Sensitive records (questionnaires, daily logs, uploaded docs) are strictly excluded.
    """
    requests = db.query(ConsultationRequest).filter(
        ConsultationRequest.doctor_id == current_user.id,
        ConsultationRequest.status == "pending"
    ).order_by(ConsultationRequest.created_at.desc()).all()
    
    results = []
    for req in requests:
        patient_user = db.query(User).filter(User.id == req.patient_id).first()
        patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == req.patient_id).first()
        
        results.append({
            "id": req.id,
            "patient_id": req.patient_id,
            "patient_name": patient_user.full_name if patient_user else "Unknown Patient",
            "patient_age": patient_profile.age if patient_profile else None,
            "patient_sex": patient_profile.sex if patient_profile else None,
            "primary_disease": req.primary_disease,
            "consultation_reason": req.consultation_reason,
            "introductory_message": req.introductory_message,
            "status": req.status,
            "created_at": req.created_at
        })
    return results

@router.post("/requests/{id}/action")
def handle_request_action(
    id: int,
    action_in: ConsultationRequestAction,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db)
):
    req = db.query(ConsultationRequest).filter(
        ConsultationRequest.id == id,
        ConsultationRequest.doctor_id == current_user.id
    ).first()
    
    if not req:
        raise HTTPException(status_code=404, detail="Consultation request not found")
        
    if req.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot act on request that is already {req.status}"
        )
        
    target_status = "accepted" if action_in.action == "accept" else "declined"
    req.status = target_status
    req.responded_at = datetime.datetime.utcnow()
    req.doctor_response_notes = action_in.doctor_response_notes
    
    # Notify patient immediately
    notif_title = "Consultation Request Accepted" if target_status == "accepted" else "Consultation Request Update"
    doc_prof = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    doc_name = doc_prof.full_name if doc_prof else "Your Doctor"
    
    notif_msg = (
        f"{doc_name} has accepted your consultation request. Full clinical monitoring and one-to-one consultation is now unlocked."
        if target_status == "accepted"
        else f"{doc_name} could not accept your request at this time. Notes: {action_in.doctor_response_notes or 'Schedule capacity full'}."
    )
    
    notif = Notification(
        user_id=req.patient_id,
        title=notif_title,
        message=notif_msg,
        type="consultation" if target_status == "accepted" else "info"
    )
    db.add(notif)
    db.commit()
    
    log_audit(db, current_user.id, f"REQUEST_{target_status.upper()}", "consultation_request", str(req.id), {
        "patient_id": req.patient_id,
        "action": action_in.action
    })
    
    return {
        "status": "success",
        "message": f"Consultation request {target_status} successfully.",
        "request_status": target_status
    }

@router.get("/active-patients")
def get_active_patients(
    scope: Optional[str] = "all", # "all" for full clinical registry, "panel" for assigned only
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db)
):
    accepted_reqs = db.query(ConsultationRequest).filter(
        ConsultationRequest.doctor_id == current_user.id,
        ConsultationRequest.status == "accepted"
    ).all()
    panel_patient_ids = set(r.patient_id for r in accepted_reqs)
    req_by_patient = {r.patient_id: r for r in accepted_reqs}

    if scope == "panel" and panel_patient_ids:
        patients_query = db.query(User).filter(User.id.in_(panel_patient_ids))
    else:
        # Show all clinical patients in registry so every patient is accessible
        patients_query = db.query(User).filter(User.role == "patient")

    all_patients = patients_query.order_by(User.created_at.desc()).all()
    
    results = []
    for patient_user in all_patients:
        patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == patient_user.id).first()
        req = req_by_patient.get(patient_user.id)
        
        # Latest daily report
        latest_rep = db.query(DailyReport).filter(
            DailyReport.patient_id == patient_user.id
        ).order_by(DailyReport.created_at.desc()).first()
        
        # Latest AI assessment
        latest_ai = db.query(AIAssessment).filter(
            AIAssessment.patient_id == patient_user.id
        ).order_by(AIAssessment.created_at.desc()).first()
        
        is_in_panel = patient_user.id in panel_patient_ids
        
        results.append({
            "patient_id": patient_user.id,
            "full_name": patient_user.full_name,
            "email": patient_user.email,
            "phone": patient_user.phone or "",
            "age": patient_profile.age if patient_profile else None,
            "sex": patient_profile.sex if patient_profile else None,
            "primary_disease": (patient_profile.primary_disease if patient_profile else "general") or "general",
            "is_in_my_panel": is_in_panel,
            "relationship_established": req.responded_at if req else (patient_user.created_at),
            "last_report_date": latest_rep.created_at if latest_rep else None,
            "current_triage": latest_rep.triage_priority if latest_rep else "awaiting_data",
            "triage_reasons": latest_rep.triage_reasons_json if latest_rep else [],
            "risk_score": latest_ai.risk_score if latest_ai else None,
            "risk_category": latest_ai.risk_category if latest_ai else None,
            "request_id": req.id if req else None
        })
    return results

@router.post("/patient/{patient_id}/connect")
def connect_patient_to_panel(
    patient_id: int,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db)
):
    patient = db.query(User).filter(User.id == patient_id, User.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    existing = db.query(ConsultationRequest).filter(
        ConsultationRequest.doctor_id == current_user.id,
        ConsultationRequest.patient_id == patient_id
    ).first()
    
    if existing:
        existing.status = "accepted"
        existing.responded_at = datetime.datetime.utcnow()
    else:
        disease = patient.patient_profile.primary_disease if patient.patient_profile else "general"
        req = ConsultationRequest(
            patient_id=patient_id,
            doctor_id=current_user.id,
            primary_disease=disease or "general",
            status="accepted",
            consultation_reason="Physician panel onboarding and remote surveillance oversight.",
            introductory_message=f"Dr. {current_user.full_name} has connected to your care team.",
            created_at=datetime.datetime.utcnow(),
            responded_at=datetime.datetime.utcnow()
        )
        db.add(req)
        
    db.commit()
    log_audit(db, current_user.id, "PATIENT_CONNECTED_TO_PANEL", "patient", str(patient_id), {})
    return {"status": "success", "message": f"{patient.full_name} is now connected to your active care panel."}

@router.get("/patient/{patient_id}/records")
def get_patient_records(
    patient_id: int,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db)
):
    authorized = db.query(ConsultationRequest).filter(
        ConsultationRequest.doctor_id == current_user.id,
        ConsultationRequest.patient_id == patient_id,
        ConsultationRequest.status == "accepted"
    ).first()
    
    if not authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Forbidden: Consultation request has not been accepted. Patient records are locked to protect clinical privacy."
        )

    patient_user = db.query(User).filter(User.id == patient_id).first()

    if not patient_user:
        raise HTTPException(status_code=404, detail="Patient account not found")
        
    patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == patient_id).first()
    
    # Reports history (longitudinal)
    reports = db.query(DailyReport).filter(
        DailyReport.patient_id == patient_id
    ).order_by(DailyReport.created_at.desc()).limit(30).all()
    
    # AI assessments
    ai_history = db.query(AIAssessment).filter(
        AIAssessment.patient_id == patient_id
    ).order_by(AIAssessment.created_at.desc()).all()
    
    # Documents
    documents = db.query(MedicalDocument).filter(
        MedicalDocument.patient_id == patient_id
    ).order_by(MedicalDocument.uploaded_at.desc()).all()
    
    log_audit(db, current_user.id, "VIEW_PATIENT_RECORDS", "patient_records", str(patient_id), {
        "authorized_by_request_id": authorized.id
    })
    
    return {
        "patient": {
            "id": patient_user.id,
            "full_name": patient_user.full_name,
            "email": patient_user.email,
            "phone": patient_user.phone
        },
        "profile": {
            "age": patient_profile.age if patient_profile else None,
            "sex": patient_profile.sex if patient_profile else None,
            "height_cm": patient_profile.height_cm if patient_profile else None,
            "weight_kg": patient_profile.weight_kg if patient_profile else None,
            "primary_disease": patient_profile.primary_disease if patient_profile else None,
            "diagnosis_year": patient_profile.diagnosis_year if patient_profile else None,
            "current_medications": patient_profile.current_medications if patient_profile else [],
            "allergies": patient_profile.allergies if patient_profile else None,
            "current_symptoms": patient_profile.current_symptoms if patient_profile else [],
            "family_history": patient_profile.family_history if patient_profile else None,
            "smoking_status": patient_profile.smoking_status if patient_profile else None,
            "raw_questionnaire": patient_profile.raw_questionnaire_json if patient_profile else {}
        },
        "reports": [
            {
                "id": r.id,
                "created_at": r.created_at,
                "disease_module": r.disease_module,
                "triage_priority": r.triage_priority,
                "triage_reasons": r.triage_reasons_json,
                "medication_taken": r.medication_taken,
                "medication_details": r.medication_details,
                "measurements": r.measurements_json,
                "symptoms": r.symptoms_json,
                "symptom_severity": r.symptom_severity,
                "usual_condition_comparison": r.usual_condition_comparison,
                "patient_notes": r.patient_notes,
                "doctor_reviewed": r.doctor_reviewed,
                "doctor_feedback": r.doctor_feedback,
                "reviewed_at": r.reviewed_at
            }
            for r in reports
        ],
        "ai_assessments": [
            {
                "id": a.id,
                "disease_module": a.disease_module,
                "risk_score": a.risk_score,
                "risk_category": a.risk_category,
                "confidence_score": a.confidence_score,
                "missing_features": a.missing_features_json,
                "model_version": a.model_version,
                "clinical_caveats": a.clinical_caveats,
                "recommendations": a.recommendations_json,
                "created_at": a.created_at
            }
            for a in ai_history
        ],
        "documents": [
            {
                "id": d.id,
                "title": d.title,
                "document_type": d.document_type,
                "file_name": d.file_name,
                "file_size": d.file_size,
                "mime_type": d.mime_type,
                "uploaded_at": d.uploaded_at
            }
            for d in documents
        ],
        "consultation_request_id": authorized.id
    }

@router.get("/priority-queue")
def get_priority_queue(
    tier: Optional[str] = None,
    disease: Optional[str] = None,
    unreviewed_only: bool = False,
    scope: Optional[str] = "all",
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db)
):
    accepted_reqs = db.query(ConsultationRequest).filter(
        ConsultationRequest.doctor_id == current_user.id,
        ConsultationRequest.status == "accepted"
    ).all()
    accepted_patient_ids = list(set(r.patient_id for r in accepted_reqs))
    
    if scope == "panel" and accepted_patient_ids:
        query = db.query(DailyReport).filter(DailyReport.patient_id.in_(accepted_patient_ids))
    else:
        # Show all triage reports across clinic registry so doctor has full oversight
        query = db.query(DailyReport)
    
    if tier and tier.lower() != "all":
        query = query.filter(DailyReport.triage_priority == tier.lower())
    if disease and disease.lower() != "all":
        query = query.filter(DailyReport.disease_module == disease.lower())
    if unreviewed_only:

        query = query.filter(DailyReport.doctor_reviewed == False)
        
    # Custom deterministic priority order
    priority_order = case(
        (DailyReport.triage_priority == "emergency", 1),
        (DailyReport.triage_priority == "urgent", 2),
        (DailyReport.triage_priority == "high", 3),
        (DailyReport.triage_priority == "routine", 4),
        (DailyReport.triage_priority == "awaiting_review", 5),
        else_=6
    )
    
    reports = query.order_by(priority_order, DailyReport.created_at.desc()).limit(100).all()
    
    results = []
    for rep in reports:
        pat_user = db.query(User).filter(User.id == rep.patient_id).first()
        results.append({
            "id": rep.id,
            "patient_id": rep.patient_id,
            "patient_name": pat_user.full_name if pat_user else "Patient",
            "disease_module": rep.disease_module,
            "triage_priority": rep.triage_priority,
            "triage_reasons": rep.triage_reasons_json,
            "medication_taken": rep.medication_taken,
            "medication_details": rep.medication_details,
            "measurements": rep.measurements_json,
            "symptoms": rep.symptoms_json,
            "symptom_severity": rep.symptom_severity,
            "usual_condition_comparison": rep.usual_condition_comparison,
            "patient_notes": rep.patient_notes,
            "doctor_reviewed": rep.doctor_reviewed,
            "doctor_feedback": rep.doctor_feedback,
            "reviewed_at": rep.reviewed_at,
            "created_at": rep.created_at
        })
    return results

@router.post("/reports/{id}/review")
def review_patient_report(
    id: int,
    review_in: DailyReportReview,
    current_user: User = Depends(require_role(["doctor"])),
    db: Session = Depends(get_db)
):
    rep = db.query(DailyReport).filter(DailyReport.id == id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Daily report not found")
        
    # Verify patient is authorized
    authorized = db.query(ConsultationRequest).filter(
        ConsultationRequest.doctor_id == current_user.id,
        ConsultationRequest.patient_id == rep.patient_id,
        ConsultationRequest.status == "accepted"
    ).first()
    
    if not authorized:
        raise HTTPException(status_code=403, detail="Forbidden: Patient is not in your authorized active patient registry")
        
    rep.doctor_reviewed = True
    rep.reviewed_by = current_user.id
    rep.reviewed_at = datetime.datetime.utcnow()
    rep.doctor_feedback = review_in.feedback
    
    doc_prof = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    doc_name = doc_prof.full_name if doc_prof else "Your Specialist"
    
    # Notify patient immediately
    notif = Notification(
        user_id=rep.patient_id,
        title="Doctor Feedback on Daily Report",
        message=f"{doc_name} reviewed your check-in: \"{review_in.feedback}\"",
        type="consultation"
    )
    db.add(notif)
    db.commit()
    
    log_audit(db, current_user.id, "REVIEW_DAILY_REPORT", "daily_report", str(rep.id), {
        "patient_id": rep.patient_id,
        "triage_priority": rep.triage_priority
    })
    
    return {
        "status": "success",
        "message": "Report marked as reviewed with clinical feedback saved.",
        "report_id": rep.id
    }
