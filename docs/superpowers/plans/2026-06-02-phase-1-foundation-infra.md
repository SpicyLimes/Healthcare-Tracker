# Healthcare Tracker — Phase 1: Foundation & Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a running, reachable, empty-but-healthy Docker Compose stack (React frontend + FastAPI backend + PostgreSQL), wired to deploy via GitHub Actions → GitHub Container Registry (GHCR) → Portainer, with a working health-check endpoint proving the frontend can reach the backend.

**Architecture:** Four-service Docker Compose stack (`frontend`, `backend`, `db`, and later `cloudflared`). The FastAPI backend exposes a `/api/health` endpoint that checks its own status and database connectivity. The React frontend calls that endpoint and renders the result, proving end-to-end connectivity. Nginx serves the built React app and reverse-proxies `/api` to the backend. Images are built and published to GHCR by GitHub Actions; the LAN server pulls prebuilt images via a Portainer stack. Local development uses `docker compose up --build`.

**Tech Stack:** Python 3.12 + FastAPI 0.136.x + Uvicorn + SQLAlchemy 2.x + psycopg (PostgreSQL driver) + pytest; Node 22 + React 19 + Vite 8 + Vitest; PostgreSQL 17; Nginx (alpine); Docker Compose; GitHub Actions.

---

## Phase Scope & Boundaries

**This phase delivers:**
- A working local `docker compose up` that brings up db + backend + frontend.
- A `/api/health` endpoint reporting backend + database status.
- A React landing page that fetches and displays health status (proves connectivity).
- Backend test suite (pytest) and frontend test suite (Vitest) with passing tests.
- A GitHub Actions workflow that builds and pushes `backend` and `frontend` images to GHCR.
- A production `docker-compose.prod.yml` that Portainer uses to pull prebuilt images.
- README deployment notes.

**This phase explicitly does NOT include** (deferred to later phases per the spec):
- Authentication, users, or roles (Phase 2).
- Any health-record sections or data models (Phase 3+).
- Document uploads (Phase 5).
- Share links / audit log (Phase 6).
- The `cloudflared` container config and Cloudflare Access wiring (added when first deployed publicly; Phase 1 leaves a documented placeholder).
- Backups (Phase 7).

**Why this boundary:** Phase 1 proves the entire build/deploy/connectivity pipeline works end to end before any feature code is written. Every later phase builds inside this skeleton.

---

## File Structure

Files created in this phase and their single responsibilities:

```
Healthcare-Tracker/
├── docker-compose.yml              # Local dev stack (builds from source)
├── docker-compose.prod.yml         # Production stack (pulls GHCR images)
├── .env.example                    # Documented env vars (no secrets committed)
├── .gitignore                      # Ignore venvs, node_modules, .env, build output
├── .github/
│   └── workflows/
│       └── build-and-publish.yml   # CI: build + push images to GHCR
├── backend/
│   ├── Dockerfile                  # Builds the FastAPI image
│   ├── pyproject.toml              # Python deps + tooling config
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app instance + router wiring
│   │   ├── config.py               # Settings loaded from env (DB URL, etc.)
│   │   ├── database.py             # SQLAlchemy engine + session dependency
│   │   └── routers/
│   │       ├── __init__.py
│   │       └── health.py           # /api/health endpoint
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py             # pytest fixtures (test client, test DB)
│       └── test_health.py          # Tests for the health endpoint
└── frontend/
    ├── Dockerfile                  # Multi-stage: build React, serve via Nginx
    ├── nginx.conf                  # Serve SPA + proxy /api → backend
    ├── package.json                # Node deps + scripts
    ├── index.html                  # Vite entry HTML
    ├── vite.config.ts              # Vite + Vitest config
    ├── src/
    │   ├── main.tsx                # React entry point
    │   ├── App.tsx                 # Landing page: fetches + shows health status
    │   ├── api/
    │   │   └── health.ts           # fetch wrapper for /api/health
    │   └── App.test.tsx            # Vitest test for App rendering health
    └── src/setupTests.ts           # Vitest + Testing Library setup
```

