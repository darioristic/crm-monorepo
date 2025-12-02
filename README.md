# 🚀 CRM Monorepo

Modern, full-stack CRM system built with cutting-edge technologies.

## 📚 Documentation

**Complete documentation available in [`/docs`](./docs/README.md)**

- **[Setup Guide](./docs/SETUP.md)** - Get started in 5 minutes
- **[API Documentation](./docs/API.md)** - 80+ API endpoints reference
- **[Architecture](./docs/ARCHITECTURE.md)** - System design & patterns
- **[Testing Guide](./docs/TESTING.md)** - 240 tests, 98.8% pass rate

---

## ⚡ Quick Start

### Automatski (Preporučeno)

Jedna komanda pokreće sve automatski:

```bash
# Pokreće Docker Desktop (ako nije pokrenut), Docker servise, i development servere
bun run dev:start
# ili direktno:
bash scripts/dev.sh
```

Skripta automatski:
- ✅ Proverava i pokreće Docker Desktop (macOS)
- ✅ Pokreće PostgreSQL i Redis servise
- ✅ Instalira zavisnosti (ako je potrebno)
- ✅ Pokreće API server (port 3001) i Web server (port 3000)
- ✅ Čeka dok sve servise ne budu spremni

**🎉 Done!** Frontend: <http://localhost:3000> | API: <http://localhost:3001>

### Ručno

```bash
# 1. Clone and install
git clone <repo-url> && cd crm-monorepo && bun install

# 2. Start services
docker-compose up -d

# 3. Setup database
cd apps/api-server && bun run db:setup

# 4. Start development
bun run dev
```

**Test credentials**: `admin@crm.com` / `Admin123!`

---

## Tech Stack

| Layer | Technology | Version | Usage |
|-------|------------|---------|-------|
| Frontend | Next.js | 16.0.1 | React framework with App Router & Turbopack |
| Frontend | React | 19.2.0 | Modern React with Activity, useEffectEvent |
| Styling | Tailwind CSS | 4.1.16 | Utility-first CSS |
| 3D & Animations | React Three Fiber | 8.17.0 | 3D rendering in React |
| 3D & Animations | GSAP | 3.12.5 | Timeline-based UI animations |
| Backend | Bun | 1.1.0+ | All-in-one JS runtime and server |
| Backend | TypeScript | 5.7.0 | Type-safe development |
| Database | PostgreSQL | 16 | Relational database |
| Cache | Redis | 7 | Fast cache and sessions |
| Tooling | Biome | 2.3.3 | Formatter and linter |

## Project Structure

```
crm-monorepo/
├── apps/
│   ├── web/              # Next.js 16 + React 19 frontend
│   │   └── src/
│   │       ├── app/      # App Router pages
│   │       ├── components/
│   │       └── lib/      # Utilities, API client
│   └── api-server/       # Bun + TypeScript backend
│       └── src/
│           ├── routes/   # REST API endpoints
│           ├── services/ # Business logic
│           ├── db/       # PostgreSQL models, migrations, queries
│           └── cache/    # Redis integration
├── packages/
│   ├── types/            # Shared TypeScript types (@crm/types)
│   └── utils/            # Shared utility functions (@crm/utils)
├── biome.json            # Biome linter/formatter config
├── docker-compose.yml    # PostgreSQL + Redis services
├── package.json          # Root workspace configuration
└── tsconfig.json         # Base TypeScript configuration
```

## Prerequisites

