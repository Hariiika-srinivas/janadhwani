# JanaDhwani (ಜನಧ್ವನಿ)
### Kalyana Karnataka Solvathon 2026 – Complete Working Prototype
**Accessible, Multilingual, Voice-Based Public Grievance Registration, Tracking, and Escalation Platform**

---

## 1. Project Vision & Architecture

**JanaDhwani** is an accessible, multilingual, voice-first public grievance redressal and transparency platform designed for citizens across the Kalyana Karnataka region (Kalaburagi, Bidar, Raichur, Koppal, Yadgir).

It empowers citizens who cannot read or write, people without smartphones, rural villagers, and Kannada-speaking citizens to report non-emergency public service breakdowns using **voice**, **visual kiosk icons**, **assisted registration (ASHA workers)**, or **QR codes**.

### Core Architecture: Department-Independent Grievance Engine
JanaDhwani is architected with a decoupled, generic grievance core that supports multiple departments through configuration and seed data:
1. **Department #1: HEALTH** – District Government Hospitals (Maternity, Pediatric, General, OPD, Pharmacy).
2. **Department #2: POLICE** – Police Stations (Cybercrime, Financial Fraud, Lost Property, Public Safety, Citizen Disputes).
   > *Statutory Notice*: The Police module is strictly for grievance registration and progress tracking. FIR registration, offence classification, and judicial procedures remain exclusively with designated police authorities under CrPC.

Adding a third department (e.g. Municipalities, Rural Water Supply, KPTCL) requires only database category and routing configuration, with **zero rewrite** of the core escalation, audit, or SLA engine.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CITIZEN TOUCHPOINTS                             │
│   🎙️ Voice Portal   │   🏥 Visual Kiosk   │   👩‍⚕️ ASHA Assisted   │  📱 QR │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST API
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  JANADHWANI GENERIC ENGINE                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────────┐  │
│  │ Emergency Check │  │ Classifier      │  │ Deduplication & Cluster│  │
│  │ (108 Referral)  │  │ (Multi-lingual) │  │ (72h Window Surge)     │  │
│  └─────────────────┘  └─────────────────┘  └────────────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────────┐  │
│  │ Dynamic Priority│  │ Calendar SLA    │  │ Hierarchical           │  │
│  │ (0-100 Score)   │  │ (Holidays/Sun)  │  │ Escalation (L1 -> L4)  │  │
│  └─────────────────┘  └─────────────────┘  └────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             TAMPER-EVIDENT DATABASE & AUDIT LOG                        │
│   SQLite 3 · SHA-256 Hash-Chained Audit Trail · Salted Phone Privacy   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┴──────────────────────────────┐
    ▼                                                              ▼
┌───────────────────────────────┐              ┌───────────────────────────────┐
│     GOVERNMENT OFFICERS       │              │      PUBLIC & AUDITORS        │
│  L1: Category Officer         │              │  📊 Operations Dashboard      │
│  L2: Medical Superintendent   │              │  🌐 Public Transparency       │
│  L3: District Health Officer  │              │  🛡️ Forensic Audit Tool       │
│  L4: State Commissioner       │              │  ⚠️ 3x Early Warning Surges   │
└───────────────────────────────┘              └───────────────────────────────┘
```

---

## 2. Technology Stack

- **Backend**: Python 3.10+, FastAPI, Uvicorn, SQLite3 (`data/janadhwani.db`), Pydantic v2, Pytest, ReportLab, QRCode[PIL].
- **Frontend**: React 19, TypeScript, Tailwind CSS, Web Speech API (`SpeechRecognition` & `SpeechSynthesis`), MediaRecorder, PWA Service Worker & Manifest.
- **Security**: Token-based HMAC auth, salted phone hashing (`SHA-256(phone + salt)`), zero plaintext citizen PII storage, cryptographic hash-chained audit log.
- **Automation**: Optional n8n workflow integrations with Docker Compose.

---

## 3. One-Command Execution & Local Run

### Quick Start (Python FastAPI Backend):
```bash
# 1. Start application (automatically initializes database if missing)
python run.py
# Or using the bash/batch script:
./run.sh        # Linux / macOS
run.bat         # Windows
```

- **Application URL**: `http://localhost:8000`
- **Swagger API Docs**: `http://localhost:8000/docs`
- **Frontend Dev Server**: `http://localhost:3000` (`npm run dev`)

