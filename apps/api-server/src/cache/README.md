# Cache Management System

Kompletan sistem za upravljanje cache-om sa warming i invalidation funkcionalnostima.

## Struktura

```
cache/
├── redis.ts                  # Core Redis cache service
├── cache-manager.ts          # Enhanced cache utilities
├── cache-warmer.ts           # Cache warming system
├── cache-invalidator.ts      # Cache invalidation system
├── warming-tasks.ts          # Warming task registration
├── index.ts                  # Exported API
└── README.md                 # This file
```

## Osnovne Funkcionalnosti

### 1. Cache Service (redis.ts)

Osnovni Redis cache servis sa:
- Get/Set operacijama
- Pattern-based invalidation
- Stale-while-revalidate pattern
- Session management
- Rate limiting
- Distributed locks
- Pub/Sub

### 2. Cache Warming (cache-warmer.ts)

Sistem za preučitavanje (warming) cache-a.

**Features:**
- Startup warming - učitavanje pri pokretanju servera
- Background warming - periodično osvežavanje
- Priority-based warming - najvažniji podaci prvi
- Metrics tracking

### 3. Cache Invalidation (cache-invalidator.ts)

Event-driven sistem za invalidaciju cache-a.

**Features:**
- Automatska invalidacija na izmene
- Cascade invalidation (invalidacija povezanih entiteta)
- Pattern-based bulk invalidation
- Invalidation history/audit log
- Multi-instance koordinacija preko pub/sub

## Upotreba

### Osnovne Cache Operacije

```typescript
import { cache } from "./cache";

// Get
const company = await cache.get<Company>(`companies:${id}`);

// Set
await cache.set(`companies:${id}`, company, 300);

// Delete
await cache.del(`companies:${id}`);

// Pattern invalidation
await cache.invalidatePattern("companies:list:*");
```

### Cache Warming

#### Registrovanje Warming Task-ova

```typescript
import { cacheWarmer } from "./cache";

// Registruj jedan task
cacheWarmer.register({
  key: "companies:list:page:1",
  fetcher: async () => {
    return await companyQueries.findAll({ page: 1, limit: 20 }, {});
  },
  ttl: 300, // 5 minutes
  priority: 9, // 1-10 (10 = highest)
  category: "companies"
});

// Registruj više task-ova odjednom
cacheWarmer.registerBatch([
  { key: "...", fetcher: ..., ttl: 300, priority: 8, category: "users" },
  { key: "...", fetcher: ..., ttl: 300, priority: 7, category: "projects" }
]);
```

#### Pokretanje Warming-a

```typescript
import { cacheWarmer } from "./cache";

// Startup warming (pokreće se automatski u index.ts)
const metrics = await cacheWarmer.warmAll({
  parallel: true,
  maxParallel: 5
});

// Background warming (automatski svaki N minuta)
cacheWarmer.startBackgroundWarming(30); // svakih 30 minuta

// Warming samo za određenu kategoriju
await cacheWarmer.warmCategory("companies", { parallel: true });

// Refresh cache koji uskoro ističe
await cacheWarmer.warmExpiringSoon(60); // ako TTL < 60s
```

#### Metrics

```typescript
const metrics = cacheWarmer.getMetrics();
console.log(metrics);
// {
//   totalTasks: 10,
//   successfulTasks: 9,
//   failedTasks: 1,
//   totalTime: 1234,
//   startedAt: Date,
//   completedAt: Date
// }

const tasksByCategory = cacheWarmer.getTasksByCategory();
// { companies: 5, users: 3, projects: 2 }
```

### Cache Invalidation

#### Event-Driven Invalidation (Preporučeno)

