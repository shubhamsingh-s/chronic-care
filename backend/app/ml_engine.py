import math
from typing import Dict, Any, List, Tuple

MANDATORY_AI_DISCLAIMER = (
    "This AI evaluation is a statistical risk estimation derived from reported clinical indicators. "
    "It is NOT a confirmed medical diagnosis and does not replace certified laboratory testing or evaluation by a licensed physician."
)

def evaluate_diabetes_risk(features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Diabetes Risk Assessment Model (v2.3-ADA-FINDRISC-ML)
    """
    model_version = "v2.3-ADA-FINDRISC-ML"
    missing_features = []
    confidence = 100.0
    
    # Feature extraction with validation
    age = features.get("age")
    height_cm = features.get("height_cm")
    weight_kg = features.get("weight_kg")
    glucose = features.get("blood_glucose") or features.get("glucose")
    hba1c = features.get("hba1c")
    family_history = features.get("family_history", "")
    has_hypertension = features.get("has_hypertension", False)
    symptoms = features.get("current_symptoms", []) or []
    
    # Core biomarker completeness checks
    if glucose is None:
        missing_features.append("Blood Glucose (Fasting or Post-Meal)")
        confidence -= 18.0
    if hba1c is None:
        missing_features.append("HbA1c Lab Measurement")
        confidence -= 22.0
    if not height_cm or not weight_kg:
        missing_features.append("BMI / Anthropometric Data (Height & Weight)")
        confidence -= 15.0
        
    confidence = max(40.0, min(100.0, confidence))
    
    # FINDRISC scoring logic calibrated to 0-100%
    score_points = 0.0
    
    # Age points
    if age is not None:
        if age < 45:
            score_points += 0
        elif 45 <= age <= 54:
            score_points += 2
        elif 55 <= age <= 64:
            score_points += 3
        else:
            score_points += 4
            
    # BMI calculation
    bmi = None
    if height_cm and weight_kg and height_cm > 0:
        bmi = weight_kg / ((height_cm / 100.0) ** 2)
        if bmi >= 30:
            score_points += 3
        elif bmi >= 25:
            score_points += 1
            
    # Blood Glucose impact
    if glucose is not None:
        if glucose >= 200:
            score_points += 8
        elif glucose >= 140:
            score_points += 5
        elif glucose >= 100:
            score_points += 3
            
    # HbA1c impact
    if hba1c is not None:
        if hba1c >= 8.5:
            score_points += 9
        elif hba1c >= 7.0:
            score_points += 6
        elif hba1c >= 5.7:
            score_points += 3
            
    # Family history
    if family_history and any(w in str(family_history).lower() for w in ["diabetes", "diabetic", "parent", "mother", "father"]):
        score_points += 3
        
    # Hypertension comorbidity
    if has_hypertension:
        score_points += 2
        
    # Symptoms
    if any(s in str(symptoms).lower() for s in ["polydipsia", "polyuria", "thirst", "frequent urination", "fatigue"]):
        score_points += 2
        
    # Map raw points (max approx 31) into calibrated probability 0-100%
    # Using calibrated logistic sigmoid
    z = (score_points - 10.0) / 4.2
    risk_score = round((1.0 / (1.0 + math.exp(-z))) * 100.0, 1)
    risk_score = max(5.0, min(96.5, risk_score))
    
    if risk_score >= 80.0:
        category = "critical"
    elif risk_score >= 55.0:
        category = "high"
    elif risk_score >= 30.0:
        category = "moderate"
    else:
        category = "low"
        
    recommendations = [
        "Maintain regular fasting blood glucose self-monitoring logs.",
        "Follow clinical glycemic target range of 70–180 mg/dL as recommended by the American Diabetes Association (ADA).",
        "Schedule quarterly HbA1c laboratory assessment with your managing endocrinologist.",
        "Emphasize a low-glycemic dietary pattern rich in dietary fiber and lean protein."
    ]
    if category in ["high", "critical"]:
        recommendations.insert(0, "URGENT: Review current glycemic regimen with your treating physician for potential therapy optimization.")

    return {
        "disease_module": "diabetes",
        "risk_score": risk_score,
        "risk_category": category,
        "confidence_score": round(confidence, 1),
        "input_features": {
            "age": age,
            "bmi": round(bmi, 1) if bmi else None,
            "blood_glucose": glucose,
            "hba1c": hba1c,
            "family_history": family_history,
            "has_hypertension": has_hypertension
        },
        "missing_features": missing_features,
        "model_version": model_version,
        "clinical_caveats": MANDATORY_AI_DISCLAIMER,
        "recommendations": recommendations
    }

def evaluate_heart_disease_risk(features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Heart Disease Risk Assessment Model (v2.5-ACC-ASCVD-Framingham)
    """
    model_version = "v2.5-ACC-ASCVD-Framingham"
    missing_features = []
    confidence = 100.0
    
    age = features.get("age")
    sex = str(features.get("sex", "Male")).capitalize()
    sys_bp = features.get("systolic_bp") or features.get("sys_bp")
    dia_bp = features.get("diastolic_bp") or features.get("dia_bp")
    resting_hr = features.get("resting_hr") or features.get("heart_rate")
    total_chol = features.get("total_cholesterol")
    hdl_chol = features.get("hdl_cholesterol")
    smoking_status = str(features.get("smoking_status", "Never")).capitalize()
    has_diabetes = features.get("has_diabetes", False)
    
    if sys_bp is None or dia_bp is None:
        missing_features.append("Blood Pressure (Systolic / Diastolic)")
        confidence -= 25.0
    if total_chol is None or hdl_chol is None:
        missing_features.append("Lipid Panel (Total Cholesterol & HDL)")
        confidence -= 20.0
    if resting_hr is None:
        missing_features.append("Resting Heart Rate (bpm)")
        confidence -= 10.0
        
    confidence = max(40.0, min(100.0, confidence))
    
    points = 0.0
    if age is not None:
        if age > 65:
            points += 5
        elif age > 50:
            points += 3
        elif age > 40:
            points += 1
            
    if sex == "Male":
        points += 1.5
        
    if sys_bp is not None:
        sys_val = float(sys_bp)
        if sys_val >= 180:
            points += 8
        elif sys_val >= 160:
            points += 5
        elif sys_val >= 140:
            points += 3
        elif sys_val >= 130:
            points += 1
            
    if total_chol is not None and hdl_chol is not None:
        ratio = float(total_chol) / max(1.0, float(hdl_chol))
        if ratio >= 5.5:
            points += 4
        elif ratio >= 4.0:
            points += 2
            
    if smoking_status == "Current":
        points += 4
    elif smoking_status == "Former":
        points += 1
        
    if has_diabetes:
        points += 3
        
    if resting_hr is not None and float(resting_hr) >= 100:
        points += 2
        
    z = (points - 8.5) / 3.8
    risk_score = round((1.0 / (1.0 + math.exp(-z))) * 100.0, 1)
    risk_score = max(4.0, min(97.0, risk_score))
    
    if risk_score >= 75.0:
        category = "critical"
    elif risk_score >= 50.0:
        category = "high"
    elif risk_score >= 25.0:
        category = "moderate"
    else:
        category = "low"
        
    recommendations = [
        "Maintain routine ambulatory blood pressure logs targeting <130/80 mmHg per ACC/AHA guidelines.",
        "Perform at least 150 minutes of moderate-intensity aerobic physical activity weekly.",
        "Adhere to a Mediterranean-style or DASH cardio-protective dietary plan.",
        "Coordinate with your cardiologist regarding optimal lipid-lowering and antihypertensive therapies."
    ]
    if category in ["high", "critical"]:
        recommendations.insert(0, "PRIORITY: Elevated cardiovascular risk profile detected. Schedule comprehensive cardiovascular review.")

    return {
        "disease_module": "heart_disease",
        "risk_score": risk_score,
        "risk_category": category,
        "confidence_score": round(confidence, 1),
        "input_features": {
            "age": age,
            "sex": sex,
            "systolic_bp": sys_bp,
            "diastolic_bp": dia_bp,
            "resting_hr": resting_hr,
            "total_cholesterol": total_chol,
            "hdl_cholesterol": hdl_chol,
            "smoking_status": smoking_status,
            "has_diabetes": has_diabetes
        },
        "missing_features": missing_features,
        "model_version": model_version,
        "clinical_caveats": MANDATORY_AI_DISCLAIMER,
        "recommendations": recommendations
    }

def evaluate_ckd_risk(features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Chronic Kidney Disease (CKD) Risk Model (v2.0-KDIGO-KFRE)
    """
    model_version = "v2.0-KDIGO-KFRE"
    missing_features = []
    confidence = 100.0
    
    age = features.get("age")
    sex = str(features.get("sex", "Male")).capitalize()
    egfr = features.get("egfr")
    creatinine = features.get("serum_creatinine") or features.get("creatinine")
    uacr_protein = features.get("uacr_protein")
    sys_bp = features.get("systolic_bp") or features.get("sys_bp")
    has_diabetes = features.get("has_diabetes", False)
    
    if egfr is None:
        missing_features.append("Estimated Glomerular Filtration Rate (eGFR)")
        confidence -= 25.0
    if creatinine is None:
        missing_features.append("Serum Creatinine (mg/dL)")
        confidence -= 20.0
    if uacr_protein is None:
        missing_features.append("Urine Albumin-to-Creatinine Ratio (uACR) / Proteinuria")
        confidence -= 15.0
        
    confidence = max(40.0, min(100.0, confidence))
    
    points = 0.0
    if egfr is not None:
        egfr_val = float(egfr)
        if egfr_val < 15:
            points += 10
        elif egfr_val < 30:
            points += 7
        elif egfr_val < 45:
            points += 4
        elif egfr_val < 60:
            points += 2
            
    if creatinine is not None:
        cr_val = float(creatinine)
        if cr_val >= 3.0:
            points += 6
        elif cr_val >= 2.0:
            points += 4
        elif cr_val >= 1.4:
            points += 2
            
    if uacr_protein and any(p in str(uacr_protein).lower() for p in ["2+", "3+", "severely increased", "macroalbuminuria"]):
        points += 4
    elif uacr_protein and any(p in str(uacr_protein).lower() for p in ["1+", "trace", "microalbuminuria"]):
        points += 2
        
    if sys_bp is not None and float(sys_bp) >= 140:
        points += 2
        
    if has_diabetes:
        points += 2
        
    z = (points - 7.0) / 3.2
    risk_score = round((1.0 / (1.0 + math.exp(-z))) * 100.0, 1)
    risk_score = max(5.0, min(98.0, risk_score))
    
    if risk_score >= 75.0:
        category = "critical"
    elif risk_score >= 50.0:
        category = "high"
    elif risk_score >= 25.0:
        category = "moderate"
    else:
        category = "low"
        
    recommendations = [
        "Strictly avoid over-the-counter NSAIDs (e.g. Ibuprofen, Naproxen) to avoid acute nephrotoxicity.",
        "Target blood pressure <130/80 mmHg using renal-protective ACE inhibitors or ARBs under nephrology supervision.",
        "Monitor fluid intake and track serum creatinine and eGFR longitudinally.",
        "Follow KDIGO guideline-directed low-sodium dietary restrictions."
    ]
    if category in ["high", "critical"]:
        recommendations.insert(0, "CRITICAL: Significant risk of renal function progression. Immediate nephrology consultation recommended.")

    return {
        "disease_module": "ckd",
        "risk_score": risk_score,
        "risk_category": category,
        "confidence_score": round(confidence, 1),
        "input_features": {
            "age": age,
            "sex": sex,
            "egfr": egfr,
            "serum_creatinine": creatinine,
            "uacr_protein": uacr_protein,
            "systolic_bp": sys_bp,
            "has_diabetes": has_diabetes
        },
        "missing_features": missing_features,
        "model_version": model_version,
        "clinical_caveats": MANDATORY_AI_DISCLAIMER,
        "recommendations": recommendations
    }

def run_ai_risk_assessment(disease_module: str, features: Dict[str, Any]) -> Dict[str, Any]:
    if disease_module == "diabetes":
        return evaluate_diabetes_risk(features)
    elif disease_module in ["heart_disease", "hypertension"]:
        return evaluate_heart_disease_risk(features)
    elif disease_module == "ckd":
        return evaluate_ckd_risk(features)
    else:
        # Default to heart disease or diabetes based on present features
        if "blood_glucose" in features or "hba1c" in features:
            return evaluate_diabetes_risk(features)
        elif "egfr" in features or "serum_creatinine" in features:
            return evaluate_ckd_risk(features)
        return evaluate_heart_disease_risk(features)
