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
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Ports
API_PORT=3001
WEB_PORT=3000

# Navigate to project root first
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

# ============================================
# Functions
# ============================================

print_header() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║        CRM Monorepo - Dev Environment Setup           ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pids=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}⚠️  Killing processes on port $port (PIDs: $pids)${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
    else
        echo -e "${GREEN}✓ Port $port is free${NC}"
    fi
}

# Function to kill all related processes aggressively
kill_all_dev_processes() {
    echo -e "${BLUE}🧹 Cleaning up existing processes...${NC}"

    # Kill any next.js processes
    pkill -9 -f "next dev" 2>/dev/null || true
    pkill -9 -f "next-server" 2>/dev/null || true

    # Kill any bun processes running our apps
    pkill -9 -f "bun.*apps/web" 2>/dev/null || true
    pkill -9 -f "bun.*apps/api-server" 2>/dev/null || true

    # Kill by ports
    kill_port $WEB_PORT
    kill_port $API_PORT

    # Small delay to ensure processes are dead
    sleep 1
}

# Function to clear Next.js lock files and cache
clear_next_locks() {
    echo -e "${BLUE}🔓 Clearing Next.js locks and cache...${NC}"

    # Remove lock files
    rm -f "$PROJECT_ROOT/apps/web/.next/dev/lock" 2>/dev/null

    # Optionally clear .next cache if corrupted (only on --clean flag)
    if [ "$1" == "--clean" ]; then
        echo -e "${YELLOW}   Clearing .next cache...${NC}"
        rm -rf "$PROJECT_ROOT/apps/web/.next" 2>/dev/null
    fi

    echo -e "${GREEN}✓ Lock files cleared${NC}"
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

    # Check if services are already running
    local pg_running=$(docker-compose ps -q postgres 2>/dev/null)
    local redis_running=$(docker-compose ps -q redis 2>/dev/null)

    if [ -n "$pg_running" ] && [ -n "$redis_running" ]; then
        # Check if they're healthy
        if docker-compose exec -T postgres pg_isready -U crm_user -d crm_db > /dev/null 2>&1; then
            if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
                echo -e "${GREEN}✓ Docker services already running and healthy${NC}"
                return 0
            fi
        fi
    fi

    if ! docker-compose up -d postgres redis; then
        echo -e "${RED}❌ Failed to start Docker services${NC}"
        return 1
    fi

    # Wait for services to be healthy
    echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
    sleep 2

    # Check if postgres is ready (max 30 seconds)
    local max_attempts=15
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose exec -T postgres pg_isready -U crm_user -d crm_db > /dev/null 2>&1; then
            echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
            break
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo ""

    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}❌ PostgreSQL failed to start after 30 seconds${NC}"
        return 1
    fi

    # Check if redis is ready (max 15 seconds)
    attempt=0
    while [ $attempt -lt 15 ]; do
        if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Redis is ready${NC}"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    echo -e "${RED}❌ Redis failed to start after 15 seconds${NC}"
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

# Function to wait for server to be ready
wait_for_server() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=0

    echo -e "${YELLOW}   Waiting for $name to be ready...${NC}"

    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}   ✓ $name is responding${NC}"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    echo -e "${YELLOW}   ⚠ $name may still be starting...${NC}"
    return 0
}

# Function to show status
show_status() {
    echo -e "${BLUE}📊 Current Status:${NC}"
    echo ""

    # Check ports
    local web_pid=$(lsof -ti :$WEB_PORT 2>/dev/null)
    local api_pid=$(lsof -ti :$API_PORT 2>/dev/null)

    if [ -n "$web_pid" ]; then
        echo -e "  ${GREEN}✓ Web server running on port $WEB_PORT (PID: $web_pid)${NC}"
    else
        echo -e "  ${RED}✗ Web server not running${NC}"
    fi

    if [ -n "$api_pid" ]; then
        echo -e "  ${GREEN}✓ API server running on port $API_PORT (PID: $api_pid)${NC}"
    else
        echo -e "  ${RED}✗ API server not running${NC}"
    fi

    # Check Docker services
    if docker-compose exec -T postgres pg_isready -U crm_user -d crm_db > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ PostgreSQL is running${NC}"
    else
        echo -e "  ${RED}✗ PostgreSQL not running${NC}"
    fi

    if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Redis is running${NC}"
    else
        echo -e "  ${RED}✗ Redis not running${NC}"
    fi

    echo ""
}

# Function to show help
show_help() {
    echo -e "${CYAN}Usage: ./dev.sh [options]${NC}"
    echo ""
    echo "Options:"
    echo "  --help, -h      Show this help message"
    echo "  --status, -s    Show status of all services"
    echo "  --stop          Stop all development services"
    echo "  --restart       Restart all services"
    echo "  --clean         Clear Next.js cache before starting"
    echo "  --install       Force reinstall dependencies"
    echo "  --api-only      Start only the API server"
    echo "  --web-only      Start only the Web server"
    echo "  --seed-tenants  Seed Cloud Native & Softergee tenant data"
    echo ""
}

