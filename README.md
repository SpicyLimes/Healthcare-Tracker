<p align="center">
  <img src="frontend/public/logo.png" alt="HealthCare Tracker" width="80" />
</p>

<h1 align="center">HealthCare Tracker</h1>

<p align="center">
  A private, self-hosted web app for managing a patient's medical records as a caregiver.<br/>
  Family members get read-only access. Doctors get time-limited share links scoped to relevant sections.
</p>

---

## Features

- **15 record sections:** Profile, Insurance, Pharmacies, Doctors & Specialists, Family Health History, Surgeries, Hospitalizations, Vision History, Dental History, Vaccinations, Medications / Vitamins / Supplements, Ailment History, Visit Logs, Appointments, Documents
- **Linked records:** Medications link to their prescribing doctor and the pharmacy that fills them — names resolve automatically everywhere they're shown, including the dashboard, share links, and printed summaries
- **Nutrition Plan:** Meal planner (by breakfast/lunch/dinner/snacks), acceptable and unacceptable foods lists with meal-type checkboxes, and section-level document uploads
- **Notes / To-Do's:** Personal notes with pin-to-top and done/completed toggles; any user can create and edit their own notes
- **Document uploads:** PDFs, images, and Office files attached to any section or record; preview in-browser
- **Calendar:** Unified timeline view of appointments, visits, vaccinations, surgeries, hospitalizations, and medications
- **One-page summary:** Generate a printable health summary across selected sections and date ranges (browser print → save as PDF)
- **Daily Reminders (admin-only):** Build a large-print, one-page medication reminder sheet for a caregiver or patient — the kind you stick on the fridge. Cards are grouped by time of day (morning / midday / evening / as-needed), each with an emoji, a plain-language description, and an optional warning badge, plus an optional sidebar of daily reminders and a red "do not take / avoid" bar. **Seed it from your own data:** import active medications from the Medications section and foods to avoid from the Nutrition Plan, then reword them into plain language ("Allergy medicine" rather than a drug name and dosage) — imports append and flag possible duplicates, so your edits are never overwritten. Cards can be reordered, added, removed, hidden, and recoloured (four presets plus custom colours), and the whole sheet saves server-side. **Print Daily Reminders** opens the finished 8.5×11" page in a new tab for browser print → save as PDF
- **AI assistant (optional):** A built-in chat that answers questions about the patient's records by querying the database through read-only tools — answers are grounded in real data, never invented. Available to any signed-in user (Admin, Contributor, or Viewer); write actions are role-gated, so Viewers get a read-only assistant. For Admins it can also **help manage records and notes conversationally**: describe an event in plain language ("follow-up with the cardiologist last Tuesday, prescribed a new medication") and the assistant drafts the corresponding records across the relevant sections for you to confirm, and it can likewise add, edit, or delete notes and to-dos on request. **Creating, editing, and deleting are deliberately gated** — the assistant reads its proposed change back to you and only writes after you confirm; edits and deletes require a one-time, server-side confirmation that the model cannot bypass, and every write goes through the same validation and audit log as a manual change. On phones the assistant opens as a dedicated full-screen page; on desktop it slides in as a resizable panel (Standard / Medium / Large, remembered across sessions) with an active model indicator and privacy note. Bring your own self-hosted, OpenAI-compatible endpoint (e.g. LM Studio or Ollama); the model URL and name are set in-app and the assistant is disabled by default. Record creation and document reading require a model that supports tool use (and vision, for documents). No record data is sent anywhere unless you configure and enable it.
- **Role-based access:** Admin (full access), Contributor (propose changes for admin approval), Viewer (read-only), Guest (time-limited share links)
- **Contributor submissions:** Contributors propose record changes that queue for admin review; admins approve or reject from a Submissions page, and contributors track their own pending items under "My Submissions"
- **Share links:** Admin generates signed, expiring URLs scoped to specific sections for doctors; one-time token display, revocable; **email delivery built in** — send a link (with an optional message) straight from the app via your own SMTP server, with only a masked recipient stored in the audit log
- **Audit log:** Every write, authentication event (login, logout, failed login, password change/reset), user-management action, and share link access logged with a specific action label, actor, timestamp, and detail; filterable in-app
- **Backups:** Nightly automated PostgreSQL dump + uploads archive with 7-day retention, plus an admin **Backups page** — create a backup on demand, download or upload backup archives, and do a full guarded restore, all from the browser

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite, served by Nginx |
| Backend | FastAPI (Python 3.12), served by Uvicorn |
| Database | PostgreSQL 17 |
| Packaging | Docker / Docker Compose |

---

## Development

Requires Docker and Docker Compose.

```bash
cp .env.example .env        # adjust values as needed for local dev
docker compose up -d --build
# App:           http://localhost:1337
# Health check:  http://localhost:1337/api/health
docker compose down
```

### Running the tests

```bash
# Backend (Python) — recommended: isolated Docker environment, auto-cleaned
./scripts/test-backend.sh                 # all tests
./scripts/test-backend.sh -k "auth"       # pass any pytest args

# Backend (Python) — alternative: native venv
cd backend && python3.12 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]" && pytest -v

# Frontend (Node)
cd frontend && npm install && npm test
```

---

## Deployment

### Quick Start

Requires Docker and Docker Compose. No other dependencies.

```bash
# 1. Download the production compose file
curl -O https://raw.githubusercontent.com/SpicyLimes/Healthcare-Tracker/main/docker-compose.prod.yml

# 2. Create your config file
curl -O https://raw.githubusercontent.com/SpicyLimes/Healthcare-Tracker/main/.env.example
mv .env.example .env

# 3. Edit .env — fill in every value marked CHANGE_ME (takes ~2 minutes)
nano .env   # or any editor

# 4. Start the stack — images are pulled automatically from GHCR
docker compose -f docker-compose.prod.yml up -d
```

