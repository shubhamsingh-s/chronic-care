import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.database import get_db
from backend.app.models import (
    User, PatientProfile, DoctorProfile, ConsultationRequest,
    DailyReport, AIAssessment, Appointment, Notification
)
from backend.app.schemas import (
    PatientQuestionnaireSubmission, DoctorProfileResponse,
    ConsultationRequestCreate
)
from backend.app.auth import get_current_user, require_role, log_audit
from backend.app.ml_engine import run_ai_risk_assessment

router = APIRouter(prefix="/patient", tags=["Patient Portal"])

@router.post("/questionnaire")
def submit_questionnaire(
    data: PatientQuestionnaireSubmission,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db)
):
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    if not profile:
        profile = PatientProfile(user_id=current_user.id)
        db.add(profile)
        
    profile.age = data.age
    profile.sex = data.sex
    profile.height_cm = data.height_cm
    profile.weight_kg = data.weight_kg
    profile.primary_disease = data.primary_disease
    profile.diagnosis_year = data.diagnosis_year
    profile.current_medications = data.current_medications
    profile.allergies = data.allergies
    profile.current_symptoms = data.current_symptoms
    profile.family_history = data.family_history
    profile.smoking_status = data.smoking_status
    profile.preferred_specialty = data.preferred_specialty
    profile.emergency_contact = data.emergency_contact
    profile.consent_signed_at = datetime.datetime.utcnow()
    profile.questionnaire_version = data.questionnaire_version
    profile.raw_questionnaire_json = data.model_dump()
    profile.updated_at = datetime.datetime.utcnow()
    
    current_user.questionnaire_completed = True
    db.commit()
    
    # Run initial baseline AI risk assessment
    eval_features = {
        "age": data.age,
        "sex": data.sex,
        "height_cm": data.height_cm,
        "weight_kg": data.weight_kg,
        "blood_glucose": data.blood_glucose,
        "hba1c": data.hba1c,
        "systolic_bp": data.systolic_bp,
        "diastolic_bp": data.diastolic_bp,
        "resting_hr": data.resting_hr,
        "total_cholesterol": data.total_cholesterol,
        "hdl_cholesterol": data.hdl_cholesterol,
        "smoking_status": data.smoking_status,
        "egfr": data.egfr,
        "serum_creatinine": data.serum_creatinine,
        "uacr_protein": data.uacr_protein,
        "current_symptoms": data.current_symptoms,
        "family_history": data.family_history
    }
    
    target_module = data.primary_disease if data.primary_disease in ["diabetes", "heart_disease", "ckd"] else "heart_disease"
    ai_result = run_ai_risk_assessment(target_module, eval_features)
    
    assessment_record = AIAssessment(
        patient_id=current_user.id,
        disease_module=ai_result["disease_module"],
        risk_score=ai_result["risk_score"],
        risk_category=ai_result["risk_category"],
        confidence_score=ai_result["confidence_score"],
        input_features_json=ai_result["input_features"],
        missing_features_json=ai_result["missing_features"],
        model_version=ai_result["model_version"],
        clinical_caveats=ai_result["clinical_caveats"],
        recommendations_json=ai_result["recommendations"],
        created_at=datetime.datetime.utcnow()
    )
    db.add(assessment_record)
    
    # Welcome notification
    welcome_notif = Notification(
        user_id=current_user.id,
        title="Clinical Profile Completed",
        message="Your mandatory health questionnaire has been verified. Baseline AI risk stratification is now available.",
        type="info"
    )
    db.add(welcome_notif)
    db.commit()
    
    log_audit(db, current_user.id, "SUBMIT_QUESTIONNAIRE", "patient_profile", str(current_user.id), {
        "primary_disease": data.primary_disease,
        "risk_category": ai_result["risk_category"]
    })
    
    return {
        "status": "success",
        "message": "Questionnaire completed and verified. Patient dashboard unlocked.",
        "dashboard_unlocked": True,
        "baseline_ai_assessment": ai_result
    }

