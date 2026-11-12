"""
Tests for Deduplication & Priority Engine
"""
import pytest
from app.db import get_connection
from engine.priority import calculate_priority
from engine.dedupe import find_duplicate_cluster, attach_duplicate

def test_priority_calculation():
    # Base calculation
    base_p = calculate_priority(category_weight=70, duplicate_count=1, sla_progress=0.1, is_vulnerable_ward=False)
    assert 25 <= base_p <= 45

    # With vulnerable ward (+25 points)
    vuln_p = calculate_priority(category_weight=70, duplicate_count=1, sla_progress=0.1, is_vulnerable_ward=True)
    assert vuln_p >= base_p + 20

    # With 30 duplicates (+30 max boost)
    high_dup_p = calculate_priority(category_weight=70, duplicate_count=30, sla_progress=0.1, is_vulnerable_ward=False)
    assert high_dup_p >= base_p + 25

    # With overdue SLA
    overdue_p = calculate_priority(category_weight=70, duplicate_count=1, sla_progress=1.5, is_vulnerable_ward=False)
    assert overdue_p >= base_p + 15

def test_dedupe_clustering():
    conn = get_connection()
    # Check existing seed complaint in Org 1, Cat 4, Ward 1 (Maternity)
    dup = find_duplicate_cluster(conn, organization_id=1, category_id=4, ward_id=1)
    assert dup is not None
    parent_id, count = dup
    assert parent_id > 0
    assert count >= 1

    # Attach duplicate and verify priority increases
    new_priority = attach_duplicate(conn, parent_id=parent_id, new_duplicate_count=count + 1, is_vulnerable_ward=True)
    assert new_priority >= 50
    conn.close()
