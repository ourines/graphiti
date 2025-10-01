#!/bin/bash

# Neo4j Restore Script from S3-Compatible Storage
# This script restores a Neo4j database from S3-compatible storage (AWS S3, MinIO, R2, etc.)
#
# Usage:
#   ./restore.sh [database_name] [backup_name]
#
# Environment variables:
#   S3_BACKUP_BUCKET       - S3 bucket name (required)
#   S3_BACKUP_PATH         - Path prefix in bucket (default: graphiti-backups)
#   AWS_ACCESS_KEY_ID      - S3 access key (required)
#   AWS_SECRET_ACCESS_KEY  - S3 secret key (required)
#   AWS_DEFAULT_REGION     - AWS region (default: us-east-1)
#   AWS_ENDPOINT_URL       - Custom S3 endpoint for compatible services (optional)

set -e  # Exit on error

# Configuration
DATABASE_NAME="${1:-neo4j}"
BACKUP_NAME="${2}"
S3_BUCKET="${S3_BACKUP_BUCKET}"
S3_PATH="${S3_BACKUP_PATH:-graphiti-backups}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate required parameters
if [ -z "$BACKUP_NAME" ]; then
    log_error "Backup name is required"
    echo "Usage: $0 [database_name] <backup_name>"
    echo ""
    echo "Example:"
    echo "  $0 neo4j neo4j_20250102_153045"
    exit 1
fi

# Validate required environment variables
if [ -z "$S3_BUCKET" ]; then
    log_error "S3_BACKUP_BUCKET environment variable is not set"
    exit 1
fi

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    log_error "AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are not set"
    exit 1
fi

log_info "Starting restore of database: $DATABASE_NAME"
log_info "From backup: $BACKUP_NAME"

# Construct the S3 path
S3_FULL_PATH="s3://$S3_BUCKET/$S3_PATH/$BACKUP_NAME"

# Add endpoint URL if provided (for S3-compatible services)
ENDPOINT_FLAG=""
if [ -n "$AWS_ENDPOINT_URL" ]; then
    ENDPOINT_FLAG="--cloud-endpoint-url=$AWS_ENDPOINT_URL"
    log_info "Using custom S3 endpoint: $AWS_ENDPOINT_URL"
fi

# Warning message
log_warn "This will restore the database '$DATABASE_NAME' from backup '$BACKUP_NAME'"
log_warn "The database must be offline before restoring"
echo ""
read -p "Do you want to continue? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy](es)?$ ]]; then
    log_info "Restore cancelled"
    exit 0
fi

# Execute restore
log_info "Executing Neo4j restore command..."
neo4j-admin database restore \
    --from-path="$S3_FULL_PATH" \
    $ENDPOINT_FLAG \
    "$DATABASE_NAME"

if [ $? -eq 0 ]; then
    log_info "Restore completed successfully!"
    echo ""
    log_info "Next steps:"
    echo "  1. Start Neo4j database"
    echo "  2. Verify data integrity"
else
    log_error "Restore failed!"
    exit 1
fi
