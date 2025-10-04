#!/bin/bash
# Build script for mcp-http-server

set -e

echo "Building MCP HTTP Server..."
echo ""

# Navigate to mcp-http-server directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile || npm ci

# Build TypeScript
echo "🔨 Compiling TypeScript..."
pnpm run build || npx tsc

echo ""
echo "✅ Build complete!"
echo "📁 Output: dist/"
echo ""
echo "Run the server:"
echo "  node dist/index.js"
