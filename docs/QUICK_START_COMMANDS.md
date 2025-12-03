# 🚀 Quick Start Commands Guide

## Važno: Izvršavanje Komandi

Sve komande treba izvršavati iz **root direktorijuma projekta** (`crm-monorepo/`), ne iz `apps/` poddirektorijuma.

---

## 📍 Database Migracije

### Opcija 1: Iz root direktorijuma (Preporučeno)
```bash
# Iz crm-monorepo/ direktorijuma:
bun run migrate              # Pokreni migracije
bun run migrate:status       # Proveri status migracija
bun run seed:customers       # Seed customer podatke
```

### Opcija 2: Direktno u api-server
```bash
cd apps/api-server
bun run db:migrate           # Ili: bun run migrate
bun run db:seed-customers
```

### Svi Database Komande
```bash
# Iz root:
bun run migrate              # Pokreni migracije
bun run migrate:status       # Status migracija

# Iz apps/api-server:
bun run db:generate          # Generiši nove migracije
bun run db:migrate           # Pokreni migracije
bun run db:push              # Push schema direktno (development)
bun run db:seed              # Seed osnovne podatke
bun run db:seed-companies    # Seed companies
bun run db:seed-customers    # Seed customers
bun run db:setup             # Push + seed
bun run db:studio            # Otvori Drizzle Studio (GUI)
```

---

## 🧪 Testiranje

### Unit Testovi
```bash
# Iz root direktorijuma:
bun run test                 # Svi testovi
bun run test:api            # Samo API testovi
bun run test:web            # Samo web testovi
bun run test:coverage       # Sa coverage reportom
```

### E2E Testovi (Playwright)

**Prvo: Instaliraj Playwright**
```bash
cd apps/web
bun add -d @playwright/test
bunx playwright install
```

**Zatim: Pokreni E2E testove**
```bash
# Iz root:
bun run test:e2e            # Pokreni E2E testove

# Ili direktno iz apps/web:
cd apps/web
bun run test:e2e            # Pokreni testove
bun run test:e2e:ui         # Pokreni sa UI
bun run test:e2e:debug      # Debug mode
bun run test:e2e:headed     # Sa browser-om (headed mode)
```

---

## 🔧 Development

### Pokretanje Development Servera
```bash
# Iz root (preporučeno):
bun run dev:start           # Automatski pokreće sve
# ili:
bun run dev                 # Pokreni sve u paraleli
bun run dev:api             # Samo API server
bun run dev:web             # Samo web server
```

### Build
```bash
# Iz root:
bun run build               # Build sve
bun run build:api           # Build samo API
bun run build:web           # Build samo web
```

---

## 📦 Database Servisi

### Docker Services
```bash
# Iz root:
bun run db:up               # Pokreni PostgreSQL i Redis
bun run db:down             # Zaustavi servise
```

### Alternativno: docker-compose
```bash
docker-compose up -d        # Pokreni servise
docker-compose down         # Zaustavi servise
docker-compose logs -f      # Prati logove
```

---

## 🧹 Code Quality

```bash
# Iz root:
bun run lint                # Lint check
bun run lint:fix            # Auto-fix linting issues
bun run format              # Formatiraj kod
bun run check               # Biome check (lint + format)
bun run check:fix           # Auto-fix sve
bun run typecheck           # TypeScript type checking
```

---

## 🐛 Troubleshooting

### Problem: "cd: no such file or directory: apps/api-server"
**Rešenje**: Već si u root direktorijumu, ne treba `cd`. Koristi workspace komande:
```bash
# ❌ NE:
cd apps/api-server && bun run migrate

# ✅ DA:
bun run migrate
```

### Problem: "Script not found: db:seed-customers"
**Rešenje**: Koristi workspace komandu iz root-a:
```bash
# ❌ NE:
cd apps/api-server && bun run db:seed-customers

# ✅ DA:
bun run seed:customers
```

### Problem: "Script not found: test:e2e"
**Rešenje**: Prvo instaliraj Playwright:
```bash
cd apps/web
bun add -d @playwright/test
bunx playwright install
```

---

## 📝 Korisne Workspace Komande

Sve ove komande rade iz root direktorijuma koristeći Bun workspaces:

```bash
# Testovi
bun run test                # Svi testovi
bun run test:api           # API testovi
bun run test:web           # Web testovi
bun run test:e2e           # E2E testovi
bun run test:integration   # Integration testovi

# Database
bun run migrate            # Migracije
bun run migrate:status     # Status
bun run seed:customers     # Seed customers

# Development
bun run dev                # Svi servisi
bun run dev:api            # Samo API
bun run dev:web            # Samo Web

# Build
bun run build              # Sve
bun run build:api          # API
bun run build:web          # Web

# Code Quality
bun run lint
bun run format
bun run typecheck
```

---

## 🎯 Tipičan Development Flow

1. **Pokreni servise**:
   ```bash
   bun run db:up
   ```

2. **Setup database** (prvi put):
   ```bash
   bun run migrate
   bun run seed:customers
   ```

3. **Pokreni development servere**:
   ```bash
   bun run dev:start
   ```

4. **U drugom terminalu, pokreni testove**:
   ```bash
   bun run test:watch       # Watch mode za unit testove
   ```

---

*Poslednja ažuriranja: Decembar 2024*

