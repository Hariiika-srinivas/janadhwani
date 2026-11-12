"""
Hackathon Demonstration Control Router
Provides time travel, escalation triggers, audit tampering & repair for live judges.
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

from app.db import get_connection
from app.seed import seed_database
from engine.clock import advance_hours, reset as reset_clock, now_iso, get_db_offset
from engine.escalation import run_escalation_cycle
from engine.audit import verify_chain, tamper_record, repair_chain

router = APIRouter(prefix="/api/demo", tags=["Demo Controls"])

class AdvanceTimeRequest(BaseModel):
    hours: float = Field(24.0, description="Hours to advance simulated system clock")

@router.post("/advance-time")
def advance_simulated_time(req: AdvanceTimeRequest):
    """
    Advances system time by X hours and runs the escalation cycle.
    Demonstrates SLA breaches and hierarchical escalations in real-time.
    """
    new_offset = advance_hours(req.hours)
    conn = get_connection()
    summary = run_escalation_cycle(conn)
    conn.close()

    return {
        "status": "SUCCESS",
        "advanced_hours": req.hours,
        "total_offset_hours": round(new_offset / 3600, 1),
        "current_simulated_time": now_iso(),
        "escalation_summary": summary
    }

@router.post("/reset-time")
def reset_simulated_time():
    """Resets system clock back to real current time."""
    reset_clock()
    return {
        "status": "SUCCESS",
        "message": "Simulated clock reset to real system time.",
        "current_time": now_iso()
    }

@router.post("/run-cycle")
def trigger_escalation_cycle():
    """Manually triggers an SLA check and escalation pass."""
    conn = get_connection()
    summary = run_escalation_cycle(conn)
    conn.close()
    return {
        "status": "SUCCESS",
        "summary": summary
    }

@router.post("/reseed")
def reseed_demo_data():
    """Resets database and re-seeds with clean demo data."""
    seed_database(reset=True)
    return {
        "status": "SUCCESS",
        "message": "Database reset and re-seeded with 40 complaints and verified audit chains."
    }

@router.post("/tamper-audit")
def demo_tamper_audit(record_id: Optional[int] = None):
    """
    Deliberately corrupts an audit log payload to demonstrate
    real-time tamper detection to hackathon judges.
    """
    success, msg = tamper_record(record_id)
    return {
        "status": "SUCCESS" if success else "FAILED",
        "message": msg
    }

@router.post("/repair-audit")
def demo_repair_audit():
    """
    Recalculates cryptographic SHA-256 chain to restore database integrity.
    """
    success, msg = repair_chain()
    return {
        "status": "SUCCESS" if success else "FAILED",
        "message": msg
    }

@router.get("/audit-verify")
def check_audit_verification():
    """Verifies SHA-256 chain integrity."""
    conn = get_connection()
    is_valid, corrupted_id, msg = verify_chain(conn)
    conn.close()
    return {
        "is_valid": is_valid,
        "corrupted_record_id": corrupted_id,
        "message": msg
    }
