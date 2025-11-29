#!/bin/bash
# ============================================
# Docker Push Script for CRM Monorepo
# ============================================
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default values
REGISTRY="${REGISTRY:-}"
TAG="${TAG:-latest}"
PUSH_API="${PUSH_API:-true}"
PUSH_WEB="${PUSH_WEB:-true}"

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -r, --registry REGISTRY   Docker registry (required)"
    echo "  -t, --tag TAG             Image tag (default: latest)"
    echo "  --api-only                Push only API image"
    echo "  --web-only                Push only Web image"
    echo "  -h, --help                Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  DOCKER_USERNAME           Registry username"
    echo "  DOCKER_PASSWORD           Registry password/token"
    echo ""
    echo "Examples:"
    echo "  $0 -r ghcr.io/myorg -t v1.0.0"
    echo "  $0 -r docker.io/myuser -t main"
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
            PUSH_WEB="false"
            shift
            ;;
        --web-only)
            PUSH_API="false"
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

# Validate registry
if [[ -z "$REGISTRY" ]]; then
    log_error "Registry is required. Use -r or --registry to specify."
    usage
    exit 1
fi

# Login to registry if credentials are provided
if [[ -n "${DOCKER_USERNAME:-}" && -n "${DOCKER_PASSWORD:-}" ]]; then
    log_info "Logging into registry: ${REGISTRY}"
    echo "$DOCKER_PASSWORD" | docker login "${REGISTRY%%/*}" -u "$DOCKER_USERNAME" --password-stdin
fi

# Set image names
API_IMAGE="${REGISTRY}/crm-api:${TAG}"
WEB_IMAGE="${REGISTRY}/crm-web:${TAG}"

# Push API image
if [[ "$PUSH_API" == "true" ]]; then
    log_info "Pushing API image: ${API_IMAGE}"
    
    # Tag local image if it exists
    if docker image inspect "crm-api:${TAG}" &>/dev/null; then
        docker tag "crm-api:${TAG}" "$API_IMAGE"
    elif docker image inspect "crm-api:latest" &>/dev/null; then
        docker tag "crm-api:latest" "$API_IMAGE"
    fi
    
    docker push "$API_IMAGE"
    log_info "API image pushed successfully"
fi

# Push Web image
if [[ "$PUSH_WEB" == "true" ]]; then
    log_info "Pushing Web image: ${WEB_IMAGE}"
    
    # Tag local image if it exists
    if docker image inspect "crm-web:${TAG}" &>/dev/null; then
        docker tag "crm-web:${TAG}" "$WEB_IMAGE"
    elif docker image inspect "crm-web:latest" &>/dev/null; then
        docker tag "crm-web:latest" "$WEB_IMAGE"
    fi
    
    docker push "$WEB_IMAGE"
    log_info "Web image pushed successfully"
fi

log_info "Push completed successfully!"

# Print summary
echo ""
echo "=========================================="
echo "Push Summary"
echo "=========================================="
if [[ "$PUSH_API" == "true" ]]; then
    echo "API Image: ${API_IMAGE}"
fi
if [[ "$PUSH_WEB" == "true" ]]; then
    echo "Web Image: ${WEB_IMAGE}"
fi
echo "=========================================="

