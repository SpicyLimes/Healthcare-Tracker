## Healthcare Tracker

*A private, self-hosted web app for managing a patient's medical records as a caregiver. Immediate family get read-only access; doctors get time-limited share links scoped to relevant sections.*

---

## Features

- **14 record sections:** Profile Snapshot, Insurance & Pharmacy, Doctors & Specialists, Family Health History, Surgery Records, Hospitalization/ER Records, Vision History, Dental History, Vaccination Records, Medications/Vitamins/Supplements, Ailment History, Doctor's Office Visit Logs, Appointments, Documents
- **Document uploads:** PDFs, images, and Office files attached to any section or record; preview in-browser
- **Role-based access:** Admin (full access), Viewer (read-only family/doctor accounts), Guest (time-limited share links)
- **Share links:** Admin generates signed, expiring URLs scoped to specific sections for doctors; one-time token display, revocable
- **Audit log:** Every write and share link access logged with actor, timestamp, and detail; filterable in-app
- **Nightly backups:** Automated PostgreSQL dump + uploads archive with 7-day retention; single-command restore

---

## Tech Stack

- **Frontend:** React + Vite + TypeScript, served by Nginx
- **Backend:** FastAPI (Python), served by Uvicorn
- **Database:** PostgreSQL
- **Packaging:** Docker / Docker Compose

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

The app is available on **port 1337**. How you expose it — reverse proxy, VPN, tunnel, or LAN-only — is entirely up to you.

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

### CI / Building from source

Images are published to GHCR automatically on every push to `main`:

- `ghcr.io/spicylimes/healthcare-tracker-backend`
- `ghcr.io/spicylimes/healthcare-tracker-frontend`
- `ghcr.io/spicylimes/healthcare-tracker-backup`

To build from source instead, use [docker-compose.yml](docker-compose.yml) with `docker compose up -d --build`.