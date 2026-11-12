"""
Tests for SLA Deadline, Holiday Skipping, Reminders, and Escalation Engine
"""
import pytest
from datetime import datetime, timezone, timedelta
from app.db import get_connection
from engine.sla import calculate_deadline, is_overdue, get_sla_progress
from engine.escalation import run_escalation_cycle

def test_sunday_and_holiday_skipping():
    conn = get_connection()
    # Let start time be Saturday morning 2026-01-24 10:00:00 UTC
    # 2026-01-25 is Sunday (skipped)
    # 2026-01-26 is Republic Day (holiday in database, skipped)
    # Therefore, a 24-hour SLA should extend across Monday and complete on Tuesday!
    start_dt = datetime(2026, 1, 24, 10, 0, 0, tzinfo=timezone.utc)
    deadline = calculate_deadline(start_dt, sla_hours=24, conn=conn)

    # Saturday has 14 hours remaining (10:00 to 24:00)
    # Sunday 2026-01-25 has 0 hours (Sunday skipped)
    # Monday 2026-01-26 has 0 hours (Republic day skipped)
    # Tuesday 2026-01-27 provides the remaining 10 hours -> finishes at 10:00 on Tuesday
    assert deadline.weekday() == 1 # Tuesday
    assert deadline.strftime("%Y-%m-%d") == "2026-01-27"
    conn.close()

def test_overdue_and_progress():
    now_dt = datetime.now(timezone.utc)
    past_deadline = (now_dt - timedelta(hours=5)).isoformat()
    future_deadline = (now_dt + timedelta(hours=10)).isoformat()

    assert is_overdue(past_deadline, now_dt) is True
    assert is_overdue(future_deadline, now_dt) is False

    created_iso = (now_dt - timedelta(hours=10)).isoformat()
    # 10 hours elapsed out of 20 hours total = 0.5 (50%)
    deadline_20h = (now_dt + timedelta(hours=10)).isoformat()
    progress = get_sla_progress(created_iso, deadline_20h, now_dt)
    assert 0.45 <= progress <= 0.55

def test_escalation_cycle_execution():
    conn = get_connection()
    # Mark officer 1 on leave to test reassignment
    cursor = conn.cursor()
    cursor.execute("UPDATE officers SET is_on_leave = 1, substitute_officer_id = 2 WHERE id = 1")
    conn.commit()

    summary = run_escalation_cycle(conn)
    assert isinstance(summary, dict)
    assert "reminders_50" in summary
    assert "reminders_90" in summary
    assert "overdue_count" in summary
    assert "reassigned_on_leave" in summary
    conn.close()
