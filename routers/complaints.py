"""
Public Citizen Complaint Intake, Status Tracking & Verification Router
"""
import random
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

from app.db import get_connection
from app.auth import hash_phone, mask_phone
from engine.clock import now as get_current_time, now_iso
from engine.emergency import detect_emergency
from engine.classify import classify_grievance
from engine.dedupe import find_duplicate_cluster, attach_duplicate
from engine.priority import calculate_priority
from engine.sla import calculate_deadline, get_sla_progress
from engine.audit import append as audit_append
from engine.notify import send_notification

router = APIRouter(prefix="/api/complaints", tags=["Complaints"])

class ComplaintCreateRequest(BaseModel):
    text: str = Field(..., min_length=2, description="Citizen complaint voice transcript or typed text")
    organization_id: int = Field(..., description="Target hospital or police station ID")
    ward_id: Optional[int] = Field(None, description="Ward ID (for hospitals)")
    department_code: str = Field("HEALTH", description="'HEALTH' or 'POLICE'")
    language: str = Field("kn", description="'kn', 'en', 'hi', 'te', 'ur'")
    channel: str = Field("VOICE", description="'VOICE', 'KIOSK', 'ASHA_ASSISTED', 'QR_PORTAL', 'WEB'")
    phone: str = Field("9845000000", description="Citizen phone number (hashed upon intake)")
    citizen_name: Optional[str] = Field("Anonymous Citizen", description="Citizen name")
    is_anonymous: bool = Field(False, description="Flag for anonymous reporting")
    assisted_by: Optional[str] = Field(None, description="ASHA worker or help desk operator name")
    audio_path: Optional[str] = Field(None, description="Recorded audio clip URI if available")

class CitizenVerifyRequest(BaseModel):
    action: str = Field(..., description="'confirm' to close, or 'reject' to reopen")
    notes: Optional[str] = Field(None, description="Citizen verification comments")

class CitizenRatingRequest(BaseModel):
    stars: int = Field(..., ge=1, le=5, description="1 to 5 star rating")
    feedback: Optional[str] = Field(None, description="Optional citizen feedback")

