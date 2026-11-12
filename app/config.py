"""
JanaDhwani System Configuration
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DB_PATH = DATA_DIR / "janadhwani.db"
SCHEMA_PATH = BASE_DIR / "app" / "schema.sql"
STATIC_DIR = BASE_DIR / "static"
UPLOADS_DIR = STATIC_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

SECRET_KEY = os.environ.get("SECRET_KEY", "janadhwani-solvathon-kalyana-karnataka-2026-secret-salt")
PHONE_SALT = os.environ.get("PHONE_SALT", "kalyana-phone-salt-98765")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# SLA Thresholds
SLA_REMINDER_50_PCT = 0.50
SLA_REMINDER_90_PCT = 0.90
SLA_UNOPENED_THRESHOLD = 0.25

# Demonstration initial simulated time
DEFAULT_APP_TIMEZONE = "Asia/Kolkata"
