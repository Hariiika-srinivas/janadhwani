"""
REST API Integration Tests for JanaDhwani
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_api_public_orgs_and_wards():
    res = client.get("/api/orgs")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 8
    assert any(o["name"] == "District Hospital Kalaburagi" for o in data)

    res_wards = client.get("/api/wards?org_id=1")
    assert res_wards.status_code == 200
    wards = res_wards.json()
    assert len(wards) == 5

def test_complaint_registration_and_status():
    payload = {
        "text": "Maternity ward water filter is completely broken and leaking",
        "organization_id": 1,
        "ward_id": 1,
        "department_code": "HEALTH",
        "language": "en",
        "channel": "VOICE",
        "phone": "9845099999",
        "citizen_name": "Ravi Kumar",
        "is_anonymous": False
    }
    res = client.post("/api/complaints", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "public_id" in data
    pub_id = data["public_id"]
    assert data["category_name"] == "Drinking Water/Sanitation"
    assert "JD-2026-" in pub_id

    # Test status lookup
    status_res = client.get(f"/api/complaints/{pub_id}/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["complaint"]["public_id"] == pub_id
    assert "audio_text_kn" in status_data
    assert "audio_text_en" in status_data

def test_emergency_interception():
    payload = {
        "text": "Severe chest pain and unconscious patient in waiting room",
        "organization_id": 1,
        "department_code": "HEALTH",
        "phone": "9845011111"
    }
    res = client.post("/api/complaints", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["is_emergency"] is True
    assert data["helpline"] == "108"
    assert "108" in data["message_en"]

def test_officer_login_and_action():
    # Valid login
    login_res = client.post("/api/login", json={"username": "officer_sneha", "password": "password123"})
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "token" in login_data
    user = login_data["user"]
    assert user["role"] == "OFFICER"

    # Invalid login
    bad_login = client.post("/api/login", json={"username": "officer_sneha", "password": "wrongpassword"})
    assert bad_login.status_code == 401

    # Fetch officer complaints
    queue_res = client.get("/api/officer/complaints?org_id=1")
    assert queue_res.status_code == 200
    queue = queue_res.json()
    assert len(queue) > 0

    # Log action on complaint 1
    action_res = client.post("/api/complaints/1/action", json={
        "action_type": "IN_PROGRESS",
        "notes": "Inspection completed. Plumber assigned to fix valve.",
        "officer_id": user["id"]
    })
    assert action_res.status_code == 200
    assert action_res.json()["status"] == "SUCCESS"

def test_citizen_verification_and_rating():
    # Fetch public ID of a complaint
    status_res = client.get("/api/complaints/JD-2026-1006/status")
    pub_id = "JD-2026-1006"

    # Confirm verification
    verify_res = client.post(f"/api/complaints/{pub_id}/verify", json={
        "action": "confirm",
        "notes": "Verified. Water is running properly now."
    })
    assert verify_res.status_code == 200
    assert verify_res.json()["status"] == "SUCCESS"

    # Rating
    rating_res = client.post(f"/api/complaints/{pub_id}/rating", json={
        "stars": 5,
        "feedback": "Prompt response and great service!"
    })
    assert rating_res.status_code == 200

def test_dashboard_and_demo_endpoints():
    # Summary
    sum_res = client.get("/api/dashboard/summary")
    assert sum_res.status_code == 200
    assert "total_complaints" in sum_res.json()

    # Early warnings
    warn_res = client.get("/api/dashboard/early-warnings")
    assert warn_res.status_code == 200

    # Hospital health scores
    scores_res = client.get("/api/dashboard/hospital-scores")
    assert scores_res.status_code == 200
    assert len(scores_res.json()) >= 5

    # Demo advance time
    adv_res = client.post("/api/demo/advance-time", json={"hours": 12.0})
    assert adv_res.status_code == 200
    assert adv_res.json()["status"] == "SUCCESS"

    # Demo reset time
    reset_res = client.post("/api/demo/reset-time")
    assert reset_res.status_code == 200
