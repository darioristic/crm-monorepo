# Testing Guide - CRM Monorepo

Ovaj dokument sadrži sve informacije o testiranju u CRM Monorepo projektu.

## 📋 Pregled

Projekat koristi **Vitest** za unit testove, **Playwright** za E2E testove i **Vitest** za integration testove.

### Test Infrastructure

- **Backend (API Server)**: Vitest + Node environment (unit tests)
- **Backend (API Server)**: Vitest + Real DB (integration tests)
- **Frontend (Web App)**: Vitest + React Testing Library + Happy DOM (unit tests)
- **Frontend (Web App)**: Playwright (E2E tests)
- **Packages (Utils)**: Vitest + Node environment

## 🚀 Pokretanje Testova

### Svi testovi odjednom

```bash
# Pokreni sve testove (unit + integration + E2E)
bun test:all

# Pokreni samo unit testove u svim paketima
bun test

# Pokreni testove sa coverage reportom
bun test:coverage
```

### Pojedinačni paketi

```bash
# Samo backend testovi
bun test:api

# Samo frontend testovi
bun test:web

# Samo utils paketi testovi
bun test:utils

# Integration testovi (API + DB)
bun test:integration

# E2E testovi (Playwright)
bun test:e2e
```

### Watch mode (za development)

```bash
# API Server - watch mode
cd apps/api-server
bun test:watch

# Web App - watch mode
cd apps/web
bun test:watch

# Utils - watch mode
cd packages/utils
bun test:watch
```

### Coverage Report

```bash
# Generiši coverage report
bun test:coverage

# Coverage report će biti generisan u:
# - apps/api-server/coverage/
# - apps/web/coverage/
# - packages/utils/coverage/
```

### Vitest UI (interaktivni mode)

```bash
# Pokreni Vitest UI za vizuelni pregled testova
cd apps/api-server
bun test:ui

# ili za web app
cd apps/web
bun test:ui
```

## 📁 Struktura Testova

### Backend (apps/api-server/)

```
apps/api-server/
├── src/
│   ├── __tests__/
│   │   ├── setup.ts                    # Test setup i globalne konfiguracije
│   │   ├── mocks/
│   │   │   ├── redis.mock.ts          # Redis mock
│   │   │   └── db.mock.ts             # Database mock
│   │   ├── services/
│   │   │   └── auth.service.test.ts   # Auth service testovi
│   │   ├── validators/
│   │   │   └── schemas.test.ts        # Validation schema testovi
│   │   ├── routes/                     # API endpoint testovi
│   │   ├── middleware/                 # Middleware testovi
│   │   └── integration/                # Integration testovi (API + DB)
│   │       ├── setup.ts               # Integration test setup
│   │       ├── helpers.ts             # Test helper funkcije
│   │       ├── auth.integration.test.ts
│   │       ├── companies.integration.test.ts
│   │       └── invoices.integration.test.ts
├── vitest.config.ts                    # Vitest konfiguracija (unit tests)
└── vitest.integration.config.ts        # Vitest konfiguracija (integration tests)
```

**Trenutno pokriveno:**
- ✅ Password hashing (bcrypt) - 9 testova
- ✅ Validation schemas (Zod) - 51 test
- ✅ JWT token management - 15 testova (+ 3 skip)
- ✅ Session management (Redis) - 18 testova
- ✅ Auth middleware - 37 testova
- ✅ Rate-limit middleware - 33 testova
- ✅ API endpoint integration (health) - 11 testova
- ✅ Mock infrastructure (Redis, DB)

**Integration Tests:**
- ✅ Auth API integration tests (login, logout, refresh, register)
- ✅ Companies API integration tests (CRUD operations)
- ✅ Invoices API integration tests (CRUD operations)

**TODO:**
- ⏳ CORS middleware tests
- ⏳ Service layer tests (sales, reports)
- ⏳ Additional API endpoint integration tests (users, documents, products)

### Frontend (apps/web/)