---

## 4. Demo Credentials & User Roles

| Role | Username | Password | Level & Jurisdiction |
| :--- | :--- | :--- | :--- |
| **Category Officer (L1)** | `officer_sneha` | `password123` | L1 Duty Medical Officer (Kalaburagi) |
| **Duty Medical Officer (L1)** | `officer_patil` | `password123` | L1 Duty Doctor (Kalaburagi) |
| **Superintendent (L2)** | `sup_deshmukh` | `password123` | L2 Medical Superintendent (Kalaburagi) |
| **District Officer (L3)** | `dho_kalaburagi` | `password123` | L3 District Health Officer (Kalaburagi) |
| **State Commissioner (L4)** | `commissioner_health` | `password123` | L4 State Commissioner (Bengaluru/State) |
| **Police Sub-Inspector (L1)**| `psi_sharanappa` | `password123` | L1 PSI Kalaburagi Central Police |
| **Circle Inspector (L2)** | `ci_manjunath` | `password123` | L2 CI Kalaburagi Central Police |
| **Independent Auditor** | `auditor_demo` | `password123` | Forensic Audit & Chain Verification |
| **System Administrator** | `admin_demo` | `password123` | System Settings & Master Configuration |

---

## 5. Application Pages & Route Catalog

| URL Route | Name & Purpose | Target User |
| :--- | :--- | :--- |
| `/` or `/voice` | **Citizen Voice Grievance** (Web Speech audio + Kannada synthesis) | Ordinary Citizens |
| `/kiosk` | **Visual Kiosk Mode** (6 Large Icon buttons + Voice Prompts) | Rural & Non-Literate Citizens |
| `/status` | **Grievance Status & Citizen Verification** (Confirm/Reject & Rating) | Citizens & Complainants |
| `/officer` | **Officer Priority Queue** (Action logging, photo proof, GPS, snooze) | Government Officers |
| `/dashboard` | **Operations Dashboard** (KPIs, hospital scores, early warnings, trends) | Supervisors & Leadership |
| `/transparency` | **Public Transparency Portal** (Aggregated stats, zero citizen PII) | Citizens, NGOs, Media |
| `/admin` | **Administration & QR Studio** (Poster generator, SLA hours config) | Administrators |
| `/login` | **Role-Based Officer Login** (Instant 1-click persona switch) | Government Staff |
| `/docs` | **Interactive OpenAPI Documentation** (Swagger UI) | Developers & Integrators |

---

## 6. End-to-End Automated Demonstration (`scripts/demo_e2e.py`)

Run the complete 15-step demonstration script showcasing the entire grievance lifecycle:
```bash
python scripts/demo_e2e.py
```

### Demonstration Steps Covered:
1. Citizen in Raichur speaks a drinking water grievance in Kannada.
2. JanaDhwani recognises text, generates ID `JD-2026-XXXX`, and auto-classifies category.
3. Routes to Dr. Vijaykumar Raichur with calendar-aware SLA target.
4. Simulates a community wave of 30 similar complaints within 72 hours.
5. Deduplication engine clusters reports, elevates priority to 92/100.
6. Simulated time travel: Advances clock by 24 hours.
7. Escalation engine fires 50% and 90% reminders; complaint becomes overdue and escalates to L2 Superintendent.
8. Officer resolves issue, uploading inspection photo and GPS coordinates.
9. Citizen receives verification request, confirms resolution, and complaint closes permanently.
10. Citizen submits a 5-star rating.
11. Cryptographic audit trail verifies unbroken SHA-256 chain.
12. Demonstrates forensic tamper detection by simulating a database attack.
13. Self-healing algorithm recalculates and restores cryptographic integrity.
14. Police module registration: Cybercrime OTP fraud in Kalaburagi.
15. Verifies statutory police disclaimer and tracking status under the same generic engine.

---

## 7. Automated Test Suite (Pytest)

Run all 24 automated unit and integration tests:
```bash
pytest -v
```

All 24 tests pass:
- Emergency detection across Kannada, English, Hindi, and Telugu.
- Multilingual category classification (Health & Police).
- Duplicate detection & cluster priority boost.
- SLA calculations skipping Sundays and official public holidays.
- 50% & 90% reminders, overdue detection, L1->L2->L3->L4 escalation.
- Officer-on-leave automated substitute reassignment.
- SHA-256 audit log appending, unbroken chain verification, tamper detection, and repair.
- Full REST API lifecycle and Police module compliance.