@router.post("")
def register_complaint(req: ComplaintCreateRequest):
    """
    Complete grievance intake pipeline:
    1. Emergency Scan -> 2. Classify -> 3. Dedupe -> 4. Priority -> 5. Route -> 6. SLA -> 7. Audit -> 8. Notify
    """
    # 1. Emergency Detection
    is_em, em_details = detect_emergency(req.text)
    if is_em:
        return {
            "is_emergency": True,
            "emergency_details": em_details,
            "status": "EMERGENCY_REFERRED",
            "message_kn": em_details.get("message_kn"),
            "message_en": em_details.get("message_en"),
            "helpline": "108"
        }

    conn = get_connection()
    c = conn.cursor()

    # Verify Organization
    c.execute("SELECT id, name, kannada_name, department_code FROM organizations WHERE id = ?", (req.organization_id,))
    org_row = c.fetchone()
    if not org_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Selected hospital or police station not found")
    org_name = org_row[1]
    org_kn_name = org_row[2]
    dept_code = org_row[3]

    # Verify Ward if provided
    is_vulnerable_ward = False
    ward_name = "General Area"
    if req.ward_id:
        c.execute("SELECT name, is_vulnerable FROM wards WHERE id = ?", (req.ward_id,))
        ward_row = c.fetchone()
        if ward_row:
            ward_name = ward_row[0]
            is_vulnerable_ward = bool(ward_row[1])

    # 2. Classification
    classification = classify_grievance(req.text, dept_code)
    cat_name = classification["category_name"]
    eng_summary = classification["english_summary"]
    sentiment = classification["sentiment"]
    cat_weight = classification["weight"]

    # Fetch Category ID and SLA Hours from DB
    c.execute("SELECT id, default_sla_hours, kannada_name FROM categories WHERE name = ? AND department_code = ?", (cat_name, dept_code))
    cat_row = c.fetchone()
    cat_id = cat_row[0] if cat_row else 1
    sla_hours = cat_row[1] if cat_row else 24
    cat_kn_name = cat_row[2] if cat_row else cat_name

    # 3. Deduplication Check (within 72h window)
    dup_cluster = find_duplicate_cluster(conn, req.organization_id, cat_id, req.ward_id)
    if dup_cluster:
        parent_id, existing_count = dup_cluster
        new_count = existing_count + 1
        new_priority = attach_duplicate(conn, parent_id, new_count, is_vulnerable_ward, sentiment)

        # Fetch parent public ID and officer
        c.execute("""
            SELECT c.public_id, c.sla_deadline, o.name, o.designation
            FROM complaints c
            LEFT JOIN officers o ON c.assigned_officer_id = o.id
            WHERE c.id = ?
        """, (parent_id,))
        parent_row = c.fetchone()
        parent_pub_id = parent_row[0] if parent_row else f"JD-2026-{parent_id}"
        deadline_str = parent_row[1] if parent_row else "24h"
        resp_auth = f"{parent_row[2]} ({parent_row[3]})" if parent_row and parent_row[2] else "Duty Officer"

        audit_append(conn, "complaint", parent_id, "DUPLICATE_ATTACHED", "SYSTEM", {
            "duplicate_count": new_count,
            "new_priority": new_priority,
            "channel": req.channel
        })
        conn.close()

        return {
            "is_emergency": False,
            "is_duplicate": True,
            "public_id": parent_pub_id,
            "duplicate_count": new_count,
            "priority_score": new_priority,
            "category_name": cat_name,
            "category_kannada": cat_kn_name,
            "organization_name": org_name,
            "responsible_authority": resp_auth,
            "deadline": deadline_str[:16].replace("T", " "),
            "kannada_ack": f"ಇದೇ ಸಮಸ್ಯೆಯನ್ನು ಈಗಾಗಲೇ ಇತರ ನಾಗರಿಕರು ದಾಖಲಿಸಿದ್ದಾರೆ. ನಿಮ್ಮ ದೂರು ಸಂಖ್ಯೆ #{parent_pub_id} ಗೆ ಸೇರಿಸಲಾಗಿದೆ (ಒಟ್ಟು ವರದಿಗಳು: {new_count}). ಆದ್ಯತೆ ಹೆಚ್ಚಿಸಲಾಗಿದೆ!",
            "english_ack": f"This identical issue was already reported. Attached to parent complaint #{parent_pub_id} (total reports: {new_count}). Priority raised to {new_priority}!"
        }

    # 4. Priority Calculation
    initial_priority = calculate_priority(
        category_weight=cat_weight,
        duplicate_count=1,
        sla_progress=0.0,
        is_vulnerable_ward=is_vulnerable_ward,
        sentiment=sentiment
    )

    # 5. Routing to Primary Officer
    c.execute("""
        SELECT primary_officer_id FROM category_routing
        WHERE category_id = ? AND organization_id = ?
    """, (cat_id, req.organization_id))
    routing_row = c.fetchone()

    assigned_officer_id = None
    if routing_row:
        assigned_officer_id = routing_row[0]
    else:
        # Fallback to level 1 officer in that organization
        c.execute("SELECT id FROM officers WHERE organization_id = ? AND level = 1 LIMIT 1", (req.organization_id,))
        off_row = c.fetchone()
        if off_row:
            assigned_officer_id = off_row[0]
        else:
            c.execute("SELECT id FROM officers WHERE organization_id = ? LIMIT 1", (req.organization_id,))
            off_row2 = c.fetchone()
            assigned_officer_id = off_row2[0] if off_row2 else 1

    # Check if assigned officer is on leave
    c.execute("SELECT name, designation, is_on_leave, substitute_officer_id FROM officers WHERE id = ?", (assigned_officer_id,))
    off_info = c.fetchone()
    officer_name = off_info[0] if off_info else "Duty Officer"
    officer_desig = off_info[1] if off_info else "In-Charge"
    if off_info and off_info[2] and off_info[3]:
        # Officer is on leave -> use substitute
        assigned_officer_id = off_info[3]
        c.execute("SELECT name, designation FROM officers WHERE id = ?", (assigned_officer_id,))
        sub_info = c.fetchone()
        if sub_info:
            officer_name = sub_info[0]
            officer_desig = sub_info[1]

    # 6. SLA Calculation (Skips Sundays and Holidays)
    current_dt = get_current_time()
    deadline_dt = calculate_deadline(current_dt, sla_hours, conn)
    deadline_iso = deadline_dt.isoformat()
    now_str = current_dt.isoformat()

    # 7. Generate Public ID & Insert
    phone_hash = hash_phone(req.phone)
    # Unique sequence based on count
    c.execute("SELECT MAX(id) FROM complaints")
    max_id = c.fetchone()[0] or 1000
    public_id = f"JD-2026-{max_id + 1}"

    c.execute("""
        INSERT INTO complaints (
            public_id, department_code, organization_id, ward_id, category_id,
            language, original_text, english_summary, audio_path, channel,
            is_anonymous, citizen_name, citizen_phone_hash, assigned_officer_id,
            priority_score, duplicate_count, status, sla_deadline, escalation_level,
            is_overdue, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'ASSIGNED', ?, 1, 0, ?, ?)
    """, (
        public_id, dept_code, req.organization_id, req.ward_id, cat_id,
        req.language, req.text, eng_summary, req.audio_path, req.channel,
        1 if req.is_anonymous else 0,
        "Anonymous Citizen" if req.is_anonymous else req.citizen_name,
        phone_hash, assigned_officer_id, initial_priority,
        deadline_iso, now_str, now_str
    ))
    complaint_db_id = c.lastrowid

    # 8. Action & Audit Records
    c.execute("""
        INSERT INTO actions (complaint_id, officer_id, action_type, old_status, new_status, notes, created_at)
        VALUES (?, ?, 'STATUS_CHANGE', 'SUBMITTED', 'ASSIGNED', ?, ?)
    """, (complaint_db_id, assigned_officer_id, f"Routed to {officer_name} ({officer_desig})", now_str))

    audit_append(conn, "complaint", complaint_db_id, "CREATED", "CITIZEN", {
        "public_id": public_id,
        "department": dept_code,
        "category": cat_name,
        "priority": initial_priority,
        "channel": req.channel
    })

    # 9. Send Notification Acknowledgement
    send_notification(conn, complaint_db_id, phone_hash, "REGISTRATION_ACK", {
        "public_id": public_id,
        "category_name": cat_name,
        "deadline": deadline_iso[:16].replace("T", " ")
    }, language=req.language)

    conn.commit()
    conn.close()

    return {
        "is_emergency": False,
        "is_duplicate": False,
        "public_id": public_id,
        "complaint_id": complaint_db_id,
        "category_name": cat_name,
        "category_kannada": cat_kn_name,
        "responsible_authority": f"{officer_name} ({officer_desig})",
        "organization_name": org_name,
        "deadline": deadline_iso[:16].replace("T", " "),
        "priority_score": initial_priority,
        "kannada_ack": f"ಜನಧ್ವನಿ: ನಿಮ್ಮ ದೂರು #{public_id} ಯಶಸ್ವಿಯಾಗಿ ದಾಖಲಾಗಿದೆ. ನಿಗದಿತ ಪರಿಹಾರ ದಿನಾಂಕ: {deadline_iso[:16].replace('T', ' ')}. ಪರಿಶೀಲಿಸಲು: janadhwani.gov.in/status",
        "english_ack": f"JanaDhwani: Your grievance #{public_id} is registered. Responsible authority: {officer_name}. Resolution deadline: {deadline_iso[:16].replace('T', ' ')}."
    }

