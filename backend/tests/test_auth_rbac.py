import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_user_registration_and_login():
    email = "test.patient@example.com"
    pwd = "TestPassword@123"
    
    # Register
    reg_resp = client.post("/api/auth/register", json={
        "email": email,
        "password": pwd,
        "role": "patient",
        "full_name": "Test Patient",
        "phone": "+1 555-0199"
    })
    # Either 200 if new or 400 if already exists
    assert reg_resp.status_code in [200, 400]
    
    # Login
    login_resp = client.post("/api/auth/login", json={
        "email": email,
        "password": pwd
    })
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    assert "access_token" in token_data
    assert token_data["user"]["role"] == "patient"
    
    # Test invalid login
    bad_login = client.post("/api/auth/login", json={
        "email": email,
        "password": "WrongPassword!"
    })
    assert bad_login.status_code == 401

def test_rbac_enforcement():
    # Login as patient
    pat_login = client.post("/api/auth/login", json={
        "email": "john.doe@patient.care",
        "password": "Patient@12345"
    })
    assert pat_login.status_code == 200
    pat_token = pat_login.json()["access_token"]
    pat_headers = {"Authorization": f"Bearer {pat_token}"}
    
    # Patient trying to access doctor-only endpoint -> 403
    doc_ep = client.get("/api/doctor/priority-queue", headers=pat_headers)
    assert doc_ep.status_code == 403
    
    # Patient trying to access admin-only endpoint -> 403
    admin_ep = client.get("/api/admin/users", headers=pat_headers)
    assert admin_ep.status_code == 403
    
    # Unauthenticated access -> 401
    no_auth = client.get("/api/patient/dashboard")
    assert no_auth.status_code == 401