# ============================================
# Parse Arguments
# ============================================

CLEAN_CACHE=""
FORCE_INSTALL=""
API_ONLY=""
WEB_ONLY=""
SEED_TENANTS=""

for arg in "$@"; do
    case $arg in
        --help|-h)
            show_help
            exit 0
            ;;
        --status|-s)
            show_status
            exit 0
            ;;
        --stop)
            echo -e "${YELLOW}🛑 Stopping all services...${NC}"
            kill_all_dev_processes
            echo -e "${GREEN}✓ All services stopped${NC}"
            exit 0
            ;;
        --restart)
            echo -e "${YELLOW}🔄 Restarting all services...${NC}"
            kill_all_dev_processes
            clear_next_locks
            # Continue with normal startup
            ;;
        --clean)
            CLEAN_CACHE="--clean"
            ;;
        --install)
            FORCE_INSTALL="yes"
            ;;
        --api-only)
            API_ONLY="yes"
            ;;
        --web-only)
            WEB_ONLY="yes"
            ;;
        --seed-tenants)
            SEED_TENANTS="yes"
            ;;
    esac
done

# ============================================
# Main Script
# ============================================

print_header
echo -e "${BLUE}📁 Project root: $PROJECT_ROOT${NC}"
echo ""

# Step 1: Kill existing processes and clear locks
kill_all_dev_processes
clear_next_locks $CLEAN_CACHE
echo ""

# Step 2: Check and start Docker if needed (unless web-only)
if [ -z "$WEB_ONLY" ]; then
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
fi

# Step 4: Install dependencies if needed
if [ ! -d "node_modules" ] || [ -n "$FORCE_INSTALL" ]; then
    if ! install_deps; then
        echo -e "${RED}❌ Failed to install dependencies. Exiting.${NC}"
        exit 1
    fi
    echo ""
fi

# Step 4.5: Seed tenant data if requested
if [ -n "$SEED_TENANTS" ]; then
    echo -e "${BLUE}🏢 Seeding Cloud Native & Softergee tenant data...${NC}"
    cd "$PROJECT_ROOT/apps/api-server"
    if bun run db:seed-tenants; then
        echo -e "${GREEN}✓ Tenant data seeded successfully${NC}"
    else
        echo -e "${RED}❌ Failed to seed tenant data${NC}"
        exit 1
    fi
    cd "$PROJECT_ROOT"
    echo ""
fi

# Enable strict error handling for server startup
set -e

# Step 5: Start development servers
echo -e "${BLUE}🚀 Starting development servers...${NC}"
echo ""

# Start API server in background (unless web-only)
if [ -z "$WEB_ONLY" ]; then
    echo -e "${YELLOW}Starting API server on port $API_PORT...${NC}"
    cd "$PROJECT_ROOT/apps/api-server"
    bun run dev &
    API_PID=$!
    sleep 2
fi

# Start Web server in background (unless api-only)
if [ -z "$API_ONLY" ]; then
    echo -e "${YELLOW}Starting Web server on port $WEB_PORT...${NC}"
    cd "$PROJECT_ROOT/apps/web"
    bun run dev &
    WEB_PID=$!
    sleep 3
fi

# Wait for servers to be ready
echo ""
if [ -z "$WEB_ONLY" ]; then
    wait_for_server "http://localhost:$API_PORT/health" "API server"
fi
if [ -z "$API_ONLY" ]; then
    wait_for_server "http://localhost:$WEB_PORT" "Web server"
fi

echo ""
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║           🎉 Development Environment Ready!           ║"
echo "╠═══════════════════════════════════════════════════════╣"
echo "║                                                       ║"
if [ -z "$API_ONLY" ]; then
echo "║  🌐 Frontend:  http://localhost:$WEB_PORT                 ║"
fi
if [ -z "$WEB_ONLY" ]; then
echo "║  🔌 API:       http://localhost:$API_PORT                 ║"
echo "║  🗄️  Database:  localhost:5432                         ║"
echo "║  📦 Redis:     localhost:6379                         ║"
fi
echo "║                                                       ║"
echo "║  Press Ctrl+C to stop all services                    ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Trap SIGINT to cleanup
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down...${NC}"
    [ -n "$API_PID" ] && kill $API_PID 2>/dev/null || true
    [ -n "$WEB_PID" ] && kill $WEB_PID 2>/dev/null || true

    # Also kill any orphaned processes
    pkill -9 -f "next dev" 2>/dev/null || true
    pkill -9 -f "bun.*apps/web" 2>/dev/null || true
    pkill -9 -f "bun.*apps/api-server" 2>/dev/null || true

    echo -e "${GREEN}✓ Development servers stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for both processes
if [ -n "$API_PID" ] && [ -n "$WEB_PID" ]; then
    wait $API_PID $WEB_PID
elif [ -n "$API_PID" ]; then
    wait $API_PID
elif [ -n "$WEB_PID" ]; then
    wait $WEB_PID
fi
