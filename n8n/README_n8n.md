# JanaDhwani n8n Automation Workflows

This directory contains optional orchestration workflows for **n8n**, a fair-code workflow automation tool.

> **Note**: JanaDhwani core grievance registration, SLA escalation, and reminders operate autonomously via internal Python schedulers. Running n8n is **strictly optional** for advanced multi-system webhooks, external Telegram broadcasts, and IVR telephony callbacks.

---

## 1. Quick Start with Docker Compose

To start n8n locally:

```bash
cd n8n
docker compose up -d
```

- Access n8n UI at: **`http://localhost:5678`**
- Initial Setup: Create owner account when prompted.

---

## 2. Included Workflows

1. **`workflow_intake.json`**:
   - **Trigger**: Webhook from WhatsApp/IVR telephony or web intake.
   - **Action**: Cleans input text, queries `POST /api/complaints`, detects emergencies, and dispatches SMS acknowledgement or emergency 108 referral.

2. **`workflow_reminders.json`**:
   - **Trigger**: Scheduled cron trigger every 5 minutes.
   - **Action**: Invokes `POST /api/demo/run-cycle` on JanaDhwani backend, logging 50% and 90% SLA reminders and L1 -> L4 escalations.

3. **`workflow_verification.json`**:
   - **Trigger**: Webhook triggered when an officer marks a grievance `RESOLVED`.
   - **Action**: Delivers verification options to citizen (1: Confirm, 2: Reopen). Waits 48 hours; if no dispute is logged, automatically closes with an audit note.

4. **`workflow_digest.json`**:
   - **Trigger**: Daily cron at 8:00 AM IST.
   - **Action**: Queries `/api/dashboard/early-warnings` for categories with 3x weekly surges, formats executive summary, and posts alert digest.

---

## 3. Importing Workflows into n8n

1. Open `http://localhost:5678`.
2. In the left navigation, click **Workflows** > **Add Workflow**.
3. In the top right menu (`...`), click **Import from File**.
4. Select any JSON workflow from this directory.
5. Click **Save** and toggle the workflow to **Active**.
