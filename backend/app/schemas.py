from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- Auth Schemas ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=4)
    role: str = Field(..., pattern="^(patient|doctor|admin)$")
    full_name: str = Field(..., min_length=2)
    phone: Optional[str] = None
    # Optional doctor-specific registration fields
    specialty: Optional[str] = None
    qualifications: Optional[str] = None
    experience_years: Optional[int] = None
    consultation_mode: Optional[str] = "Online"
    fee: Optional[float] = 75.0
    languages: Optional[str] = "English"
    bio: Optional[str] = None
    clinic_address: Optional[str] = None
    admin_code: Optional[str] = None

class AdminCodeVerify(BaseModel):
    code: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    role: str
    full_name: str
    phone: Optional[str] = None
    is_active: bool
    questionnaire_completed: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Patient Questionnaire Schemas ---
class MedicationItem(BaseModel):
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None

class PatientQuestionnaireSubmission(BaseModel):
    age: int = Field(..., ge=1, le=125)
    sex: str = Field(..., pattern="^(Male|Female|Intersex|Other|Prefer not to answer)$")
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    primary_disease: str = Field(..., pattern="^(diabetes|heart_disease|ckd|multiple|none)$")
    diagnosis_year: Optional[str] = "Not applicable"
    current_medications: List[Dict[str, Any]] = Field(default_factory=list)
    allergies: Optional[str] = "No known allergies"
    current_symptoms: List[str] = Field(default_factory=list)
    symptom_duration: Optional[str] = "None"
    family_history: Optional[str] = "No known family history"
    smoking_status: Optional[str] = "Never"
    preferred_specialty: Optional[str] = None
    emergency_contact: Optional[str] = None
    consent_granted: bool = True
    questionnaire_version: str = "v1.0"
    
    # Disease-specific optional fields (with 'Not known'/'Not tested' support)
    # Diabetes specific
    blood_glucose: Optional[float] = None
    glucose_context: Optional[str] = None # Fasting, 2-Hr Post-Meal, Random
    hba1c: Optional[float] = None
    hba1c_date: Optional[str] = None
    insulin_regimen: Optional[str] = None
    hypoglycemia_history: Optional[str] = None
    neuropathy_retinopathy: Optional[str] = None
    
    # Heart disease specific
    systolic_bp: Optional[float] = None
    diastolic_bp: Optional[float] = None
    resting_hr: Optional[float] = None
    total_cholesterol: Optional[float] = None
    ldl_cholesterol: Optional[float] = None
    hdl_cholesterol: Optional[float] = None
    triglycerides: Optional[float] = None
    cardiac_history: Optional[str] = None
    chest_discomfort_dyspnea: Optional[str] = None
    
    # CKD specific
    serum_creatinine: Optional[float] = None
    egfr: Optional[float] = None
    egfr_date: Optional[str] = None
    uacr_protein: Optional[str] = None # Negative, Trace, 1+, 2+, 3+
    ckd_stage: Optional[str] = None
    nsaid_acei_use: Optional[str] = None

# --- Doctor Schemas ---
class DoctorProfileResponse(BaseModel):
    user_id: int
    full_name: str
    specialty: str
    qualifications: str
    experience_years: int
    consultation_mode: str
    availability_hours: str
    fee: float
    languages: str
    is_verified: bool
    bio: Optional[str]
    clinic_address: Optional[str]

    class Config:
        from_attributes = True

# --- Consultation Request Schemas ---
class ConsultationRequestCreate(BaseModel):
    doctor_id: int
    primary_disease: str
    consultation_reason: str
    introductory_message: str

class ConsultationRequestAction(BaseModel):
    action: str = Field(..., pattern="^(accept|decline)$")
    doctor_response_notes: Optional[str] = None

class PendingRequestDoctorView(BaseModel):
    id: int
    patient_id: int
    patient_name: str
    patient_age: Optional[int]
    patient_sex: Optional[str]
    primary_disease: str
    consultation_reason: str
    introductory_message: str
    status: str
    created_at: datetime

# --- Daily Monitoring Schemas ---
class DailyReportCreate(BaseModel):
    disease_module: str = Field(..., pattern="^(diabetes|heart_disease|ckd|multiple)$")
    medication_taken: str = Field(..., pattern="^(Yes|Partially|No|Unsure)$")
    medication_details: Optional[str] = None
    reason_missed: Optional[str] = None
    measurements: Dict[str, Any] = Field(default_factory=dict)
    symptoms: List[str] = Field(default_factory=list)
    symptom_severity: str = Field(..., pattern="^(None|Mild|Moderate|Severe|Critical)$")
    usual_condition_comparison: str = Field(..., pattern="^(Better|Same|Worse|Much worse)$")
    patient_notes: Optional[str] = None

class DailyReportReview(BaseModel):
    feedback: str

class DailyReportResponse(BaseModel):
    id: int
    patient_id: int
    patient_name: Optional[str] = None
    disease_module: str
    medication_taken: str
    medication_details: Optional[str]
    reason_missed: Optional[str]
    measurements: Dict[str, Any]
    symptoms: List[str]
    symptom_severity: str
    usual_condition_comparison: str
    patient_notes: Optional[str]
    triage_priority: str
    triage_reasons: List[str]
    doctor_reviewed: bool
    reviewed_at: Optional[datetime]
    doctor_feedback: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# --- AI Assessment Schemas ---
class AIAssessmentResponse(BaseModel):
    id: int
    patient_id: int
    disease_module: str
    risk_score: float
    risk_category: str
    confidence_score: float
    input_features: Dict[str, Any]
    missing_features: List[str]
    model_version: str
    clinical_caveats: str
    recommendations: List[str]
    created_at: datetime

    class Config:
        from_attributes = True

class AIEvaluationRequest(BaseModel):
    disease_module: str = Field(..., pattern="^(diabetes|heart_disease|ckd)$")
    custom_inputs: Optional[Dict[str, Any]] = None

# --- Consultation Messages & Appointments ---
class MessageCreate(BaseModel):
    message_text: str = Field(..., min_length=1)
    attachments: Optional[List[Dict[str, Any]]] = None

class MessageResponse(BaseModel):
    id: int
    request_id: int
    sender_id: int
    sender_name: Optional[str] = None
    sender_role: Optional[str] = None
    recipient_id: int
    message_text: str
    attachments: Optional[List[Dict[str, Any]]] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class AppointmentCreate(BaseModel):
    patient_id: Optional[int] = None
    doctor_id: Optional[int] = None
    scheduled_time: datetime
    duration_minutes: int = 30
    mode: str = Field(default="video", pattern="^(video|in_person|chat)$")
    notes: Optional[str] = None

class AppointmentResponse(BaseModel):
    id: int
    patient_id: int
    patient_name: Optional[str] = None
    doctor_id: int
    doctor_name: Optional[str] = None
    scheduled_time: datetime
    duration_minutes: int
    mode: str
    status: str
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# --- Documents & Notifications ---
class MedicalDocumentResponse(BaseModel):
    id: int
    patient_id: int
    title: str
    document_type: str
    file_name: str
    file_size: int
    mime_type: str
    uploaded_at: datetime

    class Config:
        from_attributes = True

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Admin Analytics ---
class AdminAnalyticsResponse(BaseModel):
    total_users: int
    total_patients: int
    total_doctors: int
    pending_doctor_verifications: int
    total_consultations: int
    active_consultations: int
    total_daily_reports: int
    disease_distribution: Dict[str, int]
    triage_distribution: Dict[str, int]
