#!/usr/bin/env bash
set -euo pipefail

DATE="${1:-}"
if [ -z "${DATE}" ]; then
    echo "[restore] ERROR: usage: restore.sh YYYY-MM-DD" >&2
    exit 1
fi

SRC="/backups/${DATE}"
if [ ! -d "${SRC}" ]; then
    echo "[restore] ERROR: backup directory not found: ${SRC}" >&2
    exit 1
fi

echo "[restore] $(date -u +%FT%TZ) — restoring from ${DATE}"

# Strip SQLAlchemy driver prefix so psql gets a valid libpq URL
LIBPQ_URL=$(echo "${DATABASE_URL}" | sed 's|postgresql+[^:]*://|postgresql://|')

# Restore DB
echo "[restore] restoring database..."
DB_NAME=$(echo "${LIBPQ_URL}" | sed 's/.*\///')
BASE_URL=$(echo "${LIBPQ_URL}" | sed "s|/${DB_NAME}$|/postgres|")
psql "${BASE_URL}" -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";"
psql "${BASE_URL}" -c "CREATE DATABASE \"${DB_NAME}\";"
gunzip -c "${SRC}/db.sql.gz" | psql "${LIBPQ_URL}"
echo "[restore] database restored"

# Restore uploads
echo "[restore] restoring uploads..."
TEMP_UPLOADS=$(mktemp -d)
tar -xzf "${SRC}/uploads.tar.gz" -C "${TEMP_UPLOADS}"
rm -rf /app/uploads
mv "${TEMP_UPLOADS}/uploads" /app/uploads
rmdir "${TEMP_UPLOADS}" 2>/dev/null || true
echo "[restore] uploads restored"

echo "[restore] $(date -u +%FT%TZ) — restore complete"