```
apps/web/
├── src/
│   ├── __tests__/
│   │   ├── setup.ts                          # Test setup + Next.js mocks
│   │   ├── hooks/
│   │   │   └── use-copy-to-clipboard.test.ts # Hook testovi
│   │   ├── components/                       # Component testovi
│   │   └── utils/                           # Utility testovi (TODO)
├── e2e/                                      # E2E testovi (Playwright)
│   ├── auth.spec.ts                         # Authentication flow
│   ├── companies.spec.ts                    # Companies management
│   └── invoices.spec.ts                     # Invoices management
├── vitest.config.ts                          # Vitest konfiguracija (unit tests)
└── playwright.config.ts                     # Playwright konfiguracija (E2E tests)
```

**Trenutno pokriveno:**
- ✅ useCopyToClipboard hook - 5 testova
- ✅ Next.js router mock
- ✅ Next.js Image mock
- ✅ E2E Authentication flow tests
- ✅ E2E Companies management tests
- ✅ E2E Invoices management tests

**TODO:**
- ⏳ UI Component testovi (Button, Input, Dialog, etc.)
- ⏳ Custom hooks testovi
- ⏳ Form validation testovi
- ⏳ API client testovi
- ⏳ Store (Zustand) testovi

### Packages (packages/utils/)

```
packages/utils/
├── src/
│   ├── index.ts
│   └── index.test.ts              # 63 comprehensive unit tests
├── vitest.config.ts
```

**Trenutno pokriveno:**
- ✅ UUID utilities (generateUUID, isValidUUID) - 4 testa
- ✅ Date & Time utilities - 8 testova
- ✅ API Response helpers - 6 testova
- ✅ Validation utilities - 10 testova
- ✅ String utilities - 8 testova
- ✅ Number & Currency utilities - 6 testova
- ✅ Object utilities - 3 testa
- ✅ Array utilities - 3 testa
- ✅ Error handling - 11 testova

**Status:** ✅ **Kompletno pokriveno (63 testa, 100% pass rate)**

## 📊 Test Coverage Status

| Paket | Testovi | Pass | Skip | Coverage |
|-------|---------|------|------|----------|
| `@crm/utils` | 63 | 63 | 0 | ✅ Excellent |
| `@crm/api-server` (unit tests) | 177 | 174 | 3 | ✅ Excellent |
| `@crm/api-server` (integration tests) | 15+ | 15+ | 0 | ✅ Good |
| `@crm/web` (unit tests) | 5 | 5 | 0 | ✅ Good |
| `@crm/web` (E2E tests) | 8+ | 8+ | 0 | ✅ Good |
| **UKUPNO** | **268+** | **265+** | **3** | **98.9% Pass** |

### Target Coverage Goals

- **Packages (utils)**: ✅ 70%+ (trenutno: ~95%)
- **Backend (api-server)**: ⏳ Target: 70% (trenutno: ~25% sa integration testovima)
- **Frontend (web)**: ⏳ Target: 60% (trenutno: ~10% sa E2E testovima)

## ✍️ Pisanje Testova

### Backend Service Test Primer

```typescript
// apps/api-server/src/__tests__/services/example.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { someService } from '../../services/example';

describe('Example Service', () => {
  beforeEach(() => {
    // Setup pre svakog testa
  });

  it('should do something correctly', () => {
    const result = someService();
    expect(result).toBeDefined();
  });
});
```

### Frontend Component Test Primer

```typescript
// apps/web/src/__tests__/components/button.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from '../../components/ui/button';

describe('Button Component', () => {
  it('should render button text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    await userEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Frontend Hook Test Primer

```typescript
// apps/web/src/__tests__/hooks/use-example.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useExample } from '../../hooks/use-example';

describe('useExample', () => {
  it('should initialize with default value', () => {
    const { result } = renderHook(() => useExample());
    expect(result.current.value).toBe(0);
  });

  it('should update value', () => {
    const { result } = renderHook(() => useExample());

    act(() => {
      result.current.increment();
    });

    expect(result.current.value).toBe(1);
  });
});
```

## 🔧 Konfiguracija

### Vitest Config (apps/api-server/vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

### Vitest Config (apps/web/vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
```

## 📝 Best Practices

### 1. Naming Conventions

