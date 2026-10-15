import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, Float, Text, JSON, DateTime, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from backend.app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="patient") # patient, doctor, admin
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    questionnaire_completed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    patient_profile = relationship("PatientProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    doctor_profile = relationship("DoctorProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    daily_reports = relationship("DailyReport", foreign_keys="DailyReport.patient_id", back_populates="patient")
    ai_assessments = relationship("AIAssessment", back_populates="patient")
    documents = relationship("MedicalDocument", back_populates="patient")
    notifications = relationship("Notification", back_populates="user")


class PatientProfile(Base):
    __tablename__ = "patient_profiles"
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    age = Column(Integer, nullable=True)
    sex = Column(String(50), nullable=True)
    height_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    primary_disease = Column(String(100), nullable=True) # diabetes, heart_disease, ckd, multiple, none
    diagnosis_year = Column(String(50), nullable=True)
    current_medications = Column(JSON, nullable=True, default=list)
    allergies = Column(Text, nullable=True)
    current_symptoms = Column(JSON, nullable=True, default=list)
    family_history = Column(Text, nullable=True)
    smoking_status = Column(String(50), nullable=True)
    preferred_specialty = Column(String(100), nullable=True)
    emergency_contact = Column(String(255), nullable=True)
    consent_signed_at = Column(DateTime, nullable=True)
    questionnaire_version = Column(String(50), default="v1.0")
    raw_questionnaire_json = Column(JSON, nullable=True, default=dict)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    user = relationship("User", back_populates="patient_profile")


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    full_name = Column(String(255), nullable=False)
    specialty = Column(String(100), nullable=False) # Cardiology, Endocrinology, Nephrology, etc.
    qualifications = Column(String(255), nullable=False) # MD, FACC, etc.
    experience_years = Column(Integer, default=5, nullable=False)
    consultation_mode = Column(String(50), default="Online") # Online, In-Person, Hybrid
    availability_hours = Column(String(255), default="Mon-Fri: 9AM - 5PM")
    fee = Column(Float, default=75.0, nullable=False)
    languages = Column(String(255), default="English")
    is_verified = Column(Boolean, default=False, nullable=False)
    bio = Column(Text, nullable=True)
    clinic_address = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    user = relationship("User", back_populates="doctor_profile")


class ConsultationRequest(Base):
    __tablename__ = "consultation_requests"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    primary_disease = Column(String(100), nullable=False)
    consultation_reason = Column(Text, nullable=False)
    introductory_message = Column(Text, nullable=False)
    status = Column(String(50), default="pending", nullable=False) # pending, accepted, declined, cancelled, completed
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    responded_at = Column(DateTime, nullable=True)
    doctor_response_notes = Column(Text, nullable=True)
    
    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("User", foreign_keys=[doctor_id])
    messages = relationship("ConsultationMessage", back_populates="request", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("idx_doctor_status", "doctor_id", "status"),
        Index("idx_patient_requests", "patient_id"),
    )


class DailyReport(Base):
    __tablename__ = "daily_reports"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    disease_module = Column(String(100), nullable=False) # diabetes, heart_disease, ckd, multiple
    medication_taken = Column(String(50), nullable=False) # Yes, Partially, No, Unsure
    medication_details = Column(String(255), nullable=True)
    reason_missed = Column(String(255), nullable=True)
    measurements_json = Column(JSON, nullable=False, default=dict)
    symptoms_json = Column(JSON, nullable=False, default=list)
    symptom_severity = Column(String(50), nullable=False, default="None") # None, Mild, Moderate, Severe, Critical
    usual_condition_comparison = Column(String(50), nullable=False, default="Same") # Better, Same, Worse, Much worse
    patient_notes = Column(Text, nullable=True)
    triage_priority = Column(String(50), nullable=False, default="routine") # emergency, urgent, high, routine, awaiting_review
    triage_reasons_json = Column(JSON, nullable=False, default=list)
    doctor_reviewed = Column(Boolean, default=False, nullable=False)
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    doctor_feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    patient = relationship("User", foreign_keys=[patient_id], back_populates="daily_reports")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    
    __table_args__ = (
        Index("idx_triage_review", "triage_priority", "doctor_reviewed"),
        Index("idx_patient_reports_time", "patient_id", "created_at"),
    )


class AIAssessment(Base):
    __tablename__ = "ai_assessments"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    disease_module = Column(String(100), nullable=False)
    risk_score = Column(Float, nullable=False) # 0.0 - 100.0
    risk_category = Column(String(50), nullable=False) # low, moderate, high, critical
    confidence_score = Column(Float, nullable=False) # 40.0 - 100.0
    input_features_json = Column(JSON, nullable=False, default=dict)
    missing_features_json = Column(JSON, nullable=False, default=list)
    model_version = Column(String(100), nullable=False)
    clinical_caveats = Column(Text, nullable=False)
    recommendations_json = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    patient = relationship("User", back_populates="ai_assessments")


class ConsultationMessage(Base):
    __tablename__ = "consultation_messages"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("consultation_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message_text = Column(Text, nullable=False)
    attachments_json = Column(JSON, nullable=True, default=list)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    request = relationship("ConsultationRequest", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])


class Appointment(Base):
    __tablename__ = "appointments"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    scheduled_time = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=30, nullable=False)
    mode = Column(String(50), default="video", nullable=False) # video, in_person, chat
    status = Column(String(50), default="scheduled", nullable=False) # scheduled, completed, cancelled
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("User", foreign_keys=[doctor_id])


class MedicalDocument(Base):
    __tablename__ = "medical_documents"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    document_type = Column(String(50), default="lab_report", nullable=False) # lab_report, prescription, imaging, other
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    patient = relationship("User", back_populates="documents")


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="info", nullable=False) # info, urgent, emergency, request, consultation
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    user = relationship("User", back_populates="notifications")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=True, index=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=False)
    resource_id = Column(String(100), nullable=True)
    details_json = Column(JSON, nullable=True, default=dict)
    ip_address = Column(String(100), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
