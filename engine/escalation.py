"""
SLA Tracking, Escalation & Officer-on-Leave Engine for JanaDhwani
Runs periodically (or on demand) to:
- Send 50% and 90% SLA reminders
- Detect overdue complaints
- Escalate unresolved complaints through L1 -> L2 -> L3 -> L4
- Reassign complaints when assigned officer is on leave
- Detect unopened complaints exceeding 25% SLA
"""
import sqlite3
from typing import Dict, Any, List
from engine.clock import now as get_current_time, now_iso
from engine.sla import get_sla_progress, is_overdue
from engine.notify import send_notification
from engine.audit import append as audit_append

def run_escalation_cycle(conn: sqlite3.Connection) -> Dict[str, Any]:
    """
    Executes a single end-to-end escalation and SLA monitoring pass.
    """
    current_time = get_current_time()
    cursor = conn.cursor()

    summary = {
        "reminders_50": 0,
        "reminders_90": 0,
        "overdue_count": 0,
        "escalated_l2": 0,
        "escalated_l3": 0,
        "escalated_l4": 0,
        "reassigned_on_leave": 0,
        "unopened_alerts": 0
    }

    # Fetch all active open complaints
    cursor.execute("""
        SELECT c.id, c.public_id, c.department_code, c.organization_id, c.category_id,
               c.assigned_officer_id, c.escalation_level, c.status, c.created_at,
               c.sla_deadline, c.opened_at, c.citizen_phone_hash, c.language,
               o.name as officer_name, o.level as officer_level, o.is_on_leave,
               o.substitute_officer_id, cat.name as category_name
        FROM complaints c
        LEFT JOIN officers o ON c.assigned_officer_id = o.id
        LEFT JOIN categories cat ON c.category_id = cat.id
        WHERE c.status NOT IN ('CLOSED', 'RESOLVED')
    """)
    complaints = cursor.fetchall()

    for comp in complaints:
        comp_id = comp[0]
        public_id = comp[1]
        dept_code = comp[2]
        org_id = comp[3]
        cat_id = comp[4]
        officer_id = comp[5]
        esc_level = comp[6]
        status = comp[7]
        created_at_iso = comp[8]
        deadline_iso = comp[9]
        opened_at = comp[10]
        phone_hash = comp[11]
        lang = comp[12]
        officer_name = comp[13] or "Assigned Officer"
        officer_level = comp[14] or 1
        is_on_leave = bool(comp[15])
        substitute_id = comp[16]
        cat_name = comp[17] or "General Grievance"

        progress = get_sla_progress(created_at_iso, deadline_iso, current_time)
        comp_is_overdue = is_overdue(deadline_iso, current_time)

        # -------------------------------------------------------------
        # 1. Officer On Leave Reassignment
        # -------------------------------------------------------------
        if is_on_leave and substitute_id and substitute_id != officer_id:
            cursor.execute("""
                UPDATE complaints
                SET assigned_officer_id = ?, updated_at = ?
                WHERE id = ?
            """, (substitute_id, now_iso(), comp_id))

            # Fetch substitute officer name
            cursor.execute("SELECT name FROM officers WHERE id = ?", (substitute_id,))
            sub_row = cursor.fetchone()
            sub_name = sub_row[0] if sub_row else "Substitute Officer"

            audit_append(conn, "complaint", comp_id, "REASSIGNED_ON_LEAVE", "SYSTEM", {
                "previous_officer_id": officer_id,
                "new_officer_id": substitute_id,
                "reason": "Assigned officer is marked on leave"
            })
            summary["reassigned_on_leave"] += 1
            officer_id = substitute_id
            officer_name = sub_name

        # -------------------------------------------------------------
        # 2. Check 50% SLA Reminder
        # -------------------------------------------------------------
        if progress >= 0.50 and progress < 0.90:
            cursor.execute("SELECT id FROM reminders WHERE complaint_id = ? AND reminder_type = '50_PCT_SLA'", (comp_id,))
            if not cursor.fetchone() and officer_id:
                cursor.execute("""
                    INSERT INTO reminders (complaint_id, officer_id, reminder_type, sent_at)
                    VALUES (?, ?, '50_PCT_SLA', ?)
                """, (comp_id, officer_id, now_iso()))
                send_notification(conn, comp_id, phone_hash, "REMINDER_50_PCT", {
                    "public_id": public_id,
                    "category_name": cat_name,
                    "deadline": deadline_iso[:16]
                }, language=lang)
                summary["reminders_50"] += 1

        # -------------------------------------------------------------
        # 3. Check 90% SLA Reminder
        # -------------------------------------------------------------
        if progress >= 0.90:
            cursor.execute("SELECT id FROM reminders WHERE complaint_id = ? AND reminder_type = '90_PCT_SLA'", (comp_id,))
            if not cursor.fetchone() and officer_id:
                cursor.execute("""
                    INSERT INTO reminders (complaint_id, officer_id, reminder_type, sent_at)
                    VALUES (?, ?, '90_PCT_SLA', ?)
                """, (comp_id, officer_id, now_iso()))
                send_notification(conn, comp_id, phone_hash, "REMINDER_90_PCT", {
                    "public_id": public_id,
                    "category_name": cat_name,
                    "deadline": deadline_iso[:16]
                }, language=lang)
                summary["reminders_90"] += 1

        # -------------------------------------------------------------
        # 4. Check Unopened Complaint within 25% SLA
        # -------------------------------------------------------------
        if opened_at is None and progress >= 0.25:
            cursor.execute("SELECT id FROM reminders WHERE complaint_id = ? AND reminder_type = 'UNOPENED_25_PCT'", (comp_id,))
            if not cursor.fetchone() and officer_id:
                cursor.execute("""
                    INSERT INTO reminders (complaint_id, officer_id, reminder_type, sent_at)
                    VALUES (?, ?, 'UNOPENED_25_PCT', ?)
                """, (comp_id, officer_id, now_iso()))
                audit_append(conn, "complaint", comp_id, "UNOPENED_ALERT", "SYSTEM", {
                    "progress": round(progress, 2),
                    "note": "Officer did not open complaint within 25% of SLA window"
                })
                summary["unopened_alerts"] += 1

        # -------------------------------------------------------------
        # 5. Overdue Detection & Hierarchical Escalation (L1 -> L2 -> L3 -> L4)
        # -------------------------------------------------------------
        if comp_is_overdue:
            summary["overdue_count"] += 1
            # Mark overdue in database
            cursor.execute("UPDATE complaints SET is_overdue = 1 WHERE id = ?", (comp_id,))

            # Determine appropriate escalation level based on overdue severity
            # If overdue < 24h -> L2 (Superintendent / CI)
            # If overdue >= 24h and < 48h -> L3 (DHO / DySP)
            # If overdue >= 48h -> L4 (Commissioner / SP)
            target_level = 2
            if progress >= 2.0: # Overdue by double the SLA duration
                target_level = 4
            elif progress >= 1.5:
                target_level = 3

            if target_level > esc_level:
                # Find higher level officer in same organization or district
                cursor.execute("""
                    SELECT id, name, designation FROM officers
                    WHERE organization_id = ? AND level = ?
                    LIMIT 1
                """, (org_id, target_level))
                next_officer = cursor.fetchone()

                if not next_officer:
                    # Fallback to any officer of that level in department
                    cursor.execute("""
                        SELECT o.id, o.name, o.designation
                        FROM officers o
                        JOIN organizations org ON o.organization_id = org.id
                        WHERE org.department_code = ? AND o.level = ?
                        LIMIT 1
                    """, (dept_code, target_level))
                    next_officer = cursor.fetchone()

                if next_officer:
                    next_id, next_name, next_desig = next_officer[0], next_officer[1], next_officer[2]
                    cursor.execute("""
                        UPDATE complaints
                        SET escalation_level = ?,
                            assigned_officer_id = ?,
                            status = 'ESCALATED',
                            updated_at = ?
                        WHERE id = ?
                    """, (target_level, next_id, now_iso(), comp_id))

                    template_key = f"ESCALATED_L{target_level}"
                    send_notification(conn, comp_id, phone_hash, template_key, {
                        "public_id": public_id,
                        "officer_name": next_name,
                        "designation": next_desig
                    }, language=lang)

                    audit_append(conn, "complaint", comp_id, f"ESCALATED_TO_L{target_level}", "SYSTEM", {
                        "previous_level": esc_level,
                        "new_level": target_level,
                        "escalated_to_officer": next_name,
                        "reason": f"SLA breached (progress: {round(progress, 2)}x)"
                    })

                    if target_level == 2:
                        summary["escalated_l2"] += 1
                    elif target_level == 3:
                        summary["escalated_l3"] += 1
                    elif target_level == 4:
                        summary["escalated_l4"] += 1

    conn.commit()
    return summary
