FROM python:3.12-slim

WORKDIR /app

# Install dependencies first for better layer caching.
# Pins match the [project.dependencies] block in backend/pyproject.toml exactly
# (NOT the dev extras); no editable install needed because uvicorn resolves the
# app by module path (app.main:app) with WORKDIR /app already on the Python path.
# Keep this list in sync with pyproject's runtime dependencies.
RUN pip install --no-cache-dir \
    "fastapi==0.136.3" \
    "uvicorn[standard]==0.34.0" \
    "sqlalchemy==2.0.36" \
    "psycopg[binary]==3.2.3" \
    "pydantic-settings==2.6.1" \
    "pyjwt==2.13.0" \
    "pwdlib[argon2]==0.3.0" \
    "alembic==1.18.4" \
    "email-validator==2.2.0" \
    "python-multipart==0.0.32" \
    "slowapi==0.1.9" \
    "filetype==1.2.0" \
    "httpx==0.28.1"

# Postgres 17 client tools (pg_dump/psql) for the admin Backups feature.
# Debian slim ships postgresql-client-15, and pg_dump refuses servers newer
# than itself, so pull v17 from the official PGDG repo.
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
 && mkdir -p /etc/apt/keyrings \
 && curl -fsSL -o /etc/apt/keyrings/pgdg.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
 && echo "deb [signed-by=/etc/apt/keyrings/pgdg.asc] http://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo "$VERSION_CODENAME")-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update && apt-get install -y --no-install-recommends postgresql-client-17 \
 && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Copy Alembic config and application code (migrations live under app/migrations)
COPY alembic.ini ./
COPY app ./app

EXPOSE 8000

RUN adduser --disabled-password --gecos "" appuser && \
    mkdir -p /app/uploads /backups && \
    chown -R appuser:appuser /app/uploads /backups
USER appuser

# Apply migrations, then run the API. Host 0.0.0.0 for inter-container reach.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
