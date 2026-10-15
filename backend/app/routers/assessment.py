import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.app.database import get_db
from backend.app.models import User, AIAssessment, PatientProfile, DailyReport
from backend.app.schemas import AIEvaluationRequest, AIAssessmentResponse
from backend.app.auth import require_role, log_audit
from backend.app.ml_engine import run_ai_risk_assessment

router = APIRouter(prefix="/assessment", tags=["AI Risk Assessment"])

@router.post("/evaluate", response_model=AIAssessmentResponse)
def evaluate_risk_on_demand(
    eval_req: AIEvaluationRequest,
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db)
):
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    
    # Merge baseline profile data with latest daily report measurements and custom inputs
    features = {}
    if profile:
        features.update({
            "age": profile.age,
            "sex": profile.sex,
            "height_cm": profile.height_cm,
            "weight_kg": profile.weight_kg,
            "smoking_status": profile.smoking_status,
            "family_history": profile.family_history
        })
        if profile.raw_questionnaire_json:
            features.update(profile.raw_questionnaire_json)
            
    latest_rep = db.query(DailyReport).filter(
        DailyReport.patient_id == current_user.id
    ).order_by(DailyReport.created_at.desc()).first()
    
    if latest_rep:
        features.update(latest_rep.measurements_json)
        features["current_symptoms"] = latest_rep.symptoms_json
        
    if eval_req.custom_inputs:
        features.update(eval_req.custom_inputs)
        
    result = run_ai_risk_assessment(eval_req.disease_module, features)
    
    assessment_rec = AIAssessment(
        patient_id=current_user.id,
        disease_module=result["disease_module"],
        risk_score=result["risk_score"],
        risk_category=result["risk_category"],
        confidence_score=result["confidence_score"],
        input_features_json=result["input_features"],
        missing_features_json=result["missing_features"],
        model_version=result["model_version"],
        clinical_caveats=result["clinical_caveats"],
        recommendations_json=result["recommendations"],
        created_at=datetime.datetime.utcnow()
    )
    db.add(assessment_rec)
    db.commit()
    db.refresh(assessment_rec)
    
    log_audit(db, current_user.id, "AI_RISK_EVALUATION", "ai_assessment", str(assessment_rec.id), {
        "disease_module": eval_req.disease_module,
        "risk_score": result["risk_score"],
        "category": result["risk_category"]
    })
    
    return {
        "id": assessment_rec.id,
        "patient_id": assessment_rec.patient_id,
        "disease_module": assessment_rec.disease_module,
        "risk_score": assessment_rec.risk_score,
        "risk_category": assessment_rec.risk_category,
        "confidence_score": assessment_rec.confidence_score,
        "input_features": assessment_rec.input_features_json,
        "missing_features": assessment_rec.missing_features_json,
        "model_version": assessment_rec.model_version,
        "clinical_caveats": assessment_rec.clinical_caveats,
        "recommendations": assessment_rec.recommendations_json,
        "created_at": assessment_rec.created_at
    }

@router.get("/history", response_model=List[AIAssessmentResponse])
def get_assessment_history(
    current_user: User = Depends(require_role(["patient"])),
    db: Session = Depends(get_db)
):
    assessments = db.query(AIAssessment).filter(
        AIAssessment.patient_id == current_user.id
    ).order_by(AIAssessment.created_at.desc()).all()
    
    return [
        {
            "id": a.id,
            "patient_id": a.patient_id,
            "disease_module": a.disease_module,
            "risk_score": a.risk_score,
            "risk_category": a.risk_category,
            "confidence_score": a.confidence_score,
            "input_features": a.input_features_json,
            "missing_features": a.missing_features_json,
            "model_version": a.model_version,
            "clinical_caveats": a.clinical_caveats,
            "recommendations": a.recommendations_json,
            "created_at": a.created_at
        }
        for a in assessments
    ]