```typescript
import {
  invalidateOnCreate,
  invalidateOnUpdate,
  invalidateOnDelete
} from "./cache";

// U service metodi - CREATE
async createCompany(data: CreateCompanyRequest) {
  const company = await companyQueries.create(data);

  // Automatski invalidira sve povezane cache pattern-e
  await invalidateOnCreate("companies", company.id);

  return successResponse(company);
}

// U service metodi - UPDATE
async updateCompany(id: string, data: UpdateCompanyRequest) {
  const updated = await companyQueries.update(id, data);

  // Invalidira company cache + sve povezane entitete
  await invalidateOnUpdate("companies", id, updated);

  return successResponse(updated);
}

// U service metodi - DELETE
async deleteCompany(id: string) {
  await companyQueries.delete(id);

  // Cascade invalidation - briše i povezane entitete
  await invalidateOnDelete("companies", id);

  return successResponse({ id });
}
```

#### Batch Invalidation

```typescript
import { cacheInvalidator, InvalidationEvent } from "./cache";

// Invalidiraj više entiteta odjednom
await cacheInvalidator.invalidateBatch(
  InvalidationEvent.ENTITY_UPDATED,
  "companies",
  ["id1", "id2", "id3"]
);
```

#### Custom Invalidation Rules

```typescript
import { cacheInvalidator } from "./cache";

// Registruj custom invalidation rule
cacheInvalidator.registerRule("custom_entity", {
  patterns: [
    "custom_entity:*",
    "custom_entity:list:*"
  ],
  relatedEntities: ["other_entity"],
  customHandler: async (entityId, data) => {
    // Custom invalidation logic
    await cache.del(`special:${entityId}`);
  }
});
```

#### Invalidation History & Stats

```typescript
import { cacheInvalidator } from "./cache";

// Pregledaj history
const history = cacheInvalidator.getHistory(10); // last 10
console.log(history);
// [
//   {
//     timestamp: Date,
//     event: "entity:updated",
//     entityType: "companies",
//     entityId: "123",
//     patternsInvalidated: ["companies:*", "companies:list:*"],
//     keysInvalidated: 45
//   },
//   ...
// ]

// Statistika
const stats = cacheInvalidator.getStats();
console.log(stats);
// {
//   totalInvalidations: 100,
//   byEvent: { "entity:created": 30, "entity:updated": 50, ... },
//   byEntity: { "companies": 40, "users": 30, ... },
//   recentInvalidations: 15 // last hour
// }
```

### Stale-While-Revalidate Pattern

Vraća stale podatke odmah ako fresh nisu dostupni, refresh-uje u background-u:

```typescript
import { cache } from "./cache";

const data = await cache.getWithStale(
  "companies:list:page:1",
  async () => {
    // Fetcher function - poziva se samo ako nema cached data
    return await companyQueries.findAll(...);
  },
  300,  // Fresh TTL - 5 minutes
  600   // Stale TTL - 10 minutes
);
```

**How it works:**
1. Prvo pokušava da dobije fresh data (TTL = 300s)
2. Ako fresh nema, vraća stale data (TTL = 600s) odmah
3. U background-u refresh-uje data (fire-and-forget)
4. Ako nema ni stale, fetch-uje direktno

### Rate Limiting

```typescript
import { cache } from "./cache";

// Check rate limit
const { allowed, remaining, resetIn } = await cache.checkRateLimit(
  "user:123:api",
  100,  // limit
  60    // window in seconds
);

if (!allowed) {
  return errorResponse("RATE_LIMIT_EXCEEDED", `Try again in ${resetIn}s`);
}

// Get rate limit info
const info = await cache.getRateLimitInfo("user:123:api", 100);
console.log(info);
// { count: 45, remaining: 55, resetIn: 42 }
```

### Distributed Locks

Sprečava race conditions u multi-instance okruženju:

```typescript
import { cache } from "./cache";

const lockValue = await cache.acquireLock("process:invoice:123", 30);

if (lockValue) {
  try {
    // Critical section - samo jedan proces može da izvršava
    await processInvoice(123);
  } finally {
    await cache.releaseLock("process:invoice:123", lockValue);
  }
} else {
  console.log("Lock already held by another process");
}
```

