# Quick Start Guide

## Prerequisites

1. **Node.js 18+** installed
2. **GraphiTi FastAPI server** running at `http://localhost:8000`

## Installation

```bash
cd mcp-http-server

# Install dependencies
npm install

# Or use pnpm
pnpm install
```

## Build

```bash
# Compile TypeScript
npm run build

# Output will be in dist/
```

## Run

### Development Mode (with watch)

```bash
# Create .env file
cp .env.example .env

# Edit .env to set GRAPHITI_API_URL
# Then run:
npm run dev
```

### Production Mode

```bash
# Stdio mode (for Claude Desktop)
GRAPHITI_API_URL=http://localhost:8000 node dist/index.js

# HTTP mode (for debugging)
MCP_TRANSPORT=http GRAPHITI_API_URL=http://localhost:8000 node dist/index.js
```

## Test with Claude Code

1. Create `.claude.json` in your project root:

```json
{
  "mcpServers": {
    "graphiti": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-http-server/dist/index.js"],
      "env": {
        "GRAPHITI_API_URL": "http://localhost:8000",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

2. Restart Claude Code

3. Test by asking Claude to add/search memory

## Test with HTTP Mode

```bash
# Start server in HTTP mode
MCP_TRANSPORT=http GRAPHITI_API_URL=http://localhost:8000 npm run dev

# In another terminal, test:
curl http://localhost:3000/health
curl http://localhost:3000/debug/tools
```

## Troubleshooting

### Build errors

If you get module resolution errors, try:

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### "Cannot find module" errors

Make sure your tsconfig.json has:
- `"module": "Node16"`
- `"moduleResolution": "Node16"`

### Claude can't connect

1. Check logs (stderr output)
2. Verify GRAPHITI_API_URL is correct
3. Test with HTTP mode first
4. Make sure FastAPI server is running

## Next Steps

- Read [README.md](./README.md) for full documentation
- See [../IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) for architecture details
- Check [Issues](https://github.com/ourines/graphiti/issues) for known problems
