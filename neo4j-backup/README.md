# Neo4j to R2 Backup Service

Automated Neo4j database backup service that exports data to Cloudflare R2 storage.

## Features

- ✅ **Automated Scheduled Backups** - Cron-based scheduling (default: daily at 2 AM)
- ✅ **Online Backups** - No database downtime required (uses Cypher export)
- ✅ **Compression** - Gzip compression to reduce storage costs
- ✅ **R2 Cloud Storage** - Reliable offsite backup to Cloudflare R2
- ✅ **Automatic Cleanup** - Removes old backups based on retention policy
- ✅ **APOC Support** - Uses APOC export if available, falls back to manual export
- ✅ **Configurable** - Environment-based configuration
- ✅ **Health Checks** - Built-in health monitoring

## Quick Start

### 1. Configure R2 Storage

Create a Cloudflare R2 bucket and obtain credentials:

1. Log in to Cloudflare Dashboard
2. Navigate to R2 → Create bucket
3. Create API token with R2 edit permissions
4. Note down:
   - Account ID
   - Access Key ID
   - Secret Access Key
   - Bucket Name

### 2. Set Environment Variables

Create a `.env` file in the project root:

```bash
# Required - Neo4j credentials
NEO4J_PASSWORD=your_neo4j_password

# Required - R2 Storage
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=graphiti-neo4j-backup

# Optional - Backup Configuration
BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM (cron format)
BACKUP_RETENTION_DAYS=7     # Keep backups for 7 days
BACKUP_COMPRESSION=true     # Enable gzip compression
BACKUP_PREFIX=neo4j-backup  # Prefix for R2 objects
RUN_IMMEDIATE_BACKUP=false  # Run backup on service start
```

### 3. Start the Backup Service

```bash
# Start all services including backup
docker-compose up -d

# Or start only the backup service
docker-compose up -d neo4j-backup

# Check backup service logs
docker-compose logs -f neo4j-backup
```

### 4. Verify Backups

Check your R2 bucket for backup files:
- Format: `neo4j-backup/neo4j_YYYY-MM-DD_HH-MM-SS.cypher.gz`
- Example: `neo4j-backup/neo4j_2025-10-08_02-00-00.cypher.gz`

## Configuration

### Environment Variables

#### Neo4j Connection

| Variable | Default | Description |
|----------|---------|-------------|
| `NEO4J_HOST` | `neo4j` | Neo4j hostname |
| `NEO4J_BOLT_PORT` | `7687` | Neo4j Bolt port |
| `NEO4J_USER` | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | *required* | Neo4j password |
| `NEO4J_DATABASE` | `neo4j` | Database name |

#### R2 Storage (Required)

| Variable | Default | Description |
|----------|---------|-------------|
| `R2_ACCOUNT_ID` | *required* | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | *required* | R2 access key ID |
| `R2_SECRET_ACCESS_KEY` | *required* | R2 secret access key |
| `R2_BUCKET_NAME` | *required* | R2 bucket name |

#### Backup Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_SCHEDULE` | `0 2 * * *` | Cron schedule (daily 2 AM) |
| `BACKUP_RETENTION_DAYS` | `7` | Days to keep old backups |
| `BACKUP_COMPRESSION` | `true` | Enable gzip compression |
| `BACKUP_PREFIX` | `neo4j-backup` | Prefix for R2 object keys |
| `RUN_IMMEDIATE_BACKUP` | `false` | Run backup on service start |

### Cron Schedule Examples

```bash
# Every day at 2 AM
BACKUP_SCHEDULE="0 2 * * *"

# Every 6 hours
BACKUP_SCHEDULE="0 */6 * * *"

# Every Monday at 3 AM
BACKUP_SCHEDULE="0 3 * * 1"

# Every day at 1 AM and 1 PM
BACKUP_SCHEDULE="0 1,13 * * *"
```

Cron format: `minute hour day month weekday`

## Manual Backup

Trigger a manual backup:

```bash
# Execute backup script inside running container
docker-compose exec neo4j-backup python3 /app/backup.py

# Or rebuild and restart with immediate backup
RUN_IMMEDIATE_BACKUP=true docker-compose up -d neo4j-backup
```

## Restore from Backup

### 1. Download Backup from R2

```bash
# Using AWS CLI (R2 is S3-compatible)
aws s3 cp \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com \
  s3://graphiti-neo4j-backup/neo4j-backup/neo4j_2025-10-08_02-00-00.cypher.gz \
  ./restore.cypher.gz

# Decompress
gunzip restore.cypher.gz
```

### 2. Restore to Neo4j

```bash
# Using cypher-shell
docker-compose exec neo4j cypher-shell -u neo4j -p <password> < restore.cypher

# Or connect to Neo4j and run the Cypher script
docker-compose exec neo4j cypher-shell -u neo4j -p <password>
neo4j> :source /path/to/restore.cypher
```

## Monitoring

### Check Service Status

```bash
# View service logs
docker-compose logs -f neo4j-backup

# Check service health
docker-compose ps neo4j-backup

# View cron jobs
docker-compose exec neo4j-backup crontab -l
```

### Expected Log Output

```
[INFO] ============================================================
[INFO] Neo4j to R2 Backup Service
[INFO] ============================================================
[INFO] Configuration:
  - Backup schedule: 0 2 * * *
  - Retention days: 7
  - Compression: true
  - R2 Bucket: graphiti-neo4j-backup
  - Neo4j Host: neo4j
  - Neo4j Database: neo4j
[INFO] ============================================================
[INFO] Waiting for Neo4j to be ready...
[INFO] Neo4j is ready!
[INFO] Cron schedule configured: 0 2 * * *
[INFO] Next backup will run at configured time
[INFO] Starting cron daemon...
```

