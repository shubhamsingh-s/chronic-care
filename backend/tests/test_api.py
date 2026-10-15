import pytest
import time
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_full_clinical_workflow():
    # 1. Login as Dr. Jenkins and Patient Michael Brown
    doc_login = client.post("/api/auth/login", json={
        "email": "dr.jenkins@chroniccare.ai",
        "password": "Doctor@12345"
    })
    assert doc_login.status_code == 200
    doc_data = doc_login.json()
    doc_token = doc_data["access_token"]
    doc_id = doc_data["user"]["id"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}
    
    # Create or use unique test patient
    test_email = f"workflow.patient.{int(time.time())}@patient.care"
    reg_resp = client.post("/api/auth/register", json={
        "email": test_email,
        "password": "Patient@12345",
        "role": "patient",
        "full_name": "Workflow Test Patient"
    })
    assert reg_resp.status_code == 200
    pat_token = reg_resp.json()["access_token"]
    pat_id = reg_resp.json()["user"]["id"]
    pat_headers = {"Authorization": f"Bearer {pat_token}"}
    
    # 2. Complete Mandatory Questionnaire
    q_data = {
        "age": 42,
        "sex": "Male",
        "height_cm": 178.0,
        "weight_kg": 82.0,
        "primary_disease": "heart_disease",
        "diagnosis_year": "2023",
        "current_medications": [{"name": "Lisinopril", "dosage": "10mg", "frequency": "Daily"}],
        "allergies": "None",
        "current_symptoms": ["Occasional palpitations"],
        "systolic_bp": 142.0,
        "diastolic_bp": 92.0,
        "resting_hr": 78.0,
        "consent_granted": True,
        "questionnaire_version": "v1.0"
    }
    q_resp = client.post("/api/patient/questionnaire", json=q_data, headers=pat_headers)
    assert q_resp.status_code == 200
    assert q_resp.json()["dashboard_unlocked"] is True
    
    # 3. Patient checks dashboard -> unlocked!
    dash_resp = client.get("/api/patient/dashboard", headers=pat_headers)
    assert dash_resp.status_code == 200
    assert dash_resp.json()["questionnaire_completed"] is True
    
    # 4. Patient submits consultation request to Dr. Jenkins
    req_resp = client.post("/api/patient/requests", json={
        "doctor_id": doc_id,
        "primary_disease": "heart_disease",
        "consultation_reason": "Hypertension surveillance and cardiology guidance.",
        "introductory_message": "Hello Dr. Jenkins, seeking specialist oversight for blood pressure management."
    }, headers=pat_headers)
    assert req_resp.status_code == 200
    req_id = req_resp.json()["request_id"]
    
    # 5. Immediate Name Visibility in Dr. Jenkins' Pending Queue
    pending_resp = client.get("/api/doctor/pending-requests", headers=doc_headers)
    assert pending_resp.status_code == 200
    pending_list = pending_resp.json()
    my_item = next((item for item in pending_list if item["patient_name"] == "Workflow Test Patient"), None)
    assert my_item is not None
    assert my_item["patient_name"] == "Workflow Test Patient"
    assert my_item["status"] == "pending"
    
    # 6. Pre-Acceptance Gating: Doctor attempts to access patient's private records -> 403 Forbidden!
    unauth_records = client.get(f"/api/doctor/patient/{pat_id}/records", headers=doc_headers)
    assert unauth_records.status_code == 403
    assert "Forbidden" in unauth_records.json()["detail"]
    
    # 7. Doctor accepts the consultation request atomically
    accept_resp = client.post(
        f"/api/doctor/requests/{req_id}/action",
        json={"action": "accept", "doctor_response_notes": "Welcome, your request is approved."},
        headers=doc_headers
    )
    assert accept_resp.status_code == 200
    assert accept_resp.json()["request_status"] == "accepted"
    
    # 8. Post-Acceptance: Full records are now UNLOCKED!
    auth_records = client.get(f"/api/doctor/patient/{pat_id}/records", headers=doc_headers)
    assert auth_records.status_code == 200
    records_body = auth_records.json()
    assert records_body["patient"]["full_name"] == "Workflow Test Patient"
    assert "profile" in records_body
    
    # 9. Patient submits daily report with Emergency BP trigger
    rep_resp = client.post("/api/monitoring/daily-report", json={
        "disease_module": "heart_disease",
        "medication_taken": "No",
        "measurements": {"systolic_bp": 188, "diastolic_bp": 118, "resting_hr": 92},
        "symptoms": ["Chest tightness"],
        "symptom_severity": "Critical",
        "usual_condition_comparison": "Much worse"
    }, headers=pat_headers)
    assert rep_resp.status_code == 200
    assert rep_resp.json()["triage_priority"] == "emergency"
    daily_report_id = rep_resp.json()["id"]
    
    # 10. Check Priority Queue for Dr. Jenkins -> Emergency report is ranked at top!
    queue_resp = client.get("/api/doctor/priority-queue", headers=doc_headers)
    assert queue_resp.status_code == 200
    queue_reports = queue_resp.json()
    assert len(queue_reports) > 0
    top_report = queue_reports[0]
    assert top_report["triage_priority"] == "emergency"
    
    # 11. Doctor reviews report and adds clinical feedback
    review_resp = client.post(
        f"/api/doctor/reports/{daily_report_id}/review",
        json={"feedback": "Urgent: Please take Lisinopril immediately and rest quietly. Call emergency services if pain worsens."},
        headers=doc_headers
    )
    assert review_resp.status_code == 200
    
    # 12. One-to-one consultation message exchange for accepted relationship
    send_msg = client.post(
        f"/api/consultation/{req_id}/messages",
        json={"message_text": "Hello, I have reviewed your emergency BP reading. Please follow instructions."},
        headers=doc_headers
    )
    assert send_msg.status_code == 200
    assert "emergency BP reading" in send_msg.json()["message_text"]
    
    # Fetch messages
    get_msgs = client.get(f"/api/consultation/{req_id}/messages", headers=pat_headers)
    assert get_msgs.status_code == 200
    assert len(get_msgs.json()) >= 1
