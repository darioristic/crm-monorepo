# Integration Tests

Integration testovi testiraju API rute sa realnom bazom podataka i Redis cache-om.

## Setup

1. Uveri se da su PostgreSQL i Redis pokrenuti:
   ```bash
   docker-compose up -d
   ```

2. Kreiraj test bazu podataka (opciono):
   ```sql
   CREATE DATABASE crm_test;
   ```

3. Postavi environment varijable:
   ```bash
   export TEST_DATABASE_URL="postgresql://crm_user:crm_password@localhost:5432/crm_test"
   export TEST_REDIS_URL="redis://localhost:6379/2"
   export API_URL="http://localhost:3001"
   ```

## Pokretanje testova

```bash
# Pokreni sve integration testove
bun run test:integration

# Pokreni u watch modu
bun run test:integration:watch
```

## Struktura testova

- `auth.integration.test.ts` - Testovi autentifikacije API-ja
- `companies.integration.test.ts` - Testovi kompanija API-ja
- `invoices.integration.test.ts` - Testovi faktura API-ja

## Helper funkcije

`helpers.ts` sadrži korisne funkcije za:
- `createTestUser()` - Kreiranje test korisnika
- `createTestCompany()` - Kreiranje test kompanije
- `createTestSession()` - Kreiranje test sesije
- `getAuthHeaders()` - Dobijanje auth headers
- `cleanupUser()` / `cleanupCompany()` - Čišćenje test podataka

## Best Practices

- Svaki test treba da očisti podatke koje kreira
- Koristi `beforeAll` za setup koji se dešava jednom
- Koristi `beforeEach` za setup koji se dešava pre svakog testa
- Uvek cleanup-uj test podatke nakon testa

## Napomena

Integration testovi koriste realnu bazu podataka, tako da:
- Testovi mogu biti sporiji od unit testova
- Treba paziti da se ne koriste produkcijski podaci
- Testovi automatski čiste podatke pre i posle svakog testa

