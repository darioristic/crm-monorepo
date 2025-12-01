# CRM Setup Guide - Development Environment

Vodič za podešavanje development okruženja za CRM projekat.

## 📋 Preduslovi

Pre nego što počnete, potrebno je da imate sledeće instalirano:

### Obavezno

- **Bun** >= 1.1.0 ([instalacija](https://bun.sh))
- **Node.js** >= 20.0.0 (za kompatibilnost alata)
- **PostgreSQL** >= 16.0
- **Redis** >= 7.0
- **Git** >= 2.40.0

### Opciono

- **Docker** + **Docker Compose** (za lakše podešavanje DB/Redis)
- **VS Code** + preporučeni extensions
- **Postman** ili **Insomnia** (za testiranje API-ja)

## 🚀 Quick Start (sa Dockerom)

Najbrži način da pokrenete projekat:

```bash
# 1. Clone repository
git clone <repo-url> crm-monorepo
cd crm-monorepo

# 2. Install dependencies
bun install

# 3. Start services (PostgreSQL + Redis)
docker-compose up -d

# 4. Setup environment
cp apps/api-server/.env.example apps/api-server/.env
cp apps/web/.env.example apps/web/.env

# 5. Setup database
cd apps/api-server
bun run db:push
bun run db:seed

# 6. Start development servers
cd ../..
bun run dev
```

Aplikacija će biti dostupna na:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **API Docs**: http://localhost:4000/api/v1

## 📦 Detaljna Instalacija

### 1. Instalacija Bun

**MacOS / Linux**:
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows**:
```bash
powershell -c "irm bun.sh/install.ps1 | iex"
```

Verifikuj instalaciju:
```bash
bun --version
# Očekivano: 1.1.0 ili novije
```

### 2. Instalacija PostgreSQL

#### Opcija A: Lokalna instalacija

**MacOS (Homebrew)**:
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install postgresql-16
sudo systemctl start postgresql
```

**Windows**:
Preuzmi installer sa: https://www.postgresql.org/download/windows/

#### Opcija B: Docker (preporučeno)

```bash
docker run -d \
  --name crm-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=crm_dev \
  -p 5432:5432 \
  postgres:16-alpine
```

### 3. Instalacija Redis

#### Opcija A: Lokalna instalacija

**MacOS (Homebrew)**:
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian**:
```bash
sudo apt install redis-server
sudo systemctl start redis
```

#### Opcija B: Docker (preporučeno)

```bash
docker run -d \
  --name crm-redis \
  -p 6379:6379 \
  redis:7-alpine
```

### 4. Docker Compose (sve odjednom)

Najlakši način - koristite `docker-compose.yml` u root folderu:

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: crm_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  postgres_data:
  redis_data:
```

Pokrenite servise:
```bash
docker-compose up -d
```

Zaustavite servise:
```bash
docker-compose down
```

Očistite sve podatke:
```bash
docker-compose down -v
```

## ⚙️ Environment Configuration

### Backend API Server

Kreiraj `apps/api-server/.env` fajl:

```env
# Server Configuration
NODE_ENV=development
PORT=4000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crm_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Session
SESSION_SECRET=your-session-secret-key-change-this-too

# CORS
CORS_ORIGINS=http://localhost:3000
CORS_CREDENTIALS=true
CORS_MAX_AGE=86400

# Email (Optional - za development možete ostaviti prazno)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@crm.example.com

# Rate Limiting
RATE_LIMIT_WINDOW=900
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=debug

# API Keys
API_KEY_SECRET=your-api-key-secret
```

### Frontend Web App

Kreiraj `apps/web/.env.local` fajl:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_API_TIMEOUT=30000

# App Configuration
NEXT_PUBLIC_APP_NAME=CRM System
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Feature Flags (Optional)
NEXT_PUBLIC_FEATURE_ANALYTICS=false
NEXT_PUBLIC_FEATURE_CHAT=false
```

### Security Best Practices

⚠️ **VAŽNO**:
- Nikada ne commitujte `.env` fajlove u git
- Koristite jake secret keys u production
- Generiši random keys:
  ```bash
  # Generate secure random key
  openssl rand -base64 32
  ```

## 🗄️ Database Setup

### 1. Kreiraj Database

```bash
# Ako koristite lokalni PostgreSQL
createdb crm_dev

# Ili preko psql
psql -U postgres
CREATE DATABASE crm_dev;
\q
```

### 2. Generate Schema

```bash
cd apps/api-server
bun run db:generate
```

### 3. Push Schema to Database

```bash
bun run db:push
```

### 4. Seed Database (Initial Data)

```bash
bun run db:seed
```

Ovo će kreirati:
- Test admin user: `admin@crm.com` / `Admin123!`
- Test regular user: `user@crm.com` / `User123!`
- Sample companies
- Sample contacts
- Sample products

### 5. Database Studio (GUI)

```bash
bun run db:studio
```

Otvoriće se Drizzle Studio na: http://localhost:3000

### Database Commands

```bash
# Generate migrations
bun run db:generate

# Push schema (no migrations)
bun run db:push

# Run migrations
bun run db:migrate

# Pull schema from DB
bun run db:pull

# Open database studio
bun run db:studio

# Seed database
bun run db:seed

# Clear all data
bun run db:unseed

# Reset database (drop + recreate + seed)
bun run db:setup
```

## 🏃 Running the Application

### Development Mode

#### Start Everything

```bash
# Root directory - start all services
bun run dev
```

Ovo će pokrenuti:
- Backend API na `http://localhost:4000`
- Frontend na `http://localhost:3000`

#### Start Individually

Backend only:
```bash
cd apps/api-server
bun run dev
```

Frontend only:
```bash
cd apps/web
bun run dev
```

### Production Build

```bash
# Build everything
bun run build

# Start production servers
bun run start
```

### Available Scripts

Root level (`package.json`):
```bash
bun run dev          # Start all dev servers
bun run build        # Build all apps
bun run test         # Run all tests
bun run test:coverage # Test with coverage
bun run lint         # Lint all code
bun run format       # Format all code
bun run typecheck    # Type check all code
```

Backend (`apps/api-server/package.json`):
```bash
bun run dev          # Start dev server (hot reload)
bun run start        # Start production server
bun run build        # Build for production
bun run test         # Run tests
bun run test:watch   # Run tests in watch mode
bun run test:ui      # Run tests with UI
bun run test:coverage # Coverage report
bun run lint         # Lint code
bun run format       # Format code
bun run typecheck    # Type check
bun run db:*         # Database commands
```

Frontend (`apps/web/package.json`):
```bash
bun run dev          # Start dev server
bun run build        # Build for production
bun run start        # Start production server
bun run lint         # Lint code
bun run test         # Run tests
```

## 🧪 Testing Setup

### Run Tests

```bash
# All tests
bun test

# Specific package
bun test:api
bun test:web
bun test:utils

# Watch mode
cd apps/api-server
bun run test:watch

# With coverage
bun run test:coverage

# With UI
bun run test:ui
```

### Test Data

Test database se automatski seeduje sa:
- 2 test users (admin + user)
- 5 companies
- 10 contacts
- 5 products
- Sample deals, quotes, invoices

Login credentials:
- Admin: `admin@crm.com` / `Admin123!`
- User: `user@crm.com` / `User123!`

## 🔧 IDE Setup (VS Code)

### Preporučeni Extensions

Instaliraj sledeće extensions:

```json
{
  "recommendations": [
    "biomejs.biome",              // Linting + Formatting
    "bradlc.vscode-tailwindcss",  // Tailwind IntelliSense
    "dbaeumer.vscode-eslint",     // ESLint
    "esbenp.prettier-vscode",     // Prettier
    "orta.vscode-jest",           // Test runner
    "ms-vscode.vscode-typescript-next",
    "usernamehw.errorlens",       // Error highlighting
    "gruntfuggly.todo-tree",      // TODO comments
    "streetsidesoftware.code-spell-checker"
  ]
}
```

### VS Code Settings

Kreiraj `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

### Debugging Configuration

Kreiraj `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API Server",
      "runtimeExecutable": "bun",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/apps/api-server",
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "bun",
      "runtimeArgs": ["test"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal"
    }
  ]
}
```

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -ti:4000 | xargs kill -9  # Backend
lsof -ti:3000 | xargs kill -9  # Frontend
```

