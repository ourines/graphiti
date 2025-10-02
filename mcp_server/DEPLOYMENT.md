# Production Deployment Guide

This guide covers deploying the Graphiti MCP server with Nginx reverse proxy authentication, Gemini support, and S3-compatible backup solutions.

## Architecture

```
Internet → Nginx (Authentication) → MCP Server (SSE:8000) → Neo4j (7687)
                                                                  ↓
                                                            S3 Backup Storage
```

## Features

- ✅ **Nginx Reverse Proxy with Basic Authentication**
- ✅ **Google Gemini Support** (LLM + Embeddings)
- ✅ **S3-Compatible Backup/Restore** (AWS S3, MinIO, Cloudflare R2, etc.)
- ✅ **Docker Compose Deployment**
- ✅ **SSE Transport for MCP**

## Quick Start

### 1. Environment Configuration

Copy and configure environment variables:

```bash
cp .env.example .env
```

Edit `.env` and configure:

**⚠️ CRITICAL: Docker Networking**
- Use `NEO4J_URI=bolt://neo4j:7687` for Docker Compose (service name)
- Use `NEO4J_URI=bolt://localhost:7687` only if Neo4j runs on host machine
- Using `localhost` in Docker containers will fail!

**LLM Provider** - Choose one:

#### Option A: Google Gemini (Recommended)
```bash
GOOGLE_API_KEY=your_google_api_key_here
MODEL_NAME=gemini-2.5-flash
EMBEDDER_MODEL_NAME=text-embedding-004
```

#### Option B: OpenAI
```bash
OPENAI_API_KEY=your_openai_api_key_here
MODEL_NAME=gpt-4.1-mini
```

### 2. Generate Authentication Credentials

```bash
cd scripts
./generate-htpasswd.sh admin
```

This creates `.htpasswd` file for Nginx basic authentication.

### 3. Deploy with Docker Compose

```bash
docker-compose up -d
```

Services will be available at:
- **Nginx (authenticated)**: `http://localhost:80`
- **Health check**: `http://localhost:80/health` (no auth required)
- **Neo4j Browser**: `http://localhost:7474`

## Using the MCP Server

### Configure in MCP Client (e.g., Claude Desktop)

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "graphiti": {
      "command": "npx",
      "args": [
        "-y",
        "supergateway",
        "--sse",
        "http://your-server.com/sse",
        "--header",
        "Authorization: Basic <base64_encoded_credentials>"
      ]
    }
  }
}
```

To generate base64 credentials:
```bash
echo -n "username:password" | base64
```

### Testing the Connection

```bash
# Test health endpoint (no auth)
curl http://localhost/health

# Test SSE endpoint (with auth)
curl -u username:password http://localhost/sse
```

## S3 Backup Configuration

### Configure S3 Credentials

Add to `.env`:

```bash
# For AWS S3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_DEFAULT_REGION=us-east-1
S3_BACKUP_BUCKET=your-backup-bucket
S3_BACKUP_PATH=graphiti-backups

# For S3-compatible services (MinIO, R2, etc.)
AWS_ENDPOINT_URL=https://your-s3-endpoint.com
```

### Backup Database

```bash
# From host machine
docker-compose exec neo4j /scripts/backup.sh neo4j

# Or enter container and run
docker-compose exec neo4j bash
/scripts/backup.sh neo4j
```

### Restore Database

```bash
# Stop Neo4j first
docker-compose stop neo4j

# Restore from backup
docker-compose exec neo4j /scripts/restore.sh neo4j neo4j_20250102_153045

# Start Neo4j
docker-compose start neo4j
```

### List Available Backups

```bash
# Using AWS CLI
aws s3 ls s3://your-backup-bucket/graphiti-backups/

# For custom endpoints
aws s3 ls s3://your-backup-bucket/graphiti-backups/ --endpoint-url=https://your-endpoint.com
```

## LLM Provider Configuration

### Google Gemini

**Advantages**:
- Native structured output support
- Competitive pricing
- Fast inference
- Text embedding included

**Setup**:
```bash
GOOGLE_API_KEY=your_key
MODEL_NAME=gemini-2.5-flash
EMBEDDER_MODEL_NAME=text-embedding-004
```

Get API key: https://aistudio.google.com/apikey

### OpenAI

**Setup**:
```bash
OPENAI_API_KEY=your_key
MODEL_NAME=gpt-4.1-mini
```

### Azure OpenAI

**Setup**:
```bash
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_VERSION=2025-01-01-preview
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment
AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME=your-embedding-deployment
OPENAI_API_KEY=your_azure_key
```

## Security Considerations

### Nginx Authentication

- Use strong passwords for `.htpasswd`
- Consider OAuth for production (requires additional setup)
- Use HTTPS in production (configure SSL certificates)

### Network Security

For production deployment:

1. **Use HTTPS**: Configure SSL/TLS certificates
2. **Firewall**: Restrict access to necessary ports only
3. **Environment Variables**: Never commit `.env` to version control
4. **Rotate Credentials**: Regularly update passwords and API keys

### Example Nginx SSL Configuration

Add to `nginx.conf`:

```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # ... rest of configuration
}
```

## Monitoring and Logs

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f graphiti-mcp
docker-compose logs -f nginx
docker-compose logs -f neo4j
```

### Health Checks

```bash
# MCP Server health
curl http://localhost/health

# Neo4j health
curl http://localhost:7474
```

## Troubleshooting

### MCP Server Connection Issues

1. **Check authentication**:
   ```bash
   curl -v -u username:password http://localhost/sse
   ```

2. **Check MCP server logs**:
   ```bash
   docker-compose logs graphiti-mcp
   ```

### Backup/Restore Issues

1. **Verify S3 credentials**:
   ```bash
   aws s3 ls s3://your-bucket/ --endpoint-url=$AWS_ENDPOINT_URL
   ```

2. **Check Neo4j permissions**:
   ```bash
   docker-compose exec neo4j ls -la /scripts/
   ```

### Gemini API Issues

1. **Verify API key**:
   ```bash
   curl "https://generativelanguage.googleapis.com/v1/models?key=$GOOGLE_API_KEY"
   ```

2. **Check quota**: Visit [Google AI Studio](https://aistudio.google.com/)

## Updating

```bash
# Pull latest images
docker-compose pull

# Restart services
docker-compose down
docker-compose up -d
```

## Scaling Considerations

### Increase Concurrency

Adjust in `.env`:
```bash
SEMAPHORE_LIMIT=20  # Default: 10
```

### Neo4j Memory

Adjust in `docker-compose.yml`:
```yaml
NEO4J_server_memory_heap_max__size=2G
NEO4J_server_memory_pagecache_size=1G
```

## Support

For issues and questions:
- GitHub Issues: https://github.com/getzep/graphiti/issues
- Documentation: https://help.getzep.com/graphiti

## License

See main repository LICENSE file.
