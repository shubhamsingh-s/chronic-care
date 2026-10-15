from typing import Dict, Any, List, Tuple, Optional
from backend.app.config import settings

def evaluate_triage(
    disease_module: str,
    measurements: Dict[str, Any],
    symptoms: List[str],
    symptom_severity: str,
    usual_condition_comparison: str,
    medication_taken: str,
    baseline_creatinine: Optional[float] = None
) -> Tuple[str, List[str]]:
    """
    Clinician-approved deterministic multi-factor triage engine.
    Returns: (priority_tier, list_of_explainable_reasons)
    Priority tiers: 'emergency', 'urgent', 'high', 'routine', 'awaiting_review'
    
    Safety Invariant: Medication non-adherence alone NEVER classifies a report as emergency.
    """
    emergency_reasons = []
    urgent_reasons = []
    high_reasons = []
    
    symptoms_lower = [str(s).lower() for s in symptoms]
    
    # ---------------- 1. GENERAL CLINICAL RULES ----------------
    if symptom_severity.capitalize() == "Critical":
        emergency_reasons.append("Patient self-reported Critical symptom severity requiring immediate clinical escalation")
    elif symptom_severity.capitalize() == "Severe":
        urgent_reasons.append("Patient self-reported Severe symptom severity")
        
    if usual_condition_comparison.capitalize() == "Much worse":
        urgent_reasons.append("Patient condition self-rated as 'Much worse' than usual baseline")
    elif usual_condition_comparison.capitalize() == "Worse":
        high_reasons.append("Patient condition self-rated as 'Worse' than usual baseline")
        
    if medication_taken.capitalize() == "No":
        high_reasons.append("Prescribed medication was missed during this reporting period (Medication Non-Adherence)")
    elif medication_taken.capitalize() == "Partially":
        high_reasons.append("Patient reported partial adherence to prescribed medication regimen")

    # Check for quantitative data presence
    has_biometric_data = False
    
    # ---------------- 2. HEART DISEASE / HYPERTENSION RULES ----------------
    if disease_module in ["heart_disease", "multiple"]:
        sys_bp = measurements.get("systolic_bp") or measurements.get("sys_bp")
        dia_bp = measurements.get("diastolic_bp") or measurements.get("dia_bp")
        hr = measurements.get("resting_hr") or measurements.get("heart_rate")
        
        if sys_bp is not None:
            has_biometric_data = True
            sys_val = float(sys_bp)
            if sys_val >= settings.BP_EMERGENCY_SYS:
                emergency_reasons.append(f"Hypertensive Crisis (Systolic BP {sys_val:.0f} mmHg >= {settings.BP_EMERGENCY_SYS:.0f} mmHg)")
            elif sys_val >= settings.BP_URGENT_SYS_MIN:
                urgent_reasons.append(f"Stage 2 Severe Hypertension (Systolic BP {sys_val:.0f} mmHg)")
            elif sys_val >= settings.BP_HIGH_SYS_MIN:
                high_reasons.append(f"Elevated Blood Pressure (Systolic BP {sys_val:.0f} mmHg)")
                
        if dia_bp is not None:
            has_biometric_data = True
            dia_val = float(dia_bp)
            if dia_val >= settings.BP_EMERGENCY_DIA:
                emergency_reasons.append(f"Hypertensive Crisis (Diastolic BP {dia_val:.0f} mmHg >= {settings.BP_EMERGENCY_DIA:.0f} mmHg)")
            elif dia_val >= settings.BP_URGENT_DIA_MIN:
                urgent_reasons.append(f"Stage 2 Severe Hypertension (Diastolic BP {dia_val:.0f} mmHg)")
            elif dia_val >= settings.BP_HIGH_DIA_MIN:
                high_reasons.append(f"Elevated Diastolic BP ({dia_val:.0f} mmHg)")
                
        if hr is not None:
            has_biometric_data = True
            hr_val = float(hr)
            if hr_val >= settings.HR_EMERGENCY_HIGH or hr_val <= settings.HR_EMERGENCY_LOW:
                emergency_reasons.append(f"Critical Arrhythmia / Heart Rate alert ({hr_val:.0f} bpm - emergency threshold <=40 or >=140)")
            elif (hr_val >= settings.HR_URGENT_HIGH_MIN and hr_val <= settings.HR_URGENT_HIGH_MAX) or \
                 (hr_val >= settings.HR_URGENT_LOW_MIN and hr_val <= settings.HR_URGENT_LOW_MAX):
                urgent_reasons.append(f"Abnormal Heart Rate detected ({hr_val:.0f} bpm)")
                
        # Heart disease red-flag symptoms
        cardiac_emergency_syms = ["chest pain", "chest pressure", "sudden breathlessness", "radiating pain to left arm", "syncope", "loss of consciousness"]
        for sym in cardiac_emergency_syms:
            if any(sym in s for s in symptoms_lower):
                emergency_reasons.append(f"Cardiac Red-Flag Symptom reported: '{sym.title()}'")
                
        cardiac_urgent_syms = ["shortness of breath", "palpitations", "dizziness", "severe leg swelling"]
        for sym in cardiac_urgent_syms:
            if any(sym in s for s in symptoms_lower):
                urgent_reasons.append(f"Urgent cardiac symptom reported: '{sym.title()}'")

    # ---------------- 3. DIABETES MELLITUS RULES ----------------
    if disease_module in ["diabetes", "multiple"]:
        glucose = measurements.get("blood_glucose") or measurements.get("glucose")
        
        if glucose is not None:
            has_biometric_data = True
            glu_val = float(glucose)
            if glu_val <= settings.GLUCOSE_EMERGENCY_LOW:
                emergency_reasons.append(f"Severe Level 2 Hypoglycemia alert ({glu_val:.0f} mg/dL <= {settings.GLUCOSE_EMERGENCY_LOW:.0f} mg/dL)")
            elif glu_val >= settings.GLUCOSE_EMERGENCY_HIGH:
                emergency_reasons.append(f"Critical Hyperglycemia / DKA or HHS risk ({glu_val:.0f} mg/dL >= {settings.GLUCOSE_EMERGENCY_HIGH:.0f} mg/dL)")
            elif glu_val <= settings.GLUCOSE_URGENT_LOW_MAX and glu_val >= settings.GLUCOSE_URGENT_LOW_MIN:
                urgent_reasons.append(f"Level 1 Hypoglycemia ({glu_val:.0f} mg/dL [55-69 mg/dL])")
            elif glu_val >= settings.GLUCOSE_URGENT_HIGH_MIN and glu_val <= settings.GLUCOSE_URGENT_HIGH_MAX:
                urgent_reasons.append(f"Severe Hyperglycemia ({glu_val:.0f} mg/dL [250-399 mg/dL])")
            elif glu_val >= settings.GLUCOSE_HIGH_MIN and glu_val <= settings.GLUCOSE_HIGH_MAX:
                high_reasons.append(f"Above Target Blood Glucose ({glu_val:.0f} mg/dL [180-249 mg/dL])")
                
        diabetes_emergency_syms = ["confusion", "fruity breath odor", "seizure", "unresponsiveness"]
        for sym in diabetes_emergency_syms:
            if any(sym in s for s in symptoms_lower):
                emergency_reasons.append(f"Diabetic Red-Flag Symptom: '{sym.title()}'")
                
        diabetes_urgent_syms = ["persistent vomiting", "extreme dehydration", "blurred vision"]
        for sym in diabetes_urgent_syms:
            if any(sym in s for s in symptoms_lower):
                urgent_reasons.append(f"Urgent diabetic symptom reported: '{sym.title()}'")

    # ---------------- 4. CHRONIC KIDNEY DISEASE (CKD) RULES ----------------
    if disease_module in ["ckd", "multiple"]:
        egfr = measurements.get("egfr")
        creatinine = measurements.get("serum_creatinine") or measurements.get("creatinine")
        sys_bp = measurements.get("systolic_bp") or measurements.get("sys_bp")
        
        if egfr is not None:
            has_biometric_data = True
            egfr_val = float(egfr)
            if egfr_val < settings.EGFR_EMERGENCY_LOW:
                emergency_reasons.append(f"Stage 5 Kidney Failure alert: eGFR {egfr_val:.1f} mL/min/1.73m² (<15)")
            elif egfr_val <= settings.EGFR_URGENT_LOW_MAX:
                urgent_reasons.append(f"Stage 4 Severe CKD: eGFR {egfr_val:.1f} mL/min/1.73m² (15-29)")
                
        if creatinine is not None:
            has_biometric_data = True
            cr_val = float(creatinine)
            if baseline_creatinine is not None and baseline_creatinine > 0:
                delta = cr_val - baseline_creatinine
                if delta >= settings.CREATININE_RISE_URGENT_THRESHOLD:
                    urgent_reasons.append(f"Acute Kidney Injury alert: Creatinine increased by +{delta:.2f} mg/dL over baseline (current {cr_val:.2f} vs baseline {baseline_creatinine:.2f})")
                    
        if sys_bp is not None and float(sys_bp) >= 160.0:
            urgent_reasons.append(f"Renal Hypertension Hazard: Systolic BP {float(sys_bp):.0f} mmHg (>=160 mmHg)")
            
        ckd_emergency_syms = ["anuria", "uremic confusion", "severe dyspnea", "complete absence of urine"]
        for sym in ckd_emergency_syms:
            if any(sym in s for s in symptoms_lower):
                emergency_reasons.append(f"Renal Red-Flag Symptom: '{sym.title()}'")
                
        ckd_urgent_syms = ["rapid fluid weight gain", "gross hematuria", "severe edema", "blood in urine"]
        for sym in ckd_urgent_syms:
            if any(sym in s for s in symptoms_lower):
                urgent_reasons.append(f"Urgent renal symptom reported: '{sym.title()}'")

    # ---------------- 5. FINAL TIER DETERMINATION ----------------
    if emergency_reasons:
        return "emergency", emergency_reasons
        
    if urgent_reasons:
        return "urgent", urgent_reasons
        
    if high_reasons:
        return "high", high_reasons
        
    # Check if there were any quantitative measurements
    if not has_biometric_data:
        return "awaiting_review", [
            "Insufficient biometric data provided for quantitative triage. Check-in recorded without acute symptom triggers."
        ]
        
    # If vitals within target ranges and medication adhered to
    return "routine", [
        "Vitals within established chronic care target boundaries",
        "Prescribed medication confirmed taken as directed",
        "No acute or escalating symptom triggers detected"
    ]
