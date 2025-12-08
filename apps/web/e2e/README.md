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

# Pokreni specifičan test fajl
bunx playwright test e2e/auth.spec.ts

# Pokreni specifičan test
bunx playwright test e2e/auth.spec.ts -g "should display login form"

# Pokreni testove u specifičnom browseru
bunx playwright test --project=chromium
bunx playwright test --project=firefox
bunx playwright test --project=webkit
```

## Struktura testova

### Kritični tokovi (Critical Flows)

- **`auth.spec.ts`** - Testovi autentifikacije
  - Login, logout, validacija kredencijala

- **`companies.spec.ts`** - Testovi upravljanja kompanijama
  - Kreiranje, izmena, pregled kompanija
  - Inline kreiranje klijenata u Quote/Invoice formama

- **`invoices.spec.ts`** - Testovi upravljanja fakturama
  - Kreiranje, pregled, upravljanje fakturama

- **`sales-pipeline.spec.ts`** - Testovi kompletnog sales flow-a
  - Quotes → Invoices flow
  - Kreiranje i pregled ponuda
  - Statusne promene
  - Javni linkovi za fakture

- **`documents.spec.ts`** - Testovi upravljanja dokumentima
  - Upload, download, pregled dokumenta
  - Deljenje, brisanje, pretraga
  - Filtriranje po tipu

- **`projects.spec.ts`** - Testovi upravljanja projektima i taskovima
  - Kreiranje projekata i taskova
  - Promena statusa, dodela korisnicima
  - Milestone management
  - Pretraga i filtriranje

- **`users.spec.ts`** - Testovi upravljanja korisnicima i permisijama
  - Prikaz korisnika, pozivnice
  - Promena uloga, deaktivacija
  - Team member management
  - Admin funkcionalnosti

- **`multi-tenant.spec.ts`** - Testovi multi-tenant izolacije
  - Izolacija podataka između tenanata
  - Prevencija neautorizovanog pristupa
  - Provera tenant konteksta

- **`products.spec.ts`** - Testovi upravljanja proizvodima
  - CRUD operacije za proizvode
  - Inventory management
  - Import/export funkcionalnosti
  - Pretraga, filtriranje, sortiranje

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

## Test Helpers

Zajedničke utility funkcije su dostupne u `helpers.ts`:

```typescript
import { login, logout, generateTestData, navigateTo } from './helpers';

// Login
await login(page);

// Logout
await logout(page);

// Generisanje test podataka
const testData = generateTestData('Company');

// Navigacija
await navigateTo(page, 'companies');

// Pretraga
await searchFor(page, 'search term');

// Potvrda dijaloga
await confirmDialog(page);
```

## Konfiguracija

Testovi su konfigurisani u `playwright.config.ts`:

- **Browseri**: Chromium, Firefox, WebKit
- **Base URL**: `http://localhost:3000`
- **API URL**: `http://localhost:3001`
- **Paralelno izvršavanje**: Enabled
- **Retries**: 2 (u CI), 0 (lokalno)
- **Screenshots**: Samo na failure
- **Video**: Sačuvano na failure

## Coverage threshold

- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

Konfigurisano u `vitest.config.ts`.

## Best Practices

- Testovi treba da budu nezavisni - svaki test se izvršava iz početka
- Koristi `test.beforeEach` za setup koji je zajednički za sve testove
- Koristi `page.goto()` pre svakog testa za navigaciju
- Čekaj da se elementi pojave pre interakcije (`await expect(...).toBeVisible()`)
- Koristi helper funkcije iz `helpers.ts` za česte operacije
- Koristi `data-testid` atribute za stabilne selektore
- Testovi treba da rade i u CI okruženju

## Debugging

```bash
# Prikaži test report
bunx playwright show-report

# Prikaži trace
bunx playwright show-trace trace.zip

# Debug mode
bunx playwright test --debug
```

## Continuous Integration

Testovi su dizajnirani za CI okruženje:

- Paralelno izvršavanje sa 1 workerom
- Automatski retry na failure (2 puta)
- GitHub reporter za anotacije
- Screenshot i video na failure

