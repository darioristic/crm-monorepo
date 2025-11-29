#!/bin/bash
# ============================================
# Kubernetes Deploy Script for CRM Monorepo
# ============================================
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
ENV="${ENV:-dev}"
DRY_RUN="${DRY_RUN:-false}"
REGISTRY="${REGISTRY:-}"
TAG="${TAG:-latest}"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --env ENV             Environment: dev, staging, production (default: dev)"
    echo "  -r, --registry REGISTRY   Docker registry for image references"
    echo "  -t, --tag TAG             Image tag (default: latest)"
    echo "  --dry-run                 Show what would be applied without executing"
    echo "  -h, --help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e dev"
    echo "  $0 -e production -r ghcr.io/myorg -t v1.0.0"
    echo "  $0 -e staging --dry-run"
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

log_section() {
    echo -e "\n${BLUE}==== $1 ====${NC}\n"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENV="$2"
            shift 2
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN="true"
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

# Validate environment
case $ENV in
    dev|staging|production)
        ;;
    *)
        log_error "Invalid environment: $ENV. Must be dev, staging, or production."
        exit 1
        ;;
esac

OVERLAY_DIR="${ROOT_DIR}/k8s/overlays/${ENV}"

# Check if overlay exists
if [[ ! -d "$OVERLAY_DIR" ]]; then
    log_error "Overlay directory not found: $OVERLAY_DIR"
    exit 1
fi

# Check kubectl is available
if ! command -v kubectl &>/dev/null; then
    log_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check kustomize is available (or use kubectl kustomize)
KUSTOMIZE_CMD="kubectl kustomize"
if command -v kustomize &>/dev/null; then
    KUSTOMIZE_CMD="kustomize build"
fi

log_section "Deploying to ${ENV} environment"

cd "$ROOT_DIR"

# Build kustomize output
log_info "Building kustomize manifests..."
MANIFESTS=$($KUSTOMIZE_CMD "$OVERLAY_DIR")

# Update image references if registry is specified
if [[ -n "$REGISTRY" ]]; then
    log_info "Updating image references to use registry: ${REGISTRY}"
    MANIFESTS=$(echo "$MANIFESTS" | sed "s|image: crm-api:|image: ${REGISTRY}/crm-api:|g")
    MANIFESTS=$(echo "$MANIFESTS" | sed "s|image: crm-web:|image: ${REGISTRY}/crm-web:|g")
fi

# Update image tags
if [[ "$TAG" != "latest" ]]; then
    log_info "Updating image tags to: ${TAG}"
    MANIFESTS=$(echo "$MANIFESTS" | sed "s|:latest|:${TAG}|g")
    MANIFESTS=$(echo "$MANIFESTS" | sed "s|:dev|:${TAG}|g")
    MANIFESTS=$(echo "$MANIFESTS" | sed "s|:staging|:${TAG}|g")
fi

if [[ "$DRY_RUN" == "true" ]]; then
    log_section "Dry Run - Would apply the following manifests:"
    echo "$MANIFESTS"
    echo ""
    log_info "Dry run complete. No changes made."
else
    log_info "Applying manifests to cluster..."
    echo "$MANIFESTS" | kubectl apply -f -
    
    log_section "Waiting for deployments to be ready..."
    
    # Get namespace from environment
    case $ENV in
        dev)
            NAMESPACE="crm-dev"
            ;;
        staging)
            NAMESPACE="crm-staging"
            ;;
        production)
            NAMESPACE="crm-prod"
            ;;
    esac
    
    # Wait for deployments
    log_info "Waiting for crm-api deployment..."
    kubectl rollout status deployment/crm-api -n "$NAMESPACE" --timeout=300s || true
    
    log_info "Waiting for crm-web deployment..."
    kubectl rollout status deployment/crm-web -n "$NAMESPACE" --timeout=300s || true
    
    log_section "Deployment Status"
    kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/part-of=crm-monorepo
    
    log_info "Deployment to ${ENV} completed!"
fi

# Print summary
echo ""
echo "=========================================="
echo "Deployment Summary"
echo "=========================================="
echo "Environment: ${ENV}"
echo "Registry: ${REGISTRY:-local}"
echo "Tag: ${TAG}"
echo "Overlay: ${OVERLAY_DIR}"
echo "=========================================="

