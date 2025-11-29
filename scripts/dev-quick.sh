#!/bin/bash

# ============================================
# CRM Monorepo - Quick Dev Start (No Docker check)
# ============================================

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

API_PORT=3001
WEB_PORT=3000

echo -e "${BLUE}🚀 Quick Dev Start${NC}"

# Navigate to project root
cd "$(dirname "$0")/.."

# Kill existing processes
echo -e "${YELLOW}Freeing ports...${NC}"
lsof -ti :$WEB_PORT | xargs kill -9 2>/dev/null || true
lsof -ti :$API_PORT | xargs kill -9 2>/dev/null || true
sleep 1

# Install deps if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    bun install
fi

# Start servers
echo -e "${GREEN}Starting servers...${NC}"

# API in background
cd apps/api-server && bun run dev &
sleep 2

# Web in foreground
cd ../web && bun run dev

