"""
Duplicate Grievance Detection & Clustering Engine for JanaDhwani
Matches complaints within 72 hours for the same org, category, and ward.
"""
import sqlite3
from typing import Optional, Tuple
from datetime import datetime, timezone, timedelta
from engine.clock import now as get_current_time
from engine.priority import calculate_priority
from engine.sla import get_sla_progress

def find_duplicate_cluster(
    conn: sqlite3.Connection,
    organization_id: int,
    category_id: int,
    ward_id: Optional[int] = None
) -> Optional[Tuple[int, int]]:
    """
    Checks if an open grievance exists with the same org, category, and ward within 72h.
    Returns (parent_complaint_id, existing_duplicate_count) or None.
    """
    cursor = conn.cursor()
    current_time = get_current_time()
    cutoff_time = (current_time - timedelta(hours=72)).isoformat()

    # Query for matching open complaints
    if ward_id is not None:
        query = """
            SELECT id, duplicate_count, created_at, sla_deadline, category_id
            FROM complaints
            WHERE organization_id = ?
              AND category_id = ?
              AND ward_id = ?
              AND status NOT IN ('CLOSED', 'RESOLVED')
              AND created_at >= ?
            ORDER BY id ASC
            LIMIT 1
        """
        cursor.execute(query, (organization_id, category_id, ward_id, cutoff_time))
    else:
        query = """
            SELECT id, duplicate_count, created_at, sla_deadline, category_id
            FROM complaints
            WHERE organization_id = ?
              AND category_id = ?
              AND status NOT IN ('CLOSED', 'RESOLVED')
              AND created_at >= ?
            ORDER BY id ASC
            LIMIT 1
        """
        cursor.execute(query, (organization_id, category_id, cutoff_time))

    row = cursor.fetchone()
    if row:
        return (row[0], row[1])
    return None

def attach_duplicate(
    conn: sqlite3.Connection,
    parent_id: int,
    new_duplicate_count: int,
    is_vulnerable_ward: bool = False,
    sentiment: str = "NEGATIVE"
) -> int:
    """
    Updates parent complaint's duplicate count and recomputes its priority score.
    Returns the new priority score.
    """
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.created_at, c.sla_deadline, cat.weight
        FROM complaints c
        JOIN categories cat ON c.category_id = cat.id
        WHERE c.id = ?
    """, (parent_id,))
    row = cursor.fetchone()
    if not row:
        return 50

    created_at_iso, sla_deadline_iso, cat_weight = row[0], row[1], row[2]
    progress = get_sla_progress(created_at_iso, sla_deadline_iso)
    new_priority = calculate_priority(
        category_weight=cat_weight,
        duplicate_count=new_duplicate_count,
        sla_progress=progress,
        is_vulnerable_ward=is_vulnerable_ward,
        sentiment=sentiment
    )

    cursor.execute("""
        UPDATE complaints
        SET duplicate_count = ?,
            priority_score = ?,
            updated_at = datetime('now')
        WHERE id = ?
    """, (new_duplicate_count, new_priority, parent_id))
    conn.commit()

    return new_priority
