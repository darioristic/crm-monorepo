# E2E Tests with Playwright

End-to-end testovi koriste Playwright za testiranje kompletnog user flow-a kroz web aplikaciju.

## Setup

```bash
# Instaliraj Playwright i browsere
bun install
bunx playwright install
```

## Pokretanje testova

```bash
# Pokreni sve E2E testove
bun run test:e2e

# Pokreni testove sa UI
bun run test:e2e:ui

# Pokreni testove u debug modu
bun run test:e2e:debug

# Pokreni testove sa vidljivim browserom
bun run test:e2e:headed
```

## Struktura testova

- `auth.spec.ts` - Testovi autentifikacije (login, logout)
- `companies.spec.ts` - Testovi upravljanja kompanijama
- `invoices.spec.ts` - Testovi upravljanja fakturama

## Pre pokretanja testova

1. Uveri se da su API server i web server pokrenuti:
   ```bash
   bun run dev
   ```

2. Ili koristi `webServer` opciju u `playwright.config.ts` koja automatski pokreće servere

## Test credentials

Koristi se test korisnik:
- Email: `admin@crm.com`
- Password: `Admin123!`

## Best Practices

- Testovi treba da budu nezavisni - svaki test se izvršava iz početka
- Koristi `test.beforeEach` za setup koji je zajednički za sve testove
- Koristi `page.goto()` pre svakog testa za navigaciju
- Čekaj da se elementi pojave pre interakcije (`await expect(...).toBeVisible()`)

