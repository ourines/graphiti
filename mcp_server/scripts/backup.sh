#!/bin/bash

# Simple Neo4j Backup Script
# Stops Neo4j container, creates tar.gz backup, restarts container, uploads to S3

set -e

NEO4J_CONTAINER="${NEO4J_CONTAINER:-mcp_server-neo4j-1}"
VOLUME_NAME="${VOLUME_NAME:-mcp_server_neo4j_data}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="neo4j_${TIMESTAMP}.tar.gz"
S3_BUCKET="${S3_BACKUP_BUCKET}"
S3_PATH="${S3_BACKUP_PATH:-graphiti-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Starting Neo4j backup..."

# Validate S3 configuration
if [ -z "$S3_BUCKET" ] || [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: S3 configuration missing"
    exit 0
fi

# Step 1: Stop Neo4j container
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Stopping Neo4j container (downtime starts)..."
docker stop "$NEO4J_CONTAINER"

# Step 2: Create tar.gz backup from volume
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Creating backup archive..."
docker run --rm \
    -v "$VOLUME_NAME":/data:ro \
    -v /tmp:/backup \
    alpine:3.19 \
    tar -czf "/backup/$BACKUP_NAME" -C /data .

BACKUP_SIZE=$(ls -lh "/tmp/$BACKUP_NAME" | awk '{print $5}')
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Backup created: $BACKUP_SIZE"

# Step 3: Restart Neo4j container
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Starting Neo4j container (downtime ends)..."
docker start "$NEO4J_CONTAINER"

# Step 4: Upload to S3
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Uploading to s3://$S3_BUCKET/$S3_PATH/..."
AWS_ARGS=""
[ -n "$AWS_ENDPOINT_URL" ] && AWS_ARGS="--endpoint-url=$AWS_ENDPOINT_URL"

aws s3 cp "/tmp/$BACKUP_NAME" "s3://$S3_BUCKET/$S3_PATH/$BACKUP_NAME" $AWS_ARGS

if [ $? -eq 0 ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✓ Upload successful"
    rm -f "/tmp/$BACKUP_NAME"

    # Cleanup old backups
    if [ "$RETENTION_DAYS" -gt 0 ]; then
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] Cleaning up backups older than $RETENTION_DAYS days..."
        # Calculate cutoff date (BusyBox-compatible using Python from aws-cli)
        CUTOFF_DATE=$(python3 -c "from datetime import datetime, timedelta; print((datetime.now() - timedelta(days=$RETENTION_DAYS)).strftime('%Y%m%d'))" 2>/dev/null || echo "")

        if [ -n "$CUTOFF_DATE" ]; then
            aws s3 ls "s3://$S3_BUCKET/$S3_PATH/" $AWS_ARGS | grep "neo4j_" | while read -r line; do
                FILE=$(echo "$line" | awk '{print $4}')
                FILE_DATE=$(echo "$FILE" | grep -o '[0-9]\{8\}' | head -1)
                if [ -n "$FILE_DATE" ] && [ "$FILE_DATE" -lt "$CUTOFF_DATE" ]; then
                    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Deleting old backup: $FILE"
                    aws s3 rm "s3://$S3_BUCKET/$S3_PATH/$FILE" $AWS_ARGS
                fi
            done
        fi
    fi

    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Backup completed successfully"
else
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: Upload failed"
    rm -f "/tmp/$BACKUP_NAME"
    exit 1
fi
