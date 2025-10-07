#!/bin/bash
set -e

echo "[INFO] ============================================================"
echo "[INFO] Neo4j to R2 Backup Service"
echo "[INFO] ============================================================"
echo "[INFO] Configuration:"
echo "  - Backup schedule: ${BACKUP_SCHEDULE:-0 2 * * *}"
echo "  - Retention days: ${BACKUP_RETENTION_DAYS:-7}"
echo "  - Compression: ${BACKUP_COMPRESSION:-true}"
echo "  - R2 Bucket: ${R2_BUCKET_NAME}"
echo "  - Neo4j Host: ${NEO4J_HOST:-neo4j}"
echo "  - Neo4j Database: ${NEO4J_DATABASE:-neo4j}"
echo "[INFO] ============================================================"

# Validate required environment variables
if [ -z "$NEO4J_PASSWORD" ]; then
    echo "[ERROR] NEO4J_PASSWORD is required"
    exit 1
fi

if [ -z "$R2_ACCOUNT_ID" ] || [ -z "$R2_ACCESS_KEY_ID" ] || [ -z "$R2_SECRET_ACCESS_KEY" ] || [ -z "$R2_BUCKET_NAME" ]; then
    echo "[ERROR] R2 credentials are required"
    echo "        Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"
    exit 1
fi

# Wait for Neo4j to be ready
echo "[INFO] Waiting for Neo4j to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if cypher-shell -a "bolt://${NEO4J_HOST:-neo4j}:${NEO4J_BOLT_PORT:-7687}" \
                     -u "${NEO4J_USER:-neo4j}" \
                     -p "${NEO4J_PASSWORD}" \
                     "RETURN 1" > /dev/null 2>&1; then
        echo "[INFO] Neo4j is ready!"
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "[INFO] Waiting for Neo4j... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 5
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "[ERROR] Neo4j did not become ready in time"
    exit 1
fi

# Run immediate backup if requested
if [ "${RUN_IMMEDIATE_BACKUP:-false}" = "true" ]; then
    echo "[INFO] Running immediate backup..."
    python3 /app/backup.py
    echo "[INFO] Immediate backup completed"
fi

# Setup cron schedule
CRON_SCHEDULE="${BACKUP_SCHEDULE:-0 2 * * *}"

# Write crontab
echo "$CRON_SCHEDULE /usr/local/bin/python3 /app/backup.py > /proc/1/fd/1 2>&1" > /var/spool/cron/crontabs/root
chmod 600 /var/spool/cron/crontabs/root

echo "[INFO] Cron schedule configured: $CRON_SCHEDULE"
echo "[INFO] Next backup will run at configured time"
echo "[INFO] Starting cron daemon..."
echo "[INFO] ============================================================"

# Start cron in background
crond

# Keep container alive and tail cron logs
echo "[INFO] Backup service is running. Waiting for scheduled backups..."
tail -f /dev/null