---

## Task 1: Repo scaffolding — .gitignore and env example

**Files:**
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create `.gitignore`**

```gitignore
# Python
__pycache__/
*.py[cod]
.venv/
venv/
*.egg-info/
.pytest_cache/

# Node
node_modules/
dist/
.vite/
coverage/

# Env / secrets
.env
*.local

# OS / editor
.DS_Store
.idea/
.vscode/
```

- [ ] **Step 2: Create `.env.example`**

```dotenv
# Copy to .env for local dev. NEVER commit a real .env.

# Postgres
POSTGRES_USER=healthtracker
POSTGRES_PASSWORD=change-me-in-real-env
POSTGRES_DB=healthtracker

# Backend database URL (points at the 'db' service inside the compose network)
DATABASE_URL=postgresql+psycopg://healthtracker:change-me-in-real-env@db:5432/healthtracker
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore .env.example
git commit -m "chore: add gitignore and env example"
```

---

## Task 2: Backend Python project + dependencies

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/tests/__init__.py`

- [ ] **Step 1: Create `backend/pyproject.toml`**

```toml
[project]
name = "healthcare-tracker-backend"
version = "0.1.0"
description = "Healthcare Tracker backend API"
requires-python = ">=3.12"
dependencies = [
    "fastapi==0.136.3",
    "uvicorn[standard]==0.34.0",
    "sqlalchemy==2.0.36",
    "psycopg[binary]==3.2.3",
    "pydantic-settings==2.6.1",
]

[project.optional-dependencies]
dev = [
    "pytest==8.3.4",
    "httpx==0.28.1",
]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

- [ ] **Step 2: Create empty package markers**

Create `backend/app/__init__.py` with a single line:

```python
# Healthcare Tracker backend package
```

Create `backend/tests/__init__.py` empty (zero bytes is fine; add a comment to avoid an empty file):

```python
# Backend test package
```

- [ ] **Step 3: Create a virtual environment and install deps (local sanity check)**

Run:
```bash
cd backend && python3.12 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"
```
Expected: installs FastAPI, SQLAlchemy, pytest, etc. without errors.

- [ ] **Step 4: Commit**

```bash
git add backend/pyproject.toml backend/app/__init__.py backend/tests/__init__.py
git commit -m "chore(backend): add python project and dependencies"
```

---

## Task 3: Backend config and database session

**Files:**
- Create: `backend/app/config.py`
- Create: `backend/app/database.py`

- [ ] **Step 1: Create `backend/app/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    database_url: str = (
        "postgresql+psycopg://healthtracker:change-me-in-real-env@db:5432/healthtracker"
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
```

- [ ] **Step 2: Create `backend/app/database.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Base class for all ORM models (used in later phases)."""


def get_db():
    """FastAPI dependency that yields a database session and closes it after use."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/config.py backend/app/database.py
git commit -m "feat(backend): add settings and database session"
```

---

## Task 4: Health endpoint (TDD)

**Files:**
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/health.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/conftest.py`
- Test: `backend/tests/test_health.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/conftest.py`:

```python
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """A TestClient for the FastAPI app."""
    return TestClient(app)
```

Create `backend/tests/test_health.py`:

```python
def test_health_returns_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "database" in body


def test_health_reports_database_status(client):
    response = client.get("/api/health")
    body = response.json()
    # In the test environment the DB may be up ("connected") or unreachable
    # ("unavailable"); either is a valid string, but the key must be present.
    assert body["database"] in {"connected", "unavailable"}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && . .venv/bin/activate && pytest tests/test_health.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'app.main'` (or import error), because `main.py` and the router don't exist yet.

- [ ] **Step 3: Write the router**

Create `backend/app/routers/__init__.py`:

```python
# Routers package
```

Create `backend/app/routers/health.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health(db: Session = Depends(get_db)):
    """Report API liveness and database connectivity."""
    database_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        database_status = "unavailable"
    return {"status": "ok", "database": database_status}
