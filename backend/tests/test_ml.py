import pytest
from backend.app.ml_engine import (
    evaluate_diabetes_risk, evaluate_heart_disease_risk, evaluate_ckd_risk,
    MANDATORY_AI_DISCLAIMER
)

def test_diabetes_risk_model_bounds_and_disclaimer():
    # Full biomarkers provided
    features_full = {
        "age": 52,
        "height_cm": 175,
        "weight_kg": 85,
        "blood_glucose": 190,
        "hba1c": 8.2,
        "family_history": "Mother had diabetes",
        "has_hypertension": True
    }
    res = evaluate_diabetes_risk(features_full)
    assert 0.0 <= res["risk_score"] <= 100.0
    assert res["model_version"] == "v2.3-ADA-FINDRISC-ML"
    assert res["confidence_score"] == 100.0
    assert MANDATORY_AI_DISCLAIMER in res["clinical_caveats"]
    assert "NOT a confirmed medical diagnosis" in res["clinical_caveats"]

def test_missing_biomarkers_confidence_penalty():
    # Missing glucose and HbA1c
    features_incomplete = {
        "age": 52,
        "height_cm": 175,
        "weight_kg": 85
    }
    res = evaluate_diabetes_risk(features_incomplete)
    assert res["confidence_score"] < 100.0
    assert "Blood Glucose (Fasting or Post-Meal)" in res["missing_features"]
    assert "HbA1c Lab Measurement" in res["missing_features"]

def test_heart_disease_risk_model():
    features = {
        "age": 60,
        "sex": "Male",
        "systolic_bp": 155,
        "diastolic_bp": 95,
        "resting_hr": 82,
        "total_cholesterol": 230,
        "hdl_cholesterol": 40,
        "smoking_status": "Current"
    }
    res = evaluate_heart_disease_risk(features)
    assert 0.0 <= res["risk_score"] <= 100.0
    assert res["risk_category"] in ["moderate", "high", "critical"]
    assert res["model_version"] == "v2.5-ACC-ASCVD-Framingham"
    assert MANDATORY_AI_DISCLAIMER in res["clinical_caveats"]

def test_ckd_risk_model():
    features = {
        "age": 65,
        "sex": "Male",
        "egfr": 32.0,
        "serum_creatinine": 2.2,
        "uacr_protein": "2+",
        "systolic_bp": 150
    }
    res = evaluate_ckd_risk(features)
    assert 0.0 <= res["risk_score"] <= 100.0
    assert res["model_version"] == "v2.0-KDIGO-KFRE"
    assert len(res["recommendations"]) > 0
    assert MANDATORY_AI_DISCLAIMER in res["clinical_caveats"]
