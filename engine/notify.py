"""
Notification Engine for JanaDhwani
Stores mock SMS and Telegram notifications with Kannada and English templates.
"""
import sqlite3
from typing import Dict, Any, Optional
from engine.clock import now_iso

NOTIFICATION_TEMPLATES = {
    "REGISTRATION_ACK": {
        "kn": "ಜನಧ್ವನಿ: ನಿಮ್ಮ ದೂರು #{public_id} ಯಶಸ್ವಿಯಾಗಿ ದಾಖಲಾಗಿದೆ. ವಿಭಾಗ: {category_name}. ನಿಗದಿತ ಪರಿಹಾರ ದಿನಾಂಕ: {deadline}. ಪರಿಶೀಲಿಸಲು: janadhwani.gov.in/status",
        "en": "JanaDhwani: Your grievance #{public_id} is registered. Category: {category_name}. Resolution deadline: {deadline}. Track at: janadhwani.gov.in/status"
    },
    "OFFICER_ASSIGNED": {
        "kn": "ಜನಧ್ವನಿ: ನಿಮ್ಮ ದೂರು #{public_id} ಅನ್ನು ಅಧಿಕಾರಿ {officer_name} ({designation}) ಅವರಿಗೆ ನಿಯೋಜಿಸಲಾಗಿದೆ.",
        "en": "JanaDhwani: Your grievance #{public_id} has been assigned to Officer {officer_name} ({designation})."
    },
    "REMINDER_50_PCT": {
        "kn": "ಎಚ್ಚರಿಕೆ: ದೂರು #{public_id} ಗೆ 50% ಗಡುವು ಮುಗಿದಿದೆ. ಶೀಘ್ರ ಕ್ರಮ ಕೈಗೊಳ್ಳಿ.",
        "en": "Alert: 50% SLA elapsed for complaint #{public_id}. Please take action."
    },
    "REMINDER_90_PCT": {
        "kn": "ಅತಿ ತುರ್ತು ಎಚ್ಚರಿಕೆ: ದೂರು #{public_id} ಗೆ 90% ಗಡುವು ಮುಗಿದಿದೆ. ವಿಳಂಬವಾದರೆ ಉನ್ನತಾಧಿಕಾರಿಗಳಿಗೆ ವರ್ಗಾವಣೆಯಾಗುವುದು.",
        "en": "Critical Alert: 90% SLA elapsed for complaint #{public_id}. Pending auto-escalation."
    },
    "ESCALATED_L2": {
        "kn": "ಜನಧ್ವನಿ: ನಿಗದಿತ ಅವಧಿಯಲ್ಲಿ ಪರಿಹಾರವಾಗದ ಕಾರಣ ದೂರು #{public_id} ವೈದ್ಯಕೀಯ ಅಧೀಕ್ಷಕರಿಗೆ (L2) ವರ್ಗಾವಣೆಯಾಗಿದೆ.",
        "en": "JanaDhwani: Grievance #{public_id} overdue. Escalated to Medical Superintendent / CI (L2)."
    },
    "ESCALATED_L3": {
        "kn": "ಜನಧ್ವನಿ: ದೂರು #{public_id} ಜಿಲ್ಲಾ ಮಟ್ಟದ ಅಧಿಕಾರಿಗೆ (L3: DHO/DySP) ವರ್ಗಾವಣೆಯಾಗಿದೆ.",
        "en": "JanaDhwani: Grievance #{public_id} escalated to District Health Officer / DySP (L3)."
    },
    "ESCALATED_L4": {
        "kn": "ಜನಧ್ವನಿ: ದೂರು #{public_id} ರಾಜ್ಯ ಆಯುಕ್ತರಿಗೆ / ಎಸ್ಪಿ ಅವರಿಗೆ (L4: Commissioner/SP) ವರ್ಗಾವಣೆಯಾಗಿದೆ.",
        "en": "JanaDhwani: Grievance #{public_id} escalated to State Commissioner / SP (L4)."
    },
    "RESOLVED_NEEDS_VERIFICATION": {
        "kn": "ಜನಧ್ವನಿ: ನಿಮ್ಮ ದೂರು #{public_id} ಅನ್ನು ಅಧಿಕಾರಿಗಳು ಪರಿಹರಿಸಿದ್ದಾರೆ ಎಂದು ತಿಳಿಸಿದ್ದಾರೆ. ದಯವಿಟ್ಟು ಪರಿಶೀಲಿಸಿ: 1 ಒತ್ತುವ ಮೂಲಕ ದೃಢೀಕರಿಸಿ, 2 ಒತ್ತುವ ಮೂಲಕ ಮರುತೆರೆಯಿರಿ.",
        "en": "JanaDhwani: Grievance #{public_id} is marked RESOLVED. Please verify: Press 1 to confirm fix, 2 to reopen complaint."
    },
    "VERIFIED_CLOSED": {
        "kn": "ಜನಧ್ವನಿ: ನಿಮ್ಮ ದೃಢೀಕರಣದ ಮೇರೆಗೆ ದೂರು #{public_id} ಅನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಮುಕ್ತಾಯಗೊಳಿಸಲಾಗಿದೆ. ಧನ್ಯವಾದಗಳು!",
        "en": "JanaDhwani: Thank you! Grievance #{public_id} has been confirmed fixed and closed."
    },
    "VERIFIED_REOPENED": {
        "kn": "ಜನಧ್ವನಿ: ನಿಮ್ಮ ಅಸಮ್ಮತಿಯ ಮೇರೆಗೆ ದೂರು #{public_id} ಅನ್ನು ಮರುತೆರೆಯಲಾಗಿದೆ ಮತ್ತು ಮೇಲ್ವಿಚಾರಕರಿಗೆ ನೀಡಲಾಗಿದೆ.",
        "en": "JanaDhwani: Grievance #{public_id} has been REOPENED upon citizen rejection and flagged to supervisor."
    }
}

def send_notification(
    conn: sqlite3.Connection,
    complaint_id: int,
    recipient_phone_hash: str,
    template_code: str,
    template_vars: Dict[str, Any],
    language: str = "kn",
    channel: str = "SMS"
) -> Dict[str, Any]:
    """
    Renders message template and records mock SMS notification in database.
    """
    templates = NOTIFICATION_TEMPLATES.get(template_code, {
        "kn": "ಜನಧ್ವನಿ ಅಧಿಸೂಚನೆ #{public_id}",
        "en": "JanaDhwani Notification #{public_id}"
    })
    lang = language if language in ("kn", "en") else "kn"
    text_template = templates.get(lang, templates.get("en", ""))

    try:
        message_text = text_template.format(**template_vars)
    except Exception:
        message_text = text_template

    sent_at = now_iso()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO notifications (complaint_id, recipient_phone_hash, channel, template_code, language, message_text, status, sent_at)
        VALUES (?, ?, ?, ?, ?, ?, 'SENT', ?)
    """, (complaint_id, recipient_phone_hash, channel, template_code, lang, message_text, sent_at))
    conn.commit()

    return {
        "notification_id": cursor.lastrowid,
        "template_code": template_code,
        "message_text": message_text,
        "channel": channel,
        "sent_at": sent_at
    }