---

## 8. Five-Minute Hackathon Pitch

> *"Every year, thousands of rural patients in Kalyana Karnataka visit district hospitals only to find dry taps, absent doctors, or unstocked pharmacies. They cannot write formal letters, they don't have smartphones, and visiting government offices to follow up is expensive and exhausting.*
>
> *JanaDhwani is the voice of the ordinary citizen. By speaking a sentence in Kannada or tapping an icon on a hospital kiosk, their grievance is instantly registered, given a unique ID, routed to the responsible officer, and assigned an enforceable deadline.*
>
> *If an officer ignores the grievance, the system does not let it die—it escalates up the hierarchy from Duty Officer to Superintendent, then to the District Health Officer, and finally to the State Commissioner. And crucially: an officer cannot quietly close a ticket without the citizen's own verification.*
>
> *Built with tamper-evident cryptographic audit chains and extensible to police and municipal services, JanaDhwani brings genuine accountability and transparency to grassroots governance."*

---

## 9. Honest Limitations & Future Scaling

1. **Browser Speech Recognition**: Browser-based Web Speech API depends on device microphones and internet connectivity. In production, JanaDhwani will integrate **Bhashini** (Government of India's National Language Translation Mission) for higher dialect accuracy in North Karnataka Kannada.
2. **Telephony & IVR**: Real phone call handling requires an IVR gateway like Exotel or Twilio. The prototype implements mock SMS and automated notifications.
3. **Emergency Handling**: Emergency keywords trigger immediate guidance to 108 and hospital casualty desks; it does not replace the national 108 emergency dispatch infrastructure.
4. **Police Department Boundary**: JanaDhwani registers and tracks non-emergency citizen police grievances. It does not file FIRs or replace judicial police powers.
5. **Cost Model**: SQLite embedded storage and minimal API dependencies result in an estimated operational cost of **less than ₹0.04 per complaint**, scaling easily to all 31 districts of Karnataka on existing state cloud infrastructure.

---

## 10. Solvathon Problem Statement Mapping Table

| Solvathon Requirement | JanaDhwani Implementation | Web Endpoint / Page | Automated Verification |
| :--- | :--- | :--- | :--- |
| **Voice Reporting** | Web Speech recognition + live transcript | `/pages/voice.html` (`/voice`) | `test_api.py::test_complaint_registration_and_status` |
| **No-Smartphone Reporting** | Large visual icon kiosk mode | `/pages/kiosk.html` (`/kiosk`) | `demo_e2e.py` (Kiosk wave step) |
| **Kannada Support** | Full Kannada UI dictionary + TTS | `static/js/i18n.js` | `test_classification.py::test_health_kannada_classification` |
| **Unique Complaint ID** | Format: `JD-2026-XXXX` | `POST /api/complaints` | `test_api.py::test_complaint_registration_and_status` |
| **Automatic Categorization**| Multilingual keyword engine | `engine/classify.py` | `test_classification.py` |
| **Complaint Forwarding** | Routing table to primary officer | `category_routing` table | `test_api.py::test_complaint_registration_and_status` |
| **Complaint Tracking** | Status API with audio playback | `GET /api/complaints/{id}/status` | `test_api.py::test_complaint_registration_and_status` |
| **Pending Follow-Up** | 50% & 90% SLA reminders | `engine/escalation.py` | `test_sla_escalation.py` |
| **Public Dashboard** | KPI cards, trends, hospital scores | `/pages/dashboard.html` (`/dashboard`) | `test_api.py::test_dashboard_and_demo_endpoints` |
| **SLA Escalation** | L1 -> L2 -> L3 -> L4 ladder | `engine/escalation.py` | `test_sla_escalation.py::test_escalation_cycle_execution` |
| **Action History** | SHA-256 hash-chained audit trail | `engine/audit.py` | `test_audit.py::test_audit_append_and_verify` |
| **Citizen Verification** | Confirm closes, Reject reopens | `POST /api/complaints/{id}/verify`| `test_api.py::test_citizen_verification_and_rating` |
| **Tamper Detection** | Chain verification + forensic note | `/api/demo/tamper-audit` | `test_audit.py::test_tamper_detection_and_repair` |
| **Police Extensibility** | Generic engine with Police categories | `POST /api/complaints` (POLICE) | `test_police.py` |
