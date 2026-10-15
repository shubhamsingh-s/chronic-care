# ChronicCare AI — Clinical System Architecture & Specifications

## 1. Executive Summary & Clinical Mission
ChronicCare AI is an enterprise-grade full-stack remote patient monitoring (RPM), clinical triage, and telemedicine platform engineered for longitudinal management of three high-burden chronic diseases:
1. **Diabetes Mellitus** (Type 1 & Type 2 Glycemic Tracking)
2. **Heart Disease & Hypertension** (Cardiovascular Hemodynamics)
3. **Chronic Kidney Disease (CKD)** (Renal Function & Filtration Trajectory)

---

## 2. Strict Role-Based Security & Permission Matrix

```
                                  ┌───────────────────────────┐
                                  │      JWT Authentication   │
                                  └─────────────┬─────────────┘
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 ▼                              ▼                              ▼
      ┌────────────────────┐         ┌────────────────────┐         ┌────────────────────┐
      │   Patient Portal   │         │   Doctor Portal    │         │    Admin Portal    │
      └──────────┬─────────┘         └──────────┬─────────┘         └──────────┬─────────┘
                 │                              │                              │
                 ▼                              ▼                              ▼
      • Mandatory Onboarding         • Immediate Name Visibility     • Doctor Verification
      • Daily Biometric Check-In     • Pre-Acceptance Privacy Gate   • Account Governance
      • AI Risk Stratification       • Smart Priority Queue          • Redacted Audit Logs
      • Specialist Directory         • Authorized Records Vault      • Platform Analytics
      • Telehealth Messaging         • Asynchronous Consultation
```

### Pre-Acceptance Privacy Gating (Core Security Invariant)
1. **Pre-Acceptance State:**
   When a patient files a consultation request with a specialist, the doctor immediately sees:
   - Patient's Full Name (prominently displayed)
   - Age & Biological Sex
   - Primary Chronic Condition
   - Consultation Reason & Introductory Message
   - Submission Timestamp
   
   **Strict Privacy Gate:** Full medical records, onboarding questionnaire responses, uploaded lab documents, and longitudinal daily reports are strictly blocked at the backend (`HTTP 403 Forbidden`).

2. **Atomic Acceptance State Transition:**
   When the physician clicks **Accept**:
   - `consultation_requests.status` transitions atomically to `'accepted'`.
   - The active doctor–patient care relationship is created in the database.
   - The patient's full electronic health record, longitudinal charts, and documents unlock.
   - The patient appears in the doctor's **Active Patients** registry and **Smart Priority Queue**.
   - An instant real-time notification is dispatched to the patient.

---

## 3. Clinician-Approved 5-Tier Triage Engine (`triage.py`)

Rather than relying purely on machine learning risk scores for urgency, ChronicCare AI executes a deterministic, multi-factor clinical triage evaluation on every daily report:

| Priority Tier | Clinical Trigger Criteria | Required System Behavior |
| :--- | :--- | :--- |
| **1. Emergency** (`emergency`) | • Systolic BP &ge; 180 or Diastolic &ge; 120 mmHg (Hypertensive Crisis)<br>• Heart Rate &ge; 140 or &le; 40 bpm<br>• Blood Glucose &le; 54 mg/dL or &ge; 400 mg/dL<br>• eGFR &lt; 15 mL/min/1.73m² (Stage 5 Failure)<br>• Red-flag symptoms: Chest pain, syncope, fruity breath, anuria<br>• Self-rated `Critical` symptom severity | • Full-width Red Emergency Safety Alert Bar on patient portal instructing immediate call to 911/112<br>• Pinned to top of Doctor Priority Queue with pulsing badge<br>• Instant high-priority alert sent to assigned physician |
| **2. Urgent** (`urgent`) | • Systolic BP 160–179 or Diastolic 100–119 mmHg (Stage 2 Severe HTN)<br>• HR 115–139 or 41–50 bpm<br>• Glucose 55–69 or 250–399 mg/dL<br>• eGFR 15–29 mL/min/1.73m² (Stage 4)<br>• Serum Creatinine rise &ge; 0.4 mg/dL over baseline (AKI trigger)<br>• Symptoms: Shortness of breath, dizziness, leg swelling<br>• Condition rated `Much worse` or severity `Severe` | • Ranked directly below emergencies with Orange URGENT badge<br>• Explainable clinical trigger reason tags displayed<br>• Urgent review notification dispatched |
| **3. High Priority** (`high`) | • Systolic BP 140–159 or Diastolic 90–99 mmHg<br>• Glucose 180–249 mg/dL<br>• Condition rated `Worse`<br>• Prescribed medication missed (`medication_taken == "No"`) | • Amber High Priority badge<br>• Queued for same-day clinical review<br>• *Safety Invariant:* Medication non-adherence alone NEVER classifies as emergency |
| **4. Routine** (`routine`) | • Biomarkers within chronic target ranges<br>• Medication taken as prescribed (`Yes`)<br>• No or mild stable symptoms<br>• Condition rated `Same` or `Better` | • Emerald Routine badge<br>• Chronological routine review |
| **5. Awaiting Review** (`awaiting_review`) | • Report submitted with missing biometric measurements<br>• No acute red-flag symptoms | • Slate Awaiting Data badge<br>• Never penalizes patient for missing home monitors |

---

## 4. Calibrated AI/ML Risk Stratification Engine (`ml_engine.py`)

All predictive models output statistical probability scores (0.0%–100.0%) and comply with mandatory medical AI safety guidelines:
1. **Never Diagnose:** All outputs carry the mandatory disclaimer:
   > *"This AI evaluation is a statistical risk estimation derived from reported clinical indicators. It is NOT a confirmed medical diagnosis and does not replace certified laboratory testing or evaluation by a licensed physician."*
2. **Confidence Degradation:** Missing core biomarkers (e.g., lipid panel or HbA1c) reduce the confidence score (-15% to -25% per biomarker, minimum 40.0%) and explicitly enumerate missing inputs in `missing_features`.
3. **Three Disease Models:**
   - **Diabetes Mellitus:** `v2.3-ADA-FINDRISC-ML`
   - **Heart Disease & Hypertension:** `v2.5-ACC-ASCVD-Framingham`
   - **Chronic Kidney Disease (CKD):** `v2.0-KDIGO-KFRE`

---

## 5. Relational Database Architecture (11 Normalized Tables)
- `users`: Core identity, password hash, role (`patient`, `doctor`, `admin`), active status.
- `patient_profiles`: Demographics, diagnosis history, medications, allergies, questionnaire JSON.
- `doctor_profiles`: Medical specialty, credentials, experience, consultation fees, verification status.
- `consultation_requests`: Indexed on `(doctor_id, status)` and `(patient_id)`.
- `daily_reports`: Longitudinal RPM submissions with `triage_priority`, explainable reasons, vitals JSON.
- `ai_assessments`: Calibrated risk probability, confidence score, missing biomarkers, recommendations.
- `consultation_messages`: One-to-one asynchronous patient–doctor communication thread.
- `appointments`: Telehealth and in-person scheduled encounters.
- `medical_documents`: Encrypted diagnostic PDFs, prescriptions, and lab panels (max 15MB).
- `notifications`: Real-time alerts for priority triggers, doctor feedback, and appointment reminders.
- `audit_logs`: Immutable security event trail with redacted PHI.
