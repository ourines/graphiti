#!/bin/bash

# Entrypoint script for backup service
# Allows customizing backup schedule via BACKUP_CRON environment variable

set -e

echo "[INFO] Starting Neo4j Backup Service"

# Check if custom cron schedule is provided
if [ -n "$BACKUP_CRON" ]; then
    echo "[INFO] Using custom backup schedule: $BACKUP_CRON"
    echo "$BACKUP_CRON /usr/local/bin/backup-data.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root
else
    echo "[INFO] Using default backup schedule: 0 2 * * * (daily at 2 AM UTC)"
fi

# Validate S3 configuration
if [ -z "$S3_BACKUP_BUCKET" ]; then
    echo "[WARN] S3_BACKUP_BUCKET not set. Backups will be skipped."
    echo "[WARN] To enable backups, set S3_BACKUP_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY"
else
    echo "[INFO] Backup target: s3://$S3_BACKUP_BUCKET/${S3_BACKUP_PATH:-graphiti-backups}"
    echo "[INFO] Retention period: ${BACKUP_RETENTION_DAYS:-7} days"

    # Perform initial backup on startup if BACKUP_ON_START is set
    if [ "$BACKUP_ON_START" = "true" ]; then
        echo "[INFO] Performing initial backup on startup..."
        /usr/local/bin/backup-data.sh
    fi
fi

# Execute the command passed to the container (usually crond)
exec "$@"