## Integracija u Services

### Primer: Companies Service sa Event-Driven Invalidation

```typescript
import type { Company, CreateCompanyRequest, UpdateCompanyRequest } from "@crm/types";
import { companyQueries } from "../db/queries/companies";
import { cache, invalidateOnCreate, invalidateOnUpdate, invalidateOnDelete } from "../cache";
import { cacheManager } from "../cache";

const CACHE_TTL = 300;
const CACHE_PREFIX = "companies";

class CompaniesService {
  async getCompanyById(id: string): Promise<ApiResponse<Company>> {
    // Option 1: Manual cache handling
    const cacheKey = `${CACHE_PREFIX}:${id}`;
    const cached = await cache.get<Company>(cacheKey);
    if (cached) return successResponse(cached);

    const company = await companyQueries.findById(id);
    if (!company) return Errors.NotFound("Company").toResponse();

    await cache.set(cacheKey, company, CACHE_TTL);
    return successResponse(company);
  }

  async getCompanyByIdV2(id: string): Promise<ApiResponse<Company>> {
    // Option 2: Using cacheManager (cleaner)
    const company = await cacheManager.getOrSet(
      `${CACHE_PREFIX}:${id}`,
      () => companyQueries.findById(id),
      CACHE_TTL
    );

    if (!company) return Errors.NotFound("Company").toResponse();
    return successResponse(company);
  }

  async createCompany(data: CreateCompanyRequest): Promise<ApiResponse<Company>> {
    const company = await companyQueries.create(data);

    // Automatska invalidacija - briše companies:*, companies:list:*, itd.
    await invalidateOnCreate("companies", company.id);

    return successResponse(company);
  }

  async updateCompany(id: string, data: UpdateCompanyRequest): Promise<ApiResponse<Company>> {
    const updated = await companyQueries.update(id, data);

    // Invalidira company + sve list cache-ove + povezane entitete
    await invalidateOnUpdate("companies", id, updated);

    return successResponse(updated);
  }

  async deleteCompany(id: string): Promise<ApiResponse<void>> {
    await companyQueries.delete(id);

    // Cascade invalidation - briše i projects, contacts, deals povezane sa ovom company
    await invalidateOnDelete("companies", id);

    return successResponse(undefined);
  }
}
```

## Predefinisane Invalidation Rules

Sistem već ima definisane rules za sledeće entitete:

| Entity | Patterns | Related Entities |
|--------|----------|------------------|
| `companies` | `companies:*`, `companies:list:*`, `companies:industries` | projects, contacts, deals |
| `projects` | `projects:*`, `projects:list:*`, `projects:active`, `projects:stats` | tasks, milestones, companies |
| `tasks` | `tasks:*`, `tasks:list:*`, `projects:*:tasks` | projects |
| `milestones` | `milestones:*`, `milestones:list:*`, `projects:*:milestones` | projects |
| `users` | `users:*`, `users:list:*`, `users:active` | session, permissions |
| `deals` | `deals:*`, `deals:list:*`, `deals:open`, `deals:stats` | quotes, companies, contacts |
| `quotes` | `quotes:*`, `quotes:list:*` | deals, companies |
| `contacts` | `contacts:*`, `contacts:list:*` | companies, leads |
| `leads` | `leads:*`, `leads:list:*`, `leads:recent` | contacts |

## Advanced Patterns

### Conditional Warming

```typescript
// Warm samo ako cache ne postoji
cacheWarmer.register({
  key: "expensive:computation",
  fetcher: async () => {
    if (await cache.exists("expensive:computation")) {
      return null; // Skip warming
    }
    return await expensiveComputation();
  },
  ttl: 3600,
  priority: 10,
  category: "critical"
});
```

### Tagged Cache Invalidation

