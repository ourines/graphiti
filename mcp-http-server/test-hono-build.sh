#!/bin/bash

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "Hono.js Migration - Build & Test"
echo "========================================"
echo "Working directory: $(pwd)"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check dist directory
echo "📦 Checking build output..."
if [ -d "dist" ] && [ -f "dist/server.js" ]; then
    echo -e "${GREEN}✓ Build output exists${NC}"
else
    echo -e "${RED}✗ Build output missing${NC}"
    exit 1
fi
echo ""

# Check package.json dependencies
echo "📋 Checking dependencies..."
if grep -q '"hono"' package.json; then
    echo -e "${GREEN}✓ Hono.js installed${NC}"
else
    echo -e "${RED}✗ Hono.js not found${NC}"
    exit 1
fi

if grep -q '"@hono/node-server"' package.json; then
    echo -e "${GREEN}✓ @hono/node-server installed${NC}"
else
    echo -e "${RED}✗ @hono/node-server not found${NC}"
    exit 1
fi

if ! grep -q '"express"' package.json; then
    echo -e "${GREEN}✓ Express removed${NC}"
else
    echo -e "${YELLOW}⚠ Express still in dependencies${NC}"
fi
echo ""

# Check server.ts for Hono imports
echo "🔍 Checking source code..."
if grep -q "from 'hono'" src/server.ts; then
    echo -e "${GREEN}✓ Hono imports found${NC}"
else
    echo -e "${RED}✗ Hono imports not found${NC}"
    exit 1
fi

if grep -q "from '@hono/node-server'" src/server.ts; then
    echo -e "${GREEN}✓ @hono/node-server imports found${NC}"
else
    echo -e "${RED}✗ @hono/node-server imports not found${NC}"
    exit 1
fi

if ! grep -q "from 'express'" src/server.ts; then
    echo -e "${GREEN}✓ Express imports removed${NC}"
else
    echo -e "${YELLOW}⚠ Express imports still present${NC}"
fi
echo ""

# Check compiled output
echo "🔨 Checking compiled output..."
if grep -q "hono" dist/server.js; then
    echo -e "${GREEN}✓ Hono in compiled output${NC}"
else
    echo -e "${RED}✗ Hono not in compiled output${NC}"
    exit 1
fi
echo ""

# Summary
echo "========================================"
echo -e "${GREEN}✅ All checks passed!${NC}"
echo "========================================"
echo ""
echo "Migration to Hono.js completed successfully!"
echo ""
echo "Next steps:"
echo "  1. Start the server: node dist/index.js"
echo "  2. Test endpoints with curl"
echo "  3. Run ./test-http-server.sh for full integration test"
echo ""
