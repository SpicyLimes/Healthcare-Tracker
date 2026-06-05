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

# Restore DB
echo "[restore] restoring database..."
# Extract db name from DATABASE_URL (postgresql://user:pass@host:port/dbname)
DB_NAME=$(echo "${DATABASE_URL}" | sed 's/.*\///')
# Connect to postgres (default db) to drop/recreate target db
BASE_URL=$(echo "${DATABASE_URL}" | sed "s|/${DB_NAME}$|/postgres|")
psql "${BASE_URL}" -c "DROP DATABASE IF EXISTS ${DB_NAME};"
psql "${BASE_URL}" -c "CREATE DATABASE ${DB_NAME};"
gunzip -c "${SRC}/db.sql.gz" | psql "${DATABASE_URL}"
echo "[restore] database restored"

# Restore uploads
echo "[restore] restoring uploads..."
rm -rf /app/uploads/*
tar -xzf "${SRC}/uploads.tar.gz" -C /app
echo "[restore] uploads restored"

echo "[restore] $(date -u +%FT%TZ) — restore complete"