### Database Connection Error

```bash
# Check if PostgreSQL is running
pg_isready

# Check connection
psql -U postgres -d crm_dev -c "SELECT 1"

# Restart PostgreSQL
brew services restart postgresql@16  # MacOS
sudo systemctl restart postgresql    # Linux
```

### Redis Connection Error

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Restart Redis
brew services restart redis  # MacOS
sudo systemctl restart redis # Linux
```

### Bun Cache Issues

```bash
# Clear Bun cache
rm -rf node_modules
rm -rf .bun
bun install
```

### Database Migration Issues

```bash
# Drop and recreate database
dropdb crm_dev
createdb crm_dev
cd apps/api-server
bun run db:push
bun run db:seed
```

### Module Not Found Errors

```bash
# Reinstall dependencies
rm -rf node_modules
rm bun.lockb
bun install
```

## 📚 Additional Resources

- [Bun Documentation](https://bun.sh/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Next.js 16 Docs](https://nextjs.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Vitest Docs](https://vitest.dev/)

## 🆘 Getting Help

Ako imate problema:

1. Proverite [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Pogledajte postojeće [GitHub Issues](link-to-issues)
3. Kreirajte novi issue sa detaljima:
   - OS i verzija
   - Bun verzija
   - Error message
   - Koraci za reprodukciju

## ✅ Verification Checklist

Nakon setup-a, verifikujte da sve radi:

- [ ] `bun --version` pokazuje verziju >= 1.1.0
- [ ] PostgreSQL radi: `pg_isready` vraća "accepting connections"
- [ ] Redis radi: `redis-cli ping` vraća "PONG"
- [ ] Backend startuje: `cd apps/api-server && bun run dev`
- [ ] Frontend startuje: `cd apps/web && bun run dev`
- [ ] Testovi prolaze: `bun test`
- [ ] Login radi na http://localhost:3000
- [ ] API health check: http://localhost:4000/health

Ako sve ✅ prođu, spremni ste za development! 🎉

---

**Last Updated**: 2025-12-01