- Test fajlovi: `*.test.ts` ili `*.spec.ts`
- Test描述: Koristi jasne describe/it blokove
- Avoid: "it should work" ❌
- Prefer: "it should return user data when valid ID is provided" ✅

### 2. Test Organization

```typescript
describe('Feature Name', () => {
  describe('Subfeature', () => {
    it('should behave in specific way', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = function(input);

      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### 3. Mocking

```typescript
// Mock eksterni servis
vi.mock('../../services/external', () => ({
  fetchData: vi.fn(() => Promise.resolve({ data: 'mocked' })),
}));

// Mock environment variables
beforeEach(() => {
  process.env.API_URL = 'http://test.com';
});
```

### 4. Async Tests

```typescript
// Koristi async/await
it('should fetch data', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});

// Ili waitFor za React
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

## 🐛 Debugging Testova

### Console Output

```bash
# Detaljniji output
bun test -- --reporter=verbose

# Prikaži console.log u testovima
bun test -- --reporter=verbose --outputFile.json=false
```

### Debug u VS Code

Dodaj u `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run"],
  "console": "integratedTerminal"
}
```

## 🔄 CI/CD Integration

Testovi se automatski pokreću u GitHub Actions pipeline-u:

```yaml
# .github/workflows/ci.yml
- name: Run Tests
  run: bun test

- name: Upload Coverage
  run: bun test:coverage
```

## 📚 Dodatni Resursi

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## 🎯 Sledeći Koraci (Roadmap)

### Prioritet 1 - Kritično
- [x] Auth service - JWT i session testovi ✅
- [x] API endpoint integration testovi ✅
- [x] Middleware testovi (auth, rate-limit) ✅
- [x] E2E testovi (Playwright) ✅
- [ ] CORS middleware tests
- [ ] Additional integration tests (users, documents, products)

### Prioritet 2 - Važno
- [ ] Sales service testovi
- [ ] UI Component library testovi (Button, Input, Dialog)
- [ ] Form validation testovi
- [ ] More E2E test scenarios

### Prioritet 3 - Nice to have
- [ ] Performance testovi
- [ ] Visual regression testovi
- [ ] Load testing

## 🎭 E2E Testovi (Playwright)

E2E testovi koriste Playwright za testiranje kompletnog user flow-a kroz web aplikaciju.

### Setup

```bash
# Instaliraj Playwright i browsere
cd apps/web
bun install
bunx playwright install
```

### Pokretanje E2E testova

```bash
# Pokreni sve E2E testove
bun test:e2e

# Pokreni testove sa UI
bun test:e2e:ui

# Pokreni testove u debug modu
bun test:e2e:debug

# Pokreni testove sa vidljivim browserom
bun test:e2e:headed
```

### E2E Test Coverage

- ✅ Authentication flow (login, logout)
- ✅ Companies management (create, edit, list)
- ✅ Invoices management (create, view, list)

Više informacija: [E2E Tests README](../../apps/web/e2e/README.md)

## 🔗 Integration Testovi

Integration testovi testiraju API rute sa realnom bazom podataka i Redis cache-om.

### Setup

```bash
# Uveri se da su PostgreSQL i Redis pokrenuti
docker-compose up -d

# Postavi environment varijable
export TEST_DATABASE_URL="postgresql://crm_user:crm_password@localhost:5432/crm_test"
export TEST_REDIS_URL="redis://localhost:6379/2"
export API_URL="http://localhost:3001"
```

### Pokretanje Integration testova

```bash
# Pokreni sve integration testove
bun test:integration

# Pokreni u watch modu
bun test:integration:watch
```

### Integration Test Coverage

- ✅ Auth API (register, login, logout, refresh)
- ✅ Companies API (CRUD operations)
- ✅ Invoices API (CRUD operations, overdue invoices)

Više informacija: [Integration Tests README](../../apps/api-server/src/__tests__/integration/README.md)

---

**Poslednje ažuriranje:** 2025-01-XX
**Ukupno testova:** 268+ (265+ pass + 3 skip)
**Test success rate:** 98.9% (100% pass rate za pokrenute testove)
**Test execution:** Unit tests ~5s, Integration tests ~30s, E2E tests ~60s
