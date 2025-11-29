#!/bin/bash
# ============================================
# Health Check Script for CRM Monorepo
# ============================================
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
API_URL="${API_URL:-http://localhost:3001}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
TIMEOUT="${TIMEOUT:-10}"
RETRIES="${RETRIES:-3}"
RETRY_DELAY="${RETRY_DELAY:-5}"
CHECK_API="${CHECK_API:-true}"
CHECK_WEB="${CHECK_WEB:-true}"
VERBOSE="${VERBOSE:-false}"

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --api-url URL       API server URL (default: http://localhost:3001)"
    echo "  --web-url URL       Web server URL (default: http://localhost:3000)"
    echo "  --timeout SECONDS   Request timeout (default: 10)"
    echo "  --retries COUNT     Number of retries (default: 3)"
    echo "  --retry-delay SECS  Delay between retries (default: 5)"
    echo "  --api-only          Check only API health"
    echo "  --web-only          Check only Web health"
    echo "  -v, --verbose       Verbose output"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  API_URL             Override API URL"
    echo "  WEB_URL             Override Web URL"
    echo ""
    echo "Exit Codes:"
    echo "  0 - All health checks passed"
    echo "  1 - One or more health checks failed"
    echo ""
    echo "Examples:"
    echo "  $0"
    echo "  $0 --api-url https://api.example.com --web-url https://app.example.com"
    echo "  $0 --api-only --verbose"
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_debug() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $1"
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --api-url)
            API_URL="$2"
            shift 2
            ;;
        --web-url)
            WEB_URL="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --retries)
            RETRIES="$2"
            shift 2
            ;;
        --retry-delay)
            RETRY_DELAY="$2"
            shift 2
            ;;
        --api-only)
            CHECK_WEB="false"
            shift
            ;;
        --web-only)
            CHECK_API="false"
            shift
            ;;
        -v|--verbose)
            VERBOSE="true"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Health check function with retries
check_health() {
    local name="$1"
    local url="$2"
    local endpoint="${3:-/health}"
    local full_url="${url}${endpoint}"
    
    log_debug "Checking ${name} at ${full_url}"
    
    for ((i=1; i<=RETRIES; i++)); do
        log_debug "Attempt ${i}/${RETRIES}..."
        
        response=$(curl -sf -w "\n%{http_code}" --max-time "$TIMEOUT" "$full_url" 2>/dev/null) || true
        
        if [[ -n "$response" ]]; then
            http_code=$(echo "$response" | tail -n1)
            body=$(echo "$response" | head -n -1)
            
            log_debug "Response code: ${http_code}"
            log_debug "Response body: ${body}"
            
            if [[ "$http_code" == "200" ]]; then
                log_success "${name} is healthy (${full_url})"
                return 0
            fi
        fi
        
        if [[ $i -lt $RETRIES ]]; then
            log_debug "Retrying in ${RETRY_DELAY} seconds..."
            sleep "$RETRY_DELAY"
        fi
    done
    
    log_fail "${name} health check failed after ${RETRIES} attempts (${full_url})"
    return 1
}

# Track overall status
OVERALL_STATUS=0

echo ""
echo "=========================================="
echo "CRM Health Check"
echo "=========================================="
echo "Timeout: ${TIMEOUT}s | Retries: ${RETRIES} | Delay: ${RETRY_DELAY}s"
echo "=========================================="
echo ""

# Check API health
if [[ "$CHECK_API" == "true" ]]; then
    log_info "Checking API Server..."
    if ! check_health "API Server" "$API_URL" "/health"; then
        OVERALL_STATUS=1
    fi
    echo ""
fi

# Check Web health
if [[ "$CHECK_WEB" == "true" ]]; then
    log_info "Checking Web Application..."
    if ! check_health "Web Application" "$WEB_URL" "/api/health"; then
        OVERALL_STATUS=1
    fi
    echo ""
fi

# Summary
echo "=========================================="
if [[ $OVERALL_STATUS -eq 0 ]]; then
    log_success "All health checks passed!"
else
    log_error "One or more health checks failed!"
fi
echo "=========================================="

exit $OVERALL_STATUS

