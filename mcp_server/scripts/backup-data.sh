#!/bin/bash

# Neo4j Data Backup Script to S3-Compatible Storage
# Backs up Neo4j data directory by creating a compressed archive
#
# Environment variables:
#   S3_BACKUP_BUCKET       - S3 bucket name (required)
#   S3_BACKUP_PATH         - Path prefix in bucket (default: graphiti-backups)
#   AWS_ACCESS_KEY_ID      - S3 access key (required)
#   AWS_SECRET_ACCESS_KEY  - S3 secret key (required)
#   AWS_DEFAULT_REGION     - AWS region (default: us-east-1)
#   AWS_ENDPOINT_URL       - Custom S3 endpoint for R2/MinIO (optional)
#   BACKUP_RETENTION_DAYS  - Days to keep backups (default: 7)

set -e

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="neo4j_backup_${TIMESTAMP}.tar.gz"
DATA_DIR="/data"
TEMP_DIR="/tmp/backup"
S3_BUCKET="${S3_BACKUP_BUCKET}"
S3_PATH="${S3_BACKUP_PATH:-graphiti-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Validate required environment variables
if [ -z "$S3_BUCKET" ]; then
    log_error "S3_BACKUP_BUCKET is not set. Skipping backup."
    exit 0  # Exit gracefully to not crash the container
fi

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    log_warn "AWS credentials not set. Skipping backup."
    exit 0
fi

log_info "Starting Neo4j data backup..."
log_info "Backup name: $BACKUP_NAME"

# Create temp directory
mkdir -p "$TEMP_DIR"

# Create compressed archive
log_info "Creating compressed archive of Neo4j data..."
if ! tar -czf "$TEMP_DIR/$BACKUP_NAME" -C /data . 2>&1; then
    log_error "Failed to create backup archive"
    rm -rf "$TEMP_DIR"
    exit 1
fi

BACKUP_SIZE=$(du -h "$TEMP_DIR/$BACKUP_NAME" | cut -f1)
log_info "Backup archive created: $BACKUP_SIZE"

# Prepare AWS CLI arguments
AWS_ARGS=""
if [ -n "$AWS_ENDPOINT_URL" ]; then
    AWS_ARGS="--endpoint-url=$AWS_ENDPOINT_URL"
    log_info "Using S3 endpoint: $AWS_ENDPOINT_URL"
fi

# Upload to S3
log_info "Uploading to s3://$S3_BUCKET/$S3_PATH/$BACKUP_NAME..."
aws s3 cp "$TEMP_DIR/$BACKUP_NAME" "s3://$S3_BUCKET/$S3_PATH/$BACKUP_NAME" $AWS_ARGS

if [ $? -eq 0 ]; then
    log_info "✓ Backup uploaded successfully"

    # Cleanup old backups using Python for date calculation
    if [ "$RETENTION_DAYS" -gt 0 ]; then
        log_info "Cleaning up backups older than $RETENTION_DAYS days..."

        # Calculate cutoff date using Python
        CUTOFF_DATE=$(python3 -c "
from datetime import datetime, timedelta
cutoff = datetime.now() - timedelta(days=$RETENTION_DAYS)
print(cutoff.strftime('%Y%m%d'))
")

        log_info "Cutoff date: $CUTOFF_DATE (backups before this will be deleted)"

        # List and delete old backups based on filename date
        aws s3 ls "s3://$S3_BUCKET/$S3_PATH/" $AWS_ARGS | grep "neo4j_backup_" | while read -r line; do
            BACKUP_FILE=$(echo "$line" | awk '{print $4}')
            # Extract date from filename (format: neo4j_backup_YYYYMMDD_HHMMSS.tar.gz)
            BACKUP_DATE=$(echo "$BACKUP_FILE" | grep -o '[0-9]\{8\}' | head -1)

            if [ -n "$BACKUP_DATE" ] && [ "$BACKUP_DATE" -lt "$CUTOFF_DATE" ]; then
                log_info "Deleting old backup: $BACKUP_FILE (date: $BACKUP_DATE)"
                aws s3 rm "s3://$S3_BUCKET/$S3_PATH/$BACKUP_FILE" $AWS_ARGS
            fi
        done

        log_info "Cleanup completed"
    fi

    log_info "Backup completed successfully"
else
    log_error "Failed to upload backup to S3"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Cleanup temp files
rm -rf "$TEMP_DIR"

log_info "Backup process finished"
