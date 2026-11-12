"""
Police Department Module Integration Tests
Validates that POLICE department uses the exact same core grievance engine.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_police_complaint_registration_and_disclaimer():
    # Organization 6 is Kalaburagi Central Police Station
    payload = {
        "text": "Cyber fraud: money unauthorizedly debited via fraudulent link Rs 15000",
        "organization_id": 6,
        "department_code": "POLICE",
        "language": "en",
        "channel": "WEB",
        "phone": "9845077777",
        "citizen_name": "Arun Kumar"
    }
    res = client.post("/api/complaints", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "public_id" in data
    pub_id = data["public_id"]
    assert data["category_name"] == "Cybercrime & Online Fraud"

    # Status check
    status_res = client.get(f"/api/complaints/{pub_id}/status")
    assert status_res.status_code == 200
    comp = status_res.json()["complaint"]
    assert comp["department_code"] == "POLICE"
    assert "Police" in comp["org_name"]

def test_police_officer_queue_and_levels():
    # Login as PSI Sharanappa
    login_res = client.post("/api/login", json={"username": "psi_sharanappa", "password": "password123"})
    assert login_res.status_code == 200
    user = login_res.json()["user"]
    assert user["department_code"] == "POLICE"
    assert "Sub-Inspector" in user["designation"]

    # Fetch police queue
    queue_res = client.get("/api/officer/complaints?department=POLICE")
    assert queue_res.status_code == 200
    queue = queue_res.json()
    assert len(queue) > 0
    assert all(c["department_code"] == "POLICE" for c in queue)
