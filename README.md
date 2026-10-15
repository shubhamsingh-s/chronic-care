# ChronicCare AI — Production Full-Stack Specification

[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React 18+](https://img.shields.io/badge/Frontend-React_19_%2F_Vite-61DAFB.svg)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind_CSS_v4-38B2AC.svg)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-13_Passed-success.svg)](https://docs.pytest.org/)

**ChronicCare AI** is an end-to-end full-stack healthcare web application engineered for **AI-Powered Chronic Disease Prediction, Longitudinal Remote Patient Monitoring (RPM), and Telehealth Consultation**.

---

## 🌟 Key Platform Capabilities

- **3 Dedicated Disease Care Modules:**
  - **Diabetes Mellitus:** Fasting vs. post-meal glucose dual-line chart, shaded ADA target area (70–180 mg/dL), HbA1c timeline, medication adherence tracking.
  - **Heart Disease & Hypertension:** Systolic & diastolic BP trends with clinical threshold reference lines (120/80, 140/90, 180/120), resting heart rate, lipid panel tracking.
  - **Chronic Kidney Disease (CKD):** Longitudinal eGFR & serum creatinine curves, proteinuria/uACR monitoring, nephrotoxicity warnings (NSAID avoidance).
- **Mandatory 12+ Question Health Onboarding Wizard:**
  - Multi-step clinical onboarding form with automatic BMI calculation, conditional disease sections, and informed patient data-sharing consent.
- **Immediate Patient Name Visibility & Pre-Acceptance Privacy Gating:**
  - When a patient sends a consultation request, the doctor **immediately sees their full name, age, primary condition, and introductory message**.
  - **Strict Security Gate:** Detailed medical records, onboarding questionnaires, uploaded lab files, and daily reports remain locked (`HTTP 403 Forbidden`) until the doctor explicitly accepts the request.
- **Atomic Care Relationship Establishment:**
  - Clicking **Accept** establishes the authorized care relationship, unlocks the patient's medical records, routes their daily reports into the doctor's **Smart Priority Queue**, and enables the 1-to-1 asynchronous messaging workspace.
- **Clinician-Approved 5-Tier Smart Priority Queue (`triage.py`):**
  - Evaluates daily check-ins deterministically against evidence-based clinical thresholds:
    1. `emergency` (Hypertensive Crisis &ge;180/120, Hypoglycemia &le;54, Stage 5 CKD &lt;15, Chest Pain, Critical Severity)
    2. `urgent` (Stage 2 Severe HTN, Hyperglycemia 250–399, eGFR 15–29, Creatinine rise &ge;0.4 AKI trigger)
    3. `high` (Elevated vitals, Missed medication non-adherence)
    4. `routine` (Target vitals, medication adhered to, stable)
    5. `awaiting_review` (Missing home monitor data)
- **Top-Level Red Emergency Safety Alert Banner:**
  - Triggers an unmistakable red alert banner instructing the patient to call emergency services (911/112) immediately rather than waiting for asynchronous review.
- **Calibrated AI/ML Risk Engine (`ml_engine.py`):**
  - Non-diagnostic statistical risk estimation with dynamic confidence degradation (-15% to -25% per missing biomarker) and mandatory non-diagnostic disclaimers.
- **1-Click Clinical Demo Switcher Bar:**
  - Instant navigation between doctors, active patients, pending request demos, new onboarding patients, and administrators.

---

## 🧪 Pre-Configured Test Personas & Seed Accounts

All accounts can be accessed with 1-click via the top **Demo Switcher Bar** or using the credentials below:

| Role | Name | Email | Password | Scenario / Test Objective |
| :--- | :--- | :--- | :--- | :--- |
| **Doctor** | Dr. Sarah Jenkins | `dr.jenkins@chroniccare.ai` | `Doctor@12345` | **Cardiology:** Has pending request from Alice Johnson (instant name visibility) & active patient John Doe (Emergency BP in queue) |
| **Doctor** | Dr. Robert Patel | `dr.patel@chroniccare.ai` | `Doctor@12345` | **Endocrinology:** Has pending request from Carlos Ramirez & active patient Emily Watson (Urgent hyperglycemia logs) |
| **Doctor** | Dr. Elena Rostova | `dr.rostova@chroniccare.ai` | `Doctor@12345` | **Nephrology:** Has active patient David Miller (CKD Stage 3b longitudinal eGFR tracking) |
| **Patient** | John Doe | `john.doe@patient.care` | `Patient@12345` | **Heart Disease:** Accepted by Dr. Jenkins; 7-day BP culminating in 184/116 mmHg + chest pressure (Emergency Alert demo) |
| **Patient** | Emily Watson | `emily.watson@patient.care` | `Patient@12345` | **Diabetes:** Accepted by Dr. Patel; 5-day glucose trend with hyperglycemia (Urgent alert demo) |
| **Patient** | David Miller | `david.miller@patient.care` | `Patient@12345` | **CKD:** Accepted by Dr. Rostova; 4-day creatinine (1.7 to 2.1 mg/dL) and eGFR tracking |
| **Patient** | Alice Johnson | `alice.johnson@patient.care` | `Patient@12345` | **Pending Request Demo:** Shows "Awaiting doctor acceptance" on patient dashboard and immediate name visibility on Dr. Jenkins' queue |
| **Patient** | Michael Brown | `michael.brown@patient.care` | `Patient@12345` | **Onboarding State Machine Demo:** `questionnaire_completed = False`; logging in launches the 12-question health wizard |
| **Admin** | System Administrator | `admin@chroniccare.ai` | `Admin@12345` | **Platform Governance:** Doctor verification toggling, user account status, audit logs, and platform analytics |

---

## 🚀 Quickstart & Local Execution

### 1. Database Initialization & Seeding
```bash
# Seed all realistic clinical records across all roles
python backend/seed_data.py
```

### 2. Run Automated Test Suite
```bash
# Run backend RBAC, Triage, ML, and End-to-End API tests
python -m pytest backend/tests/ -v
```

### 3. Start Application

#### Option A: Unified Full-Stack Server (Recommended)
```bash
# Build frontend bundle
cd frontend
npm run build
cd ..

# Run FastAPI production server (serves API & React SPA on port 8000)
uvicorn backend.app.main:app --port 8000
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser.

#### Option B: Dual Development Server
```bash
# Terminal 1: Backend
uvicorn backend.app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🏛️ System Architecture & Technology Stack

- **Backend:** Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy ORM, signed JWT authentication (`HS256`), PBKDF2-HMAC-SHA256 password hashing.
- **Database:** PostgreSQL (production) with automatic SQLite (WAL mode + Foreign Keys enabled) zero-config local fallback.
- **Clinical Triage:** Multi-factor deterministic engine (`triage.py`) covering 5 distinct clinical tiers.
- **Machine Learning:** Calibrated statistical risk models (`ml_engine.py`) with non-diagnostic disclaimers and biomarker completeness confidence penalties.
- **Frontend:** React, TypeScript, Tailwind CSS, Recharts (longitudinal clinical charts), Lucide React.
- **Audit Logging:** Immutable security event logging with automated PHI redaction.
