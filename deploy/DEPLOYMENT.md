# CRM OpenShift Deployment Guide

This document provides comprehensive instructions for deploying the CRM application to OpenShift.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Initial Setup](#initial-setup)
4. [Database Setup](#database-setup)
5. [Application Deployment](#application-deployment)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Environment Configuration](#environment-configuration)
8. [Monitoring & Logging](#monitoring--logging)
9. [Operations](#operations)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- OpenShift CLI (`oc`) >= 4.14
- kubectl >= 1.28
- Docker or Podman
- Git

### OpenShift Requirements

- OpenShift 4.x cluster
- Cluster admin access (for operator installation)
- OpenShift Pipelines operator installed
- Sufficient cluster resources:
  - Development: 4 vCPU, 8GB RAM
  - Staging: 8 vCPU, 16GB RAM
  - Production: 16+ vCPU, 32GB+ RAM

### Operator Requirements

1. **Crunchy Data PostgreSQL Operator** (for PostgreSQL 16)
   - Install from OperatorHub or:
   ```bash
   oc apply -k https://github.com/CrunchyData/postgres-operator-examples/install/default
   ```

2. **Redis Operator** (OpsTree Solutions)
   - Install from OperatorHub

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      OpenShift Cluster                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Route     │    │   Route     │    │  Tekton     │     │
│  │  (Frontend) │    │  (Backend)  │    │  Pipeline   │     │
│  └──────┬──────┘    └──────┬──────┘    └─────────────┘     │
│         │                  │                                 │
│  ┌──────▼──────┐    ┌──────▼──────┐                        │
│  │   Service   │    │   Service   │                        │
│  │  (Frontend) │    │  (Backend)  │                        │
│  └──────┬──────┘    └──────┬──────┘                        │
│         │                  │                                 │
│  ┌──────▼──────┐    ┌──────▼──────┐                        │
│  │ Deployment  │    │ Deployment  │                        │
│  │  Next.js    │    │    Bun      │                        │
│  │  (3 pods)   │    │  (3 pods)   │                        │
│  └─────────────┘    └──────┬──────┘                        │
│                            │                                 │
│                     ┌──────┴──────┐                        │
│                     │             │                         │
│              ┌──────▼─────┐ ┌─────▼─────┐                  │
│              │ PostgreSQL │ │   Redis   │                  │
│              │  Cluster   │ │  Cluster  │                  │
│              │ (Crunchy)  │ │ (OpsTree) │                  │
│              └────────────┘ └───────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/crm-monorepo.git
cd crm-monorepo
```

### 2. Login to OpenShift

```bash
# Using token
oc login --token=<token> --server=https://api.cluster.example.com:6443

# Or using credentials
oc login -u admin -p <password> https://api.cluster.example.com:6443
```

### 3. Create Namespaces

```bash
# Create all namespaces
oc apply -f deploy/openshift/base/namespace.yaml

# Verify
oc get namespaces | grep crm
```

### 4. Configure Image Registry

```bash
# Login to internal registry
oc registry login

# Get registry URL
REGISTRY=$(oc registry info)
echo "Registry: $REGISTRY"
```

## Database Setup

### 1. Install Operators

```bash
# Apply operator CRDs
oc apply -k deploy/openshift/operators/
```

### 2. Create PostgreSQL Cluster

```bash
# Wait for PostgreSQL cluster to be ready
oc wait --for=condition=Ready postgresclusters/crm-postgresql \
  -n crm-dev --timeout=600s

# Get connection details
oc get secrets -n crm-dev | grep crm-postgresql

# Extract connection string
PG_USER=$(oc get secret crm-postgresql-pguser-crm_user -n crm-dev \
  -o jsonpath='{.data.user}' | base64 -d)
PG_PASS=$(oc get secret crm-postgresql-pguser-crm_user -n crm-dev \
  -o jsonpath='{.data.password}' | base64 -d)
PG_HOST=$(oc get secret crm-postgresql-pguser-crm_user -n crm-dev \
  -o jsonpath='{.data.host}' | base64 -d)
PG_DB=$(oc get secret crm-postgresql-pguser-crm_user -n crm-dev \
  -o jsonpath='{.data.dbname}' | base64 -d)

echo "DATABASE_URL=postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:5432/${PG_DB}"
```

### 3. Create Redis Cluster

```bash
# Wait for Redis to be ready
oc wait --for=condition=Ready redis/crm-redis \
  -n crm-dev --timeout=300s

# Verify Redis connection
oc exec -it deployment/crm-backend -n crm-dev -- \
  nc -zv crm-redis 6379
```

## Application Deployment

### 1. Build Docker Images

```bash
# Build frontend
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.crm.apps.cluster.example.com \
  -t crm-frontend:latest \
  -f apps/web/Dockerfile .

# Build backend
docker build \
  -t crm-backend:latest \
  -f apps/api-server/Dockerfile .
```

### 2. Push to Registry

```bash
REGISTRY=$(oc registry info)
NAMESPACE=crm-dev

# Tag and push frontend
docker tag crm-frontend:latest ${REGISTRY}/${NAMESPACE}/crm-frontend:latest
docker push ${REGISTRY}/${NAMESPACE}/crm-frontend:latest

# Tag and push backend
docker tag crm-backend:latest ${REGISTRY}/${NAMESPACE}/crm-backend:latest
docker push ${REGISTRY}/${NAMESPACE}/crm-backend:latest
```

### 3. Update Secrets

```bash
# Update secrets with actual credentials
oc create secret generic crm-secrets \
  --from-literal=DATABASE_URL="${DATABASE_URL}" \
  --from-literal=REDIS_URL="redis://crm-redis:6379" \
  --from-literal=JWT_SECRET="$(openssl rand -base64 32)" \
  --from-literal=SMTP_HOST="" \
  --from-literal=SMTP_PORT="587" \
  --from-literal=SMTP_USER="" \
  --from-literal=SMTP_PASS="" \
  -n crm-dev \
  --dry-run=client -o yaml | oc apply -f -
```

### 4. Deploy Application

```bash
# Deploy to dev
oc apply -k deploy/openshift/overlays/dev/

# Wait for rollout
oc rollout status deployment/crm-frontend -n crm-dev --timeout=300s
oc rollout status deployment/crm-backend -n crm-dev --timeout=300s

# Get route URLs
echo "Frontend: https://$(oc get route crm-frontend -n crm-dev -o jsonpath='{.spec.host}')"
echo "Backend: https://$(oc get route crm-backend -n crm-dev -o jsonpath='{.spec.host}')"
```

## CI/CD Pipeline

### 1. Install Pipeline Components

```bash
# Install tasks
oc apply -f deploy/tekton/tasks/ -n crm-dev

# Install pipeline
oc apply -f deploy/tekton/pipeline.yaml -n crm-dev

# Install triggers
oc apply -f deploy/tekton/triggers/ -n crm-dev
```

### 2. Configure Webhook

```bash
# Get webhook URL
WEBHOOK_URL=$(oc get route crm-webhook -n crm-dev -o jsonpath='{.spec.host}')
echo "Webhook URL: https://${WEBHOOK_URL}"

# Update webhook secret
oc create secret generic crm-webhook-secret \
  --from-literal=webhook-secret="$(openssl rand -hex 20)" \
  -n crm-dev \
  --dry-run=client -o yaml | oc apply -f -
```

### 3. Run Pipeline Manually

```bash
# Create a pipeline run
oc create -f deploy/tekton/pipelineruns/manual-run.yaml -n crm-dev

# Watch pipeline progress
tkn pipelinerun logs -f -L -n crm-dev

# Or use oc
oc logs -f $(oc get pods -n crm-dev -l tekton.dev/pipelineRun -o name | head -1)
```

## Environment Configuration

### Development

```bash
# Deploy to dev
oc apply -k deploy/openshift/overlays/dev/
```

Configuration:
- 1 replica per deployment
- Debug logging enabled
- Lower resource limits
- No HPA

### Staging

```bash
# Deploy to staging
oc apply -k deploy/openshift/overlays/staging/
```

Configuration:
- 2 replicas per deployment
- Info logging
- Production-like resources
- No HPA

### Production

```bash
# Deploy to production
oc apply -k deploy/openshift/overlays/production/
```

Configuration:
- 3+ replicas per deployment
- Warn logging only
- Full resource allocation
- HPA enabled (3-15 pods)
- PodDisruptionBudget
- NetworkPolicy

## Monitoring & Logging

### View Logs

```bash
# Frontend logs
oc logs -f deployment/crm-frontend -n crm-dev

# Backend logs
oc logs -f deployment/crm-backend -n crm-dev

# All pods
oc logs -f -l app=crm-backend -n crm-dev --max-log-requests=10
```

### Metrics

```bash
# Pod resource usage
oc adm top pods -n crm-dev

# Node resource usage
oc adm top nodes
```

### Health Checks

```bash
# Frontend health
curl -k https://$(oc get route crm-frontend -n crm-dev -o jsonpath='{.spec.host}')/

# Backend health
curl -k https://$(oc get route crm-backend -n crm-dev -o jsonpath='{.spec.host}')/health

# API status
curl -k https://$(oc get route crm-backend -n crm-dev -o jsonpath='{.spec.host}')/api/v1
```

## Operations

### Rolling Update

```bash
# Update image tag
oc set image deployment/crm-backend \
  backend=${REGISTRY}/${NAMESPACE}/crm-backend:v1.2.0 \
  -n crm-dev

# Monitor rollout
oc rollout status deployment/crm-backend -n crm-dev
```

### Rollback

```bash
# View rollout history
oc rollout history deployment/crm-backend -n crm-dev

# Rollback to previous
oc rollout undo deployment/crm-backend -n crm-dev

# Rollback to specific revision
oc rollout undo deployment/crm-backend --to-revision=2 -n crm-dev
```

### Scaling

```bash
# Manual scale
oc scale deployment/crm-backend --replicas=5 -n crm-dev

# HPA will override in production
oc get hpa -n crm-prod
```

### Database Migration

```bash
# Run migrations via job
oc run crm-migrate --rm -it --restart=Never \
  --image=${REGISTRY}/${NAMESPACE}/crm-backend:latest \
  -n crm-dev \
  -- bun run db:migrate
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod events
oc describe pod <pod-name> -n crm-dev

# Check logs
oc logs <pod-name> -n crm-dev --previous
```

### Database Connection Issues

```bash
# Verify PostgreSQL is running
oc get pods -l postgres-operator.crunchydata.com/cluster=crm-postgresql -n crm-dev

# Test connection from backend pod
oc exec -it deployment/crm-backend -n crm-dev -- nc -zv crm-postgresql 5432

# Check secrets
oc get secret crm-secrets -n crm-dev -o yaml
```

### Redis Connection Issues

```bash
# Verify Redis is running
oc get pods -l app=crm-redis -n crm-dev

# Test connection
oc exec -it deployment/crm-backend -n crm-dev -- nc -zv crm-redis 6379
```

### Image Pull Errors

```bash
# Check image pull secrets
oc get secrets -n crm-dev | grep pull

# Verify image exists
oc get is -n crm-dev

# Check service account
oc get sa default -n crm-dev -o yaml
```

### Pipeline Failures

```bash
# View pipeline run logs
tkn pipelinerun logs <run-name> -n crm-dev

# Check task status
tkn taskrun list -n crm-dev

# View task logs
tkn taskrun logs <taskrun-name> -n crm-dev
```

## Security Considerations

1. **Secrets Management**
   - Use External Secrets Operator for production
   - Rotate secrets regularly
   - Never commit secrets to Git

2. **Network Policies**
   - Production uses NetworkPolicy for isolation
   - Only allow necessary traffic

3. **Pod Security**
   - All pods run as non-root
   - Read-only root filesystem where possible
   - Minimal capabilities

4. **RBAC**
   - Service accounts have minimal permissions
   - Pipeline SA only has edit access

## Support

For issues or questions:
1. Check this documentation
2. Review pod logs and events
3. Contact the platform team

