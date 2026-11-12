"""
Seed Data Script for JanaDhwani
Populates:
- Departments (HEALTH, POLICE)
- 5 District Hospitals + 3 Police Stations in Kalyana Karnataka
- Wards (including vulnerable Maternity/Pediatric)
- Categories with SLAs and multilingual keywords
- 4 Officer levels per organization
- Category routing
- Public holidays
- 40 realistic fictional complaints with audit trails and notifications
"""
import sys
from pathlib import Path

# Add project root to path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import json
import sqlite3
from datetime import datetime, timezone, timedelta
from app.config import DB_PATH
from app.db import init_db, get_connection
from app.auth import hash_password, hash_phone
from engine.audit import append as audit_append, GENESIS_HASH
from engine.sla import calculate_deadline
from engine.priority import calculate_priority

def seed_database(reset: bool = True):
    print("🌱 Initializing database schema...")
    init_db(reset=reset)

    conn = get_connection()
    cursor = conn.cursor()

    now_base = datetime.now(timezone.utc)
    now_iso = now_base.isoformat()

    # -----------------------------------------------------------------
    # 1. Departments
    # -----------------------------------------------------------------
    departments = [
        ("HEALTH", "Health & Family Welfare", "ಆರೋಗ್ಯ ಮತ್ತು ಕುಟುಂಬ ಕಲ್ಯಾಣ ಇಲಾಖೆ", "Government Hospitals Grievance System"),
        ("POLICE", "Karnataka State Police (Citizen Services)", "ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್ (ಸಾರ್ವಜನಿಕ ಸೇವೆಗಳು)", "Public grievance registration & tracking only. Non-FIR civil complaints.")
    ]
    cursor.executemany("""
        INSERT INTO departments (code, name, kannada_name, description, created_at)
        VALUES (?, ?, ?, ?, ?)
    """, [(d[0], d[1], d[2], d[3], now_iso) for d in departments])

    # -----------------------------------------------------------------
    # 2. Public Holidays (Karnataka 2026 sample)
    # -----------------------------------------------------------------
    holidays = [
        ("2026-01-26", "Republic Day", "ಗಣರಾಜ್ಯೋತ್ಸವ"),
        ("2026-03-19", "Ugadi", "ಯುಗಾದಿ ಹಬ್ಬ"),
        ("2026-04-14", "Dr. B.R. Ambedkar Jayanti", "ಡಾ. ಬಿ.ಆರ್. ಅಂಬೇಡ್ಕರ್ ಜಯಂತಿ"),
        ("2026-05-01", "Labour Day", "ಕಾರ್ಮಿಕ ದಿನಾಚರಣೆ"),
        ("2026-08-15", "Independence Day", "ಸ್ವಾತಂತ್ರ್ಯ ದಿನಾಚರಣೆ"),
        ("2026-10-02", "Gandhi Jayanti", "ಗಾಂಧಿ ಜಯಂತಿ"),
        ("2026-11-01", "Kannada Rajyotsava", "ಕನ್ನಡ ರಾಜ್ಯೋತ್ಸವ"),
        ("2026-12-25", "Christmas", "ಕ್ರಿಸ್ಮಸ್")
    ]
    cursor.executemany("""
        INSERT INTO holidays (date, name, kannada_name, created_at)
        VALUES (?, ?, ?, ?)
    """, [(h[0], h[1], h[2], now_iso) for h in holidays])

    # -----------------------------------------------------------------
    # 3. Organizations (5 Hospitals + 3 Police Stations)
    # -----------------------------------------------------------------
    orgs_data = [
        # Health Organizations
        ("HEALTH", "District Hospital Kalaburagi", "ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ ಕಲಬುರಗಿ", "Kalaburagi", 17.3297, 76.8343, "Station Road, Kalaburagi, Karnataka 585102"),
        ("HEALTH", "District Hospital Bidar", "ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ ಬೀದರ್", "Bidar", 17.9104, 77.5199, "Near Ambedkar Circle, Bidar, Karnataka 585401"),
        ("HEALTH", "District Hospital Raichur", "ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ ರಾಯಚೂರು", "Raichur", 16.2076, 77.3463, "Station Road, Raichur, Karnataka 584101"),
        ("HEALTH", "District Hospital Koppal", "ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ ಕೊಪ್ಪಳ", "Koppal", 15.3463, 76.1550, "Hospital Road, Koppal, Karnataka 583231"),
        ("HEALTH", "District Hospital Yadgir", "ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ ಯಾದಗಿರಿ", "Yadgir", 16.7644, 77.1378, "Chittapur Road, Yadgir, Karnataka 585202"),

        # Police Organizations
        ("POLICE", "Kalaburagi Central Police Station", "ಕಲಬುರಗಿ ನಗರ ಕೇಂದ್ರ ಠಾಣೆ", "Kalaburagi", 17.3312, 76.8377, "Main Bazaar, Kalaburagi, Karnataka 585101"),
        ("POLICE", "Bidar Town Police Station", "ಬೀದರ್ ನಗರ ಠಾಣೆ", "Bidar", 17.9125, 77.5215, "Fort Road, Bidar, Karnataka 585401"),
        ("POLICE", "Raichur Market Police Station", "ರಾಯಚೂರು ಮಾರುಕಟ್ಟೆ ಠಾಣೆ", "Raichur", 16.2091, 77.3489, "Gunj Road, Raichur, Karnataka 584102")
    ]
    cursor.executemany("""
        INSERT INTO organizations (department_code, name, kannada_name, district, lat, lng, address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, [(o[0], o[1], o[2], o[3], o[4], o[5], o[6], now_iso) for o in orgs_data])

    # -----------------------------------------------------------------
    # 4. Wards (5 per hospital)
    # -----------------------------------------------------------------
    wards_template = [
        ("Maternity Ward", "ಹೆರಿಗೆ ವಾರ್ಡ್", "MAT", 1),
        ("Pediatric Ward", "ಮಕ್ಕಳ ವಾರ್ಡ್", "PED", 1),
        ("General Ward", "ಸಾಮಾನ್ಯ ವಾರ್ಡ್", "GEN", 0),
        ("OPD Consultation", "ಹೊರರೋಗಿ ವಿಭಾಗ", "OPD", 0),
        ("Pharmacy & Stores", "ಔಷಧಾಲಯ ಮತ್ತು ದಾಸ್ತಾನು", "PHARM", 0)
    ]
    # Org IDs 1 to 5 are Hospitals
    for hospital_id in range(1, 6):
        for w in wards_template:
            cursor.execute("""
                INSERT INTO wards (organization_id, name, kannada_name, code, is_vulnerable, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (hospital_id, w[0], w[1], f"{w[2]}-H{hospital_id}", w[3], now_iso))

    # -----------------------------------------------------------------
    # 5. Categories (7 Health + 5 Police)
    # -----------------------------------------------------------------
    categories_data = [
        # Health
        ("HEALTH", "Doctor/Staff Absent", "ವೈದ್ಯರು/ಸಿಬ್ಬಂದಿ ಗೈರು", 12, 85, json.dumps(["doctor", "absent", "ಡಾಕ್ಟರ್", "ವೈದ್ಯರು", "ಗೈರು", "nurse", "missing"]), "Doctor or medical nurse unavailable during duty hours"),
        ("HEALTH", "Medicine Shortage", "ಔಷಧಿ ಕೊರತೆ", 48, 75, json.dumps(["medicine", "tablet", "ಔಷಧಿ", "ಮಾತ್ರೆ", "ಕೊರತೆ", "injection"]), "Shortage of essential drugs or pharmacy closed"),
        ("HEALTH", "Hygiene/Cleanliness", "ಸ್ವಚ್ಛತೆ/ನೈರ್ಮಲ್ಯ", 24, 65, json.dumps(["cleanliness", "dirty", "ಸ್ವಚ್ಛತೆ", "ಕಸ", "ಗಲೀಜು", "ವಾಸನೆ", "waste"]), "Unclean toilets, wards, or garbage accumulation"),
        ("HEALTH", "Drinking Water/Sanitation", "ಕುಡಿಯುವ ನೀರು/ಶೌಚಾಲಯ", 24, 70, json.dumps(["water", "toilet", "ಕುಡಿಯುವ ನೀರು", "ಶೌಚಾಲಯ", "ನಲ್ಲಿ", "ನೀರಿಲ್ಲ"]), "Drinking water filter broken or toilet plumbing blocked"),
        ("HEALTH", "Beds/Facilities", "ಹಾಸಿಗೆ/ವ್ಯವಸ್ಥೆಗಳು", 48, 60, json.dumps(["bed", "wheelchair", "ಹಾಸಿಗೆ", "ಮಲಗಲು ಜಾಗವಿಲ್ಲ", "ವೀಲ್‌ಚೇರ್", "fan"]), "Shortage of patient beds, wheelchairs, or stretchers"),
        ("HEALTH", "Infrastructure Maintenance", "ಕಟ್ಟಡ/ವಿದ್ಯುತ್ ದುರಸ್ತಿ", 120, 45, json.dumps(["building", "electricity", "ವಿದ್ಯುತ್", "ಕಟ್ಟಡ", "ಲಿಫ್ಟ್", "light"]), "Electrical faults, lift failure, or broken doors"),
        ("HEALTH", "Staff Behaviour", "ಸಿಬ್ಬಂದಿಯ ಅನುಚಿತ ವರ್ತನೆ", 48, 70, json.dumps(["behaviour", "rude", "ವರ್ತನೆ", "ದುರ್ವರ್ತನೆ", "ಲಂಚ", "bribe"]), "Rude behavior, harassment, or bribe demand by staff"),

        # Police
        ("POLICE", "Cybercrime & Online Fraud", "ಸೈಬರ್ ಅಪರಾಧ ಮತ್ತು ಆನ್‌ಲೈನ್ ವಂಚನೆ", 24, 80, json.dumps(["cyber", "fraud", "ಸೈಬರ್", "ಆನ್‌ಲೈನ್ ವಂಚನೆ", "ಓಟಿಪಿ", "hacked", "upi"]), "Online financial fraud, phishing, OTP scams"),
        ("POLICE", "Financial Fraud", "ಹಣಕಾಸು ವಂಚನೆ", 72, 70, json.dumps(["financial", "cheating", "ಹಣಕಾಸು ವಂಚನೆ", "ಚೀಟಿ ಫಂಡ್", "ಮೋಸ"]), "Chit fund fraud, loan cheating, money disputes"),
        ("POLICE", "Lost Property", "ಕಳೆದುಹೋದ ವಸ್ತುಗಳು / ಮೊಬೈಲ್", 48, 40, json.dumps(["lost", "mobile", "ಕಳೆದುಹೋಗಿದೆ", "ಮೊಬೈಲ್", "ಪರ್ಸ್", "ದಾಖಲೆ"]), "Lost mobile phone, documents, or valuables report"),
        ("POLICE", "Traffic & Public Safety", "ಸಂಚಾರ ಮತ್ತು ಸಾರ್ವಜನಿಕ ಸುರಕ್ಷತೆ", 24, 50, json.dumps(["traffic", "parking", "ಟ್ರಾಫಿಕ್", "ಅಡ್ಡಾದಿಡ್ಡಿ ಪಾರ್ಕಿಂಗ್", "ರಸ್ತೆ"]), "Traffic violations, illegal parking, public disturbance"),
        ("POLICE", "Complaint Against Individual", "ವ್ಯಕ್ತಿಯ ವಿರುದ್ಧ ದೂರು", 48, 65, json.dumps(["quarrel", "threat", "ಜಗಳ", "ಬೆದರಿಕೆ", "ಗಲಾಟೆ", "ಕಿರುಕುಳ"]), "Non-cognizable dispute or harassment between individuals")
    ]
    cursor.executemany("""
        INSERT INTO categories (department_code, name, kannada_name, default_sla_hours, weight, keywords_json, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, [(c[0], c[1], c[2], c[3], c[4], c[5], c[6], now_iso) for c in categories_data])

    # -----------------------------------------------------------------
    # 6. Officers (4 levels for each organization + Demo Accounts)
    # -----------------------------------------------------------------
    # Password hash for default demo credentials: "password123"
    demo_pw_hash = hash_password("password123")
    demo_phone_hash = hash_phone("9845012345")

    officers_list = []

    # Health Officers for Hospital 1 (Kalaburagi)
    officers_list.append((1, "Dr. Sneha Kulkarni", "ಡಾ. ಸ್ನೇಹಾ ಕುಲಕರ್ಣಿ", "Medical Officer (Water/Hygiene)", "OFFICER", 1, "officer_sneha", demo_pw_hash, demo_phone_hash, "sneha@health.karnataka.gov.in", 0, None))
    officers_list.append((1, "Dr. Ramesh Patil", "ಡಾ. ರಮೇಶ್ ಪಾಟೀಲ್", "Duty Medical Officer", "OFFICER", 1, "officer_patil", demo_pw_hash, demo_phone_hash, "patil@health.karnataka.gov.in", 0, None))
    officers_list.append((1, "Dr. K. S. Deshmukh", "ಡಾ. ಕೆ. ಎಸ್. ದೇಶಮುಖ್", "Medical Superintendent", "SUPERVISOR", 2, "sup_deshmukh", demo_pw_hash, demo_phone_hash, "deshmukh@health.karnataka.gov.in", 0, None))
    officers_list.append((1, "Dr. Sharanappa K", "ಡಾ. ಶರಣಪ್ಪ ಕೆ", "District Health Officer (DHO)", "DISTRICT_OFFICER", 3, "dho_kalaburagi", demo_pw_hash, demo_phone_hash, "dho.kalaburagi@karnataka.gov.in", 0, None))
    officers_list.append((1, "Sri Naveen Kumar IAS", "ಶ್ರೀ ನವೀನ್ ಕುಮಾರ್ ಐಎಎಸ್", "Commissioner Health & Family Welfare", "COMMISSIONER", 4, "commissioner_health", demo_pw_hash, demo_phone_hash, "commissioner@karnataka.gov.in", 0, None))

    # Health Officers for Hospital 2 (Bidar)
    officers_list.append((2, "Dr. Anand Biradar", "ಡಾ. ಆನಂದ್ ಬಿರಾದಾರ್", "Medical Officer L1", "OFFICER", 1, "officer_biradar", demo_pw_hash, demo_phone_hash, "anand@health.karnataka.gov.in", 0, None))
    officers_list.append((2, "Dr. Meenakshi Joshi", "ಡಾ. ಮೀನಾಕ್ಷಿ ಜೋಶಿ", "Medical Superintendent L2", "SUPERVISOR", 2, "sup_joshi", demo_pw_hash, demo_phone_hash, "joshi@health.karnataka.gov.in", 0, None))
    officers_list.append((2, "Dr. Basavaraj DHO", "ಡಾ. ಬಸವರಾಜ್", "District Health Officer L3", "DISTRICT_OFFICER", 3, "dho_bidar", demo_pw_hash, demo_phone_hash, "dho.bidar@karnataka.gov.in", 0, None))
    officers_list.append((2, "Sri Naveen Kumar IAS", "ಶ್ರೀ ನವೀನ್ ಕುಮಾರ್ ಐಎಎಸ್", "State Health Commissioner L4", "COMMISSIONER", 4, "comm_bidar", demo_pw_hash, demo_phone_hash, "comm@karnataka.gov.in", 0, None))

    # Health Officers for Hospital 3 (Raichur)
    officers_list.append((3, "Dr. Vijaykumar Raichur", "ಡಾ. ವಿಜಯಕುಮಾರ್", "Duty Officer L1", "OFFICER", 1, "officer_raichur", demo_pw_hash, demo_phone_hash, "vijay@health.karnataka.gov.in", 0, None))
    officers_list.append((3, "Dr. Renuka Devi", "ಡಾ. ರೇಣುಕಾ ದೇವಿ", "Medical Superintendent L2", "SUPERVISOR", 2, "sup_raichur", demo_pw_hash, demo_phone_hash, "renuka@health.karnataka.gov.in", 0, None))
    officers_list.append((3, "Dr. Jagadish DHO", "ಡಾ. ಜಗದೀಶ್ ಡಿಎಚ್‌ಒ", "District Health Officer L3", "DISTRICT_OFFICER", 3, "dho_raichur", demo_pw_hash, demo_phone_hash, "dho.raichur@karnataka.gov.in", 0, None))
    officers_list.append((3, "Sri Naveen Kumar IAS", "ಶ್ರೀ ನವೀನ್ ಕುಮಾರ್ ಐಎಎಸ್", "State Commissioner L4", "COMMISSIONER", 4, "comm_raichur", demo_pw_hash, demo_phone_hash, "comm@karnataka.gov.in", 0, None))

    # Health Officers for Hospital 4 (Koppal)
    officers_list.append((4, "Dr. Mallikarjun Koppal", "ಡಾ. ಮಲ್ಲಿಕಾರ್ಜುನ", "Medical Officer L1", "OFFICER", 1, "officer_koppal", demo_pw_hash, demo_phone_hash, "mallikarjun@health.karnataka.gov.in", 0, None))
    officers_list.append((4, "Dr. Savita Patil", "ಡಾ. ಸವಿತಾ ಪಾಟೀಲ್", "Medical Superintendent L2", "SUPERVISOR", 2, "sup_koppal", demo_pw_hash, demo_phone_hash, "savita@health.karnataka.gov.in", 0, None))
    officers_list.append((4, "Dr. Prakash DHO", "ಡಾ. ಪ್ರಕಾಶ್", "District Health Officer L3", "DISTRICT_OFFICER", 3, "dho_koppal", demo_pw_hash, demo_phone_hash, "dho.koppal@karnataka.gov.in", 0, None))
    officers_list.append((4, "Sri Naveen Kumar IAS", "ಶ್ರೀ ನವೀನ್ ಕುಮಾರ್ ಐಎಎಸ್", "State Commissioner L4", "COMMISSIONER", 4, "comm_koppal", demo_pw_hash, demo_phone_hash, "comm@karnataka.gov.in", 0, None))

    # Health Officers for Hospital 5 (Yadgir)
    officers_list.append((5, "Dr. Suresh Yadgir", "ಡಾ. ಸುರೇಶ್", "Duty Officer L1", "OFFICER", 1, "officer_yadgir", demo_pw_hash, demo_phone_hash, "suresh@health.karnataka.gov.in", 0, None))
    officers_list.append((5, "Dr. Kavita G", "ಡಾ. ಕವಿತಾ ಜಿ", "Medical Superintendent L2", "SUPERVISOR", 2, "sup_yadgir", demo_pw_hash, demo_phone_hash, "kavita@health.karnataka.gov.in", 0, None))
    officers_list.append((5, "Dr. Chandrashekhar DHO", "ಡಾ. ಚಂದ್ರಶೇಖರ್", "District Health Officer L3", "DISTRICT_OFFICER", 3, "dho_yadgir", demo_pw_hash, demo_phone_hash, "dho.yadgir@karnataka.gov.in", 0, None))
    officers_list.append((5, "Sri Naveen Kumar IAS", "ಶ್ರೀ ನವೀನ್ ಕುಮಾರ್ ಐಎಎಸ್", "State Commissioner L4", "COMMISSIONER", 4, "comm_yadgir", demo_pw_hash, demo_phone_hash, "comm@karnataka.gov.in", 0, None))

    # Police Officers for Station 6 (Kalaburagi Police)
    officers_list.append((6, "PSI Sharanappa B", "ಶರಣಪ್ಪ ಬಿ", "Police Sub-Inspector L1", "OFFICER", 1, "psi_sharanappa", demo_pw_hash, demo_phone_hash, "psi.klb@ksp.gov.in", 0, None))
    officers_list.append((6, "CI Manjunath K", "ಮಂಜುನಾಥ್ ಕೆ", "Circle Inspector L2", "SUPERVISOR", 2, "ci_manjunath", demo_pw_hash, demo_phone_hash, "ci.klb@ksp.gov.in", 0, None))
    officers_list.append((6, "DySP Vijay Kumar", "ವಿಜಯ್ ಕುಮಾರ್", "Deputy Superintendent of Police L3", "DISTRICT_OFFICER", 3, "dysp_vijay", demo_pw_hash, demo_phone_hash, "dysp.klb@ksp.gov.in", 0, None))
    officers_list.append((6, "SP Kalaburagi IPS", "ಎಸ್ಪಿ ಕಲಬುರಗಿ", "Superintendent of Police L4", "COMMISSIONER", 4, "sp_kalaburagi", demo_pw_hash, demo_phone_hash, "sp.klb@ksp.gov.in", 0, None))

    # Police Officers for Station 7 (Bidar Police)
    officers_list.append((7, "PSI Santosh Bidar", "ಸಂತೋಷ್", "Police Sub-Inspector L1", "OFFICER", 1, "psi_bidar", demo_pw_hash, demo_phone_hash, "psi.bdr@ksp.gov.in", 0, None))
    officers_list.append((7, "CI Gururaj", "ಗುರುರಾಜ್", "Circle Inspector L2", "SUPERVISOR", 2, "ci_bidar", demo_pw_hash, demo_phone_hash, "ci.bdr@ksp.gov.in", 0, None))
    officers_list.append((7, "DySP Bidar", "ಡಿವೈಎಸ್ಪಿ ಬೀದರ್", "DySP L3", "DISTRICT_OFFICER", 3, "dysp_bidar", demo_pw_hash, demo_phone_hash, "dysp.bdr@ksp.gov.in", 0, None))
    officers_list.append((7, "SP Bidar IPS", "ಎಸ್ಪಿ ಬೀದರ್", "SP L4", "COMMISSIONER", 4, "sp_bidar", demo_pw_hash, demo_phone_hash, "sp.bdr@ksp.gov.in", 0, None))

    # Police Officers for Station 8 (Raichur Police)
    officers_list.append((8, "PSI Prakash Raichur", "ಪ್ರಕಾಶ್", "Police Sub-Inspector L1", "OFFICER", 1, "psi_raichur", demo_pw_hash, demo_phone_hash, "psi.rcr@ksp.gov.in", 0, None))
    officers_list.append((8, "CI Shivanna", "ಶಿವಣ್ಣ", "Circle Inspector L2", "SUPERVISOR", 2, "ci_raichur", demo_pw_hash, demo_phone_hash, "ci.rcr@ksp.gov.in", 0, None))
    officers_list.append((8, "DySP Raichur", "ಡಿವೈಎಸ್ಪಿ ರಾಯಚೂರು", "DySP L3", "DISTRICT_OFFICER", 3, "dysp_raichur", demo_pw_hash, demo_phone_hash, "dysp.rcr@ksp.gov.in", 0, None))
    officers_list.append((8, "SP Raichur IPS", "ಎಸ್ಪಿ ರಾಯಚೂರು", "SP L4", "COMMISSIONER", 4, "sp_raichur", demo_pw_hash, demo_phone_hash, "sp.rcr@ksp.gov.in", 0, None))

    # Auditor & Administrator accounts
    officers_list.append((1, "Vinay Rao", "ವಿನಯ್ ರಾವ್", "Chief Independent Auditor", "AUDITOR", 3, "auditor_demo", demo_pw_hash, demo_phone_hash, "auditor@karnataka.gov.in", 0, None))
    officers_list.append((1, "System Administrator", "ವ್ಯವಸ್ಥಾ ನಿರ್ವಾಹಕ", "State System Administrator", "ADMIN", 4, "admin_demo", demo_pw_hash, demo_phone_hash, "admin@janadhwani.gov.in", 0, None))

    cursor.executemany("""
        INSERT INTO officers (organization_id, name, kannada_name, designation, role, level, username, password_hash, phone_hash, email, is_on_leave, substitute_officer_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [(o[0], o[1], o[2], o[3], o[4], o[5], o[6], o[7], o[8], o[9], o[10], o[11], now_iso) for o in officers_list])

    # -----------------------------------------------------------------
    # 7. Category Routing (Primary officer mapping)
    # -----------------------------------------------------------------
    # Route all 7 health categories in org 1 to officer 1 or 2
    for cat_id in range(1, 8):
        cursor.execute("""
            INSERT INTO category_routing (category_id, organization_id, primary_officer_id)
            VALUES (?, 1, ?)
        """, (cat_id, 1 if cat_id in (3, 4) else 2))

    # Route police categories in org 6 to officer PSI
    # PSI Sharanappa is officer id 26
    cursor.execute("SELECT id FROM officers WHERE username = 'psi_sharanappa'")
    psi_row = cursor.fetchone()
    psi_id = psi_row[0] if psi_row else 26
    for cat_id in range(8, 13):
        cursor.execute("""
            INSERT INTO category_routing (category_id, organization_id, primary_officer_id)
            VALUES (?, 6, ?)
        """, (cat_id, psi_id))

    # -----------------------------------------------------------------
    # 8. Seed 40 Realistic Fictional Complaints
    # -----------------------------------------------------------------
    print("📝 Seeding 40 realistic fictional complaints across departments...")

    complaints_data = [
        # Hospital 1: Kalaburagi
        (1, 1, 4, "ಕುಡಿಯುವ ನೀರಿನ ಫಿಲ್ಟರ್ ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ, ರೋಗಿಗಳಿಗೆ ನೀರಿಲ್ಲ", "Drinking water filter broken in Maternity ward", "kn", "VOICE", "Basavaraj", "9845011111", "SUBMITTED", 1, 18, 0, 78),
        (1, 1, 4, "Maternity ward water tap has no water since yesterday", "Drinking water tap dry in Maternity ward", "en", "KIOSK", "Suresh Kumar", "9845011112", "ASSIGNED", 1, 20, 0, 82),
        (1, 1, 4, "ಕುಡಿಯುವ ನೀರು ಸಿಗುತ್ತಿಲ್ಲ, ತುರ್ತಾಗಿ ಸರಿಪಡಿಸಿ", "No drinking water available in Maternity ward", "kn", "ASHA_ASSISTED", "Lakshmi Bai", "9845011113", "IN_PROGRESS", 1, 14, 0, 85),
        (1, 2, 3, "ಮಕ್ಕಳ ವಾರ್ಡ್ ಶೌಚಾಲಯ ಅತ್ಯಂತ ಗಲೀಜಾಗಿದೆ, ಕಸ ತುಂಬಿದೆ", "Pediatric ward toilets are extremely unhygienic with garbage", "kn", "VOICE", "Mallikarjun", "9845011114", "ASSIGNED", 1, 16, 0, 88),
        (1, 2, 1, "Doctor absent during duty hours in Pediatric ward", "Doctor absent in Pediatric ward", "en", "QR_PORTAL", "Rahul Sharma", "9845011115", "ESCALATED", 2, 2, 1, 95),
        (1, 3, 2, "ಇನ್ಸುಲಿನ್ ಮತ್ತು ಬಿಪಿ ಮಾತ್ರೆಗಳು ಔಷಧಾಲಯದಲ್ಲಿ ಇಲ್ಲ", "Insulin and BP tablets out of stock in General ward", "kn", "VOICE", "Shantamma", "9845011116", "RESOLVED", 1, 40, 0, 60),
        (1, 4, 7, "ಹೊರರೋಗಿ ವಿಭಾಗದ ಸಿಬ್ಬಂದಿ ಲಂಚ ಕೇಳುತ್ತಿದ್ದಾರೆ", "OPD staff demanding bribe from patients", "kn", "WEB", "Anonymous Citizen", "9845011117", "IN_PROGRESS", 1, 30, 0, 80),
        (1, 5, 5, "ರೋಗಿಗಳಿಗೆ ಮಲಗಲು ಹಾಸಿಗೆ ಇಲ್ಲ, ನೆಲದ ಮೇಲೆ ಮಲಗಿಸಿದ್ದಾರೆ", "Bed shortage in General ward, patients sleeping on floor", "kn", "VOICE", "Ganesh", "9845011118", "ESCALATED", 3, 0, 1, 92),

        # Hospital 2: Bidar
        (2, 6, 4, "ಬೀದರ್ ಆಸ್ಪತ್ರೆಯ ಶೌಚಾಲಯಗಳಲ್ಲಿ ನೀರಿನ ಪೂರೈಕೆ ಸ್ಥಗಿತಗೊಂಡಿದೆ", "Toilets have no water supply in Bidar Hospital", "kn", "VOICE", "Jagadeesh", "9845012221", "ASSIGNED", 1, 22, 0, 72),
        (2, 7, 1, "Emergency doctor arrived 2 hours late in Bidar", "Duty doctor arrived very late", "en", "WEB", "Mohammed Arif", "9845012222", "ESCALATED", 2, 4, 1, 88),
        (2, 8, 2, "ಆ್ಯಂಟಿಬಯೋಟಿಕ್ ಇಂಜೆಕ್ಷನ್ ಖಾಲಿಯಾಗಿದೆ", "Antibiotic injections out of stock in Bidar", "kn", "KIOSK", "Revanna", "9845012223", "IN_PROGRESS", 1, 35, 0, 68),
        (2, 9, 3, "ಕಸದ ಬುಟ್ಟಿಗಳು ತುಂಬಿ ಹರಿಯುತ್ತಿವೆ, ದುರ್ನಾತ ಬರುತ್ತಿದೆ", "Overflowing garbage bins causing foul smell", "kn", "VOICE", "Prabhavati", "9845012224", "RESOLVED", 1, 12, 0, 58),
        (2, 10, 6, "ವಿದ್ಯುತ್ ಕಡಿತದಿಂದ ಫ್ಯಾನ್ ಮತ್ತು ಲೈಟ್ ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ", "Power outage, fans and lights not working", "kn", "ASHA_ASSISTED", "Veeranna", "9845012225", "CLOSED", 1, 100, 0, 45),
        (2, 6, 5, "Wheelchairs are broken and not enough for elderly patients", "Wheelchairs broken in Bidar hospital", "en", "VOICE", "David D'Souza", "9845012226", "ASSIGNED", 1, 38, 0, 65),

        # Hospital 3: Raichur
        (3, 11, 4, "ರಾಯಚೂರು ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆಯ ಹೆರಿಗೆ ವಾರ್ಡ್‌ನಲ್ಲಿ ಕುಡಿಯುವ ನೀರಿಲ್ಲ", "No drinking water in Raichur maternity ward", "kn", "VOICE", "Tayamma", "9845013331", "ASSIGNED", 1, 19, 0, 84),
        (3, 11, 4, "Drinking water RO plant stopped working in Raichur", "Water purifier defunct in Raichur", "en", "KIOSK", "Hanumanth", "9845013332", "IN_PROGRESS", 1, 15, 0, 80),
        (3, 12, 1, "ಮಕ್ಕಳ ವಿಭಾಗದ ವೈದ್ಯರು ಗೈರುಹಾಜರಾಗಿದ್ದಾರೆ", "Pediatrician absent during evening rounds", "kn", "VOICE", "Channamma", "9845013333", "ESCALATED", 2, 1, 1, 96),
        (3, 13, 3, "General ward is extremely unhygienic with stagnant water", "Stagnant water and mosquito breeding in General ward", "en", "WEB", "Praveen", "9845013334", "RESOLVED", 1, 20, 0, 62),
        (3, 14, 2, "ಔಷಧಾಲಯದಲ್ಲಿ ಪ್ಯಾರಸಿಟಮಾಲ್ ಸಿರಪ್ ಲಭ್ಯವಿಲ್ಲ", "Paracetamol syrup out of stock in Raichur", "kn", "VOICE", "Bheemanna", "9845013335", "ASSIGNED", 1, 44, 0, 70),
        (3, 15, 7, "Security staff misbehaving with rural villagers", "Security guards rude to rural visitors", "en", "ASHA_ASSISTED", "Narasimha", "9845013336", "IN_PROGRESS", 1, 32, 0, 65),

        # Hospital 4: Koppal
        (4, 16, 4, "ಕೊಪ್ಪಳ ಆಸ್ಪತ್ರೆಯಲ್ಲಿ ಕುಡಿಯುವ ನೀರಿನ ನಲ್ಲಿ ಮುರಿದುಬಿದ್ದಿದೆ", "Water tap broken in Koppal hospital", "kn", "VOICE", "Eshwarappa", "9845014441", "RESOLVED", 1, 18, 0, 60),
        (4, 17, 3, "Pediatric toilets have no running water and filthy smell", "No water in toilets and bad odour", "en", "KIOSK", "Anitha", "9845014442", "IN_PROGRESS", 1, 21, 0, 75),
        (4, 18, 1, "ವೈದ್ಯರು ಸಮಯಕ್ಕೆ ಸರಿಯಾಗಿ ಬರುತ್ತಿಲ್ಲ, ರೋಗಿಗಳು ಕಾಯುತ್ತಿದ್ದಾರೆ", "Doctors coming very late, patients waiting", "kn", "VOICE", "Hussain Sab", "9845014443", "ASSIGNED", 1, 10, 0, 78),
        (4, 19, 2, "Iron and folic acid tablets shortage in Koppal", "Iron tablets shortage for pregnant women", "en", "WEB", "Roopa", "9845014444", "ESCALATED", 2, 3, 1, 89),
        (4, 20, 6, "ಲಿಫ್ಟ್ ಕೆಟ್ಟು ನಿಂತಿದ್ದು ರೋಗಿಗಳನ್ನು ಮೆಟ್ಟಿಲಲ್ಲಿ ಹೊತ್ತುಕೊಂಡು ಹೋಗಬೇಕಿದೆ", "Elevator broken, carrying patients by stairs", "kn", "VOICE", "Siddappa", "9845014445", "ASSIGNED", 1, 80, 0, 72),

        # Hospital 5: Yadgir
        (5, 21, 4, "ಯಾದಗಿರಿ ಆಸ್ಪತ್ರೆಯ ಹೆರಿಗೆ ವಿಭಾಗದಲ್ಲಿ ನೀರು ಸೋರುತ್ತಿದೆ", "Water leakage in Maternity ward in Yadgir", "kn", "VOICE", "Kallamma", "9845015551", "IN_PROGRESS", 1, 20, 0, 82),
        (5, 22, 1, "Doctor not available for newborn screening in Yadgir", "Doctor unavailable in Pediatric ward", "en", "ASHA_ASSISTED", "Vijaylaxmi", "9845015552", "ESCALATED", 3, 0, 1, 98),
        (5, 23, 3, "ಆಸ್ಪತ್ರೆಯ ಆವರಣದಲ್ಲಿ ಎಲ್ಲೆಂದರಲ್ಲಿ ಕಸ ಬಿದ್ದಿದೆ", "Hospital compound littered with medical waste", "kn", "VOICE", "Nagaraj", "9845015553", "RESOLVED", 1, 15, 0, 64),
        (5, 24, 2, "Emergency saline bottles out of stock in Yadgir", "Saline bottles shortage in Yadgir", "en", "KIOSK", "Devendra", "9845015554", "ASSIGNED", 1, 42, 0, 74),
        (5, 25, 7, "ನರ್ಸ್ ರೋಗಿಗಳಿಗೆ ಕೆಟ್ಟದಾಗಿ ಮಾತನಾಡುತ್ತಿದ್ದಾರೆ", "Nurse shouting and insulting rural patients", "kn", "VOICE", "Mariyamma", "9845015555", "IN_PROGRESS", 1, 36, 0, 69),

        # Police Complaints (Kalaburagi, Bidar, Raichur)
        (6, None, 8, "ನನ್ನ ಬ್ಯಾಂಕ್ ಖಾತೆಯಿಂದ ೨೫,೦೦೦ ರೂ ಆನ್‌ಲೈನ್ ಮೂಲಕ ಕಡಿತವಾಗಿದೆ", "Unauthorized bank account debit of Rs 25,000 via online link", "kn", "VOICE", "Gururaj K", "9845016661", "IN_PROGRESS", 1, 20, 0, 85),
        (6, None, 8, "Victim received fake electricity bill APK link, lost 50000", "Cyber fraud via malicious electricity bill APK", "en", "WEB", "Santosh Kumar", "9845016662", "ASSIGNED", 1, 22, 0, 88),
        (6, None, 9, "ಚೀಟಿ ಫಂಡ್ ಸಂಸ್ಥೆ ಹಣ ಮರುಪಾವತಿಸದೆ ವಂಚಿಸಿದೆ", "Chit fund operator absconded with investor deposits", "kn", "VOICE", "Somanna", "9845016663", "ASSIGNED", 1, 65, 0, 70),
        (6, None, 10, "ಕಲಬುರಗಿ ಬಸ್ ನಿಲ್ದಾಣದಲ್ಲಿ ನನ್ನ ಮೊಬೈಲ್ ಕಳೆದುಹೋಗಿದೆ", "Mobile phone lost at Kalaburagi KSRTC bus stand", "kn", "KIOSK", "Sharada", "9845016664", "RESOLVED", 1, 30, 0, 42),
        (6, None, 11, "Super Market road completely blocked due to illegal parking", "Illegal parking obstructing central road", "en", "QR_PORTAL", "Merchant Association", "9845016665", "IN_PROGRESS", 1, 18, 0, 55),
        (6, None, 12, "ನೆರೆಹೊರೆಯವರು ರಾತ್ರಿ ವೇಳೆ ಅತಿಯಾದ ಗಲಾಟೆ ಮಾಡುತ್ತಿದ್ದಾರೆ", "Persistent loud noise and harassment from neighbours", "kn", "VOICE", "Venkat Rao", "9845016666", "ASSIGNED", 1, 40, 0, 62),

        # Police Bidar & Raichur
        (7, None, 8, "ಬೀದರ್‌ನಲ್ಲಿ ಓಟಿಪಿ ವಂಚನೆ ಮೂಲಕ ಹಣ ಕಡಿತ", "OTP fraud reported in Bidar town", "kn", "VOICE", "Abdul Wahid", "9845017771", "IN_PROGRESS", 1, 16, 0, 86),
        (7, None, 10, "Lost purse containing Aadhaar and Driving License", "Lost wallet with government identity cards", "en", "WEB", "Pooja Patil", "9845017772", "CLOSED", 1, 44, 0, 38),
        (8, None, 8, "ರಾಯಚೂರಿನಲ್ಲಿ ಉದ್ಯೋಗದ ಆಮಿಷವೊಡ್ಡಿ ಹಣ ಪಡೆದು ವಂಚನೆ", "Job offer scam on Telegram, citizen cheated of Rs 40,000", "kn", "VOICE", "Rameshwar", "9845018881", "ASSIGNED", 1, 23, 0, 84),
        (8, None, 11, "Over-speeding private buses near Station Road", "Reckless bus speeding posing pedestrian hazard", "en", "VOICE", "Citizens Forum", "9845018882", "RESOLVED", 1, 15, 0, 52)
    ]

    for idx, c in enumerate(complaints_data, start=1001):
        org_id = c[0]
        ward_id = c[1]
        cat_id = c[2]
        orig_text = c[3]
        eng_summary = c[4]
        lang = c[5]
        channel = c[6]
        citizen_name = c[7]
        phone = c[8]
        status = c[9]
        esc_level = c[10]
        hours_remaining = c[11]
        is_overdue_flag = c[12]
        priority_score = c[13]

        public_id = f"JD-2026-{idx}"
        dept_code = "HEALTH" if org_id <= 5 else "POLICE"
        phone_h = hash_phone(phone)

        # Timestamps
        created_time = now_base - timedelta(hours=24 + (idx % 48))
        created_iso = created_time.isoformat()

        # Compute deadline
        # For overdue complaints, deadline is in the past
        if is_overdue_flag:
            deadline_time = now_base - timedelta(hours=6 + (idx % 12))
        else:
            deadline_time = now_base + timedelta(hours=hours_remaining)
        deadline_iso = deadline_time.isoformat()

        # Select officer
        cursor.execute("SELECT id FROM officers WHERE organization_id = ? AND level = ? LIMIT 1", (org_id, esc_level))
        off_row = cursor.fetchone()
        assigned_officer = off_row[0] if off_row else 1

        resolved_at = None
        resolution_notes = None
        if status in ("RESOLVED", "CLOSED"):
            resolved_at = (now_base - timedelta(hours=4)).isoformat()
            resolution_notes = "Grievance inspected and successfully resolved by duty team on site."

        cursor.execute("""
            INSERT INTO complaints (
                public_id, department_code, organization_id, ward_id, category_id,
                language, original_text, english_summary, channel, is_anonymous,
                citizen_name, citizen_phone_hash, assigned_officer_id, priority_score,
                duplicate_count, status, sla_deadline, escalation_level, is_overdue,
                opened_at, resolved_at, resolution_notes, verified_by_citizen,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            public_id, dept_code, org_id, ward_id, cat_id,
            lang, orig_text, eng_summary, channel,
            citizen_name, phone_h, assigned_officer, priority_score,
            status, deadline_iso, esc_level, is_overdue_flag,
            created_iso, resolved_at, resolution_notes,
            1 if status == "CLOSED" else None,
            created_iso, now_iso
        ))
        comp_db_id = cursor.lastrowid

        # Record Initial Action
        cursor.execute("""
            INSERT INTO actions (complaint_id, officer_id, action_type, old_status, new_status, notes, created_at)
            VALUES (?, ?, 'STATUS_CHANGE', 'SUBMITTED', ?, 'Complaint intake registered in JanaDhwani', ?)
        """, (comp_db_id, assigned_officer, status, created_iso))

        # Append to Audit Log (Hash-Chained)
        audit_append(conn, "complaint", comp_db_id, "CREATED", "CITIZEN", {
            "public_id": public_id,
            "department": dept_code,
            "category_id": cat_id,
            "priority": priority_score,
            "channel": channel
        })

    conn.commit()
    conn.close()
    print("✅ Seed data populated successfully with 40 complaints, officers, and verified audit chains.")

if __name__ == "__main__":
    reset_flag = "--reset" in sys.argv or "-r" in sys.argv
    seed_database(reset=reset_flag)
