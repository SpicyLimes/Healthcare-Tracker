## HEALTHCARE TRACKER APP
*A Dockerized App that assists Individuals, Caretakers, and Friends/Family Members with keeping track of a Patient's Healthcare Information.*

### *Work In Progress - Please check back later...*

### Features:
 * Document Upload
 * Dedicated Sections for Recordkeeping
    - Profile Snapshot
    - Insurance and Pharmacy Information
    - Doctor and Specialist Information
    - Family Health History
    - Surgery Records
    - Hospitalization/ER Records
    - Vision History
    - Dental History
    - Vaccination Records
    - Medications, Vitamins, and Supplements
    - Ailment History
    - Doctor's Office Visit Logs

### Future Features: 
 * Simple Forum/Chat Area for Members to Leave Notes and/or Discuss Topics of Important
 * Calendar with Optional Syncing with Google Calendar / Apple Calendar

---

## Tech Stack

- **Frontend:** React + Vite + TypeScript, served by Nginx
- **Backend:** FastAPI (Python), served by Uvicorn
- **Database:** PostgreSQL
- **Packaging:** Docker / Docker Compose

## Development

Requires Docker and Docker Compose.

```bash
cp .env.example .env        # adjust values as needed for local dev
docker compose up -d --build
# App:           http://localhost:8080
# Health check:  http://localhost:8080/api/health  -> {"status":"ok","database":"connected"}
docker compose down
```

### Running the tests

```bash
# Backend (Python)
cd backend && python3.12 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]" && pytest -v

# Frontend (Node)
cd frontend && npm install && npm test
```

## Deployment

Images are built and published to the GitHub Container Registry (GHCR) by the
GitHub Actions workflow in [.github/workflows/build-and-publish.yml](.github/workflows/build-and-publish.yml)
on every push to `main`. The published images are:

- `ghcr.io/spicylimes/healthcare-tracker-backend`
- `ghcr.io/spicylimes/healthcare-tracker-frontend`

To run the published images, use [docker-compose.prod.yml](docker-compose.prod.yml),
which pulls the GHCR images instead of building from source. Supply the database
environment variables (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`,
`DATABASE_URL`) via your deployment environment or secrets, and place the
frontend (host port `8080`) behind your own reverse proxy with TLS as
appropriate for your environment.

> **Status:** Phase 1 (foundation) establishes the containerized stack and the
> health-check connectivity path. Authentication, user roles, the record
> sections listed above, document uploads, and related features are planned for
> subsequent phases.