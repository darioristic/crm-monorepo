#!/bin/bash
# ============================================
# OpenShift Deploy Script for CRM Monorepo
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
TAG="${TAG:-latest}"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --env ENV       Environment: dev, staging, production (default: dev)"
    echo "  -t, --tag TAG       Image tag (default: latest)"
    echo "  --dry-run           Show what would be applied without executing"
    echo "  --build             Trigger new builds before deploying"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e dev"
    echo "  $0 -e production -t v1.0.0"
    echo "  $0 -e staging --build"
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

BUILD="${BUILD:-false}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENV="$2"
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
        --build)
            BUILD="true"
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

OVERLAY_DIR="${ROOT_DIR}/deploy/openshift/overlays/${ENV}"

# Check if overlay exists
if [[ ! -d "$OVERLAY_DIR" ]]; then
    log_error "Overlay directory not found: $OVERLAY_DIR"
    exit 1
fi

# Check oc is available
if ! command -v oc &>/dev/null; then
    log_error "oc (OpenShift CLI) is not installed or not in PATH"
    exit 1
fi

# Check kustomize is available
KUSTOMIZE_CMD="oc kustomize"
if command -v kustomize &>/dev/null; then
    KUSTOMIZE_CMD="kustomize build"
fi

log_section "Deploying to OpenShift ${ENV} environment"

cd "$ROOT_DIR"

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

# Trigger builds if requested
if [[ "$BUILD" == "true" && "$DRY_RUN" == "false" ]]; then
    log_section "Triggering OpenShift Builds"
    
    log_info "Starting API build..."
    oc start-build crm-api-build -n "$NAMESPACE" --follow || log_warn "API build may not exist yet"
    
    log_info "Starting Web build..."
    oc start-build crm-web-build -n "$NAMESPACE" --follow || log_warn "Web build may not exist yet"
fi

# Build kustomize output
log_info "Building kustomize manifests..."
MANIFESTS=$($KUSTOMIZE_CMD "$OVERLAY_DIR")

if [[ "$DRY_RUN" == "true" ]]; then
    log_section "Dry Run - Would apply the following manifests:"
    echo "$MANIFESTS"
    echo ""
    
    # Validate with oc
    log_info "Validating manifests..."
    echo "$MANIFESTS" | oc apply --dry-run=server -f - || log_warn "Validation returned warnings"
    
    log_info "Dry run complete. No changes made."
else
    log_info "Applying manifests to OpenShift cluster..."
    echo "$MANIFESTS" | oc apply -f -
    
    log_section "Waiting for deployments to be ready..."
    
    # Wait for deployments
    log_info "Waiting for crm-api deployment..."
    oc rollout status deployment/crm-api -n "$NAMESPACE" --timeout=300s || true
    
    log_info "Waiting for crm-web deployment..."
    oc rollout status deployment/crm-web -n "$NAMESPACE" --timeout=300s || true
    
    log_section "Deployment Status"
    oc get pods -n "$NAMESPACE" -l app.kubernetes.io/part-of=crm-monorepo
    
    log_section "Routes"
    oc get routes -n "$NAMESPACE"
    
    log_info "Deployment to OpenShift ${ENV} completed!"
fi

# Print summary
echo ""
echo "=========================================="
echo "OpenShift Deployment Summary"
echo "=========================================="
echo "Environment: ${ENV}"
echo "Namespace: ${NAMESPACE}"
echo "Tag: ${TAG}"
echo "Overlay: ${OVERLAY_DIR}"
echo "=========================================="

