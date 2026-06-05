#!/usr/bin/env bash
set -euo pipefail

DATE=$(date +%Y-%m-%d)
DEST="/backups/${DATE}"
mkdir -p "${DEST}"

echo "[backup] $(date -u +%FT%TZ) — starting backup for ${DATE}"

# Strip SQLAlchemy driver prefix so pg_dump gets a valid libpq URL
LIBPQ_URL=$(echo "${DATABASE_URL}" | sed 's|postgresql+[^:]*://|postgresql://|')

# DB dump
echo "[backup] dumping database..."
pg_dump "${LIBPQ_URL}" > "${DEST}/db.sql"
gzip "${DEST}/db.sql"
echo "[backup] database dump complete: ${DEST}/db.sql.gz"

# Uploads archive
echo "[backup] archiving uploads..."
tar -czf "${DEST}/uploads.tar.gz" -C /app uploads
echo "[backup] uploads archive complete: ${DEST}/uploads.tar.gz"

# Prune backups older than 7 days
echo "[backup] pruning backups older than 7 days..."
find /backups -mindepth 1 -maxdepth 1 -type d -name "????-??-??" | sort | head -n -7 | xargs -r rm -rf
echo "[backup] pruning complete"

echo "[backup] $(date -u +%FT%TZ) — backup finished successfully"