```typescript
import { cacheManager } from "./cache";

// Store with tags
await cacheManager.setWithTags(
  "user:123:profile",
  userProfile,
  ["users", "profiles", "user:123"],
  300
);

// Invalidate by tag (briše sve sa tim tag-om)
await cacheManager.invalidateByTag("user:123");
```

### Multi-Instance Coordination

Cache invalidator automatski koristi Redis pub/sub za koordinaciju između multiple server instance. Kada jedna instanca invalidira cache, sve ostale instance su obaveštene.

```typescript
// Automatski published na "cache:invalidation" channel
await invalidateOnUpdate("companies", id);

// Sve instance primaju event i invalidiraju svoj cache
```

## Performance Tips

1. **Koristi parallel warming** za startup:
   ```typescript
   await cacheWarmer.warmAll({ parallel: true, maxParallel: 10 });
   ```

2. **Koristi stale-while-revalidate** za često pristupane podatke:
   ```typescript
   const data = await cache.getWithStale(key, fetcher, 300, 600);
   ```

3. **Koristi priority** za warming task-ove:
   - 10: Critical (user auth, permissions)
   - 8-9: High (frequently accessed lists)
   - 5-7: Medium (reports, analytics)
   - 1-4: Low (rarely accessed data)

4. **Warm before expiry** umesto nakon:
   ```typescript
   // Pokreće se automatski u background-u
   await cacheWarmer.warmExpiringSoon(60); // refresh if TTL < 60s
   ```

5. **Batch invalidation** za bulk operacije:
   ```typescript
   await cacheInvalidator.invalidateBatch(event, entityType, ids);
   ```

## Monitoring

### Cache Stats

```typescript
import { cache } from "./cache";

const stats = await cache.getStats();
console.log(stats);
// {
//   connected: true,
//   memory: "15.2MB",
//   clients: 5,
//   keys: 1234
// }
```

### Warming Metrics

```typescript
const metrics = cacheWarmer.getMetrics();
// Logguj metrics za monitoring
logger.info({ metrics }, "Cache warming metrics");
```

### Invalidation Stats

```typescript
const stats = cacheInvalidator.getStats();
logger.info({ stats }, "Cache invalidation stats");
```

## Configuration

Sve se konfigurira preko environment varijabli:

```env
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret
```

## Best Practices

1. **Uvek koristi event-driven invalidation** umesto manual:
   ```typescript
   // ✅ Good
   await invalidateOnUpdate("companies", id);

   // ❌ Avoid
   await cache.invalidatePattern("companies:*");
   ```

2. **Registruj warming tasks** za sve često pristupane podatke

3. **Koristi TTL** prema frekvenciji izmena:
   - Static data: 3600s (1h) ili više
   - Frequently changing: 300s (5min)
   - Real-time data: 60s ili koristi pub/sub

4. **Monitor invalidation stats** za optimization

5. **Test warming performance** pre production deploy-a

## Troubleshooting

### Cache warming ne radi

- Proveri da li je `performStartupWarming()` pozvan u `index.ts`
- Proveri da li su tasks registrovani pre warming-a
- Pogledaj logs za errors

### Invalidation ne briše sve pattern-e

- Proveri da li su invalidation rules pravilno registrovane
- Koristi `cacheInvalidator.getHistory()` za debug
- Proveri da li redis SCAN radi (ne blokira KEYS)

### Background warming troši previše resursa

- Smanji `maxParallel` parametar
- Povećaj warming interval
- Smanji broj warming tasks-ova

## Migration Guide

Za migraciju postojećih services-a:

### Staro (manual invalidation):

```typescript
await cache.invalidatePattern(`${CACHE_PREFIX}:list:*`);
await cache.del(`${CACHE_PREFIX}:${id}`);
```

### Novo (event-driven):

```typescript
await invalidateOnUpdate("companies", id);
// Automatski invalidira sve pattern-e + related entities
```

---

**Made with ❤️ for CRM Monorepo**
