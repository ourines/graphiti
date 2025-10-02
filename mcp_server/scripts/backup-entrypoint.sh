#!/bin/bash

# Entrypoint for backup service

set -e

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Starting Neo4j Backup Service"

# Check if custom cron schedule is provided
if [ -n "$BACKUP_CRON" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Custom schedule: $BACKUP_CRON"
    echo "$BACKUP_CRON /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root
else
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Default schedule: 0 2 * * * (daily at 2 AM UTC)"
fi

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Backup service ready"

# Execute cron
exec "$@"
