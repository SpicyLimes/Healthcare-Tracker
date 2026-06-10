FROM python:3.12-slim

WORKDIR /app

# Install dependencies first for better layer caching.
# Pins match backend/pyproject.toml exactly; no editable install needed
# because uvicorn resolves the app by module path (app.main:app) with
# WORKDIR /app already on the Python path.
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
    "filetype==1.2.0"

# Copy Alembic config and application code (migrations live under app/migrations)
COPY alembic.ini ./
COPY app ./app

EXPOSE 8000

RUN adduser --disabled-password --gecos "" appuser && \
    mkdir -p /app/uploads && \
    chown -R appuser:appuser /app/uploads
USER appuser

# Apply migrations, then run the API. Host 0.0.0.0 for inter-container reach.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