```

- [ ] **Step 4: Write the app entrypoint**

Create `backend/app/main.py`:

```python
from fastapi import FastAPI

from app.routers import health

app = FastAPI(title="Healthcare Tracker API", version="0.1.0")
app.include_router(health.router)
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
cd backend && . .venv/bin/activate && pytest tests/test_health.py -v
```
Expected: PASS — both tests green. (The DB is not running locally yet, so `database` will be `"unavailable"`, which the test allows.)

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/app/routers backend/tests/conftest.py backend/tests/test_health.py
git commit -m "feat(backend): add /api/health endpoint with db check"
```

---

## Task 5: Backend Dockerfile

**Files:**
- Create: `backend/Dockerfile`

- [ ] **Step 1: Create `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install dependencies first for better layer caching
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .

# Copy application code
COPY app ./app

EXPOSE 8000

# Run the API. Host 0.0.0.0 so it is reachable from other containers.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Build the image locally to verify it builds**

Run:
```bash
docker build -t healthtracker-backend:dev ./backend
```
Expected: build completes with "naming to ... healthtracker-backend:dev".

- [ ] **Step 3: Commit**

```bash
git add backend/Dockerfile
git commit -m "chore(backend): add Dockerfile"
```

---

## Task 6: Frontend project scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/setupTests.ts`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "healthcare-tracker-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.0",
    "vite": "^8.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Healthcare Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `frontend/vite.config.ts`**

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // During `vite dev`, proxy API calls to the backend container/service.
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
  },
});
```

- [ ] **Step 4: Create `frontend/src/setupTests.ts`**

```typescript
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Create `frontend/src/main.tsx`**

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Install deps to verify the manifest resolves**

Run:
```bash
cd frontend && npm install
```
Expected: completes and creates `node_modules` + `package-lock.json` without errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/index.html frontend/vite.config.ts frontend/src/main.tsx frontend/src/setupTests.ts
git commit -m "chore(frontend): scaffold vite + react project"
```

---

## Task 7: Frontend health API client + App component (TDD)

**Files:**
- Create: `frontend/src/api/health.ts`
- Create: `frontend/src/App.tsx`
- Test: `frontend/src/App.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/App.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App";

afterEach(() => {
  vi.restoreAllMocks();
});

test("renders the app title", () => {
  vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ status: "ok", database: "connected" })),
  );
  render(<App />);
  expect(screen.getByText("Healthcare Tracker")).toBeInTheDocument();
});

test("displays backend health status after fetch", async () => {
  vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ status: "ok", database: "connected" })),
  );
  render(<App />);
  await waitFor(() => {
    expect(screen.getByText(/Backend: ok/i)).toBeInTheDocument();
    expect(screen.getByText(/Database: connected/i)).toBeInTheDocument();
  });
});

