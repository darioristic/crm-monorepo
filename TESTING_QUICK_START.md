# 🧪 Quick Start - Testiranje

## Pokretanje testova

### Sve testove odjednom
```bash
bun run test:all
```

### Pojedinačno

**Unit testovi:**
```bash
bun run test              # Svi unit testovi
bun run test:api          # Samo API server
bun run test:web          # Samo web app
bun run test:utils        # Samo utils paket
```

**Integration testovi:**
```bash
# Pre pokretanja: uveri se da su DB i Redis pokrenuti
docker-compose up -d

bun run test:integration
```

**E2E testovi:**
```bash
# Pre pokretanja: instaliraj Playwright browsere (samo prvi put)
cd apps/web
bunx playwright install

# Pokreni E2E testove
cd ../..
bun run test:e2e
```

## Prvi put setup

### 1. Instaliraj zavisnosti
```bash
bun install
```

### 2. Setup E2E testova (samo jednom)
```bash
cd apps/web
bunx playwright install
cd ../..
```

### 3. Pokreni servise za integration testove
```bash
docker-compose up -d
```

## Troubleshooting

### `test:all` ne radi
Koristi `bun run test:all` (ne samo `test:all`)

### Integration testovi padaju
- Proveri da li su PostgreSQL i Redis pokrenuti: `docker-compose ps`
- Proveri environment varijable u `apps/api-server/src/__tests__/integration/setup.ts`

### E2E testovi padaju
- Proveri da li su web i API server pokrenuti
- Playwright config automatski pokreće servere, ali možda treba ručno:
  ```bash
  bun run dev
  ```

## Više informacija

- [Detaljna dokumentacija](./docs/TESTING.md)
- [E2E testovi README](./apps/web/e2e/README.md)
- [Integration testovi README](./apps/api-server/src/__tests__/integration/README.md)

