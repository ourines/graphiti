FROM python:3.11-alpine

# Install required packages
RUN apk add --no-cache \
    bash \
    curl \
    dcron \
    openjdk17-jre \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Install Python dependencies
RUN pip install --no-cache-dir \
    boto3 \
    botocore \
    croniter \
    fastapi \
    neo4j \
    "uvicorn[standard]"

# Install Neo4j Cypher Shell
RUN wget https://dist.neo4j.org/cypher-shell/cypher-shell-5.26.0.zip \
    && unzip cypher-shell-5.26.0.zip \
    && mv cypher-shell-5.26.0 /opt/cypher-shell \
    && chmod +x /opt/cypher-shell/bin/cypher-shell \
    && ln -s /opt/cypher-shell/bin/cypher-shell /usr/local/bin/cypher-shell \
    && rm -rf cypher-shell-5.26.0.zip

# Copy backup service files
COPY neo4j-backup/ /app/

# Make scripts executable
RUN chmod +x /app/backup.py /app/entrypoint.sh

# Create backup directory
RUN mkdir -p /backups

# Create necessary directories
RUN mkdir -p /var/log

# Health check - verify cron is running
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD pgrep crond || exit 1

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]
