import pytest
from backend.app.triage import evaluate_triage

def test_hypertensive_crisis_emergency():
    # Systolic >= 180 or Diastolic >= 120 triggers emergency
    priority, reasons = evaluate_triage(
        disease_module="heart_disease",
        measurements={"systolic_bp": 184, "diastolic_bp": 110, "resting_hr": 78},
        symptoms=[],
        symptom_severity="Moderate",
        usual_condition_comparison="Same",
        medication_taken="Yes"
    )
    assert priority == "emergency"
    assert any("Hypertensive Crisis" in r for r in reasons)

def test_severe_hypoglycemia_emergency():
    # Glucose <= 54 mg/dL triggers emergency
    priority, reasons = evaluate_triage(
        disease_module="diabetes",
        measurements={"blood_glucose": 48},
        symptoms=["Dizziness"],
        symptom_severity="Moderate",
        usual_condition_comparison="Same",
        medication_taken="Yes"
    )
    assert priority == "emergency"
    assert any("Severe Level 2 Hypoglycemia" in r for r in reasons)

def test_stage_5_ckd_emergency():
    # eGFR < 15 triggers emergency
    priority, reasons = evaluate_triage(
        disease_module="ckd",
        measurements={"egfr": 12.0, "serum_creatinine": 3.8},
        symptoms=[],
        symptom_severity="Mild",
        usual_condition_comparison="Same",
        medication_taken="Yes"
    )
    assert priority == "emergency"
    assert any("Stage 5 Kidney Failure" in r for r in reasons)

def test_red_flag_symptom_emergency():
    # Chest pain in heart disease triggers emergency even if BP is normal
    priority, reasons = evaluate_triage(
        disease_module="heart_disease",
        measurements={"systolic_bp": 120, "diastolic_bp": 80, "resting_hr": 70},
        symptoms=["Chest pain", "Radiating pain to left arm"],
        symptom_severity="Severe",
        usual_condition_comparison="Worse",
        medication_taken="Yes"
    )
    assert priority == "emergency"
    assert any("Cardiac Red-Flag Symptom" in r for r in reasons)

def test_medication_non_adherence_safety_invariant():
    """
    CRITICAL SAFETY INVARIANT:
    Medication non-adherence alone must NEVER classify a patient as emergency.
    It should trigger 'high' priority review.
    """
    priority, reasons = evaluate_triage(
        disease_module="heart_disease",
        measurements={"systolic_bp": 125, "diastolic_bp": 82, "resting_hr": 72},
        symptoms=[],
        symptom_severity="None",
        usual_condition_comparison="Same",
        medication_taken="No"
    )
    assert priority == "high"
    assert priority != "emergency"
    assert any("Medication Non-Adherence" in r for r in reasons)

def test_routine_triage():
    # Completely normal metrics and medication taken -> routine
    priority, reasons = evaluate_triage(
        disease_module="heart_disease",
        measurements={"systolic_bp": 118, "diastolic_bp": 78, "resting_hr": 68},
        symptoms=[],
        symptom_severity="None",
        usual_condition_comparison="Same",
        medication_taken="Yes"
    )
    assert priority == "routine"
