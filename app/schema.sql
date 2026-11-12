-- ====================================================================
-- JanaDhwani Database Schema (SQLite 3)
-- Kalyana Karnataka Solvathon 2026
-- ====================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL, -- 'HEALTH', 'POLICE'
    name TEXT NOT NULL,
    kannada_name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_code TEXT NOT NULL REFERENCES departments(code),
    name TEXT NOT NULL,
    kannada_name TEXT NOT NULL,
    district TEXT NOT NULL, -- 'Kalaburagi', 'Bidar', 'Raichur', 'Koppal', 'Yadgir'
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    address TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kannada_name TEXT NOT NULL,
    code TEXT NOT NULL,
    is_vulnerable INTEGER NOT NULL DEFAULT 0, -- 1 for Maternity, Pediatric, ICU
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_code TEXT NOT NULL REFERENCES departments(code),
    name TEXT NOT NULL,
    kannada_name TEXT NOT NULL,
    default_sla_hours INTEGER NOT NULL,
    weight INTEGER NOT NULL DEFAULT 50, -- 1 to 100
    keywords_json TEXT NOT NULL, -- JSON array of multilingual keywords
    description TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS officers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    kannada_name TEXT NOT NULL,
    designation TEXT NOT NULL,
    role TEXT NOT NULL, -- 'OFFICER', 'SUPERVISOR', 'DISTRICT_OFFICER', 'COMMISSIONER', 'ADMIN', 'AUDITOR'
    level INTEGER NOT NULL DEFAULT 1, -- 1 (L1), 2 (L2), 3 (L3), 4 (L4)
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    phone_hash TEXT NOT NULL,
    email TEXT,
    is_on_leave INTEGER NOT NULL DEFAULT 0,
    substitute_officer_id INTEGER REFERENCES officers(id),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS category_routing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    primary_officer_id INTEGER NOT NULL REFERENCES officers(id),
    UNIQUE(category_id, organization_id)
);

CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT UNIQUE NOT NULL, -- e.g. JD-2026-1001
    department_code TEXT NOT NULL REFERENCES departments(code),
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    ward_id INTEGER REFERENCES wards(id),
    category_id INTEGER NOT NULL REFERENCES categories(id),
    language TEXT NOT NULL DEFAULT 'kn', -- 'kn', 'en', 'hi', 'te', 'ur'
    original_text TEXT NOT NULL,
    english_summary TEXT NOT NULL,
    audio_path TEXT,
    channel TEXT NOT NULL DEFAULT 'VOICE', -- 'VOICE', 'KIOSK', 'ASHA_ASSISTED', 'QR_PORTAL', 'WEB'
    is_anonymous INTEGER NOT NULL DEFAULT 0,
    citizen_name TEXT,
    citizen_phone_hash TEXT NOT NULL,
    citizen_phone_encrypted TEXT,
    assigned_officer_id INTEGER REFERENCES officers(id),
    priority_score INTEGER NOT NULL DEFAULT 50, -- 0 to 100
    duplicate_count INTEGER NOT NULL DEFAULT 1,
    parent_complaint_id INTEGER REFERENCES complaints(id),
    status TEXT NOT NULL DEFAULT 'SUBMITTED', -- 'SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED', 'ESCALATED'
    sla_deadline TEXT NOT NULL, -- ISO-8601 UTC string
    escalation_level INTEGER NOT NULL DEFAULT 1, -- 1 to 4
    snoozed_until TEXT,
    snooze_reason TEXT,
    is_overdue INTEGER NOT NULL DEFAULT 0,
    opened_at TEXT,
    resolved_at TEXT,
    resolution_notes TEXT,
    resolution_photo_url TEXT,
    resolution_location TEXT,
    verified_by_citizen INTEGER, -- 1 = confirmed, 0 = rejected, null = pending
    verification_notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    officer_id INTEGER REFERENCES officers(id),
    action_type TEXT NOT NULL, -- 'STATUS_CHANGE', 'NOTE_ADDED', 'SNOOZED', 'REASSIGNED', 'RESOLVED', 'REOPENED', 'VERIFIED'
    old_status TEXT,
    new_status TEXT,
    notes TEXT,
    photo_url TEXT,
    location_gps TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prev_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- 'complaint', 'action', 'system'
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    actor_id TEXT NOT NULL, -- officer username or 'CITIZEN' or 'SYSTEM'
    payload_json TEXT NOT NULL,
    timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    recipient_phone_hash TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'SMS',
    template_code TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'kn',
    message_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SENT',
    sent_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    officer_id INTEGER NOT NULL REFERENCES officers(id),
    reminder_type TEXT NOT NULL, -- '50_PCT_SLA', '90_PCT_SLA', 'OVERDUE', 'UNOPENED_25_PCT'
    sent_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
    feedback_text TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL, -- 'YYYY-MM-DD'
    name TEXT NOT NULL,
    kannada_name TEXT,
    created_at TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_complaints_public_id ON complaints(public_id);
CREATE INDEX IF NOT EXISTS idx_complaints_org ON complaints(organization_id);
CREATE INDEX IF NOT EXISTS idx_complaints_cat ON complaints(category_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_deadline ON complaints(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_complaints_officer ON complaints(assigned_officer_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entry_hash ON audit_log(entry_hash);
CREATE INDEX IF NOT EXISTS idx_actions_complaint ON actions(complaint_id);
CREATE INDEX IF NOT EXISTS idx_notifications_complaint ON notifications(complaint_id);
