<p align="center">
  <img src="frontend/public/logo.png" alt="Healthcare Tracker" width="80" />
</p>

<h1 align="center">Healthcare Tracker</h1>

<p align="center">
  A private, self-hosted web app for managing a patient's medical records as a caregiver.<br/>
  Family members get read-only access. Doctors get time-limited share links scoped to relevant sections.
</p>

---

## Features

- **15 record sections:** Profile, Insurance, Pharmacies, Doctors & Specialists, Family Health History, Surgeries, Hospitalizations, Vision History, Dental History, Vaccinations, Medications / Vitamins / Supplements, Ailment History, Visit Logs, Appointments, Documents
- **Nutrition Plan:** Meal planner (by breakfast/lunch/dinner/snacks), acceptable and unacceptable foods lists with meal-type checkboxes, and section-level document uploads
- **Notes / To-Do's:** Personal notes with pin-to-top and done/completed toggles; any user can create and edit their own notes
- **Document uploads:** PDFs, images, and Office files attached to any section or record; preview in-browser
- **Calendar:** Unified timeline view of appointments, visits, vaccinations, surgeries, hospitalizations, and medications
- **One-page summary:** Generate a printable health summary across selected sections and date ranges (browser print → save as PDF)
- **AI assistant (optional, admin-only):** A built-in chat that answers questions about the patient's records by querying the database through read-only tools — answers are grounded in real data, never invented. It can also **help manage records conversationally**: describe an event in plain language ("follow-up with the cardiologist last Tuesday, prescribed a new medication") and the assistant drafts the corresponding records across the relevant sections for you to confirm. **Creating, editing, and deleting are deliberately gated** — the assistant reads its proposed change back to you and only writes after you confirm; edits and deletes require a one-time, server-side confirmation that the model cannot bypass, and every write goes through the same validation and audit log as a manual change. On phones the assistant opens as a dedicated full-screen page; on desktop it slides in as a resizable panel (Standard / Medium / Large, remembered across sessions) with an active model indicator and privacy note. Bring your own self-hosted, OpenAI-compatible endpoint (e.g. LM Studio or Ollama); the model URL and name are set in-app and the assistant is disabled by default. Record creation and document reading require a model that supports tool use (and vision, for documents). No record data is sent anywhere unless you configure and enable it.
- **Role-based access:** Admin (full access), Viewer (read-only), Guest (time-limited share links)
- **Share links:** Admin generates signed, expiring URLs scoped to specific sections for doctors; one-time token display, revocable
- **Audit log:** Every write and share link access logged with actor, timestamp, and detail; filterable in-app
- **Nightly backups:** Automated PostgreSQL dump + uploads archive with 7-day retention; single-command restore

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
# Backend (Python)
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

Two roles: **Admin** (full access and user management) and **Viewer** (read-only). No public sign-up — the admin creates all accounts.

- `INITIAL_ADMIN_PASSWORD` must be at least 12 characters or startup fails
- Set `JWT_SECRET` to a long random string: `openssl rand -hex 32`
- Set `COOKIE_SECURE=true` in any environment served over HTTPS

### Backups

The `backup` container runs nightly at 2:00 AM. The 7 most recent daily backups are kept automatically. To restore:

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml run --rm backup restore YYYY-MM-DD
docker compose -f docker-compose.prod.yml up -d
```

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

**Model requirements:** Any model works for Q&A. Record creation, editing, and deletion require a model with **tool/function calling** support. Good small options: `llama3.2:3b`, `qwen2.5:3b`, `phi3:mini`.

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
