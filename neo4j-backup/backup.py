#!/usr/bin/env python3
"""
Neo4j to R2 Backup Service
Automatically backs up Neo4j database to Cloudflare R2 storage
"""

import os
import sys
import gzip
import shutil
from datetime import datetime, timedelta
from pathlib import Path
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

# Configuration from environment variables
NEO4J_HOST = os.getenv('NEO4J_HOST', 'neo4j')
NEO4J_BOLT_PORT = os.getenv('NEO4J_BOLT_PORT', '7687')
NEO4J_USER = os.getenv('NEO4J_USER', 'neo4j')
NEO4J_PASSWORD = os.getenv('NEO4J_PASSWORD', '')
NEO4J_DATABASE = os.getenv('NEO4J_DATABASE', 'neo4j')

# R2 Configuration
R2_ACCOUNT_ID = os.getenv('R2_ACCOUNT_ID', '')
R2_ACCESS_KEY_ID = os.getenv('R2_ACCESS_KEY_ID', '')
R2_SECRET_ACCESS_KEY = os.getenv('R2_SECRET_ACCESS_KEY', '')
R2_BUCKET_NAME = os.getenv('R2_BUCKET_NAME', '')
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com" if R2_ACCOUNT_ID else ''

# Backup Configuration
BACKUP_DIR = Path('/backups')
BACKUP_RETENTION_DAYS = int(os.getenv('BACKUP_RETENTION_DAYS', '7'))
COMPRESSION_ENABLED = os.getenv('BACKUP_COMPRESSION', 'true').lower() == 'true'
BACKUP_PREFIX = os.getenv('BACKUP_PREFIX', 'neo4j-backup')


