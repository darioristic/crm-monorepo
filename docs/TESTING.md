# Testing Guide - CRM Monorepo

Ovaj dokument sadrži sve informacije o testiranju u CRM Monorepo projektu.

## 📋 Pregled

Projekat koristi **Vitest** kao test framework za sve pakete i aplikacije.

### Test Infrastructure

- **Backend (API Server)**: Vitest + Node environment
- **Frontend (Web App)**: Vitest + React Testing Library + Happy DOM
- **Packages (Utils)**: Vitest + Node environment

## 🚀 Pokretanje Testova

### Svi testovi odjednom

```bash
# Pokreni sve testove u svim paketima
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
│   │   ├── routes/                     # API endpoint testovi (TODO)
│   │   └── middleware/                 # Middleware testovi (TODO)
├── vitest.config.ts                    # Vitest konfiguracija
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

**TODO:**
- ⏳ Auth API endpoint tests (login, logout, refresh)
- ⏳ CORS middleware tests
- ⏳ Service layer tests (sales, reports)
- ⏳ Additional API endpoint integration tests (users, companies, projects)

### Frontend (apps/web/)

```
apps/web/
├── src/
│   ├── __tests__/
│   │   ├── setup.ts                          # Test setup + Next.js mocks
│   │   ├── hooks/
│   │   │   └── use-copy-to-clipboard.test.ts # Hook testovi
│   │   ├── components/                       # Component testovi (TODO)
│   │   └── utils/                           # Utility testovi (TODO)
├── vitest.config.ts                          # Vitest konfiguracija
```

**Trenutno pokriveno:**
- ✅ useCopyToClipboard hook - 5 testova
- ✅ Next.js router mock
- ✅ Next.js Image mock

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
| `@crm/api-server` (auth service) | 9 | 9 | 0 | ✅ Good |
| `@crm/api-server` (validators) | 51 | 51 | 0 | ✅ Excellent |
| `@crm/api-server` (JWT) | 18 | 15 | 3 | ✅ Good |
| `@crm/api-server` (sessions) | 18 | 18 | 0 | ✅ Excellent |
| `@crm/api-server` (auth middleware) | 37 | 37 | 0 | ✅ Excellent |
| `@crm/api-server` (rate-limit middleware) | 33 | 33 | 0 | ✅ Excellent |
| `@crm/api-server` (health API) | 11 | 11 | 0 | ✅ Excellent |
| **UKUPNO** | **240** | **237** | **3** | **98.8% Pass** |

### Target Coverage Goals

- **Packages (utils)**: ✅ 70%+ (trenutno: ~95%)
- **Backend (api-server)**: ⏳ Target: 70% (trenutno: ~15%)
- **Frontend (web)**: ⏳ Target: 60% (trenutno: ~5%)

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
- [ ] Auth service - JWT i session testovi
- [ ] API endpoint integration testovi
- [ ] Middleware testovi (auth, rate-limit)

### Prioritet 2 - Važno
- [ ] Sales service testovi
- [ ] UI Component library testovi (Button, Input, Dialog)
- [ ] Form validation testovi

### Prioritet 3 - Nice to have
- [ ] E2E testovi (Playwright)
- [ ] Performance testovi
- [ ] Visual regression testovi

---

**Poslednje ažuriranje:** 2025-12-01
**Ukupno testova:** 240 (237 pass + 3 skip)
**Test success rate:** 98.8% (100% pass rate za pokrenute testove)
**Test execution:** 7 fajlova, 347 expect() poziva, ~5s
