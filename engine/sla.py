"""
SLA Deadline Calculator for JanaDhwani
Calculates resolution deadlines while skipping Sundays and configured public holidays.
"""
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import Optional, Set
from app.config import DB_PATH
from engine.clock import now as get_current_time

def get_holiday_dates(conn: Optional[sqlite3.Connection] = None) -> Set[str]:
    """Fetch all configured public holiday dates (YYYY-MM-DD)."""
    should_close = False
    if conn is None:
        try:
            conn = sqlite3.connect(DB_PATH)
            should_close = True
        except Exception:
            return set()

    holiday_set = set()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT date FROM holidays")
        for row in cursor.fetchall():
            holiday_set.add(row[0])
    except Exception:
        pass
    finally:
        if should_close:
            conn.close()

    return holiday_set

def calculate_deadline(start_dt: Optional[datetime], sla_hours: int, conn: Optional[sqlite3.Connection] = None) -> datetime:
    """
    Calculates SLA resolution deadline.
    Skips Sundays and official public holidays.
    Each active day accounts for business resolution progress.
    """
    if start_dt is None:
        start_dt = get_current_time()

    holidays = get_holiday_dates(conn)

    current_dt = start_dt
    hours_left = sla_hours

    # Advance hour by hour, checking if current date is Sunday or Holiday
    while hours_left > 0:
        current_dt += timedelta(hours=1)
        # Check if the day is a Sunday (weekday == 6)
        if current_dt.weekday() == 6:
            continue
        # Check if current date is a registered holiday
        date_str = current_dt.strftime("%Y-%m-%d")
        if date_str in holidays:
            continue
        hours_left -= 1

    return current_dt

def is_overdue(deadline_iso: str, current_dt: Optional[datetime] = None) -> bool:
    """Checks if a given deadline string is past the current simulated time."""
    if current_dt is None:
        current_dt = get_current_time()
    try:
        deadline = datetime.fromisoformat(deadline_iso.replace("Z", "+00:00"))
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        return current_dt > deadline
    except Exception:
        return False

def get_sla_progress(created_at_iso: str, deadline_iso: str, current_dt: Optional[datetime] = None) -> float:
    """
    Returns float from 0.0 to 1.0+ representing proportion of SLA consumed.
    >= 1.0 means overdue.
    """
    if current_dt is None:
        current_dt = get_current_time()
    try:
        start = datetime.fromisoformat(created_at_iso.replace("Z", "+00:00"))
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        end = datetime.fromisoformat(deadline_iso.replace("Z", "+00:00"))
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)

        total_duration = (end - start).total_seconds()
        if total_duration <= 0:
            return 1.0
        elapsed = (current_dt - start).total_seconds()
        return max(0.0, elapsed / total_duration)
    except Exception:
        return 0.5
