# Connecting to Graphiti MCP Server from Claude Code

This guide explains how to connect Claude Code to your locally running Graphiti MCP server.

## Prerequisites

- Graphiti MCP server running (via `docker-compose up -d`)
- Generated `.htpasswd` authentication file
- Your username and password

## Configuration for Claude Code

Add this configuration to your Claude Code MCP settings:

### Option 1: Using supergateway (Recommended)

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
        "Authorization: Basic <base64_credentials>"
      ]
    }
  }
}
```

**IMPORTANT**: The header value must be a single array element. Do NOT split it into multiple elements.

### Generate Base64 Credentials

```bash
# Replace 'admin' and 'your_password' with your actual credentials
echo -n "admin:your_password" | base64
```

Example output: `YWRtaW46eW91cl9wYXNzd29yZA==`

### Complete Example

If your username is `admin` and password is `admin123`:

**Working Example:**
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
        "Authorization: Basic YWRtaW46YWRtaW4xMjM="
      ]
    }
  }
}
```

**Alternative format (may work better in some MCP clients):**
```json
{
  "mcpServers": {
    "graphiti": {
      "command": "npx",
      "args": [
        "-y",
        "supergateway",
        "--sse=http://localhost:5150/sse",
        "--header=Authorization: Basic YWRtaW46YWRtaW4xMjM="
      ]
    }
  }
}
```

## Important Notes

### Port Configuration

- **Local deployment**: Use port `5150` (default in current setup)
- **Production deployment**: Change to `80` or your configured port in `docker-compose.yml`

### Authentication

- We use **Basic Authentication**, not Bearer tokens
- Format: `Authorization: Basic <base64_encoded_username:password>`
- The credentials must match what you generated with `generate-htpasswd.sh`

### Troubleshooting

**Cannot connect?**

1. Verify services are running:
   ```bash
   docker ps | grep mcp_server
   ```

2. Test health endpoint:
   ```bash
   curl http://localhost:5150/health
   ```

3. Test authenticated endpoint:
   ```bash
   curl -u admin:your_password http://localhost:5150/sse
   ```
   (Should hang - SSE is a streaming connection)

4. Check your base64 encoding:
   ```bash
   echo -n "admin:your_password" | base64
   ```

5. Verify supergateway is installed:
   ```bash
   npx supergateway --version
   ```

**Authentication failed?**

- Ensure `.htpasswd` file exists: `ls -la mcp_server/.htpasswd`
- Verify credentials match: try connecting with curl first
- Check Nginx logs: `docker logs mcp_server-nginx-1`

## Alternative: Direct SSE Connection (Not Recommended)

Some MCP clients support direct SSE connections:

```json
{
  "mcpServers": {
    "graphiti": {
      "transport": "sse",
      "url": "http://localhost:5150/sse",
      "headers": {
        "Authorization": "Basic YWRtaW46YWRtaW4xMjM="
      }
    }
  }
}
```

However, this depends on client support and may not work with all MCP clients. **Use supergateway for maximum compatibility.**

## Security Considerations

### For Production

1. **Use HTTPS**: Never send Basic Auth over unencrypted HTTP in production
2. **Strong passwords**: Use complex passwords (not `admin123`)
3. **Rotate credentials**: Change passwords regularly
4. **Consider OAuth**: For production, implement OAuth 2.0 authentication

### For Local Development

The current setup is suitable for local development with:
- Basic authentication over HTTP
- localhost-only access (not exposed to network)
- Port 5150 (non-standard port)

## Next Steps

- Test the connection in Claude Code
- Try creating and searching memories
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- Consider implementing HTTPS for production use
