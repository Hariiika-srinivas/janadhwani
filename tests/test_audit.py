"""
Tests for SHA-256 Hash-Chained Audit Trail, Tamper Detection & Repair
"""
import pytest
from app.db import get_connection
from engine.audit import append, verify_chain, tamper_record, repair_chain

def test_audit_append_and_verify():
    conn = get_connection()
    is_valid, bad_id, msg = verify_chain(conn)
    assert is_valid is True, f"Initial chain should be valid: {msg}"

    # Append test record
    entry_hash = append(conn, "test_entity", 9999, "TEST_ACTION", "TEST_ACTOR", {"key": "value"})
    assert len(entry_hash) == 64

    # Verify chain is still valid
    is_valid, bad_id, msg = verify_chain(conn)
    assert is_valid is True
    conn.close()

def test_tamper_detection_and_repair():
    conn = get_connection()
    # 1. Deliberately tamper with last audit record
    success, tamper_msg = tamper_record()
    assert success is True

    # 2. Verify chain MUST detect tampering!
    is_valid, corrupted_id, err_msg = verify_chain(conn)
    assert is_valid is False, "Tamper detection must fail validation"
    assert corrupted_id is not None
    assert "Tamper detected" in err_msg or "Chain linkage broken" in err_msg

    # 3. Repair chain
    repair_success, repair_msg = repair_chain()
    assert repair_success is True

    # 4. Chain must be valid again
    is_valid_again, _, ok_msg = verify_chain(conn)
    assert is_valid_again is True, f"Repaired chain should be valid: {ok_msg}"
    conn.close()
