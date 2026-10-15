export type Role = 'patient' | 'doctor' | 'admin';

export interface User {
  id: number;
  email: string;
  role: Role;
  full_name: string;
  phone?: string;
  is_active: boolean;
  questionnaire_completed: boolean;
  created_at: string;
  profile?: any;
}

export interface PatientProfile {
  user_id: number;
  age?: number;
  sex?: string;
  height_cm?: number;
  weight_kg?: number;
  primary_disease: 'diabetes' | 'heart_disease' | 'ckd' | 'multiple' | 'none';
  diagnosis_year?: string;
  current_medications?: Array<{ name: string; dosage?: string; frequency?: string }>;
  allergies?: string;
  current_symptoms?: string[];
  family_history?: string;
  smoking_status?: string;
  preferred_specialty?: string;
  consent_signed_at?: string;
  raw_questionnaire?: any;
}

export interface DoctorProfile {
  user_id: number;
  full_name: string;
  specialty: string;
  qualifications: string;
  experience_years: number;
  consultation_mode: 'Online' | 'In-Person' | 'Hybrid';
  availability_hours: string;
  fee: number;
  languages: string;
  is_verified: boolean;
  bio?: string;
  clinic_address?: string;
}

export interface ConsultationRequest {
  id: number;
  patient_id: number;
  doctor_id: number;
  doctor_name?: string;
  patient_name?: string;
  patient_age?: number;
  patient_sex?: string;
  specialty?: string;
  primary_disease: string;
  consultation_reason: string;
  introductory_message: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed';
  created_at: string;
  responded_at?: string;
  doctor_response_notes?: string;
}

export interface DailyReport {
  id: number;
  patient_id: number;
  patient_name?: string;
  disease_module: string;
  medication_taken: 'Yes' | 'Partially' | 'No' | 'Unsure';
  medication_details?: string;
  reason_missed?: string;
  measurements: Record<string, any>;
  symptoms: string[];
  symptom_severity: 'None' | 'Mild' | 'Moderate' | 'Severe' | 'Critical';
  usual_condition_comparison: 'Better' | 'Same' | 'Worse' | 'Much worse';
  patient_notes?: string;
  triage_priority: 'emergency' | 'urgent' | 'high' | 'routine' | 'awaiting_review';
  triage_reasons: string[];
  doctor_reviewed: boolean;
  reviewed_at?: string;
  doctor_feedback?: string;
  created_at: string;
}

export interface AIAssessment {
  id: number;
  patient_id: number;
  disease_module: string;
  risk_score: number;
  risk_category: 'low' | 'moderate' | 'high' | 'critical';
  confidence_score: number;
  input_features: Record<string, any>;
  missing_features: string[];
  model_version: string;
  clinical_caveats: string;
  recommendations: string[];
  created_at: string;
}

export interface ConsultationMessage {
  id: number;
  request_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  recipient_id: number;
  message_text: string;
  attachments?: any[];
  is_read: boolean;
  created_at: string;
}

export interface Appointment {
  id: number;
  patient_id: number;
  patient_name?: string;
  doctor_id: number;
  doctor_name?: string;
  scheduled_time: string;
  duration_minutes: number;
  mode: 'video' | 'in_person' | 'chat';
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
}

export interface MedicalDocument {
  id: number;
  patient_id: number;
  title: string;
  document_type: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}
