"""
Tamper-Evident SHA-256 Hash-Chained Audit Trail for JanaDhwani
"""
import hashlib
import json
import sqlite3
from typing import Dict, Any, Tuple, Optional
from engine.clock import now_iso
from app.db import get_connection

GENESIS_HASH = "0" * 64

def calculate_entry_hash(prev_hash: str, entity_type: str, entity_id: int, action: str, actor_id: str, payload_json: str, timestamp: str) -> str:
    """Computes SHA-256 hash of audit entry components."""
    content = f"{prev_hash}|{entity_type}|{entity_id}|{action}|{actor_id}|{payload_json}|{timestamp}"
    return hashlib.sha256(content.encode("utf-8")).hexdigest()

def append(conn: sqlite3.Connection, entity_type: str, entity_id: int, action: str, actor_id: str, payload: Dict[str, Any]) -> str:
    """
    Appends a new immutable, hash-chained record to the audit_log.
    Returns the generated entry_hash.
    """
    cursor = conn.cursor()
    cursor.execute("SELECT entry_hash FROM audit_log ORDER BY id DESC LIMIT 1")
    last_row = cursor.fetchone()
    prev_hash = last_row[0] if last_row else GENESIS_HASH

    timestamp = now_iso()
    payload_json = json.dumps(payload, sort_keys=True)
    entry_hash = calculate_entry_hash(prev_hash, entity_type, entity_id, action, actor_id, payload_json, timestamp)

    cursor.execute(
        "INSERT INTO audit_log (prev_hash, entry_hash, entity_type, entity_id, action, actor_id, payload_json, timestamp) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (prev_hash, entry_hash, entity_type, entity_id, action, actor_id, payload_json, timestamp)
    )
    conn.commit()
    return entry_hash

def verify_chain(conn: Optional[sqlite3.Connection] = None) -> Tuple[bool, Optional[int], str]:
    """
    Verifies the integrity of the audit log hash chain.
    Returns (is_valid, corrupted_record_id, message).
    """
    should_close = False
    if conn is None:
        conn = get_connection()
        should_close = True

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, prev_hash, entry_hash, entity_type, entity_id, action, actor_id, payload_json, timestamp FROM audit_log ORDER BY id ASC")
        rows = cursor.fetchall()

        if not rows:
            return (True, None, "Audit chain is empty. Verified.")

        expected_prev = GENESIS_HASH
        for row in rows:
            rec_id = row["id"] if isinstance(row, sqlite3.Row) else row[0]
            prev_hash = row["prev_hash"] if isinstance(row, sqlite3.Row) else row[1]
            entry_hash = row["entry_hash"] if isinstance(row, sqlite3.Row) else row[2]
            entity_type = row["entity_type"] if isinstance(row, sqlite3.Row) else row[3]
            entity_id = row["entity_id"] if isinstance(row, sqlite3.Row) else row[4]
            action = row["action"] if isinstance(row, sqlite3.Row) else row[5]
            actor_id = row["actor_id"] if isinstance(row, sqlite3.Row) else row[6]
            payload_json = row["payload_json"] if isinstance(row, sqlite3.Row) else row[7]
            timestamp = row["timestamp"] if isinstance(row, sqlite3.Row) else row[8]

            # 1. Check prev_hash linkage
            if prev_hash != expected_prev:
                return (False, rec_id, f"Chain linkage broken at record #{rec_id}: expected prev_hash {expected_prev[:8]}..., found {prev_hash[:8]}...")

            # 2. Recompute entry hash
            computed = calculate_entry_hash(prev_hash, entity_type, entity_id, action, actor_id, payload_json, timestamp)
            if computed != entry_hash:
                return (False, rec_id, f"Tamper detected in record #{rec_id}: computed hash {computed[:8]}... does not match recorded {entry_hash[:8]}...")

            expected_prev = entry_hash

        return (True, None, f"All {len(rows)} audit records verified successfully. Chain is unbroken.")
    finally:
        if should_close:
            conn.close()

def tamper_record(record_id: Optional[int] = None) -> Tuple[bool, str]:
    """
    Simulates malicious tampering by altering an audit entry payload.
    Used for live hackathon demonstration of tamper detection.
    """
    conn = get_connection()
    cursor = conn.cursor()
    if record_id is None:
        cursor.execute("SELECT id FROM audit_log ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
        if not row:
            conn.close()
            return False, "No records to tamper."
        record_id = row[0]

    cursor.execute("SELECT payload_json FROM audit_log WHERE id = ?", (record_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False, f"Record #{record_id} not found."

    original_payload = json.loads(row[0])
    original_payload["TAMPERED_BY_DEMO"] = True
    original_payload["notes"] = "MALICIOUS MODIFICATION IN DATABASE"
    tampered_json = json.dumps(original_payload, sort_keys=True)

    cursor.execute("UPDATE audit_log SET payload_json = ? WHERE id = ?", (tampered_json, record_id))
    conn.commit()
    conn.close()
    return True, f"Record #{record_id} payload tampered. Verify chain will now detect corruption!"

def repair_chain() -> Tuple[bool, str]:
    """
    Recalculates valid cryptographic hash chain across all records.
    Used for live hackathon demonstration of chain healing/audit recovery.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, prev_hash, entry_hash, entity_type, entity_id, action, actor_id, payload_json, timestamp FROM audit_log ORDER BY id ASC")
    rows = cursor.fetchall()
    if not rows:
        conn.close()
        return True, "No records to repair."

    expected_prev = GENESIS_HASH
    for row in rows:
        rec_id = row["id"] if isinstance(row, sqlite3.Row) else row[0]
        entity_type = row["entity_type"] if isinstance(row, sqlite3.Row) else row[3]
        entity_id = row["entity_id"] if isinstance(row, sqlite3.Row) else row[4]
        action = row["action"] if isinstance(row, sqlite3.Row) else row[5]
        actor_id = row["actor_id"] if isinstance(row, sqlite3.Row) else row[6]
        payload_json = row["payload_json"] if isinstance(row, sqlite3.Row) else row[7]
        timestamp = row["timestamp"] if isinstance(row, sqlite3.Row) else row[8]

        computed = calculate_entry_hash(expected_prev, entity_type, entity_id, action, actor_id, payload_json, timestamp)
        cursor.execute("UPDATE audit_log SET prev_hash = ?, entry_hash = ? WHERE id = ?", (expected_prev, computed, rec_id))
        expected_prev = computed

    conn.commit()
    conn.close()
    return True, f"Repaired cryptographic chain for {len(rows)} audit records."
