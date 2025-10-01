# Quick Start Guide

Get Graphiti MCP server running with Nginx authentication and Gemini in 5 minutes.

## Prerequisites

- Docker & Docker Compose
- Google Gemini API key (get from https://aistudio.google.com/apikey)

## Steps

### 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```bash
# IMPORTANT: Keep NEO4J_URI as 'neo4j' (Docker service name), not 'localhost'
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=demodemo

# Add your Gemini API key
GOOGLE_API_KEY=your_api_key_here
MODEL_NAME=gemini-2.5-flash
EMBEDDER_MODEL_NAME=text-embedding-004

# Optional: Configure S3 backup
S3_BACKUP_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
```

### 2. Generate Authentication

```bash
cd scripts
./generate-htpasswd.sh admin
cd ..
```

Enter a secure password when prompted.

### 3. Start Services

```bash
docker-compose up -d
```

### 4. Verify Deployment

```bash
# Check health (no auth required)
curl http://localhost:5150/health

# Test authenticated endpoint (should timeout - SSE is a streaming connection)
curl -u admin:your_password http://localhost:5150/sse
```

### 5. Configure MCP Client

Generate base64 credentials:
```bash
echo -n "admin:your_password" | base64
# Output: YWRtaW46eW91cl9wYXNzd29yZA==
```

Add to your MCP client (e.g., Claude Desktop):
```json
{
  "mcpServers": {
    "graphiti": {
      "command": "npx",
      "args": [
        "-y",
        "supergateway",
        "--sse",
        "http://localhost:5150/sse",
        "--header",
        "Authorization: Basic YWRtaW46eW91cl9wYXNzd29yZA=="
      ]
    }
  }
}
```

**Note**: Port 5150 is used for local deployment. Change to 80 or your custom port in production.

## Backup Database

```bash
docker-compose exec neo4j /scripts/backup.sh neo4j
```

## View Logs

```bash
docker-compose logs -f
```

## Stop Services

```bash
docker-compose down
```

## Next Steps

- Read [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- Configure HTTPS for production use
- Set up automatic backups

## Troubleshooting

**Connection refused?**
- Check if services are running: `docker-compose ps`
- View logs: `docker-compose logs graphiti-mcp`

**Authentication failed?**
- Verify `.htpasswd` file exists: `ls -la .htpasswd`
- Check credentials match what you generated

**Gemini API errors?**
- Verify API key: `echo $GOOGLE_API_KEY`
- Check quota at https://aistudio.google.com/

## Support

For detailed documentation, see [DEPLOYMENT.md](DEPLOYMENT.md)
