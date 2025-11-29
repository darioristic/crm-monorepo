#!/bin/bash
# ============================================
# Docker Build Script for CRM Monorepo
# ============================================
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
REGISTRY="${REGISTRY:-}"
TAG="${TAG:-latest}"
BUILD_API="${BUILD_API:-true}"
BUILD_WEB="${BUILD_WEB:-true}"
PUSH="${PUSH:-false}"
NO_CACHE="${NO_CACHE:-false}"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -r, --registry REGISTRY   Docker registry (e.g., ghcr.io/username)"
    echo "  -t, --tag TAG             Image tag (default: latest)"
    echo "  --api-only                Build only API image"
    echo "  --web-only                Build only Web image"
    echo "  --push                    Push images after build"
    echo "  --no-cache                Build without cache"
    echo "  -h, --help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -t v1.0.0"
    echo "  $0 -r ghcr.io/myorg -t main --push"
    echo "  $0 --api-only --no-cache"
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

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        --api-only)
            BUILD_WEB="false"
            shift
            ;;
        --web-only)
            BUILD_API="false"
            shift
            ;;
        --push)
            PUSH="true"
            shift
            ;;
        --no-cache)
            NO_CACHE="true"
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

# Set image names
if [[ -n "$REGISTRY" ]]; then
    API_IMAGE="${REGISTRY}/crm-api:${TAG}"
    WEB_IMAGE="${REGISTRY}/crm-web:${TAG}"
else
    API_IMAGE="crm-api:${TAG}"
    WEB_IMAGE="crm-web:${TAG}"
fi

# Build options
BUILD_OPTS=""
if [[ "$NO_CACHE" == "true" ]]; then
    BUILD_OPTS="--no-cache"
fi

cd "$ROOT_DIR"

# Build API image
if [[ "$BUILD_API" == "true" ]]; then
    log_info "Building API image: ${API_IMAGE}"
    docker build $BUILD_OPTS \
        -f docker/api.Dockerfile \
        -t "$API_IMAGE" \
        --label "org.opencontainers.image.revision=$(git rev-parse HEAD 2>/dev/null || echo 'unknown')" \
        --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        .
    
    if [[ "$PUSH" == "true" && -n "$REGISTRY" ]]; then
        log_info "Pushing API image: ${API_IMAGE}"
        docker push "$API_IMAGE"
    fi
    
    log_info "API image built successfully: ${API_IMAGE}"
fi

# Build Web image
if [[ "$BUILD_WEB" == "true" ]]; then
    log_info "Building Web image: ${WEB_IMAGE}"
    
    # Get API URL from environment or use default
    NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3001}"
    
    docker build $BUILD_OPTS \
        -f docker/web.Dockerfile \
        -t "$WEB_IMAGE" \
        --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
        --label "org.opencontainers.image.revision=$(git rev-parse HEAD 2>/dev/null || echo 'unknown')" \
        --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        .
    
    if [[ "$PUSH" == "true" && -n "$REGISTRY" ]]; then
        log_info "Pushing Web image: ${WEB_IMAGE}"
        docker push "$WEB_IMAGE"
    fi
    
    log_info "Web image built successfully: ${WEB_IMAGE}"
fi

log_info "Build completed successfully!"

# Print summary
echo ""
echo "=========================================="
echo "Build Summary"
echo "=========================================="
if [[ "$BUILD_API" == "true" ]]; then
    echo "API Image: ${API_IMAGE}"
fi
if [[ "$BUILD_WEB" == "true" ]]; then
    echo "Web Image: ${WEB_IMAGE}"
fi
echo "=========================================="

