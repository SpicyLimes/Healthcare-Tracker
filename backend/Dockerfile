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
    "pydantic-settings==2.6.1"

# Copy application code
COPY app ./app

EXPOSE 8000

# Run the API. Host 0.0.0.0 so it is reachable from other containers.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
