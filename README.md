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
# App:           http://localhost:8080
# Health check:  http://localhost:8080/api/health
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

Images are built and published to the GitHub Container Registry (GHCR) by the
GitHub Actions workflow in [.github/workflows/build-and-publish.yml](.github/workflows/build-and-publish.yml)
on every push to `main`. The published images are:

- `ghcr.io/spicylimes/healthcare-tracker-backend`
- `ghcr.io/spicylimes/healthcare-tracker-frontend`
- `ghcr.io/spicylimes/healthcare-tracker-backup`

To run the published images, use [docker-compose.prod.yml](docker-compose.prod.yml),
which pulls the GHCR images instead of building from source. Supply all required
environment variables via your deployment environment or a `.env` file — see
[.env.example](.env.example) for the full list. Place the frontend (host port
`8080`) behind your own reverse proxy with TLS as appropriate for your
environment.

### Authentication

The app uses email/password login with two roles: **Admin** (full access and
user management) and **Viewer** (read-only). There is no public sign-up.

- **First admin:** On first startup with an empty database, an initial admin is
  created from `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` (see
  `.env.example`). `INITIAL_ADMIN_PASSWORD` must be at least 12 characters or
  startup fails. Change the password after first login.
- **Sessions:** Short-lived access tokens plus refresh tokens delivered as
  httpOnly cookies; the client refreshes transparently. State-changing requests
  are CSRF-protected.
- **Database schema** is managed with Alembic migrations. The backend runs
  `alembic upgrade head` on startup automatically.

Set `JWT_SECRET` to a long random value and `COOKIE_SECURE=true` in any
environment served over HTTPS.

### Backups

The `backup` container runs a nightly cron job (2:00 AM) that dumps the
database and archives the uploads volume to `BACKUP_HOST_PATH` on the host.
The 7 most recent daily backups are kept; older ones are pruned automatically.

To restore from a backup:

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml run --rm backup restore YYYY-MM-DD
docker compose -f docker-compose.prod.yml up -d
```