# MCP Server Authentication

This document describes how to configure authentication for the Graphiti MCP HTTP Server when deploying to public networks.

## Overview

The MCP server implements **OAuth 2.1 Bearer Token** authentication according to the [MCP specification 2025-03-26](https://spec.modelcontextprotocol.io/specification/2025-03-26/security/authentication/).

## Authentication Methods

### 1. Bearer Token (Recommended for Production) ✅

**Standard:** OAuth 2.1 Bearer Token
**Security:** High
**Header:** `Authorization: Bearer <token>`

```bash
# Generate a secure token
openssl rand -hex 32
```

**Example request:**
```bash
curl -H "Authorization: Bearer your-secure-token" \
     http://your-server.com/api/endpoint
```

### 2. API Key (Simple Alternative)

**Standard:** Custom API Key
**Security:** Medium
**Header:** `X-API-Key: <key>`

```bash
# Generate a secure key
openssl rand -hex 32
```

**Example request:**
```bash
curl -H "X-API-Key: your-secure-api-key" \
     http://your-server.com/api/endpoint
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Enable authentication (REQUIRED for public deployment)
MCP_AUTH_ENABLED=true

# Choose authentication method: 'bearer' or 'apikey'
MCP_AUTH_METHOD=bearer

# Bearer Token (if using bearer method)
MCP_AUTH_BEARER_TOKEN=your-secure-bearer-token-here

# API Key (if using apikey method)
MCP_AUTH_API_KEY=your-secure-api-key-here

# Public endpoints (no auth required)
MCP_AUTH_PUBLIC_ENDPOINTS=/health,/status
```

### Generate Secure Tokens

```bash
# For Bearer Token
export MCP_AUTH_BEARER_TOKEN=$(openssl rand -hex 32)
echo "Bearer Token: $MCP_AUTH_BEARER_TOKEN"

# For API Key
export MCP_AUTH_API_KEY=$(openssl rand -hex 32)
echo "API Key: $MCP_AUTH_API_KEY"
```

## Usage Examples

### Bearer Token Authentication

```typescript
// JavaScript/TypeScript
const response = await fetch('http://your-server.com/api/tool', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-secure-token',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ /* your data */ }),
});
```

```python
# Python
import requests

headers = {
    'Authorization': 'Bearer your-secure-token',
    'Content-Type': 'application/json',
}

response = requests.post(
    'http://your-server.com/api/tool',
    headers=headers,
    json={'your': 'data'}
)
```

```bash
# cURL
curl -X POST http://your-server.com/api/tool \
  -H "Authorization: Bearer your-secure-token" \
  -H "Content-Type: application/json" \
  -d '{"your": "data"}'
```

### API Key Authentication

```typescript
// JavaScript/TypeScript
const response = await fetch('http://your-server.com/api/tool', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-secure-api-key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ /* your data */ }),
});
```

```python
# Python
import requests

headers = {
    'X-API-Key': 'your-secure-api-key',
    'Content-Type': 'application/json',
}

response = requests.post(
    'http://your-server.com/api/tool',
    headers=headers,
    json={'your': 'data'}
)
```

## Error Responses

### 401 Unauthorized

**Missing credentials:**
```json
{
  "error": "unauthorized",
  "message": "Missing Authorization header"
}
```

**Invalid token:**
```json
{
  "error": "unauthorized",
  "message": "Invalid bearer token"
}
```

**Response headers:**
```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="MCP Server"
Content-Type: application/json
```

## Public Endpoints

The following endpoints are public by default (no authentication required):

- `/health` - Health check endpoint
- `/status` - Server status endpoint

To customize public endpoints, set:
```bash
MCP_AUTH_PUBLIC_ENDPOINTS=/health,/status,/metrics,/custom-public-endpoint
```

## Security Best Practices

### 🔒 Production Deployment Checklist

- ✅ **ALWAYS enable authentication** for public-facing servers
- ✅ **Use HTTPS only** - Never deploy HTTP endpoints to production
- ✅ **Generate strong tokens** - Use `openssl rand -hex 32` or equivalent
- ✅ **Store secrets securely** - Use environment variables, never hardcode
- ✅ **Rotate credentials regularly** - Change tokens periodically
- ✅ **Monitor authentication attempts** - Review logs for suspicious activity
- ✅ **Implement rate limiting** - Prevent brute-force attacks
- ✅ **Validate redirect URIs** - Prevent open redirect vulnerabilities

### ⚠️ Common Security Mistakes

- ❌ Deploying with `MCP_AUTH_ENABLED=false` to public networks
- ❌ Using weak or predictable tokens
- ❌ Hardcoding credentials in source code
- ❌ Committing `.env` files to version control
- ❌ Using HTTP instead of HTTPS
- ❌ Sharing tokens via insecure channels (email, chat, etc.)

## Testing Authentication

### Test Bearer Token

```bash
# Valid token
curl -H "Authorization: Bearer your-secure-token" \
     http://localhost:3000/debug/tools

# Invalid token (should return 401)
curl -H "Authorization: Bearer wrong-token" \
     http://localhost:3000/debug/tools

# Missing token (should return 401)
curl http://localhost:3000/debug/tools
```

### Test API Key

```bash
# Valid key
curl -H "X-API-Key: your-secure-api-key" \
     http://localhost:3000/debug/tools

# Invalid key (should return 401)
curl -H "X-API-Key: wrong-key" \
     http://localhost:3000/debug/tools
```

### Test Public Endpoints

```bash
# Should work without authentication
curl http://localhost:3000/health
curl http://localhost:3000/status
```

## Troubleshooting

### Authentication not working

1. **Check environment variables:**
   ```bash
   echo $MCP_AUTH_ENABLED
   echo $MCP_AUTH_METHOD
   ```

2. **Verify token/key is correct:**
   - No extra spaces or newlines
   - Correct environment variable name
   - Server restarted after config changes

3. **Check request headers:**
   - `Authorization: Bearer <token>` (note the space after "Bearer")
   - `X-API-Key: <key>` (case-sensitive)

4. **Review server logs:**
   - Look for authentication errors
   - Check for middleware initialization messages

### Common Issues

**Issue:** "Missing Authorization header"
**Solution:** Include the correct header in your request

**Issue:** "Invalid bearer token"
**Solution:** Verify the token matches `MCP_AUTH_BEARER_TOKEN` exactly

**Issue:** Authentication works locally but not in production
**Solution:** Ensure environment variables are set correctly in production environment

**Issue:** Public endpoints still require authentication
**Solution:** Check `MCP_AUTH_PUBLIC_ENDPOINTS` is configured correctly

## Migration from No Auth

If you're migrating an existing deployment:

1. **Generate secure credentials:**
   ```bash
   export MCP_AUTH_BEARER_TOKEN=$(openssl rand -hex 32)
   ```

2. **Update server configuration:**
   ```bash
   # Add to .env
   echo "MCP_AUTH_ENABLED=true" >> .env
   echo "MCP_AUTH_METHOD=bearer" >> .env
   echo "MCP_AUTH_BEARER_TOKEN=$MCP_AUTH_BEARER_TOKEN" >> .env
   ```

3. **Restart server:**
   ```bash
   # Restart your MCP server
   ```

4. **Update all clients:**
   - Add authentication headers to all API requests
   - Test thoroughly before deploying to production

## Additional Resources

- [MCP Specification - Authentication](https://spec.modelcontextprotocol.io/specification/2025-03-26/security/authentication/)
- [OAuth 2.1 RFC](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-11)
- [OWASP API Security](https://owasp.org/www-project-api-security/)

## Support

For issues or questions:
- Check server logs for detailed error messages
- Review this documentation
- Open an issue on GitHub
