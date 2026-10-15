import os
import shutil
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models import (
    User, DailyReport, PatientProfile, ConsultationRequest,
    MedicalDocument, Notification, AIAssessment
)
from backend.app.schemas import DailyReportCreate, DailyReportResponse, MedicalDocumentResponse
from backend.app.auth import get_current_user, require_role, log_audit
from backend.app.triage import evaluate_triage
from backend.app.ml_engine import run_ai_risk_assessment

router = APIRouter(prefix="/monitoring", tags=["Remote Patient Monitoring"])

@router.post("/daily-report", response_model=DailyReportResponse)
def submit_daily_report(
    report_in: DailyReportCreate,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db)
):
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    
    # Check baseline creatinine from profile or prior reports for CKD delta checking
    baseline_creatinine = None
    if profile and profile.raw_questionnaire_json:
        baseline_creatinine = profile.raw_questionnaire_json.get("serum_creatinine")
    if baseline_creatinine is None:
        prior_report = db.query(DailyReport).filter(
            DailyReport.patient_id == current_user.id
        ).order_by(DailyReport.created_at.asc()).first()
        if prior_report and prior_report.measurements_json:
            baseline_creatinine = prior_report.measurements_json.get("serum_creatinine")
            
    # Run deterministic triage
    priority, reasons = evaluate_triage(
        disease_module=report_in.disease_module,
        measurements=report_in.measurements,
        symptoms=report_in.symptoms,
        symptom_severity=report_in.symptom_severity,
        usual_condition_comparison=report_in.usual_condition_comparison,
        medication_taken=report_in.medication_taken,
        baseline_creatinine=float(baseline_creatinine) if baseline_creatinine else None
    )
    
    # Store daily report
    daily_rep = DailyReport(
        patient_id=current_user.id,
        disease_module=report_in.disease_module,
        medication_taken=report_in.medication_taken,
        medication_details=report_in.medication_details,
        reason_missed=report_in.reason_missed,
        measurements_json=report_in.measurements,
        symptoms_json=report_in.symptoms,
        symptom_severity=report_in.symptom_severity,
        usual_condition_comparison=report_in.usual_condition_comparison,
        patient_notes=report_in.patient_notes,
        triage_priority=priority,
        triage_reasons_json=reasons,
        doctor_reviewed=False,
        created_at=datetime.datetime.utcnow()
    )
    db.add(daily_rep)
    db.commit()
    db.refresh(daily_rep)
    
    # If emergency or urgent, dispatch immediate notification to accepted doctors
    if priority in ["emergency", "urgent"]:
        active_reqs = db.query(ConsultationRequest).filter(
            ConsultationRequest.patient_id == current_user.id,
            ConsultationRequest.status == "accepted"
        ).all()
        for r in active_reqs:
            urgency_text = "EMERGENCY ALERT" if priority == "emergency" else "URGENT CLINICAL ALERT"
            alert_notif = Notification(
                user_id=r.doctor_id,
                title=f"{urgency_text}: {current_user.full_name}",
                message=f"Patient {current_user.full_name} logged a {priority.upper()} check-in ({reasons[0] if reasons else 'Biometric anomaly'}).",
                type=priority
            )
            db.add(alert_notif)
            
    # Also recalculate latest AI risk snapshot with newly submitted measurements
    eval_inputs = {}
    if profile:
        eval_inputs.update({
            "age": profile.age,
            "sex": profile.sex,
            "height_cm": profile.height_cm,
            "weight_kg": profile.weight_kg,
            "smoking_status": profile.smoking_status,
            "family_history": profile.family_history
        })
    eval_inputs.update(report_in.measurements)
    eval_inputs["current_symptoms"] = report_in.symptoms
    
    ai_res = run_ai_risk_assessment(report_in.disease_module, eval_inputs)
    new_assessment = AIAssessment(
        patient_id=current_user.id,
        disease_module=ai_res["disease_module"],
        risk_score=ai_res["risk_score"],
        risk_category=ai_res["risk_category"],
        confidence_score=ai_res["confidence_score"],
        input_features_json=ai_res["input_features"],
        missing_features_json=ai_res["missing_features"],
        model_version=ai_res["model_version"],
        clinical_caveats=ai_res["clinical_caveats"],
        recommendations_json=ai_res["recommendations"],
        created_at=datetime.datetime.utcnow()
    )
    db.add(new_assessment)
    db.commit()
    
    log_audit(db, current_user.id, "SUBMIT_DAILY_REPORT", "daily_report", str(daily_rep.id), {
        "disease_module": report_in.disease_module,
        "triage_priority": priority,
        "reasons": reasons
    })
    
    return {
        "id": daily_rep.id,
        "patient_id": daily_rep.patient_id,
        "patient_name": current_user.full_name,
        "disease_module": daily_rep.disease_module,
        "medication_taken": daily_rep.medication_taken,
        "medication_details": daily_rep.medication_details,
        "reason_missed": daily_rep.reason_missed,
        "measurements": daily_rep.measurements_json,
        "symptoms": daily_rep.symptoms_json,
        "symptom_severity": daily_rep.symptom_severity,
        "usual_condition_comparison": daily_rep.usual_condition_comparison,
        "patient_notes": daily_rep.patient_notes,
        "triage_priority": daily_rep.triage_priority,
        "triage_reasons": daily_rep.triage_reasons_json,
        "doctor_reviewed": daily_rep.doctor_reviewed,
        "reviewed_at": daily_rep.reviewed_at,
        "doctor_feedback": daily_rep.doctor_feedback,
        "created_at": daily_rep.created_at
    }