- [Bun](https://bun.sh/) >= 1.1.0
- [Docker](https://www.docker.com/) (for PostgreSQL and Redis)

## Getting Started

### 1. Install Dependencies

```bash
cd crm-monorepo
bun install
```

### 2. Start Database Services

```bash
bun run db:up
```

This starts PostgreSQL (port 5432) and Redis (port 6379) containers.

### 3. Initialize Database

```bash
cd apps/api-server
bun run db:setup   # Creates schema + seeds sample data
```

### 4. Start Development Servers

**Start all apps:**
```bash
bun run dev
```

**Or start individually:**
```bash
# API Server (port 3001)
bun run dev:api

# Web Frontend (port 3000)
bun run dev:web
```

## Scripts

### Root Workspace

| Command | Description |
|---------|-------------|
| `bun run dev:start` | **Automatski pokreće sve** (Docker + servisi + dev serveri) |
| `bun run dev` | Start all development servers (zahteva Docker) |
| `bun run dev:api` | Start API server only |
| `bun run dev:web` | Start web frontend only |
| `bun run dev:quick` | Quick start bez Docker provere |
| `bun run build` | Build all packages |
| `bun run db:up` | Start Docker containers |
| `bun run db:down` | Stop Docker containers |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run lint` | Run Biome linter |
| `bun run format` | Format code with Biome |
| `bun run check` | Run all Biome checks |
| `bun run clean` | Remove all node_modules |

### API Server (`apps/api-server`)

| Command | Description |
|---------|-------------|
| `bun run db:migrate` | Run pending migrations |
| `bun run db:rollback` | Rollback last migration |
| `bun run db:reset` | Rollback all migrations |
| `bun run db:status` | Show migration status |
| `bun run db:schema` | Create database schema |
| `bun run db:seed` | Insert sample data |
| `bun run db:unseed` | Remove sample data |
| `bun run db:setup` | Schema + seed in one command |

## Environment Variables

### API Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `HOST` | `0.0.0.0` | Server host |
| `DATABASE_URL` | `postgres://crm_user:crm_password@localhost:5432/crm_db` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |

### Web Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:3001` | API server URL |

## API Endpoints

### Health
- `GET /health` - Server health check

### Companies
- `GET /api/v1/companies` - List companies
- `GET /api/v1/companies/:id` - Get company by ID
- `POST /api/v1/companies` - Create company
- `PUT /api/v1/companies/:id` - Update company
- `DELETE /api/v1/companies/:id` - Delete company

### Users
- `GET /api/v1/users` - List users (with company join)
- `GET /api/v1/users/:id` - Get user by ID
- `POST /api/v1/users` - Create user
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user

### Leads
- `GET /api/v1/leads` - List leads
- `GET /api/v1/leads/:id` - Get lead by ID
- `POST /api/v1/leads` - Create lead
- `PUT /api/v1/leads/:id` - Update lead
- `DELETE /api/v1/leads/:id` - Delete lead

### Deals
- `GET /api/v1/deals` - List deals
- `GET /api/v1/deals/:id` - Get deal by ID
- `POST /api/v1/deals` - Create deal
- `PUT /api/v1/deals/:id` - Update deal
- `GET /api/v1/deals/pipeline/summary` - Pipeline summary

### Projects & Tasks
- `GET /api/v1/projects` - List projects
- `GET /api/v1/projects/:id` - Get project by ID
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects/:projectId/tasks` - List project tasks
- `POST /api/v1/projects/:projectId/tasks` - Create task
- `PUT /api/v1/tasks/:id` - Update task

## OpenShift Deployment

This project includes full OpenShift deployment configuration with CI/CD pipeline support.

### Directory Structure

```
deploy/
├── openshift/
│   ├── base/                    # Base Kubernetes manifests
│   │   ├── namespace.yaml       # Namespaces and RBAC
│   │   ├── configmap.yaml       # Configuration
│   │   ├── secrets.yaml         # Sensitive data
│   │   ├── frontend-deployment.yaml
│   │   ├── backend-deployment.yaml
│   │   ├── *-service.yaml       # Services
│   │   └── *-route.yaml         # Routes (Ingress)
│   ├── operators/               # Database operators
│   │   ├── postgresql-cluster.yaml
│   │   └── redis-cluster.yaml
│   └── overlays/                # Environment-specific configs
│       ├── dev/
│       ├── staging/
│       └── production/
└── tekton/                      # CI/CD Pipeline
    ├── pipeline.yaml
    ├── tasks/
    └── triggers/
```

### Prerequisites

1. OpenShift 4.x cluster with:
   - OpenShift Pipelines (Tekton) operator
   - Crunchy Data PostgreSQL operator
   - Redis operator (OpsTree or similar)

2. CLI tools:
   - `oc` (OpenShift CLI)
   - `kubectl`
   - `kustomize`

### Quick Start Deployment

```bash
# 1. Login to OpenShift
oc login --token=<token> --server=<api-server>

# 2. Create namespaces
oc apply -f deploy/openshift/base/namespace.yaml

# 3. Install database operators (one-time)
oc apply -k deploy/openshift/operators/

# 4. Wait for operators to be ready
oc wait --for=condition=Ready pods -l app=postgres-operator -n postgres-operator --timeout=300s

# 5. Deploy to development environment
oc apply -k deploy/openshift/overlays/dev/

# 6. Check deployment status
oc get pods -n crm-dev
oc get routes -n crm-dev
```

### Building Docker Images

```bash
# Build frontend image
docker build -t crm-frontend:latest -f apps/web/Dockerfile .

# Build backend image
docker build -t crm-backend:latest -f apps/api-server/Dockerfile .

# Push to OpenShift internal registry
oc registry login
docker tag crm-frontend:latest $(oc registry info)/crm-dev/crm-frontend:latest
docker push $(oc registry info)/crm-dev/crm-frontend:latest
```

### CI/CD Pipeline

The Tekton pipeline automates build and deployment:

```bash
# Install pipeline tasks
oc apply -f deploy/tekton/tasks/

# Install pipeline
oc apply -f deploy/tekton/pipeline.yaml

# Install triggers (for webhook automation)
oc apply -f deploy/tekton/triggers/

# Run pipeline manually
oc create -f deploy/tekton/pipelineruns/manual-run.yaml

# Monitor pipeline run
tkn pipelinerun logs -f -n crm-dev
```

### Environment Configuration

| Environment | Namespace | Replicas | Resources |
|-------------|-----------|----------|-----------|
| Development | crm-dev | 1 | 256Mi-512Mi |
| Staging | crm-staging | 2 | 512Mi-1Gi |
| Production | crm-prod | 3+ (HPA) | 1Gi-2Gi |

### Secrets Management

Before deployment, update the secrets:

```bash
# Create secrets from literals
oc create secret generic crm-secrets \
  --from-literal=DATABASE_URL="postgresql://user:pass@host:5432/db" \
  --from-literal=REDIS_URL="redis://host:6379" \
  --from-literal=JWT_SECRET="your-secret" \
  -n crm-dev

# Or edit the secrets file
oc apply -f deploy/openshift/base/secrets.yaml
```

### Rolling Updates and Rollback

```bash
# Trigger a rolling update
oc set image deployment/crm-backend backend=image:new-tag -n crm-dev

# Monitor rollout
oc rollout status deployment/crm-backend -n crm-dev

# Rollback to previous version
oc rollout undo deployment/crm-backend -n crm-dev

# Rollback to specific revision
oc rollout undo deployment/crm-backend --to-revision=2 -n crm-dev
```

### Monitoring and Logging

```bash
# View pod logs
oc logs -f deployment/crm-backend -n crm-dev

# View all pods in namespace
oc get pods -n crm-dev -w

# Port-forward for local testing
oc port-forward svc/crm-backend 3001:3001 -n crm-dev

# Check resource usage
oc adm top pods -n crm-dev
```

### Verification Steps

1. Check pod status:
   ```bash
   oc get pods -n crm-dev
   ```

2. Test frontend route:
   ```bash
   curl https://dev.crm.apps.cluster-domain.com/
   ```

3. Test backend health:
   ```bash
   curl https://api.dev.crm.apps.cluster-domain.com/health
   ```

4. Test API endpoint:
   ```bash
   curl https://api.dev.crm.apps.cluster-domain.com/api/v1/companies
   ```

### Troubleshooting

```bash
# View pod events
oc describe pod <pod-name> -n crm-dev

# View deployment events
oc describe deployment crm-backend -n crm-dev

# Check PostgreSQL connection
oc exec -it deployment/crm-backend -n crm-dev -- nc -zv crm-postgresql 5432

# Check Redis connection
oc exec -it deployment/crm-backend -n crm-dev -- nc -zv crm-redis 6379
```

---

## 3D & Animations

The frontend includes React Three Fiber and GSAP for advanced visualizations:

```tsx
// Example: 3D Scene with React Three Fiber
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

function Scene() {
  return (
    <Canvas>
      <ambientLight intensity={0.5} />
      <mesh>
        <boxGeometry />
        <meshStandardMaterial color="hotpink" />
      </mesh>
      <OrbitControls />
    </Canvas>
  );
}
```

```tsx
// Example: GSAP Animation
import gsap from "gsap";
import { useEffect, useRef } from "react";

function AnimatedComponent() {
  const ref = useRef(null);
  
  useEffect(() => {
    gsap.from(ref.current, {
      opacity: 0,
      y: 50,
      duration: 1,
      ease: "power3.out"
    });
  }, []);
  
  return <div ref={ref}>Animated content</div>;
}
```

## License

MIT
