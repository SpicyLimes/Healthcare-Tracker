FROM alpine:3.21

# tzdata is required for TZ to have any effect: without it Alpine silently
# stays on UTC, so `TZ=America/Chicago` would look configured but do nothing.
RUN apk add --no-cache postgresql17-client bash tzdata

COPY backup.sh /usr/local/bin/backup.sh
COPY restore.sh /usr/local/bin/restore.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/entrypoint.sh

# Nightly at 2:00 AM in TZ (set via the compose env var; defaults to UTC).
# crond reads the container's local time, so TZ is what makes "0 2" mean 2 AM
# where the operator lives rather than 2 AM UTC.
RUN echo "0 2 * * * /usr/local/bin/backup.sh 2>&1 | tee -a /var/log/backup.log" > /etc/crontabs/root

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
