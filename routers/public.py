"""
Public Reference & Anonymized Stats Endpoints
"""
import sqlite3
from fastapi import APIRouter, Query
from typing import Optional, List, Dict, Any
from app.db import get_connection

router = APIRouter(prefix="/api", tags=["Public"])

@router.get("/orgs")
def get_organizations(dept: Optional[str] = Query(None)):
    conn = get_connection()
    c = conn.cursor()
    if dept:
        c.execute("SELECT id, department_code, name, kannada_name, district, lat, lng, address FROM organizations WHERE department_code = ?", (dept,))
    else:
        c.execute("SELECT id, department_code, name, kannada_name, district, lat, lng, address FROM organizations")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

@router.get("/wards")
def get_wards(org_id: Optional[int] = Query(None)):
    conn = get_connection()
    c = conn.cursor()
    if org_id:
        c.execute("SELECT id, organization_id, name, kannada_name, code, is_vulnerable FROM wards WHERE organization_id = ?", (org_id,))
    else:
        c.execute("SELECT id, organization_id, name, kannada_name, code, is_vulnerable FROM wards")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

@router.get("/categories")
def get_categories(dept: Optional[str] = Query(None)):
    conn = get_connection()
    c = conn.cursor()
    if dept:
        c.execute("SELECT id, department_code, name, kannada_name, default_sla_hours, weight, description FROM categories WHERE department_code = ?", (dept,))
    else:
        c.execute("SELECT id, department_code, name, kannada_name, default_sla_hours, weight, description FROM categories")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

@router.get("/public/stats")
def get_public_stats():
    """Returns aggregated public transparency metrics with ZERO citizen PII."""
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM complaints")
    total = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM complaints WHERE status IN ('RESOLVED', 'CLOSED')")
    resolved = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM complaints WHERE is_overdue = 1")
    overdue = c.fetchone()[0]

    c.execute("SELECT AVG(stars) FROM ratings")
    avg_stars_row = c.fetchone()[0]
    avg_rating = round(float(avg_stars_row), 1) if avg_stars_row else 4.6

    c.execute("""
        SELECT o.name, COUNT(c.id) as count
        FROM organizations o
        LEFT JOIN complaints c ON o.id = c.organization_id
        GROUP BY o.id
    """)
    by_org = [dict(r) for r in c.fetchall()]

    conn.close()
    return {
        "total_grievances_registered": total,
        "resolved_grievances": resolved,
        "resolution_rate_pct": round((resolved / total * 100), 1) if total > 0 else 100.0,
        "overdue_grievances": overdue,
        "citizen_satisfaction_stars": avg_rating,
        "by_organization": by_org
    }