@router.get("/dashboard")
def get_patient_dashboard(
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db)
):
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    
    # Active doctor relationship (status == 'accepted')
    active_req = db.query(ConsultationRequest).filter(
        ConsultationRequest.patient_id == current_user.id,
        ConsultationRequest.status == "accepted"
    ).order_by(ConsultationRequest.responded_at.desc()).first()
    
    assigned_doctor = None
    if active_req:
        doc_user = db.query(User).filter(User.id == active_req.doctor_id).first()
        doc_prof = db.query(DoctorProfile).filter(DoctorProfile.user_id == active_req.doctor_id).first()
        if doc_user and doc_prof:
            assigned_doctor = {
                "doctor_id": doc_user.id,
                "name": doc_prof.full_name,
                "specialty": doc_prof.specialty,
                "qualifications": doc_prof.qualifications,
                "request_id": active_req.id,
                "accepted_at": active_req.responded_at
            }
            
    # Pending requests
    pending_req = db.query(ConsultationRequest).filter(
        ConsultationRequest.patient_id == current_user.id,
        ConsultationRequest.status == "pending"
    ).order_by(ConsultationRequest.created_at.desc()).first()
    
    pending_request_info = None
    if pending_req:
        doc_user = db.query(User).filter(User.id == pending_req.doctor_id).first()
        doc_prof = db.query(DoctorProfile).filter(DoctorProfile.user_id == pending_req.doctor_id).first()
        pending_request_info = {
            "request_id": pending_req.id,
            "doctor_name": doc_prof.full_name if doc_prof else "Specialist",
            "specialty": doc_prof.specialty if doc_prof else "General",
            "submitted_at": pending_req.created_at,
            "status": "pending",
            "notice": "Awaiting doctor acceptance. Full clinical records remain private until approved."
        }
        
    # Latest daily check-in
    latest_report = db.query(DailyReport).filter(
        DailyReport.patient_id == current_user.id
    ).order_by(DailyReport.created_at.desc()).first()
    
    latest_report_data = None
    if latest_report:
        latest_report_data = {
            "id": latest_report.id,
            "created_at": latest_report.created_at,
            "disease_module": latest_report.disease_module,
            "triage_priority": latest_report.triage_priority,
            "triage_reasons": latest_report.triage_reasons_json,
            "symptom_severity": latest_report.symptom_severity,
            "medication_taken": latest_report.medication_taken,
            "measurements": latest_report.measurements_json,
            "doctor_reviewed": latest_report.doctor_reviewed,
            "doctor_feedback": latest_report.doctor_feedback
        }
        
    # Latest AI Assessment
    latest_ai = db.query(AIAssessment).filter(
        AIAssessment.patient_id == current_user.id
    ).order_by(AIAssessment.created_at.desc()).first()
    
    latest_ai_data = None
    if latest_ai:
        latest_ai_data = {
            "id": latest_ai.id,
            "disease_module": latest_ai.disease_module,
            "risk_score": latest_ai.risk_score,
            "risk_category": latest_ai.risk_category,
            "confidence_score": latest_ai.confidence_score,
            "missing_features": latest_ai.missing_features_json,
            "model_version": latest_ai.model_version,
            "recommendations": latest_ai.recommendations_json,
            "created_at": latest_ai.created_at
        }
        
    # Next scheduled appointment
    next_apt = db.query(Appointment).filter(
        Appointment.patient_id == current_user.id,
        Appointment.status == "scheduled",
        Appointment.scheduled_time >= datetime.datetime.utcnow()
    ).order_by(Appointment.scheduled_time.asc()).first()
    
    next_apt_data = None
    if next_apt:
        doc = db.query(DoctorProfile).filter(DoctorProfile.user_id == next_apt.doctor_id).first()
        next_apt_data = {
            "id": next_apt.id,
            "doctor_name": doc.full_name if doc else "Doctor",
            "scheduled_time": next_apt.scheduled_time,
            "mode": next_apt.mode,
            "duration_minutes": next_apt.duration_minutes
        }
        
    # Unread notifications count
    unread_notifs = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()
    
    return {
        "questionnaire_completed": current_user.questionnaire_completed,
        "primary_disease": profile.primary_disease if profile else "none",
        "assigned_doctor": assigned_doctor,
        "pending_request": pending_request_info,
        "latest_daily_report": latest_report_data,
        "latest_ai_assessment": latest_ai_data,
        "next_appointment": next_apt_data,
        "unread_notifications_count": unread_notifs
    }

