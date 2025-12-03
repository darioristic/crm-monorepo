# Troubleshooting Guide

Vodič za rešavanje čestih problema u CRM projektu.

## Development Setup

### Problem: Docker servisi ne startuju

**Rešenje:**
```bash
# Proveri da li je Docker Desktop pokrenut
# Na macOS:
open -a Docker

# Proveri status kontejnera
docker ps -a

# Restartuj servise
bun run db:down
bun run db:up
```

### Problem: Port već zauzet

**Rešenje:**
```bash
# Oslobodi portove
bun run kill-ports

# Ili ručno:
lsof -ti :3000 | xargs kill -9
lsof -ti :3001 | xargs kill -9
```

### Problem: Database connection error

**Rešenje:**
1. Proveri da li PostgreSQL radi: `docker ps | grep postgres`
2. Proveri `DATABASE_URL` u `.env` fajlu
3. Testiraj konekciju:
```bash
psql $DATABASE_URL -c "SELECT 1"
```

### Problem: Redis connection error

**Rešenje:**
1. Proveri da li Redis radi: `docker ps | grep redis`
2. Proveri `REDIS_URL` u `.env` fajlu
3. Testiraj konekciju:
```bash
redis-cli -u $REDIS_URL ping
```

## Database Issues

### Problem: Migration ne radi

**Rešenje:**
```bash
cd apps/api-server
bun run db:push  # Koristi Drizzle push umesto migracija
```

### Problem: Schema se ne ažurira

**Rešenje:**
```bash
# Rekreiraj schema
cd apps/api-server
bun run src/db/schema.ts
```

## API Issues

### Problem: CORS errors

**Rešenje:**
1. Proveri `CORS_ORIGINS` u `.env` fajlu
2. Dodaj frontend URL u CORS origins
3. Restartuj API server

### Problem: 401 Unauthorized

**Rešenje:**
1. Proveri da li su cookies dozvoljeni u browser-u
2. Proveri da li je JWT_SECRET postavljen
3. Pokušaj ponovo da se prijaviš

### Problem: Rate limit errors

**Rešenje:**
- Rate limit je postavljen na 100 zahteva po 15 minuta
- Sačekaj ili koristi API key za veće limite

## Frontend Issues

### Problem: Build errors

**Rešenje:**
```bash
# Očisti cache
rm -rf apps/web/.next
rm -rf node_modules apps/*/node_modules

# Reinstaliraj zavisnosti
bun install

# Pokušaj ponovo build
bun run build:web
```

### Problem: Type errors

**Rešenje:**
```bash
# Proveri TypeScript greške
bun run typecheck

# Ako su greške u shared types, rebuild workspace packages
cd packages/types && bun run build
```

### Problem: Styles se ne učitavaju

**Rešenje:**
1. Proveri da li Tailwind CSS konfiguracija postoji
2. Restartuj dev server
3. Proveri `globals.css` import u layout-u

## Performance Issues

### Problem: Spor API response

**Rešenje:**
1. Proveri Redis cache status
2. Optimizuj database queries
3. Proveri database indekse

### Problem: Veliki bundle size

**Rešenje:**
```bash
# Analiziraj bundle
cd apps/web
ANALYZE=true bun run build
```

## Email Issues

### Problem: Email-i se ne šalju

**Rešenje:**
1. Proveri da li su email workers pokrenuti
2. Proveri Redis queue status
3. Proveri email service konfiguraciju

## Sentry Issues

### Problem: Sentry se ne inicijalizuje

**Rešenje:**
1. Proveri `SENTRY_DSN` environment variable
2. Proveri da li je u production modu
3. Proveri console za warning poruke

## Common Solutions

### Reset Database

```bash
cd apps/api-server
bun run db:reset
bun run db:seed
```

### Clean Build

```bash
# Očisti sve
bun run clean
rm -rf apps/web/.next apps/api-server/dist

# Reinstaliraj i rebuild
bun install
bun run build
```

### Reset Environment

```bash
# Kopiraj .env.example ako postoji
cp .env.example .env

# Postavi sve potrebne environment variables
# Restartuj servise
```