@router.get("/{public_id}/status")
def get_complaint_status(public_id: str):
    """
    Public lookup by ID with Kannada and English audio-friendly status synthesis text.
    Never exposes citizen phone number or private identity.
    """
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        SELECT c.id, c.public_id, c.department_code, c.language, c.original_text,
               c.english_summary, c.channel, c.status, c.priority_score,
               c.duplicate_count, c.sla_deadline, c.escalation_level, c.is_overdue,
               c.snooze_reason, c.resolution_notes, c.resolution_photo_url,
               c.verified_by_citizen, c.created_at, c.updated_at,
               o.name as org_name, o.kannada_name as org_kn_name,
               w.name as ward_name, cat.name as cat_name, cat.kannada_name as cat_kn_name,
               off.name as officer_name, off.designation as officer_desig
        FROM complaints c
        JOIN organizations o ON c.organization_id = o.id
        LEFT JOIN wards w ON c.ward_id = w.id
        JOIN categories cat ON c.category_id = cat.id
        LEFT JOIN officers off ON c.assigned_officer_id = off.id
        WHERE c.public_id = ?
    """, (public_id.strip(),))
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Complaint ID not found")

    comp = dict(row)

    # Fetch action timeline
    c.execute("""
        SELECT a.action_type, a.new_status, a.notes, a.photo_url, a.created_at,
               off.name as officer_name, off.designation
        FROM actions a
        LEFT JOIN officers off ON a.officer_id = off.id
        WHERE a.complaint_id = ?
        ORDER BY a.id ASC
    """, (comp["id"],))
    actions = [dict(a) for a in c.fetchall()]

    conn.close()

    # Build audio-friendly explanation in Kannada and English
    status_label_kn = {
        "SUBMITTED": "ದಾಖಲಾಗಿದೆ",
        "ASSIGNED": "ಅಧಿಕಾರಿಗೆ ನಿಯೋಜಿಸಲಾಗಿದೆ",
        "IN_PROGRESS": "ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ ಮತ್ತು ಕಾಮಗಾರಿ ಪ್ರಗತಿಯಲ್ಲಿದೆ",
        "RESOLVED": "ಪರಿಹರಿಸಲಾಗಿದೆ, ನಿಮ್ಮ ದೃಢೀಕರಣ ಬಾಕಿ ಇದೆ",
        "CLOSED": "ಯಶಸ್ವಿಯಾಗಿ ಮುಕ್ತಾಯಗೊಂಡಿದೆ",
        "ESCALATED": "ಗಡುವು ಮೀರಿದ್ದರಿಂದ ಉನ್ನತಾಧಿಕಾರಿಗಳಿಗೆ ವರ್ಗಾವಣೆಯಾಗಿದೆ",
        "REOPENED": "ನಾಗರಿಕರ ಅಸಮ್ಮತಿಯ ಮೇರೆಗೆ ಮರುತೆರೆಯಲಾಗಿದೆ"
    }.get(comp["status"], comp["status"])

    audio_text_kn = f"ದೂರು ಸಂಖ್ಯೆ {comp['public_id']}. ಸ್ಥಿತಿ: {status_label_kn}. ಜವಾಬ್ದಾರಿಯುತ ಅಧಿಕಾರಿ: {comp['officer_name'] or 'ವಿಭಾಗೀಯ ಅಧಿಕಾರಿ'}. ನಿಗದಿತ ಪರಿಹಾರ ದಿನಾಂಕ: {comp['sla_deadline'][:10]}."
    audio_text_en = f"Grievance ID {comp['public_id']}. Status: {comp['status']}. Assigned to: {comp['officer_name'] or 'Duty Officer'} ({comp['officer_desig'] or ''}). Resolution target: {comp['sla_deadline'][:10]}."

    return {
        "complaint": comp,
        "timeline": actions,
        "audio_text_kn": audio_text_kn,
        "audio_text_en": audio_text_en
    }

@router.post("/{public_id}/verify")
def verify_complaint_resolution(public_id: str, req: CitizenVerifyRequest):
    """
    Citizen Verification Flow:
    - confirm: Closes complaint permanently.
    - reject: Reopens complaint, sets status to REOPENED, and escalates to Level 2 supervisor.
    """
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT id, status, organization_id, citizen_phone_hash, language FROM complaints WHERE public_id = ?", (public_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Complaint not found")

    comp_id, current_status, org_id, phone_hash, lang = row[0], row[1], row[2], row[3], row[4]
    now_str = now_iso()

    if req.action.lower() == "confirm":
        c.execute("""
            UPDATE complaints
            SET verified_by_citizen = 1,
                verification_notes = ?,
                status = 'CLOSED',
                updated_at = ?
            WHERE id = ?
        """, (req.notes or "Citizen confirmed problem is resolved", now_str, comp_id))

        c.execute("""
            INSERT INTO actions (complaint_id, action_type, old_status, new_status, notes, created_at)
            VALUES (?, 'VERIFIED', ?, 'CLOSED', 'Citizen confirmed resolution in verification portal', ?)
        """, (comp_id, current_status, now_str))

        audit_append(conn, "complaint", comp_id, "VERIFIED_CLOSED", "CITIZEN", {
            "public_id": public_id,
            "action": "confirm",
            "notes": req.notes
        })
        send_notification(conn, comp_id, phone_hash, "VERIFIED_CLOSED", {"public_id": public_id}, language=lang)
        conn.commit()
        conn.close()
        return {"status": "SUCCESS", "message": "Grievance successfully verified and closed. Thank you!"}

    elif req.action.lower() == "reject":
        # Find Level 2 supervisor
        c.execute("SELECT id FROM officers WHERE organization_id = ? AND level = 2 LIMIT 1", (org_id,))
        sup_row = c.fetchone()
        sup_id = sup_row[0] if sup_row else 1

        c.execute("""
            UPDATE complaints
            SET verified_by_citizen = 0,
                verification_notes = ?,
                status = 'REOPENED',
                escalation_level = 2,
                assigned_officer_id = ?,
                updated_at = ?
            WHERE id = ?
        """, (req.notes or "Citizen reported issue persists after claimed resolution", sup_id, now_str, comp_id))

        c.execute("""
            INSERT INTO actions (complaint_id, officer_id, action_type, old_status, new_status, notes, created_at)
            VALUES (?, ?, 'REOPENED', ?, 'REOPENED', ?, ?)
        """, (comp_id, sup_id, current_status, f"Citizen rejected resolution: {req.notes or 'Issue persists'}", now_str))

        audit_append(conn, "complaint", comp_id, "VERIFIED_REOPENED", "CITIZEN", {
            "public_id": public_id,
            "action": "reject",
            "reassigned_to_supervisor": sup_id,
            "notes": req.notes
        })
        send_notification(conn, comp_id, phone_hash, "VERIFIED_REOPENED", {"public_id": public_id}, language=lang)
        conn.commit()
        conn.close()
        return {"status": "REOPENED", "message": "Grievance reopened and escalated to Medical Superintendent / CI."}

    else:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid action. Must be 'confirm' or 'reject'.")

@router.post("/{public_id}/rating")
def rate_complaint_resolution(public_id: str, req: CitizenRatingRequest):
    """Stores 1-5 star citizen rating for transparency dashboard."""
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT id FROM complaints WHERE public_id = ?", (public_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Complaint not found")
    comp_id = row[0]

    c.execute("""
        INSERT INTO ratings (complaint_id, stars, feedback_text, created_at)
        VALUES (?, ?, ?, ?)
    """, (comp_id, req.stars, req.feedback, now_iso()))
    conn.commit()
    conn.close()
    return {"status": "SUCCESS", "message": f"Rating of {req.stars} stars recorded. Thank you for your feedback!"}
