"""
One-Command Local Execution Script for JanaDhwani
Usage: python run.py
"""
import sys
import os
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.config import DB_PATH
from app.seed import seed_database

def main():
    print("==================================================================")
    print("  JANADHWANI - KALYANA KARNATAKA SOLVATHON 2026")
    print("  Multilingual Voice-Based Public Grievance Platform")
    print("==================================================================")

    # Check database initialization
    if not DB_PATH.exists():
        print("⚡ Database not detected. Initializing database and seed data...")
        seed_database(reset=True)
    else:
        print(f"✓ SQLite database verified at: {DB_PATH}")

    port = int(os.environ.get("PORT", "8001"))
    host = os.environ.get("HOST", "0.0.0.0")

    print("\n🚀 Starting JanaDhwani server on:")
    print(f"   ► Application URL:   http://localhost:{port}")
    print(f"   ► API Documentation: http://localhost:{port}/docs")
    print(f"   ► Interactive UI:    http://localhost:3000 (Vite / Express)")
    print("\n🔑 Demo Credentials:")
    print("   • Officer (L1):             officer_sneha / password123")
    print("   • Superintendent (L2):      sup_deshmukh / password123")
    print("   • District Officer (L3):    dho_kalaburagi / password123")
    print("   • State Commissioner (L4):  commissioner_health / password123")
    print("   • Police SI (L1):           psi_sharanappa / password123")
    print("   • Independent Auditor:      auditor_demo / password123")
    print("   • Administrator:            admin_demo / password123")
    print("==================================================================\n")

    try:
        import uvicorn
        uvicorn.run("app.main:app", host=host, port=port, reload=False)
    except ImportError:
        print("Note: uvicorn not installed in active environment. Run with .venv/bin/python run.py")

if __name__ == "__main__":
    main()