That's it. The app handles the rest:
- Database schema is created and migrated automatically on startup
- Your first admin account is created from `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`
- Nightly backups start writing to `BACKUP_HOST_PATH` (default: `./backups`) automatically
- Change your admin password after first login

The app is available on **port 1337**. How you expose it — reverse proxy, VPN, Cloudflare Tunnel, or LAN-only — is entirely up to you.

---

### Authentication

Three account roles: **Admin** (full access and user management), **Contributor** (proposes record changes that an admin approves), and **Viewer** (read-only). **Guests** are not accounts — they access scoped, time-limited share links. No public sign-up; the admin creates all accounts.

- `INITIAL_ADMIN_PASSWORD` must be at least 12 characters or startup fails
- Set `JWT_SECRET` to a long random string: `openssl rand -hex 32`
- Set `COOKIE_SECURE=true` in any environment served over HTTPS

**Onboarding & password reset:** when an admin creates a user, they can send a **welcome email** with a temporary password (with a configurable expiry) instead of setting one by hand — the new user logs in and is required to choose their own password before reaching any records. Admins can likewise **reset a user's password**, emailing a fresh temporary password. Both require [email](#email-optional) to be configured; temporary passwords never leave the server in plaintext beyond the email itself. The `PUT /api/users/{id}/password` endpoint remains as a manual break-glass alternative.

### Backups

The `backup` container runs nightly at 2:00 AM. The 7 most recent daily backups are kept automatically.

**In-app (recommended):** Admins manage everything from the **Backups** page — create a backup on demand, download any backup as a single archive, upload a previously downloaded archive, restore (guarded by a typed confirmation, with an automatic safety backup taken first), and delete. Uploaded backups are never auto-pruned.

**CLI (alternative):**

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml run --rm backup restore YYYY-MM-DD
docker compose -f docker-compose.prod.yml up -d
```

### Email (optional)

Share links can be emailed directly from the app. Out of the box `EMAIL_BACKEND=console` (nothing is sent; the Email button is hidden). To enable, point the app at any SMTP server in `.env`:

```bash
EMAIL_BACKEND=smtp
SMTP_HOST=mail.example.com
SMTP_PORT=465                 # 465 = implicit SSL; 587 = STARTTLS (auto-detected)
SMTP_USER=noreply@example.com
SMTP_PASSWORD=...
EMAIL_FROM=HealthCare Tracker <noreply@example.com>
APP_BASE_URL=https://your-app-domain   # used to build the links inside emails
```

Emails contain only the link, its expiry, and your optional message — no patient details. If your app sits behind an access gate (e.g. Cloudflare Access), make sure the `/guest` page, the `/api/guest` API prefix, and the static `/assets` and `/logo.png` paths are reachable without authentication, or recipients will see a blank page.

### AI Assistant Setup

The AI assistant works with any **OpenAI-compatible endpoint**. Configure it in **Settings → AI Settings** after first login. The assistant is disabled by default.

| Provider | Best for | Example Base URL |
|---|---|---|
| LM Studio | Local, GUI-based model management | `http://host.docker.internal:1234/v1` |
| Ollama (same stack) | Bundled with this app's Compose stack | `http://ollama:11434/v1` |
| Ollama (separate container) | Ollama running on the same host, separate stack | `http://host.docker.internal:11434/v1` |
| OpenRouter | Cloud, no local hardware needed | `https://openrouter.ai/api/v1` |
| OpenAI | Cloud (records leave your network) | `https://api.openai.com/v1` |

> **Linux hosts:** `host.docker.internal` does not resolve by default on Linux Docker. Add `extra_hosts: ["host.docker.internal:host-gateway"]` to the `backend` service in your Compose file, or use your host's LAN IP directly.

**Model requirements:** Any model works for Q&A. Creating, editing, and deleting records and notes require a model with **tool/function calling** support. Good small options: `llama3.2:3b`, `qwen2.5:3b`, `phi3:mini`.

#### Option A — Ollama bundled in this app's Compose stack

Append to your `docker-compose.yml` (or Portainer stack YAML), then set **Base URL** in AI Settings to `http://ollama:11434/v1`. Verify current image names and options against the [Ollama Docker documentation](https://hub.docker.com/r/ollama/ollama).

```yaml
  ollama:
    image: ollama/ollama
    restart: unless-stopped
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_KEEP_ALIVE=10m   # unload model after 10 min idle
    # GPU (NVIDIA) — remove this block for CPU-only:
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: 1
    #           capabilities: [gpu]

volumes:
  ollama_data:
```

After starting the stack, pull a model once:

```bash
docker exec -it <ollama-container-name> ollama pull llama3.2:3b
```

#### Option B — Ollama in a separate container on the same host

```bash
docker run -d \
  --name ollama \
  -p 11434:11434 \
  -v ollama_data:/root/.ollama \
  ollama/ollama

# Pull a model:
docker exec ollama ollama pull llama3.2:3b
```

Set **Base URL** in AI Settings to `http://<your-host-ip>:11434/v1` or `http://host.docker.internal:11434/v1` (Linux: requires the `extra_hosts` note above).

---

### CI / Building from source

Images are published to GHCR automatically on every push to `main`:

- `ghcr.io/spicylimes/healthcare-tracker-backend`
- `ghcr.io/spicylimes/healthcare-tracker-frontend`
- `ghcr.io/spicylimes/healthcare-tracker-backup`

To build from source instead, use [docker-compose.yml](docker-compose.yml) with `docker compose up -d --build`.
