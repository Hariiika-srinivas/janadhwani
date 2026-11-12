"""
Database Connection & Initialization for JanaDhwani
"""
import sqlite3
from typing import Generator
from app.config import DB_PATH, SCHEMA_PATH

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db(reset: bool = False):
    """Initializes SQLite database with schema.sql."""
    if reset and DB_PATH.exists():
        try:
            DB_PATH.unlink()
        except Exception as e:
            print(f"Warning: could not delete {DB_PATH}: {e}")

    conn = get_connection()
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()
    conn.executescript(schema_sql)
    conn.commit()
    conn.close()
    print(f"Database initialized successfully at {DB_PATH}")

if __name__ == "__main__":
    init_db(reset=True)
