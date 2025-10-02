#!/bin/bash

# Simple Neo4j Restore Script
# Downloads backup from S3, stops Neo4j, restores data, restarts Neo4j

set -e

BACKUP_FILE="$1"
NEO4J_CONTAINER="${NEO4J_CONTAINER:-mcp_server-neo4j-1}"
VOLUME_NAME="${VOLUME_NAME:-mcp_server_neo4j_data}"
S3_BUCKET="${S3_BACKUP_BUCKET}"
S3_PATH="${S3_BACKUP_PATH:-graphiti-backups}"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_filename>"
    echo ""
    echo "List available backups:"
    AWS_ARGS=""
    [ -n "$AWS_ENDPOINT_URL" ] && AWS_ARGS="--endpoint-url=$AWS_ENDPOINT_URL"
    aws s3 ls "s3://$S3_BUCKET/$S3_PATH/" $AWS_ARGS
    exit 1
fi

# Validate S3 configuration
if [ -z "$S3_BUCKET" ] || [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "ERROR: S3 configuration missing"
    exit 1
fi

echo "========================================="
echo "  Neo4j Database Restore"
echo "========================================="
echo "Backup file: $BACKUP_FILE"
echo ""
echo "WARNING: This will DELETE ALL CURRENT DATA"
echo "========================================="
read -p "Type 'yes' to continue: " -r
echo
if [ "$REPLY" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Step 1: Download backup from S3
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Downloading backup from S3..."
AWS_ARGS=""
[ -n "$AWS_ENDPOINT_URL" ] && AWS_ARGS="--endpoint-url=$AWS_ENDPOINT_URL"

aws s3 cp "s3://$S3_BUCKET/$S3_PATH/$BACKUP_FILE" "/tmp/$BACKUP_FILE" $AWS_ARGS

BACKUP_SIZE=$(ls -lh "/tmp/$BACKUP_FILE" | awk '{print $5}')
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Downloaded: $BACKUP_SIZE"

# Step 2: Stop Neo4j container
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Stopping Neo4j container..."
docker stop "$NEO4J_CONTAINER"

# Step 3: Clear volume and restore from backup
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Restoring data..."
docker run --rm \
    -v "$VOLUME_NAME":/data \
    -v /tmp:/backup:ro \
    alpine:3.19 \
    sh -c "rm -rf /data/* /data/..?* /data/.[!.]* 2>/dev/null; tar -xzf /backup/$BACKUP_FILE -C /data"

# Step 4: Restart Neo4j container
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Starting Neo4j container..."
docker start "$NEO4J_CONTAINER"

# Cleanup
rm -f "/tmp/$BACKUP_FILE"

echo "========================================="
echo "  Restore completed successfully!"
echo "========================================="
echo "Wait ~30 seconds for Neo4j to start"
