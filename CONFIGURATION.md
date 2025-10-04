# Configuration Guide

## Quick Start: Where to Configure?

```
📁 Graphiti Project
├── .env                    ← SERVER configuration (Docker Compose)
│                             Neo4j, LLM, API authentication
│
└── mcp-http-server/
    ├── .env                ← CLIENT configuration (Optional)
    │                         API URL, auth token
    └── CONFIG.md           ← Detailed client config guide
```

## Configuration Files Overview

| File | Purpose | Who Uses It | When to Configure |
|------|---------|-------------|-------------------|
| **`.env`** (root) | Server config | Docker Compose | ✅ Always (server setup) |
| **`mcp-http-server/.env`** | Client config | MCP client | ⚠️ Optional (see below) |
| **Claude Desktop config** | Client config | Claude Desktop | ✅ Recommended (client setup) |

---

## 🖥️ Server Configuration

**File**: `.env` (copy from `.env.example` in root)

**Used by**: `docker-compose up`

**Contains**:
- Neo4j password
- LLM provider (Gemini, OpenAI, etc.)
- API authentication (for public deployment)

**Example**:
```bash
NEO4J_PASSWORD=secure-password
GOOGLE_API_KEY=your-api-key
GRAPHITI_API_TOKEN=abc123...
```

**When**: Configure BEFORE running `docker-compose up`

---

## 💻 Client Configuration

**You have 2 options** (pick one):

### Option 1: Claude Desktop Config (Recommended ✅)

**File**: `~/.config/Claude/claude_desktop_config.json`

**Contains**:
```json
{
  "mcpServers": {
    "graphiti": {
      "command": "npx",
      "args": ["-y", "@graphiti/mcp-http"],
      "env": {
        "GRAPHITI_API_URL": "http://127.0.0.1:8000",
        "GRAPHITI_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

**Pros**: No need for separate `.env` file

### Option 2: Local .env File

**File**: `mcp-http-server/.env` (copy from `mcp-http-server/.env.example`)

**Contains**:
```bash
GRAPHITI_API_URL=http://localhost:8000
GRAPHITI_API_TOKEN=your-token-here
```

**When**: For local development or if you prefer separate config files

---

## 🔗 Connecting Client to Server

The `GRAPHITI_API_TOKEN` (client) **must match** `GRAPHITI_API_TOKEN` (server).

**Example**:

1. **Server** (`.env` in root):
   ```bash
   GRAPHITI_API_TOKEN=mysecrettoken123
   ```

2. **Client** (Claude Desktop config):
   ```json
   {
     "env": {
       "GRAPHITI_API_TOKEN": "mysecrettoken123"
     }
   }
   ```

---

## 🚀 Quick Setup Steps

### 1. Server Setup
```bash
# 1. Copy server config
cp .env.example .env

# 2. Edit .env - set passwords and API keys
nano .env

# 3. Start server
docker-compose up -d
```

### 2. Client Setup (Option 1 - Recommended)
```bash
# Edit Claude Desktop config
code ~/.config/Claude/claude_desktop_config.json

# Add Graphiti MCP server configuration (see above)
```

### 2. Client Setup (Option 2 - Alternative)
```bash
# 1. Copy client config
cd mcp-http-server
cp .env.example .env

# 2. Edit .env
nano .env

# 3. Build client
npm install
npm run build
```

---

## ❓ Common Questions

**Q: Why are there two `.env.example` files?**
- Root `.env.example` = Server configuration
- `mcp-http-server/.env.example` = Client configuration
- They configure different components!

**Q: Do I need both `.env` files?**
- ✅ Root `.env` - Always needed for server
- ⚠️ `mcp-http-server/.env` - Optional (can use Claude Desktop config instead)

**Q: Can I use the same `.env` for both?**
- ❌ No - server and client have different configuration needs
- Keep them separate to avoid confusion

**Q: Where does `GRAPHITI_API_TOKEN` come from?**
- You generate it: `openssl rand -hex 32`
- Set it in server's `GRAPHITI_API_TOKEN`
- Use the same value in client's `GRAPHITI_API_TOKEN`

---

## 📚 Detailed Documentation

- **Server deployment**: See `DEPLOYMENT.md`
- **Client configuration**: See `mcp-http-server/CONFIG.md`
- **MCP tools usage**: See `mcp-http-server/README.md`
