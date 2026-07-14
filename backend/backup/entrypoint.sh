#!/usr/bin/env bash
set -euo pipefail

# Ensure the backup directory exists (auto-created on first startup)
mkdir -p /backups
# Backend runs as uid 1000 (appuser) and manages backups via the web app
chown -R 1000:1000 /backups || true

if [ "${1:-}" = "restore" ]; then
    shift
    exec /usr/local/bin/restore.sh "$@"
fi

# Default: start cron daemon in foreground
exec crond -f -l 2
