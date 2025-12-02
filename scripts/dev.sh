#!/bin/bash

# ============================================
# CRM Monorepo - Development Environment Startup Script
# ============================================

# Don't exit on error - we want to handle Docker startup gracefully
set +e

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
    if docker info > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Docker is running${NC}"
        return 0
    fi
    return 1
}

# Function to start Docker Desktop (macOS)
start_docker_desktop() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "${YELLOW}🐳 Docker is not running. Attempting to start Docker Desktop...${NC}"
        
        # Check if Docker Desktop is installed
        if [ -d "/Applications/Docker.app" ]; then
            echo -e "${BLUE}   Opening Docker Desktop...${NC}"
            open -a Docker
            
            # Wait for Docker to start (max 60 seconds)
            echo -e "${YELLOW}   Waiting for Docker to start (this may take up to 60 seconds)...${NC}"
            local max_attempts=60
            local attempt=0
            
            while [ $attempt -lt $max_attempts ]; do
                if docker info > /dev/null 2>&1; then
                    echo -e "${GREEN}✓ Docker is now running${NC}"
                    sleep 2  # Give it a moment to fully initialize
                    return 0
                fi
                echo -n "."
                sleep 1
                attempt=$((attempt + 1))
            done
            
            echo ""
            echo -e "${RED}❌ Docker failed to start after 60 seconds.${NC}"
            echo -e "${YELLOW}   Please start Docker Desktop manually and try again.${NC}"
            return 1
        else
            echo -e "${RED}❌ Docker Desktop is not installed.${NC}"
            echo -e "${YELLOW}   Please install Docker Desktop from https://www.docker.com/products/docker-desktop${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Docker is not running.${NC}"
        echo -e "${YELLOW}   Please start Docker manually and try again.${NC}"
        return 1
    fi
}

# Function to start Docker services
start_docker_services() {
    echo -e "${BLUE}🐳 Starting Docker services (PostgreSQL & Redis)...${NC}"
    if ! docker-compose up -d postgres redis; then
        echo -e "${RED}❌ Failed to start Docker services${NC}"
        return 1
    fi
    
    # Wait for services to be healthy
    echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
    sleep 3
    
    # Check if postgres is ready (max 60 seconds)
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose exec -T postgres pg_isready -U crm_user -d crm_db > /dev/null 2>&1; then
            echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
            break
        fi
        echo -e "${YELLOW}   Waiting for PostgreSQL...${NC}"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}❌ PostgreSQL failed to start after 60 seconds${NC}"
        return 1
    fi
    
    # Check if redis is ready (max 30 seconds)
    attempt=0
    while [ $attempt -lt 30 ]; do
        if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Redis is ready${NC}"
            return 0
        fi
        echo -e "${YELLOW}   Waiting for Redis...${NC}"
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ Redis failed to start after 30 seconds${NC}"
    return 1
}

# Function to install dependencies
install_deps() {
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    if bun install; then
        echo -e "${GREEN}✓ Dependencies installed${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        return 1
    fi
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

# Step 2: Check and start Docker if needed
echo -e "${BLUE}🐳 Checking Docker...${NC}"
if ! check_docker; then
    if ! start_docker_desktop; then
        echo ""
        echo -e "${RED}❌ Cannot proceed without Docker. Exiting.${NC}"
        exit 1
    fi
fi
echo ""

# Step 3: Start Docker services
if ! start_docker_services; then
    echo -e "${RED}❌ Failed to start Docker services. Exiting.${NC}"
    exit 1
fi
echo ""

# Step 4: Install dependencies if needed
if [ ! -d "node_modules" ] || [ "$1" == "--install" ]; then
    if ! install_deps; then
        echo -e "${RED}❌ Failed to install dependencies. Exiting.${NC}"
        exit 1
    fi
    echo ""
fi

# Enable strict error handling for server startup
set -e

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

