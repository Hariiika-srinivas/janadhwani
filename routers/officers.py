"""
Officer Portal, Action Logging, Snooze, Reassignment & Authentication Router
"""
import sqlite3
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from app.db import get_connection
from app.auth import verify_password, generate_session_token, decode_session_token
from engine.clock import now as get_current_time, now_iso
from engine.audit import append as audit_append
from engine.notify import send_notification

router = APIRouter(prefix="/api", tags=["Officer"])

class LoginRequest(BaseModel):
    username: str
    password: str

class OfficerActionRequest(BaseModel):
    action_type: str = Field(..., description="'IN_PROGRESS', 'NOTE_ADDED', 'RESOLVED', 'REASSIGN'")
    notes: str = Field(..., min_length=2, description="Action or inspection notes")
    officer_id: int = Field(..., description="ID of acting officer")
    photo_url: Optional[str] = Field(None, description="Optional photo URL proving resolution or inspection")
    location_gps: Optional[str] = Field(None, description="GPS lat,lng coordinate string")

class SnoozeRequest(BaseModel):
    officer_id: int
    duration_hours: int = Field(..., ge=1, le=72, description="Snooze duration in hours (max 72)")
    reason: str = Field(..., min_length=5, description="Mandatory justification for snoozing SLA")

class ReassignRequest(BaseModel):
    officer_id: int
    target_officer_id: int
    reason: str = Field(..., min_length=5, description="Reason for reassignment")