### Backup Process Logs

```
[INFO] Starting Neo4j backup process
[INFO] Connecting to Neo4j: bolt://neo4j:7687
[INFO] Connected successfully, starting export...
[INFO] APOC detected (version: 5.23.0), using APOC export
[INFO] Compressing neo4j_2025-10-08_02-00-00.cypher...
[INFO] Compression complete: 2.45 MB (78.3% reduction)
[INFO] Uploading to R2: neo4j-backup/neo4j_2025-10-08_02-00-00.cypher.gz (2.45 MB)
[INFO] Upload successful: s3://graphiti-neo4j-backup/neo4j-backup/neo4j_2025-10-08_02-00-00.cypher.gz
[INFO] Cleaning up backups older than 7 days
[INFO] Cleanup complete: 3 old backups removed
[INFO] Backup completed successfully!
```

## Troubleshooting

### Common Issues

#### 1. "R2 bucket not found" or "Access denied"

- Verify R2 credentials are correct
- Check bucket name spelling
- Ensure API token has R2 edit permissions
- Verify account ID is correct

#### 2. "Neo4j connection failed"

- Ensure Neo4j service is healthy
- Check NEO4J_PASSWORD is correct
- Verify network connectivity between services
- Check Neo4j logs: `docker-compose logs neo4j`

#### 3. "APOC not available"

- This is a warning, not an error
- Service will fall back to manual export
- To enable APOC, configure Neo4j with APOC plugin

#### 4. Backup file is too large

- Reduce `BACKUP_RETENTION_DAYS` to keep fewer backups
- Ensure `BACKUP_COMPRESSION=true`
- Consider implementing incremental backups (future feature)

#### 5. Cron jobs not running

- Check cron daemon is running: `docker-compose exec neo4j-backup pgrep crond`
- Verify crontab: `docker-compose exec neo4j-backup crontab -l`
- Check service logs for errors

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Compose Stack                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐                                            │
│  │   Neo4j DB   │                                            │
│  └──────┬───────┘                                            │
│         │ Bolt (7687)                                        │
│         ▼                                                    │
│  ┌──────────────────────────┐                                │
│  │  neo4j-backup Service    │                                │
│  │                          │                                │
│  │  ┌────────────────┐      │                                │
│  │  │  Cron Daemon   │      │                                │
│  │  │  (Schedule)    │      │                                │
│  │  └────────┬───────┘      │                                │
│  │           ▼              │                                │
│  │  ┌────────────────┐      │                                │
│  │  │  backup.py     │      │                                │
│  │  │  (Python)      │      │                                │
│  │  └────────┬───────┘      │                                │
│  │           │              │                                │
│  │           ├──► Export    │                                │
│  │           ├──► Compress  │                                │
│  │           └──► Upload    │                                │
│  └────────────────┬─────────┘                                │
│                   │ HTTPS                                    │
│                   ▼                                          │
└───────────────────────────────────────────────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │  Cloudflare R2      │
         │  (S3-compatible)    │
         └─────────────────────┘
```

### Backup Process Flow

1. **Scheduled Trigger** - Cron daemon triggers backup.py
2. **Connect to Neo4j** - Establish Bolt connection
3. **Export Data**
   - Try APOC export (if available)
   - Fall back to manual Cypher export
4. **Compress** - Gzip compress the export file
5. **Upload to R2** - Upload compressed file to R2 bucket
6. **Cleanup** - Remove local temp files
7. **Retention** - Delete old backups from R2

### File Formats

**Cypher Export Format** (`.cypher`):
```cypher
// Neo4j Database Export
// Database: neo4j
// Exported: 2025-10-08T02:00:00

CREATE CONSTRAINT constraint_name FOR (n:Label) REQUIRE n.property IS UNIQUE;
CREATE INDEX index_name FOR (n:Label) ON (n.property);

CREATE (n:Person {name: 'Alice', age: 30});
CREATE (n:Person {name: 'Bob', age: 25});
MATCH (a:Person {name: 'Alice'}), (b:Person {name: 'Bob'})
CREATE (a)-[:KNOWS]->(b);
```

**Compressed Format** (`.cypher.gz`):
- Gzip compressed version of above
- Typically 60-80% size reduction

## Security Considerations

1. **Credentials** - Store R2 credentials in `.env` file (gitignored)
2. **Network** - Backup service runs in isolated Docker network
3. **Encryption** - R2 provides encryption at rest
4. **Access Control** - Use R2 bucket policies for access restrictions
5. **Rotation** - Rotate R2 API keys periodically

## Performance

### Resource Usage

- **CPU**: Low (< 5% during backup)
- **Memory**: ~100-200 MB baseline, peaks during export
- **Network**: Depends on database size
- **Disk**: Temporary space for export file (auto-cleaned)

### Backup Times

| Database Size | Export Time | Upload Time (10 Mbps) |
|--------------|-------------|----------------------|
| 100 MB       | ~30 sec     | ~1 min              |
| 1 GB         | ~5 min      | ~10 min             |
| 10 GB        | ~30 min     | ~100 min            |

*Times are approximate and depend on graph complexity*

## Roadmap

Future enhancements:

- [ ] Incremental backups
- [ ] Multiple database support
- [ ] Backup encryption
- [ ] Slack/Email notifications
- [ ] Backup verification
- [ ] Restore automation
- [ ] Metrics and monitoring endpoints

## License

Same as parent project (Graphiti)

## Support

For issues and questions:
- Check logs: `docker-compose logs neo4j-backup`
- Review this README
- Open an issue in the main repository
