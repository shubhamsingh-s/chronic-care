import datetime
import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from backend.app.database import SessionLocal, init_db
from backend.app.models import (
    User, PatientProfile, DoctorProfile, ConsultationRequest,
    DailyReport, AIAssessment, ConsultationMessage, Appointment,
    Notification, AuditLog
)
from backend.app.auth import hash_password
from backend.app.triage import evaluate_triage
from backend.app.ml_engine import run_ai_risk_assessment

def seed_clinical_database():
    init_db()
    db = SessionLocal()
    
    try:
        print("[SEED] Seeding ChronicCare AI clinical records...")
        
        # 1. ADMIN USER
        admin = db.query(User).filter(User.email == "admin@chroniccare.ai").first()
        if not admin:
            admin = User(
                email="admin@chroniccare.ai",
                password_hash=hash_password("Admin@12345"),
                role="admin",
                full_name="System Administrator",
                phone="+1 (555) 019-2831",
                is_active=True,
                questionnaire_completed=True
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            print("  [OK] Admin seeded: admin@chroniccare.ai")
            
        # 2. DOCTORS
        doctors_data = [
            {
                "email": "dr.jenkins@chroniccare.ai",
                "password": "Doctor@12345",
                "full_name": "Dr. Sarah Jenkins",
                "specialty": "Cardiology",
                "qualifications": "MD, FACC, Board-Certified Cardiologist",
                "experience_years": 16,
                "consultation_mode": "Hybrid",
                "availability_hours": "Mon-Thu: 8:00 AM - 4:00 PM EST",
                "fee": 120.0,
                "languages": "English, Spanish",
                "is_verified": True,
                "bio": "Fellow of the American College of Cardiology specializing in hypertension management, preventative cardiology, and remote cardiovascular monitoring.",
                "clinic_address": "Metropolitan Heart Institute, Suite 402, Boston, MA"
            },
            {
                "email": "dr.patel@chroniccare.ai",
                "password": "Doctor@12345",
                "full_name": "Dr. Robert Patel",
                "specialty": "Endocrinology",
                "qualifications": "MD, FACE, Adult & Pediatric Endocrinologist",
                "experience_years": 14,
                "consultation_mode": "Online",
                "availability_hours": "Tue-Fri: 9:00 AM - 5:00 PM EST",
                "fee": 110.0,
                "languages": "English, Hindi, Gujarati",
                "is_verified": True,
                "bio": "Specializing in Type 1 & Type 2 Diabetes optimization, advanced continuous glucose monitoring (CGM) analytics, and metabolic health.",
                "clinic_address": "Endocrine Care & Metabolic Center, New York, NY"
            },
            {
                "email": "dr.rostova@chroniccare.ai",
                "password": "Doctor@12345",
                "full_name": "Dr. Elena Rostova",
                "specialty": "Nephrology",
                "qualifications": "MD, FASN, Renal Care Specialist",
                "experience_years": 18,
                "consultation_mode": "Hybrid",
                "availability_hours": "Mon, Wed, Fri: 8:30 AM - 4:30 PM EST",
                "fee": 135.0,
                "languages": "English, Russian",
                "is_verified": True,
                "bio": "Renal physician dedicated to slowing chronic kidney disease progression, cardiorenal syndrome management, and hypertension control.",
                "clinic_address": "Advanced Kidney Health Pavilion, Chicago, IL"
            }
        ]
        
        doctor_objs = {}
        for d in doctors_data:
            doc_user = db.query(User).filter(User.email == d["email"]).first()
            if not doc_user:
                doc_user = User(
                    email=d["email"],
                    password_hash=hash_password(d["password"]),
                    role="doctor",
                    full_name=d["full_name"],
                    is_active=True,
                    questionnaire_completed=True
                )
                db.add(doc_user)
                db.commit()
                db.refresh(doc_user)
                
                doc_prof = DoctorProfile(
                    user_id=doc_user.id,
                    full_name=d["full_name"],
                    specialty=d["specialty"],
                    qualifications=d["qualifications"],
                    experience_years=d["experience_years"],
                    consultation_mode=d["consultation_mode"],
                    availability_hours=d["availability_hours"],
                    fee=d["fee"],
                    languages=d["languages"],
                    is_verified=d["is_verified"],
                    bio=d["bio"],
                    clinic_address=d["clinic_address"]
                )
                db.add(doc_prof)
                db.commit()
                print(f"  [OK] Doctor seeded: {d['email']} ({d['specialty']})")
            doctor_objs[d["email"]] = doc_user

        # 3. PATIENTS
        patients_data = [
            # Active patient: John Doe (Heart Disease) -> Dr. Jenkins
            {
                "email": "john.doe@patient.care",
                "password": "Patient@12345",
                "full_name": "John Doe",
                "phone": "+1 (555) 234-5678",
                "questionnaire_completed": True,
                "age": 58,
                "sex": "Male",
                "height_cm": 178.0,
                "weight_kg": 88.5,
                "primary_disease": "heart_disease",
                "diagnosis_year": "2019",
                "medications": [
                    {"name": "Lisinopril", "dosage": "20mg", "frequency": "Once daily morning"},
                    {"name": "Amlodipine", "dosage": "5mg", "frequency": "Once daily evening"},
                    {"name": "Atorvastatin", "dosage": "40mg", "frequency": "Once daily at bedtime"}
                ],
                "allergies": "Penicillin (rash)",
                "symptoms": ["Chest tightness on exertion", "Occasional morning dizziness"],
                "family_history": "Father suffered myocardial infarction at age 54; Mother has hypertension.",
                "smoking_status": "Former",
                "assigned_doctor_email": "dr.jenkins@chroniccare.ai",
                "request_status": "accepted"
            },
            # Active patient: Emily Watson (Diabetes) -> Dr. Patel
            {
                "email": "emily.watson@patient.care",
                "password": "Patient@12345",
                "full_name": "Emily Watson",
                "phone": "+1 (555) 345-6789",
                "questionnaire_completed": True,
                "age": 46,
                "sex": "Female",
                "height_cm": 164.0,
                "weight_kg": 76.0,
                "primary_disease": "diabetes",
                "diagnosis_year": "2021",
                "medications": [
                    {"name": "Metformin ER", "dosage": "1000mg", "frequency": "Twice daily with meals"},
                    {"name": "Empagliflozin", "dosage": "10mg", "frequency": "Once daily morning"}
                ],
                "allergies": "Sulfa drugs",
                "symptoms": ["Polydipsia (increased thirst)", "Mild blurred vision after meals"],
                "family_history": "Maternal grandmother and mother diagnosed with Type 2 Diabetes.",
                "smoking_status": "Never",
                "assigned_doctor_email": "dr.patel@chroniccare.ai",
                "request_status": "accepted"
            },
            # Active patient: David Miller (CKD) -> Dr. Rostova
            {
                "email": "david.miller@patient.care",
                "password": "Patient@12345",
                "full_name": "David Miller",
                "phone": "+1 (555) 456-7890",
                "questionnaire_completed": True,
                "age": 63,
                "sex": "Male",
                "height_cm": 172.0,
                "weight_kg": 81.0,
                "primary_disease": "ckd",
                "diagnosis_year": "2020",
                "medications": [
                    {"name": "Losartan", "dosage": "50mg", "frequency": "Once daily"},
                    {"name": "Sodium Bicarbonate", "dosage": "650mg", "frequency": "Twice daily"}
                ],
                "allergies": "No known allergies",
                "symptoms": ["Bilateral ankle edema", "Fatigue"],
                "family_history": "Father had polycystic kidney disease.",
                "smoking_status": "Never",
                "assigned_doctor_email": "dr.rostova@chroniccare.ai",
                "request_status": "accepted"
            },
            # Pending Request Demo: Alice Johnson -> Dr. Jenkins (Immediate Name Visibility test)
            {
                "email": "alice.johnson@patient.care",
                "password": "Patient@12345",
                "full_name": "Alice Johnson",
                "phone": "+1 (555) 567-8901",
                "questionnaire_completed": True,
                "age": 52,
                "sex": "Female",
                "height_cm": 160.0,
                "weight_kg": 69.0,
                "primary_disease": "heart_disease",
                "diagnosis_year": "2023",
                "medications": [
                    {"name": "Hydrochlorothiazide", "dosage": "25mg", "frequency": "Once daily"}
                ],
                "allergies": "No known allergies",
                "symptoms": ["Elevated home blood pressure readings (150/95)", "Mild palpitations"],
                "family_history": "Strong maternal history of stroke and essential hypertension.",
                "smoking_status": "Never",
                "assigned_doctor_email": "dr.jenkins@chroniccare.ai",
                "request_status": "pending",
                "consultation_reason": "Second opinion regarding uncontrolled Stage 1 hypertension and persistent palpitations.",
                "introductory_message": "Hello Dr. Jenkins, my primary care physician recommended I consult with a cardiologist due to persistent BP elevations over 150/95 mmHg despite diuretic therapy. I look forward to working with you."
            },
            # Pending Request Demo: Carlos Ramirez -> Dr. Patel
            {
                "email": "carlos.ramirez@patient.care",
                "password": "Patient@12345",
                "full_name": "Carlos Ramirez",
                "phone": "+1 (555) 678-9012",
                "questionnaire_completed": True,
                "age": 41,
                "sex": "Male",
                "height_cm": 175.0,
                "weight_kg": 92.0,
                "primary_disease": "diabetes",
                "diagnosis_year": "2024",
                "medications": [{"name": "Metformin", "dosage": "500mg", "frequency": "Once daily"}],
                "allergies": "Aspirin",
                "symptoms": ["Fasting blood sugar routinely >170 mg/dL", "Afternoon lethargy"],
                "family_history": "Both parents have Type 2 Diabetes.",
                "smoking_status": "Former",
                "assigned_doctor_email": "dr.patel@chroniccare.ai",
                "request_status": "pending",
                "consultation_reason": "Recently diagnosed with Type 2 Diabetes; seeking comprehensive insulin-sensitizing strategy and nutritional guidance.",
                "introductory_message": "Good day Dr. Patel, my recent HbA1c came back at 8.4%. I am seeking specialist management to bring it under tighter control without experiencing hypoglycemia episodes."
            },
            # Onboarding Wizard Demo: Michael Brown (Undiagnosed / Questionnaire Incomplete)
            {
                "email": "michael.brown@patient.care",
                "password": "Patient@12345",
                "full_name": "Michael Brown",
                "phone": "+1 (555) 789-0123",
                "questionnaire_completed": False,
                "age": 35,
                "sex": "Male",
                "primary_disease": "none",
                "assigned_doctor_email": None,
                "request_status": None
            }
        ]
        
        patient_objs = {}
        for p in patients_data:
            pat_user = db.query(User).filter(User.email == p["email"]).first()
            if not pat_user:
                pat_user = User(
                    email=p["email"],
                    password_hash=hash_password(p["password"]),
                    role="patient",
                    full_name=p["full_name"],
                    phone=p["phone"],
                    is_active=True,
                    questionnaire_completed=p["questionnaire_completed"]
                )
                db.add(pat_user)
                db.commit()
                db.refresh(pat_user)
                
                # Profile
                if p["questionnaire_completed"]:
                    pat_prof = PatientProfile(
                        user_id=pat_user.id,
                        age=p["age"],
                        sex=p["sex"],
                        height_cm=p.get("height_cm"),
                        weight_kg=p.get("weight_kg"),
                        primary_disease=p["primary_disease"],
                        diagnosis_year=p.get("diagnosis_year", "Not applicable"),
                        current_medications=p.get("medications", []),
                        allergies=p.get("allergies", "No known allergies"),
                        current_symptoms=p.get("symptoms", []),
                        family_history=p.get("family_history", ""),
                        smoking_status=p.get("smoking_status", "Never"),
                        consent_signed_at=datetime.datetime.utcnow() - datetime.timedelta(days=14),
                        questionnaire_version="v1.0",
                        raw_questionnaire_json={
                            "age": p["age"],
                            "sex": p["sex"],
                            "height_cm": p.get("height_cm"),
                            "weight_kg": p.get("weight_kg"),
                            "primary_disease": p["primary_disease"],
                            "smoking_status": p.get("smoking_status")
                        }
                    )
                else:
                    pat_prof = PatientProfile(
                        user_id=pat_user.id,
                        primary_disease="none",
                        raw_questionnaire_json={}
                    )
                db.add(pat_prof)
                db.commit()
                print(f"  ✓ Patient seeded: {p['email']} (Completed: {p['questionnaire_completed']})")
            patient_objs[p["email"]] = pat_user

        # 4. CONSULTATION REQUESTS
        for p in patients_data:
            if not p.get("assigned_doctor_email"):
                continue
            pat = patient_objs[p["email"]]
            doc = doctor_objs[p["assigned_doctor_email"]]
            
            existing_req = db.query(ConsultationRequest).filter(
                ConsultationRequest.patient_id == pat.id,
                ConsultationRequest.doctor_id == doc.id
            ).first()
            
            if not existing_req:
                req_status = p["request_status"]
                reason = p.get("consultation_reason", f"Longitudinal management and clinical oversight for {p['primary_disease'].replace('_', ' ').title()}.")
                intro = p.get("introductory_message", f"Hello Doctor, I am sharing my chronic health logs for regular remote surveillance.")
                
                created_delta = datetime.timedelta(days=10) if req_status == "accepted" else datetime.timedelta(hours=2)
                responded_at = datetime.datetime.utcnow() - datetime.timedelta(days=9) if req_status == "accepted" else None
                
                new_req = ConsultationRequest(
                    patient_id=pat.id,
                    doctor_id=doc.id,
                    primary_disease=p["primary_disease"],
                    consultation_reason=reason,
                    introductory_message=intro,
                    status=req_status,
                    created_at=datetime.datetime.utcnow() - created_delta,
                    responded_at=responded_at,
                    doctor_response_notes="Request accepted. Welcome to our remote cardiology/chronic care panel." if req_status == "accepted" else None
                )
                db.add(new_req)
                db.commit()
                db.refresh(new_req)
                print(f"  ✓ Request created: {p['full_name']} -> {doc.full_name} ({req_status})")
                
                # If accepted, seed messaging thread and appointment
                if req_status == "accepted":
                    msg1 = ConsultationMessage(
                        request_id=new_req.id,
                        sender_id=pat.id,
                        recipient_id=doc.id,
                        message_text="Hello Doctor, thank you for accepting my request. I will log my measurements daily.",
                        is_read=True,
                        created_at=datetime.datetime.utcnow() - datetime.timedelta(days=9)
                    )
                    msg2 = ConsultationMessage(
                        request_id=new_req.id,
                        sender_id=doc.id,
                        recipient_id=pat.id,
                        message_text="Welcome! Please remember to take your morning vitals before your coffee and log any symptoms immediately.",
                        is_read=True,
                        created_at=datetime.datetime.utcnow() - datetime.timedelta(days=8)
                    )
                    db.add_all([msg1, msg2])
                    
                    # Appointment
                    apt = Appointment(
                        patient_id=pat.id,
                        doctor_id=doc.id,
                        scheduled_time=datetime.datetime.utcnow() + datetime.timedelta(days=2, hours=3),
                        duration_minutes=30,
                        mode="video",
                        status="scheduled",
                        notes="Quarterly chronic condition tele-review and medication adjustment plan."
                    )
                    db.add(apt)
                    db.commit()

        # 5. LONGITUDINAL DAILY REPORTS FOR ACCEPTED PATIENTS
        
        # A. John Doe (Heart Disease) - 7-day trend culminating in Emergency BP Alert
        john = patient_objs["john.doe@patient.care"]
        if not db.query(DailyReport).filter(DailyReport.patient_id == john.id).first():
            heart_reports = [
                {"days_ago": 6, "sys": 134, "dia": 86, "hr": 72, "sym": ["Mild fatigue"], "sev": "Mild", "comp": "Same", "med": "Yes"},
                {"days_ago": 5, "sys": 138, "dia": 88, "hr": 74, "sym": [], "sev": "None", "comp": "Same", "med": "Yes"},
                {"days_ago": 4, "sys": 142, "dia": 92, "hr": 78, "sym": ["Morning headache"], "sev": "Mild", "comp": "Same", "med": "Yes"},
                {"days_ago": 3, "sys": 148, "dia": 94, "hr": 80, "sym": ["Occasional dizziness"], "sev": "Moderate", "comp": "Worse", "med": "Yes"},
                {"days_ago": 2, "sys": 158, "dia": 98, "hr": 84, "sym": ["Lightheadedness"], "sev": "Moderate", "comp": "Worse", "med": "Partially"},
                {"days_ago": 1, "sys": 164, "dia": 102, "hr": 88, "sym": ["Shortness of breath on walking"], "sev": "Severe", "comp": "Much worse", "med": "No"},
                # TODAY's checkin: Hypertensive Crisis (>=180 or chest pain) -> Emergency alert!
                {"days_ago": 0, "sys": 184, "dia": 116, "hr": 104, "sym": ["Chest pressure", "Shortness of breath"], "sev": "Critical", "comp": "Much worse", "med": "No"}
            ]
            for rep in heart_reports:
                measurements = {"systolic_bp": rep["sys"], "diastolic_bp": rep["dia"], "resting_hr": rep["hr"]}
                prio, reasons = evaluate_triage("heart_disease", measurements, rep["sym"], rep["sev"], rep["comp"], rep["med"])
                r_obj = DailyReport(
                    patient_id=john.id,
                    disease_module="heart_disease",
                    medication_taken=rep["med"],
                    medication_details="Lisinopril 20mg, Amlodipine 5mg",
                    reason_missed="Forgot dose during business travel" if rep["med"] == "No" else None,
                    measurements_json=measurements,
                    symptoms_json=rep["sym"],
                    symptom_severity=rep["sev"],
                    usual_condition_comparison=rep["comp"],
                    patient_notes="Feeling tight sensation across chest and pressure behind sternum today." if rep["days_ago"] == 0 else "Routine check-in.",
                    triage_priority=prio,
                    triage_reasons_json=reasons,
                    doctor_reviewed=(rep["days_ago"] > 2),
                    doctor_feedback="Blood pressure is trending upwards. Please continue logging closely." if rep["days_ago"] == 3 else None,
                    created_at=datetime.datetime.utcnow() - datetime.timedelta(days=rep["days_ago"], hours=2)
                )
                db.add(r_obj)
            db.commit()
            print("  ✓ John Doe 7-day cardiac reports seeded (with Emergency BP alert)")

        # B. Emily Watson (Diabetes) - 5-day glucose trend with urgent hyperglycemia
        emily = patient_objs["emily.watson@patient.care"]
        if not db.query(DailyReport).filter(DailyReport.patient_id == emily.id).first():
            diab_reports = [
                {"days_ago": 4, "glu": 142, "post": 168, "hba1c": 7.4, "sym": [], "sev": "None", "comp": "Same", "med": "Yes"},
                {"days_ago": 3, "glu": 156, "post": 190, "hba1c": 7.4, "sym": ["Mild dry mouth"], "sev": "Mild", "comp": "Same", "med": "Yes"},
                {"days_ago": 2, "glu": 178, "post": 215, "hba1c": 7.4, "sym": ["Increased thirst"], "sev": "Moderate", "comp": "Worse", "med": "Yes"},
                {"days_ago": 1, "glu": 210, "post": 248, "hba1c": 7.4, "sym": ["Frequent urination", "Blurred vision"], "sev": "Moderate", "comp": "Worse", "med": "Partially"},
                {"days_ago": 0, "glu": 265, "post": 310, "hba1c": 7.4, "sym": ["Persistent thirst", "Extreme fatigue", "Blurred vision"], "sev": "Severe", "comp": "Much worse", "med": "No"}
            ]
            for rep in diab_reports:
                measurements = {"blood_glucose": rep["glu"], "post_meal_glucose": rep["post"], "hba1c": rep["hba1c"]}
                prio, reasons = evaluate_triage("diabetes", measurements, rep["sym"], rep["sev"], rep["comp"], rep["med"])
                r_obj = DailyReport(
                    patient_id=emily.id,
                    disease_module="diabetes",
                    medication_taken=rep["med"],
                    medication_details="Metformin 1000mg, Empagliflozin 10mg",
                    measurements_json=measurements,
                    symptoms_json=rep["sym"],
                    symptom_severity=rep["sev"],
                    usual_condition_comparison=rep["comp"],
                    patient_notes="Spike in post-lunch sugar, feeling dehydrated.",
                    triage_priority=prio,
                    triage_reasons_json=reasons,
                    doctor_reviewed=(rep["days_ago"] > 1),
                    created_at=datetime.datetime.utcnow() - datetime.timedelta(days=rep["days_ago"], hours=1)
                )
                db.add(r_obj)
            db.commit()
            print("  ✓ Emily Watson 5-day diabetes reports seeded (with Urgent Hyperglycemia alert)")

        # C. David Miller (CKD) - 4-day renal function trend
        david = patient_objs["david.miller@patient.care"]
        if not db.query(DailyReport).filter(DailyReport.patient_id == david.id).first():
            ckd_reports = [
                {"days_ago": 3, "creat": 1.7, "egfr": 42.0, "uacr": "1+", "sys": 136, "sym": [], "sev": "None", "comp": "Same", "med": "Yes"},
                {"days_ago": 2, "creat": 1.8, "egfr": 40.0, "uacr": "1+", "sys": 140, "sym": ["Mild swollen ankles"], "sev": "Mild", "comp": "Same", "med": "Yes"},
                {"days_ago": 1, "creat": 1.9, "egfr": 38.0, "uacr": "2+", "sys": 148, "sym": ["Bilateral leg swelling", "Lethargy"], "sev": "Moderate", "comp": "Worse", "med": "Yes"},
                {"days_ago": 0, "creat": 2.1, "egfr": 35.0, "uacr": "2+", "sys": 154, "sym": ["Leg edema", "Reduced urine volume"], "sev": "Severe", "comp": "Much worse", "med": "Yes"}
            ]
            for rep in ckd_reports:
                measurements = {
                    "serum_creatinine": rep["creat"],
                    "egfr": rep["egfr"],
                    "uacr_protein": rep["uacr"],
                    "systolic_bp": rep["sys"]
                }
                prio, reasons = evaluate_triage("ckd", measurements, rep["sym"], rep["sev"], rep["comp"], rep["med"], baseline_creatinine=1.7)
                r_obj = DailyReport(
                    patient_id=david.id,
                    disease_module="ckd",
                    medication_taken=rep["med"],
                    medication_details="Losartan 50mg, Sodium Bicarbonate",
                    measurements_json=measurements,
                    symptoms_json=rep["sym"],
                    symptom_severity=rep["sev"],
                    usual_condition_comparison=rep["comp"],
                    patient_notes="Observing more swelling around lower shins by afternoon.",
                    triage_priority=prio,
                    triage_reasons_json=reasons,
                    doctor_reviewed=(rep["days_ago"] > 1),
                    created_at=datetime.datetime.utcnow() - datetime.timedelta(days=rep["days_ago"], hours=3)
                )
                db.add(r_obj)
            db.commit()
            print("  ✓ David Miller CKD reports seeded")

        # 6. SEED BASELINE AI ASSESSMENTS
        for pat_email, dis_mod, feat in [
            ("john.doe@patient.care", "heart_disease", {"age": 58, "sex": "Male", "systolic_bp": 164, "diastolic_bp": 102, "resting_hr": 88, "total_cholesterol": 220, "hdl_cholesterol": 42, "smoking_status": "Former", "has_diabetes": False}),
            ("emily.watson@patient.care", "diabetes", {"age": 46, "height_cm": 164, "weight_kg": 76, "blood_glucose": 265, "hba1c": 7.4, "family_history": "Mother and grandmother", "has_hypertension": True}),
            ("david.miller@patient.care", "ckd", {"age": 63, "sex": "Male", "egfr": 35.0, "serum_creatinine": 2.1, "uacr_protein": "2+", "systolic_bp": 154})
        ]:
            pat = patient_objs[pat_email]
            if not db.query(AIAssessment).filter(AIAssessment.patient_id == pat.id).first():
                res = run_ai_risk_assessment(dis_mod, feat)
                ai_rec = AIAssessment(
                    patient_id=pat.id,
                    disease_module=res["disease_module"],
                    risk_score=res["risk_score"],
                    risk_category=res["risk_category"],
                    confidence_score=res["confidence_score"],
                    input_features_json=res["input_features"],
                    missing_features_json=res["missing_features"],
                    model_version=res["model_version"],
                    clinical_caveats=res["clinical_caveats"],
                    recommendations_json=res["recommendations"],
                    created_at=datetime.datetime.utcnow() - datetime.timedelta(days=1)
                )
                db.add(ai_rec)
        db.commit()
        print("  ✓ Calibrated AI Risk Assessments seeded")
        
        # 7. NOTIFICATIONS & AUDIT LOGS
        # Add notifications for Dr. Jenkins about Alice Johnson's pending request & John Doe's emergency BP
        dr_jenkins = doctor_objs["dr.jenkins@chroniccare.ai"]
        if not db.query(Notification).filter(Notification.user_id == dr_jenkins.id).first():
            n1 = Notification(
                user_id=dr_jenkins.id,
                title="New Consultation Request",
                message="Patient Alice Johnson submitted a new consultation request for Heart Disease.",
                type="request"
            )
            n2 = Notification(
                user_id=dr_jenkins.id,
                title="EMERGENCY ALERT: John Doe",
                message="Patient John Doe logged a Hypertensive Crisis: 184/116 mmHg with chest pressure.",
                type="emergency"
            )
            db.add_all([n1, n2])
            db.commit()
            print("  ✓ Doctor notifications seeded")
            
        print("✅ Clinical database seeding completed successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Database seeding error: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_clinical_database()