@router.post("/login")
def login(req: LoginRequest):
    """
    Authenticate officer or administrator and issue session token.
    Pre-configured demo users:
    - officer_sneha (password123) -> L1 Officer
    - sup_deshmukh (password123) -> L2 Medical Superintendent
    - dho_kalaburagi (password123) -> L3 District Health Officer
    - commissioner_health (password123) -> L4 State Commissioner
    - psi_sharanappa (password123) -> Police Sub-Inspector
    - auditor_demo (password123) -> Independent Auditor
    - admin_demo (password123) -> System Admin
    """
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        SELECT o.id, o.organization_id, o.name, o.kannada_name, o.designation,
               o.role, o.level, o.username, o.password_hash,
               org.name as org_name, org.department_code
        FROM officers o
        JOIN organizations org ON o.organization_id = org.id
        WHERE o.username = ?
    """, (req.username.strip(),))
    row = c.fetchone()
    conn.close()

    if not row or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    user_info = {
        "id": row["id"],
        "organization_id": row["organization_id"],
        "name": row["name"],
        "kannada_name": row["kannada_name"],
        "designation": row["designation"],
        "role": row["role"],
        "level": row["level"],
        "username": row["username"],
        "org_name": row["org_name"],
        "department_code": row["department_code"]
    }
    token = generate_session_token(user_info)
    return {
        "token": token,
        "user": user_info
    }

@router.get("/officer/complaints")
def get_officer_complaints(
    org_id: Optional[int] = None,
    level: Optional[int] = None,
    status: Optional[str] = None,
    category_id: Optional[int] = None,
    department: Optional[str] = None
):
    """
    Priority-sorted complaint queue with overdue badges and duplicate counts.
    """
    conn = get_connection()
    c = conn.cursor()

    query = """
        SELECT c.id, c.public_id, c.department_code, c.language, c.original_text,
               c.english_summary, c.channel, c.status, c.priority_score,
               c.duplicate_count, c.sla_deadline, c.escalation_level, c.is_overdue,
               c.snoozed_until, c.snooze_reason, c.created_at, c.updated_at,
               c.opened_at, c.resolved_at, c.resolution_notes, c.resolution_photo_url,
               o.name as org_name, w.name as ward_name, cat.name as cat_name,
               cat.kannada_name as cat_kn_name, off.name as officer_name, off.designation as officer_desig
        FROM complaints c
        JOIN organizations o ON c.organization_id = o.id
        LEFT JOIN wards w ON c.ward_id = w.id
        JOIN categories cat ON c.category_id = cat.id
        LEFT JOIN officers off ON c.assigned_officer_id = off.id
        WHERE 1=1
    """
    params = []

    if org_id:
        query += " AND c.organization_id = ?"
        params.append(org_id)
    if level:
        query += " AND c.escalation_level = ?"
        params.append(level)
    if status and status != "ALL":
        query += " AND c.status = ?"
        params.append(status)
    if category_id:
        query += " AND c.category_id = ?"
        params.append(category_id)
    if department:
        query += " AND c.department_code = ?"
        params.append(department)

    query += " ORDER BY c.priority_score DESC, c.id ASC"

    c.execute(query, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

@router.post("/complaints/{complaint_id}/action")
def log_officer_action(complaint_id: int, req: OfficerActionRequest):
    """
    Logs officer action (IN_PROGRESS, NOTE, RESOLVED) with photo and GPS location.
    When marked RESOLVED, sends verification prompt to citizen.
    """
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        SELECT public_id, status, citizen_phone_hash, language, organization_id
        FROM complaints WHERE id = ?
    """, (complaint_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Complaint not found")

    public_id, old_status, phone_hash, lang, org_id = row[0], row[1], row[2], row[3], row[4]
    now_str = now_iso()
    new_status = old_status

    if req.action_type == "IN_PROGRESS":
        new_status = "IN_PROGRESS"
        c.execute("""
            UPDATE complaints
            SET status = 'IN_PROGRESS', opened_at = COALESCE(opened_at, ?), updated_at = ?
            WHERE id = ?
        """, (now_str, now_str, complaint_id))

    elif req.action_type == "RESOLVED":
        new_status = "RESOLVED"
        c.execute("""
            UPDATE complaints
            SET status = 'RESOLVED',
                resolved_at = ?,
                resolution_notes = ?,
                resolution_photo_url = ?,
                resolution_location = ?,
                updated_at = ?
            WHERE id = ?
        """, (now_str, req.notes, req.photo_url, req.location_gps, now_str, complaint_id))

        # Send citizen verification notification
        send_notification(conn, complaint_id, phone_hash, "RESOLVED_NEEDS_VERIFICATION", {
            "public_id": public_id
        }, language=lang)

    # Insert action record
    c.execute("""
        INSERT INTO actions (complaint_id, officer_id, action_type, old_status, new_status, notes, photo_url, location_gps, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (complaint_id, req.officer_id, req.action_type, old_status, new_status, req.notes, req.photo_url, req.location_gps, now_str))

    # Append to hash-chained audit log
    audit_append(conn, "complaint", complaint_id, f"ACTION_{req.action_type}", str(req.officer_id), {
        "public_id": public_id,
        "old_status": old_status,
        "new_status": new_status,
        "notes": req.notes,
        "has_photo": bool(req.photo_url),
        "location": req.location_gps
    })

    conn.commit()
    conn.close()
    return {
        "status": "SUCCESS",
        "new_status": new_status,
        "message": f"Action {req.action_type} successfully recorded for complaint #{public_id}"
    }

@router.post("/complaints/{complaint_id}/snooze")
def snooze_complaint(complaint_id: int, req: SnoozeRequest):
    """
    Snooze a complaint with mandatory reason and duration (up to 72 hours).
    """
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT public_id, sla_deadline FROM complaints WHERE id = ?", (complaint_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Complaint not found")

    public_id, current_deadline = row[0], row[1]
    now_dt = get_current_time()
    snooze_until = (now_dt + timedelta(hours=req.duration_hours)).isoformat()
    now_str = now_dt.isoformat()

    c.execute("""
        UPDATE complaints
        SET snoozed_until = ?, snooze_reason = ?, updated_at = ?
        WHERE id = ?
    """, (snooze_until, req.reason, now_str, complaint_id))

    c.execute("""
        INSERT INTO actions (complaint_id, officer_id, action_type, notes, created_at)
        VALUES (?, ?, 'SNOOZED', ?, ?)
    """, (complaint_id, req.officer_id, f"Snoozed for {req.duration_hours}h. Reason: {req.reason}", now_str))

    audit_append(conn, "complaint", complaint_id, "SNOOZED", str(req.officer_id), {
        "public_id": public_id,
        "duration_hours": req.duration_hours,
        "reason": req.reason,
        "snoozed_until": snooze_until
    })

    conn.commit()
    conn.close()
    return {"status": "SUCCESS", "message": f"Complaint #{public_id} snoozed until {snooze_until[:16]}"}

@router.post("/complaints/{complaint_id}/reassign")
def reassign_complaint(complaint_id: int, req: ReassignRequest):
    """
    Reassign complaint to another officer.
    """
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT public_id, assigned_officer_id FROM complaints WHERE id = ?", (complaint_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Complaint not found")

    public_id, prev_officer = row[0], row[1]
    now_str = now_iso()

    c.execute("""
        UPDATE complaints
        SET assigned_officer_id = ?, updated_at = ?
        WHERE id = ?
    """, (req.target_officer_id, now_str, complaint_id))

    c.execute("SELECT name, designation FROM officers WHERE id = ?", (req.target_officer_id,))
    target_row = c.fetchone()
    target_name = target_row[0] if target_row else f"Officer #{req.target_officer_id}"

    c.execute("""
        INSERT INTO actions (complaint_id, officer_id, action_type, notes, created_at)
        VALUES (?, ?, 'REASSIGNED', ?, ?)
    """, (complaint_id, req.officer_id, f"Reassigned to {target_name}. Reason: {req.reason}", now_str))

    audit_append(conn, "complaint", complaint_id, "REASSIGNED", str(req.officer_id), {
        "public_id": public_id,
        "prev_officer": prev_officer,
        "new_officer": req.target_officer_id,
        "reason": req.reason
    })

    conn.commit()
    conn.close()
    return {"status": "SUCCESS", "message": f"Complaint #{public_id} reassigned to {target_name}"}