@router.get("/my-reports", response_model=List[DailyReportResponse])
def get_my_reports(
    days: int = 30,
    disease: Optional[str] = None,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db)
):
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=days)
    query = db.query(DailyReport).filter(
        DailyReport.patient_id == current_user.id,
        DailyReport.created_at >= cutoff
    )
    if disease and disease.lower() != "all":
        query = query.filter(DailyReport.disease_module == disease.lower())
        
    reports = query.order_by(DailyReport.created_at.desc()).all()
    
    return [
        {
            "id": r.id,
            "patient_id": r.patient_id,
            "patient_name": current_user.full_name,
            "disease_module": r.disease_module,
            "medication_taken": r.medication_taken,
            "medication_details": r.medication_details,
            "reason_missed": r.reason_missed,
            "measurements": r.measurements_json,
            "symptoms": r.symptoms_json,
            "symptom_severity": r.symptom_severity,
            "usual_condition_comparison": r.usual_condition_comparison,
            "patient_notes": r.patient_notes,
            "triage_priority": r.triage_priority,
            "triage_reasons": r.triage_reasons_json,
            "doctor_reviewed": r.doctor_reviewed,
            "reviewed_at": r.reviewed_at,
            "doctor_feedback": r.doctor_feedback,
            "created_at": r.created_at
        }
        for r in reports
    ]

@router.post("/upload-document", response_model=MedicalDocumentResponse)
def upload_medical_document(
    title: str = Form(...),
    document_type: str = Form("lab_report"),
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db)
):
    if file.content_type not in settings.ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file.content_type}'. Supported types: PDF, PNG, JPG/JPEG"
        )
        
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    # Generate unique filename
    timestamp_prefix = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    clean_filename = f"{current_user.id}_{timestamp_prefix}_{file.filename.replace(' ', '_')}"
    file_path = os.path.join(settings.UPLOAD_DIR, clean_filename)
    
    file_size = 0
    with open(file_path, "wb") as buffer:
        content = file.file.read()
        file_size = len(content)
        if file_size > settings.MAX_FILE_SIZE_BYTES:
            try:
                os.remove(file_path)
            except Exception:
                pass
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_BYTES / (1024*1024)} MB"
            )
        buffer.write(content)
        
    doc = MedicalDocument(
        patient_id=current_user.id,
        title=title,
        document_type=document_type,
        file_name=file.filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type,
        uploaded_at=datetime.datetime.utcnow()
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    log_audit(db, current_user.id, "UPLOAD_DOCUMENT", "medical_document", str(doc.id), {
        "file_name": file.filename,
        "type": document_type,
        "size": file_size
    })
    
    return doc

@router.get("/my-documents", response_model=List[MedicalDocumentResponse])
def get_my_documents(
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db)
):
    return db.query(MedicalDocument).filter(
        MedicalDocument.patient_id == current_user.id
    ).order_by(MedicalDocument.uploaded_at.desc()).all()

@router.get("/document/{id}/download")
def download_document(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(MedicalDocument).filter(MedicalDocument.id == id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Medical document not found")
        
    # Permission check: must be patient owner or accepted doctor
    if current_user.role == "patient" and doc.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You cannot access other patients' medical documents")
        
    if current_user.role == "doctor":
        authorized = db.query(ConsultationRequest).filter(
            ConsultationRequest.doctor_id == current_user.id,
            ConsultationRequest.patient_id == doc.patient_id,
            ConsultationRequest.status == "accepted"
        ).first()
        if not authorized:
            raise HTTPException(status_code=403, detail="Forbidden: You are not authorized to view this patient's documents")
            
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="File content not found on server storage")
        
    return FileResponse(
        doc.file_path,
        media_type=doc.mime_type,
        filename=doc.file_name
    )
