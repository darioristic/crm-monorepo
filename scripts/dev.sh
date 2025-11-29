#!/bin/bash

# ============================================
# CRM Monorepo - Development Environment Startup Script
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ports
API_PORT=3001
WEB_PORT=3000

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║        CRM Monorepo - Dev Environment Setup           ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}⚠️  Killing process on port $port (PID: $pid)${NC}"
        kill -9 $pid 2>/dev/null || true
        sleep 1
    else
        echo -e "${GREEN}✓ Port $port is free${NC}"
    fi
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker Desktop.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker is running${NC}"
}

# Function to start Docker services
start_docker_services() {
    echo -e "${BLUE}🐳 Starting Docker services (PostgreSQL & Redis)...${NC}"
    docker-compose up -d postgres redis
    
    # Wait for services to be healthy
    echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
    sleep 3
    
    # Check if postgres is ready
    until docker-compose exec -T postgres pg_isready -U crm_user -d crm_db > /dev/null 2>&1; do
        echo -e "${YELLOW}   Waiting for PostgreSQL...${NC}"
        sleep 2
    done
    echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
    
    # Check if redis is ready
    until docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
        echo -e "${YELLOW}   Waiting for Redis...${NC}"
        sleep 1
    done
    echo -e "${GREEN}✓ Redis is ready${NC}"
}

# Function to install dependencies
install_deps() {
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    bun install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
}

# Navigate to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

echo -e "${BLUE}📁 Project root: $PROJECT_ROOT${NC}"
echo ""

# Step 1: Kill processes on ports
echo -e "${BLUE}🔌 Freeing up ports...${NC}"
kill_port $WEB_PORT
kill_port $API_PORT
echo ""

# Step 2: Check Docker
echo -e "${BLUE}🐳 Checking Docker...${NC}"
check_docker
echo ""

# Step 3: Start Docker services
start_docker_services
echo ""

# Step 4: Install dependencies if needed
if [ ! -d "node_modules" ] || [ "$1" == "--install" ]; then
    install_deps
    echo ""
fi

# Step 5: Start development servers
echo -e "${BLUE}🚀 Starting development servers...${NC}"
echo ""

# Start API server in background
echo -e "${YELLOW}Starting API server on port $API_PORT...${NC}"
cd "$PROJECT_ROOT/apps/api-server"
bun run dev &
API_PID=$!

# Wait a moment for API to start
sleep 2

# Start Web server in background
echo -e "${YELLOW}Starting Web server on port $WEB_PORT...${NC}"
cd "$PROJECT_ROOT/apps/web"
bun run dev &
WEB_PID=$!

# Wait a moment
sleep 3

echo ""
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║           🎉 Development Environment Ready!           ║"
echo "╠═══════════════════════════════════════════════════════╣"
echo "║                                                       ║"
echo "║  🌐 Frontend:  http://localhost:$WEB_PORT                 ║"
echo "║  🔌 API:       http://localhost:$API_PORT                 ║"
echo "║  🗄️  Database:  localhost:5432                         ║"
echo "║  📦 Redis:     localhost:6379                         ║"
echo "║                                                       ║"
echo "║  Press Ctrl+C to stop all services                    ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Trap SIGINT to cleanup
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down...${NC}"
    kill $API_PID 2>/dev/null || true
    kill $WEB_PID 2>/dev/null || true
    echo -e "${GREEN}✓ Development servers stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for both processes
wait $API_PID $WEB_PID