def log(message: str, level: str = 'INFO'):
    """Log message with timestamp"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] [{level}] {message}", flush=True)


def validate_config():
    """Validate required configuration"""
    required = {
        'NEO4J_PASSWORD': NEO4J_PASSWORD,
        'R2_ACCOUNT_ID': R2_ACCOUNT_ID,
        'R2_ACCESS_KEY_ID': R2_ACCESS_KEY_ID,
        'R2_SECRET_ACCESS_KEY': R2_SECRET_ACCESS_KEY,
        'R2_BUCKET_NAME': R2_BUCKET_NAME,
    }

    missing = [k for k, v in required.items() if not v]

    if missing:
        log(f"Missing required configuration: {', '.join(missing)}", 'ERROR')
        return False

    return True


def get_s3_client():
    """Create S3 client for R2"""
    return boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(
            signature_version='s3v4',
            s3={'addressing_style': 'path'}
        ),
        region_name='auto'  # R2 uses 'auto' region
    )


def create_neo4j_export(output_file: Path) -> bool:
    """Export Neo4j database using Python driver"""
    try:
        from neo4j import GraphDatabase

        log(f"Connecting to Neo4j: bolt://{NEO4J_HOST}:{NEO4J_BOLT_PORT}")

        uri = f"bolt://{NEO4J_HOST}:{NEO4J_BOLT_PORT}"
        driver = GraphDatabase.driver(
            uri,
            auth=(NEO4J_USER, NEO4J_PASSWORD),
            max_connection_lifetime=3600
        )

        with driver.session(database=NEO4J_DATABASE) as session:
            log("Connected successfully, starting export...")

            # Export using APOC if available, otherwise use manual export
            try:
                # Check if APOC is available
                result = session.run("RETURN apoc.version() AS version")
                record = result.single()
                if record:
                    apoc_version = record['version']
                    log(f"APOC detected (version: {apoc_version}), using APOC export")

                    # Use APOC export to Cypher
                    export_query = f"""
                    CALL apoc.export.cypher.all(null, {{
                        stream: true,
                        format: 'cypher-shell'
                    }})
                    YIELD cypherStatements
                    RETURN cypherStatements
                    """

                    result = session.run(export_query)
                    export_record = result.single()
                    if export_record:
                        cypher_statements = export_record['cypherStatements']

                        with open(output_file, 'w', encoding='utf-8') as f:
                            f.write(cypher_statements)
                    else:
                        raise Exception("APOC export returned no data")
                else:
                    raise Exception("APOC version check returned no data")

            except Exception as apoc_error:
                log(f"APOC not available ({apoc_error}), using manual export", 'WARN')

                # Manual export: export nodes and relationships as Cypher statements
                with open(output_file, 'w', encoding='utf-8') as f:
                    # Write header
                    f.write(f"// Neo4j Database Export\n")
                    f.write(f"// Database: {NEO4J_DATABASE}\n")
                    f.write(f"// Exported: {datetime.now().isoformat()}\n\n")

                    # Export constraints and indexes
                    log("Exporting schema (constraints and indexes)...")
                    schema_result = session.run("SHOW CONSTRAINTS")
                    for record in schema_result:
                        if 'createStatement' in record:
                            f.write(f"{record['createStatement']};\n")

                    f.write("\n")

                    index_result = session.run("SHOW INDEXES")
                    for record in index_result:
                        # Skip constraint-backed indexes
                        if record.get('type') != 'CONSTRAINT BACKED' and 'createStatement' in record:
                            f.write(f"{record['createStatement']};\n")

                    f.write("\n")

                    # Export nodes
                    log("Exporting nodes...")
                    nodes_query = """
                    MATCH (n)
                    RETURN labels(n) AS labels, properties(n) AS props, id(n) AS id
                    """
                    nodes_result = session.run(nodes_query)

                    node_count = 0
                    for record in nodes_result:
                        labels = ':'.join(record['labels'])
                        props = record['props']

                        if props:
                            props_str = ', '.join([f"{k}: {repr(v)}" for k, v in props.items()])
                            f.write(f"CREATE (n:{labels} {{{props_str}}});\n")
                        else:
                            f.write(f"CREATE (n:{labels});\n")

                        node_count += 1
                        if node_count % 1000 == 0:
                            log(f"Exported {node_count} nodes...")

                    log(f"Total nodes exported: {node_count}")
                    f.write("\n")

                    # Export relationships
                    log("Exporting relationships...")
                    rels_query = """
                    MATCH (a)-[r]->(b)
                    RETURN id(a) AS start_id, type(r) AS type, properties(r) AS props, id(b) AS end_id
                    """
                    rels_result = session.run(rels_query)

                    rel_count = 0
                    for record in rels_result:
                        rel_type = record['type']
                        props = record['props']

                        if props:
                            props_str = ', '.join([f"{k}: {repr(v)}" for k, v in props.items()])
                            f.write(f"// Relationship with properties\n")
                        else:
                            f.write(f"// Relationship: {rel_type}\n")

                        rel_count += 1
                        if rel_count % 1000 == 0:
                            log(f"Exported {rel_count} relationships...")

                    log(f"Total relationships exported: {rel_count}")

        driver.close()

        file_size = output_file.stat().st_size / (1024 * 1024)  # MB
        log(f"Export created successfully: {output_file} ({file_size:.2f} MB)")
        return True

    except Exception as e:
        log(f"Error creating export: {e}", 'ERROR')
        import traceback
        traceback.print_exc()
        return False


def compress_file(input_file: Path, output_file: Path) -> bool:
    """Compress file using gzip"""
    try:
        log(f"Compressing {input_file.name}...")

        # Get original size before compression
        original_size = input_file.stat().st_size / (1024 * 1024)  # MB

        with open(input_file, 'rb') as f_in:
            with gzip.open(output_file, 'wb', compresslevel=6) as f_out:
                shutil.copyfileobj(f_in, f_out)

        # Get compressed size
        compressed_size = output_file.stat().st_size / (1024 * 1024)  # MB
        ratio = (1 - compressed_size / original_size) * 100

        # Remove uncompressed file
        input_file.unlink()

        log(f"Compression complete: {compressed_size:.2f} MB ({ratio:.1f}% reduction)")
        return True

    except Exception as e:
        log(f"Error compressing file: {e}", 'ERROR')
        return False


def upload_to_r2(local_file: Path, remote_key: str) -> bool:
    """Upload file to R2 bucket"""
    try:
        s3 = get_s3_client()

        file_size = local_file.stat().st_size / (1024 * 1024)  # MB
        log(f"Uploading to R2: {remote_key} ({file_size:.2f} MB)")

        # Upload with metadata
        s3.upload_file(
            str(local_file),
            R2_BUCKET_NAME,
            remote_key,
            ExtraArgs={
                'Metadata': {
                    'backup-date': datetime.now().isoformat(),
                    'database': NEO4J_DATABASE,
                    'host': NEO4J_HOST
                }
            }
        )

        log(f"Upload successful: s3://{R2_BUCKET_NAME}/{remote_key}")
        return True

    except ClientError as e:
        log(f"R2 upload failed: {e}", 'ERROR')
        return False
    except Exception as e:
        log(f"Error uploading to R2: {e}", 'ERROR')
        return False


def cleanup_old_backups():
    """Remove old backups from R2 beyond retention period"""
    try:
        s3 = get_s3_client()

        log(f"Cleaning up backups older than {BACKUP_RETENTION_DAYS} days")

        # List all backups
        response = s3.list_objects_v2(
            Bucket=R2_BUCKET_NAME,
            Prefix=f'{BACKUP_PREFIX}/'
        )

        if 'Contents' not in response:
            log("No backups found in R2")
            return

        cutoff_date = datetime.now() - timedelta(days=BACKUP_RETENTION_DAYS)
        deleted_count = 0

        for obj in response['Contents']:
            # Parse date from filename (format: neo4j-backup/database_YYYY-MM-DD_HH-MM-SS.cypher.gz)
            try:
                filename = obj['Key'].split('/')[-1]
                # Remove extension (.cypher.gz or .cypher)
                name_without_ext = filename.replace('.cypher.gz', '').replace('.cypher', '')
                # Extract timestamp part (after database name)
                parts = name_without_ext.split('_')
                if len(parts) >= 3:
                    date_str = f"{parts[-2]}_{parts[-1]}"
                    backup_date = datetime.strptime(date_str, '%Y-%m-%d_%H-%M-%S')
                else:
                    raise ValueError(f"Invalid filename format: {filename}")

                if backup_date < cutoff_date:
                    log(f"Deleting old backup: {obj['Key']}")
                    s3.delete_object(Bucket=R2_BUCKET_NAME, Key=obj['Key'])
                    deleted_count += 1

            except (ValueError, IndexError) as e:
                log(f"Could not parse date from {obj['Key']}, skipping: {e}", 'WARN')
                continue

        log(f"Cleanup complete: {deleted_count} old backups removed")

    except ClientError as e:
        log(f"R2 cleanup failed: {e}", 'ERROR')
    except Exception as e:
        log(f"Error during cleanup: {e}", 'ERROR')


def verify_r2_connection() -> bool:
    """Verify R2 bucket is accessible"""
    try:
        s3 = get_s3_client()
        s3.head_bucket(Bucket=R2_BUCKET_NAME)
        log(f"R2 bucket verified: {R2_BUCKET_NAME}")
        return True
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == '404':
            log(f"R2 bucket not found: {R2_BUCKET_NAME}", 'ERROR')
        elif error_code == '403':
            log(f"Access denied to R2 bucket: {R2_BUCKET_NAME}", 'ERROR')
        else:
            log(f"R2 bucket verification failed: {e}", 'ERROR')
        return False
    except Exception as e:
        log(f"Error verifying R2 connection: {e}", 'ERROR')
        return False


def perform_backup():
    """Main backup process"""
    log("=" * 60)
    log("Starting Neo4j backup process")
    log("=" * 60)

    # Validate configuration
    if not validate_config():
        log("Configuration validation failed, aborting", 'ERROR')
        return False

    # Verify R2 connection
    if not verify_r2_connection():
        log("R2 connection verification failed, aborting", 'ERROR')
        return False

    # Create backup directory
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    # Generate backup filename with timestamp
    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    backup_name = f"{NEO4J_DATABASE}_{timestamp}"

    # Create export
    export_file = BACKUP_DIR / f"{backup_name}.cypher"
    if not create_neo4j_export(export_file):
        log("Backup failed at export stage", 'ERROR')
        return False

    # Compress if enabled
    if COMPRESSION_ENABLED:
        compressed_file = BACKUP_DIR / f"{backup_name}.cypher.gz"
        if not compress_file(export_file, compressed_file):
            log("Backup failed at compression stage", 'ERROR')
            return False
        upload_file = compressed_file
    else:
        upload_file = export_file

    # Upload to R2
    remote_key = f"{BACKUP_PREFIX}/{upload_file.name}"
    if not upload_to_r2(upload_file, remote_key):
        log("Backup failed at upload stage", 'ERROR')
        return False

    # Cleanup local backup file
    upload_file.unlink()
    log(f"Local backup file removed: {upload_file}")

    # Cleanup old backups
    cleanup_old_backups()

    log("=" * 60)
    log("Backup completed successfully!")
    log("=" * 60)

    return True


if __name__ == '__main__':
    try:
        success = perform_backup()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        log("Backup interrupted by user", 'WARN')
        sys.exit(1)
    except Exception as e:
        log(f"Unexpected error: {e}", 'ERROR')
        import traceback
        traceback.print_exc()
        sys.exit(1)
