"""
Central System Clock with Simulated Time Support for JanaDhwani
"""
import sqlite3
from datetime import datetime, timezone, timedelta
from app.config import DB_PATH

def get_db_offset() -> int:
    """Read clock offset seconds from database settings if available."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM settings WHERE key = 'clock_offset_seconds'")
        row = cursor.fetchone()
        conn.close()
        if row and row[0]:
            return int(row[0])
    except Exception:
        pass
    return 0

def set_db_offset(seconds: int):
    """Save clock offset seconds in database settings."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            "INSERT INTO settings (key, value, description, updated_at) VALUES ('clock_offset_seconds', ?, 'Simulated time offset in seconds', ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            (str(seconds), now_str)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error updating clock offset: {e}")

class SystemClock:
    @classmethod
    def now(cls) -> datetime:
        """Returns current simulated UTC datetime."""
        offset_seconds = get_db_offset()
        return datetime.now(timezone.utc) + timedelta(seconds=offset_seconds)

    @classmethod
    def now_iso(cls) -> str:
        """Returns ISO-8601 formatted string of current simulated time."""
        return cls.now().isoformat()

    @classmethod
    def advance_hours(cls, hours: float):
        """Advances simulated time by specified hours."""
        current = get_db_offset()
        new_offset = current + int(hours * 3600)
        set_db_offset(new_offset)
        return new_offset

    @classmethod
    def reset(cls):
        """Resets simulated time offset back to zero."""
        set_db_offset(0)

# Convenient module-level functions
now = SystemClock.now
now_iso = SystemClock.now_iso
advance_hours = SystemClock.advance_hours
reset = SystemClock.reset