@router.get("/doctors", response_model=List[DoctorProfileResponse])
def get_doctors_directory(
    specialty: Optional[str] = None,
    language: Optional[str] = None,
    mode: Optional[str] = None,
    max_fee: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(DoctorProfile)
    # Guarantee doctors are available even on freshly initialized cloud containers
    if query.count() == 0:
        try:
            from backend.seed_data import seed_clinical_database
            seed_clinical_database()
            query = db.query(DoctorProfile)
        except Exception:
            pass

    if specialty and specialty.lower() != "all":
        query = query.filter(DoctorProfile.specialty.ilike(f"%{specialty}%"))
    if language:
        query = query.filter(DoctorProfile.languages.ilike(f"%{language}%"))
    if mode and mode.lower() != "all":
        query = query.filter(DoctorProfile.consultation_mode.ilike(f"%{mode}%"))
    if max_fee is not None:
        query = query.filter(DoctorProfile.fee <= max_fee)
        
    # Show verified doctors first
    return query.order_by(DoctorProfile.is_verified.desc(), DoctorProfile.experience_years.desc()).all()


@router.post("/requests")
def create_consultation_request(
    req_in: ConsultationRequestCreate,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db)
):
    # Verify doctor exists
    doctor = db.query(User).filter(User.id == req_in.doctor_id, User.role == "doctor").first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Selected doctor was not found")
        
    # Prevent duplicate concurrent active requests (pending or accepted)
    existing_active = db.query(ConsultationRequest).filter(
        ConsultationRequest.patient_id == current_user.id,
        ConsultationRequest.doctor_id == req_in.doctor_id,
        ConsultationRequest.status.in_(["pending", "accepted"])
    ).first()
    
    if existing_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You already have an active or pending consultation request with this doctor (Status: {existing_active.status})."
        )
        
    # Create request
    new_request = ConsultationRequest(
        patient_id=current_user.id,
        doctor_id=req_in.doctor_id,
        primary_disease=req_in.primary_disease,
        consultation_reason=req_in.consultation_reason,
        introductory_message=req_in.introductory_message,
        status="pending",
        created_at=datetime.datetime.utcnow()
    )
    db.add(new_request)
    
    # Notify doctor immediately
    doc_notif = Notification(
        user_id=doctor.id,
        title="New Consultation Request Received",
        message=f"Patient {current_user.full_name} submitted a new consultation request for {req_in.primary_disease.replace('_', ' ').title()}.",
        type="request"
    )
    db.add(doc_notif)
    db.commit()
    db.refresh(new_request)
    
    log_audit(db, current_user.id, "CREATE_CONSULTATION_REQUEST", "consultation_request", str(new_request.id), {
        "doctor_id": req_in.doctor_id,
        "disease": req_in.primary_disease
    })
    
    return {
        "status": "success",
        "message": "Consultation request sent to specialist. Visible immediately in doctor's pending queue.",
        "request_id": new_request.id
    }

@router.get("/requests")
def get_patient_requests(
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db)
):
    requests = db.query(ConsultationRequest).filter(
        ConsultationRequest.patient_id == current_user.id
    ).order_by(ConsultationRequest.created_at.desc()).all()
    
    result = []
    for r in requests:
        doc = db.query(DoctorProfile).filter(DoctorProfile.user_id == r.doctor_id).first()
        result.append({
            "id": r.id,
            "doctor_id": r.doctor_id,
            "doctor_name": doc.full_name if doc else "Specialist",
            "specialty": doc.specialty if doc else "Specialist",
            "primary_disease": r.primary_disease,
            "consultation_reason": r.consultation_reason,
            "introductory_message": r.introductory_message,
            "status": r.status,
            "created_at": r.created_at,
            "responded_at": r.responded_at,
            "doctor_response_notes": r.doctor_response_notes
        })
    return result