test("shows an error state when the health fetch fails", async () => {
  vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
  render(<App />);
  await waitFor(() => {
    expect(screen.getByText(/Backend: unreachable/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd frontend && npm test
```
Expected: FAIL — cannot resolve `./App` (and `./api/health`) because they don't exist yet.

- [ ] **Step 3: Write the health API client**

Create `frontend/src/api/health.ts`:

```typescript
export interface HealthStatus {
  status: string;
  database: string;
}

export async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return (await response.json()) as HealthStatus;
}
```

- [ ] **Step 4: Write the App component**

Create `frontend/src/App.tsx`:

```typescript
import { useEffect, useState } from "react";
import { fetchHealth, type HealthStatus } from "./api/health";

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setErrored(true));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Healthcare Tracker</h1>
      {errored ? (
        <p>Backend: unreachable</p>
      ) : health ? (
        <p>
          Backend: {health.status} — Database: {health.database}
        </p>
      ) : (
        <p>Checking backend…</p>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
cd frontend && npm test
```
Expected: PASS — all three tests green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/health.ts frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat(frontend): landing page shows backend health status"
```

---

## Task 8: Frontend Dockerfile + Nginx config

**Files:**
- Create: `frontend/nginx.conf`
- Create: `frontend/Dockerfile`

- [ ] **Step 1: Create `frontend/nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Serve the SPA: fall back to index.html for client-side routes.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse-proxy API calls to the backend service on the compose network.
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- [ ] **Step 2: Create `frontend/Dockerfile`**

```dockerfile
# --- Build stage ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Serve stage ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

- [ ] **Step 3: Build the image locally to verify it builds**

Run:
```bash
docker build -t healthtracker-frontend:dev ./frontend
```
Expected: build completes through both stages without errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/nginx.conf frontend/Dockerfile
git commit -m "chore(frontend): add nginx config and Dockerfile"
```

---

## Task 9: Local docker-compose stack

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    environment:
      DATABASE_URL: ${DATABASE_URL}
    depends_on:
      db:
        condition: service_healthy
    expose:
      - "8000"

  frontend:
    build: ./frontend
    depends_on:
      - backend
    ports:
      - "8080:80"

volumes:
  db_data:
```

- [ ] **Step 2: Bring the stack up**

Run (from repo root, with a `.env` copied from `.env.example`):
```bash
cp .env.example .env
docker compose up -d --build
```
Expected: `db`, `backend`, and `frontend` all start; `db` becomes healthy before `backend` starts.

- [ ] **Step 3: Verify the backend health endpoint reports a connected DB**

Run:
```bash
curl -s http://localhost:8080/api/health
```
Expected: `{"status":"ok","database":"connected"}` (proves frontend→nginx→backend→db path works).

- [ ] **Step 4: Verify the frontend renders**

Run:
```bash
curl -s http://localhost:8080/ | grep -o "<title>Healthcare Tracker</title>"
```
Expected: prints `<title>Healthcare Tracker</title>`.

- [ ] **Step 5: Tear down**

Run:
```bash
docker compose down
```
Expected: containers stop and are removed; the `db_data` volume persists.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add local docker-compose stack"
```

---

## Task 10: GitHub Actions — build and publish images to GHCR

**Files:**
- Create: `.github/workflows/build-and-publish.yml`

- [ ] **Step 1: Create `.github/workflows/build-and-publish.yml`**

```yaml
name: Build and Publish Images

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        include:
          - name: backend
            context: ./backend
          - name: frontend
            context: ./frontend
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Compute lowercase image name
        id: img
        run: echo "name=${REGISTRY}/${GITHUB_REPOSITORY,,}-${{ matrix.name }}" >> "$GITHUB_OUTPUT"

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: ${{ matrix.context }}
          push: true
          tags: |
            ${{ steps.img.outputs.name }}:latest
            ${{ steps.img.outputs.name }}:${{ github.sha }}
```

- [ ] **Step 2: Validate the workflow YAML syntax locally**

Run:
```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/build-and-publish.yml')); print('YAML OK')"
```
Expected: prints `YAML OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build-and-publish.yml
git commit -m "ci: build and publish backend+frontend images to GHCR"
```

- [ ] **Step 4: Push and confirm the workflow runs (manual verification)**

After pushing to `main` on GitHub, open the repo's **Actions** tab and confirm the "Build and Publish Images" run succeeds and that two packages appear under the repo's **Packages**: `...-backend` and `...-frontend`. (This step requires the GitHub remote to exist; if the repo is not yet on GitHub, note this as the first action when the remote is created.)

---

## Task 11: Production compose file (Portainer pulls GHCR images)

**Files:**
- Create: `docker-compose.prod.yml`

- [ ] **Step 1: Create `docker-compose.prod.yml`**

Replace `OWNER/REPO` placeholders with the actual lowercase `owner/repo` once the GitHub repo exists (documented in README, Task 12).

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  backend:
    image: ghcr.io/OWNER/REPO-backend:latest
    environment:
      DATABASE_URL: ${DATABASE_URL}
    depends_on:
      db:
        condition: service_healthy
    expose:
      - "8000"
    restart: unless-stopped

  frontend:
    image: ghcr.io/OWNER/REPO-frontend:latest
    depends_on:
      - backend
    ports:
      - "8080:80"
    restart: unless-stopped

  # NOTE (Phase 1 placeholder): the cloudflared tunnel container is added when
  # the app is first exposed publicly at healthcare.spicylimeslabs.com. It will
  # point at the `frontend` service on port 80 and reuse the existing tunnel +
  # Cloudflare Access. Not configured in this phase.

volumes:
  db_data:
```

- [ ] **Step 2: Validate the compose file syntax**

Run:
```bash
docker compose -f docker-compose.prod.yml config -q && echo "compose OK"
```
Expected: prints `compose OK` (note: env interpolation warnings for unset vars are acceptable here; the goal is structural validity).

- [ ] **Step 3: Commit**

```bash
git add docker-compose.prod.yml
git commit -m "feat: add production compose file for GHCR images"
```

---

## Task 12: README deployment documentation

**Files:**
- Modify: `README.md` (append a Development & Deployment section)

- [ ] **Step 1: Append the following section to `README.md`**

````markdown

---

## Development & Deployment (Phase 1)

### Local development

```bash
cp .env.example .env        # adjust values as needed
docker compose up -d --build
# App:           http://localhost:8080
# Health check:  http://localhost:8080/api/health  -> {"status":"ok","database":"connected"}
docker compose down
```

Run tests:

```bash
# Backend
cd backend && python3.12 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]" && pytest -v
# Frontend
cd frontend && npm install && npm test
```

### How deployment works

1. Push to `main` on GitHub.
2. GitHub Actions (`.github/workflows/build-and-publish.yml`) builds the
   `backend` and `frontend` images and publishes them to the GitHub Container
   Registry (GHCR) under this repo's Packages.
3. On the LAN server, a Portainer stack uses `docker-compose.prod.yml` to pull
   the prebuilt images and run them.

### Deploying on the LAN server (Portainer)

1. In `docker-compose.prod.yml`, replace `OWNER/REPO` with this repo's lowercase
   `owner/repo`.
2. Create a Portainer stack from `docker-compose.prod.yml`.
3. Provide the environment variables (`POSTGRES_USER`, `POSTGRES_PASSWORD`,
   `POSTGRES_DB`, `DATABASE_URL`) via Portainer's stack env settings — do NOT
   commit real secrets.
4. Deploy. Portainer pulls the images and starts `db`, `backend`, `frontend`.

### Not yet wired (later phases)

- `cloudflared` tunnel + Cloudflare Access for `healthcare.spicylimeslabs.com`
  (reuses the existing tunnel currently fronting `ai.spicylimeslabs.com`).
- Authentication, roles, health-record sections, document uploads, share links,
  audit log, and backups.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add Phase 1 development and deployment guide"
```

---

## Phase 1 Completion Criteria

Phase 1 is complete when all of the following are true:

- [ ] `docker compose up -d --build` brings up `db`, `backend`, `frontend` locally.
- [ ] `curl http://localhost:8080/api/health` returns `{"status":"ok","database":"connected"}`.
- [ ] `cd backend && pytest -v` passes.
- [ ] `cd frontend && npm test` passes.
- [ ] The GitHub Actions workflow builds and pushes `backend` and `frontend`
      images to GHCR on push to `main` (verified in the Actions tab + Packages).
- [ ] `docker-compose.prod.yml` exists and references the GHCR images.
- [ ] README documents local dev, the GHCR build/publish flow, and Portainer deploy.

When these pass, the foundation is proven end to end and we return to brainstorm/
plan **Phase 2: Auth & Roles**.
