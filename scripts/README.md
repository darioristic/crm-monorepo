# CRM Monorepo Scripts

Utility skripte za održavanje i unapređenje projekta.

## replace-console-logs.js

Automatski zamenjuje `console.log/error/warn` pozive sa strukturiranim loggerom.

### Upotreba

```bash
# Iz root direktorijuma:
node scripts/replace-console-logs.js
```

### Šta radi

1. Skenira sve `.ts`, `.tsx`, `.js`, `.jsx` fajlove u `apps/` i `packages/`
2. Pronalazi sve console.log/error/warn/debug pozive
3. Zamenjuje ih sa `logger.info/error/warn/debug`
4. Automatski dodaje logger import gde je potrebno
5. Generiše izveštaj o izmenama

### Isključuje

- `node_modules/`
- `dist/`, `.next/`, `build/`
- Test fajlove (`*.test.*`, `*.spec.*`, `__tests__`)

### Pre pokretanja

Proverite da imate logger konfigurisan:
- **API Server**: `apps/api-server/src/lib/logger.ts`
- **Web App**: `apps/web/src/lib/logger.ts`

### Nakon pokretanja

1. Pregledajte izmene: `git diff`
2. Podesite putanje za logger import gde je označeno `TODO`
3. Pokrenite testove: `bun run test`
4. Pokrenite lint: `bun run lint:fix`

### Primer rezultata

```
🔍 Tražim console.log pozive...

📁 Procesiranje: apps/

✅ apps/api-server/src/services/example.ts: 3 zamena
✅ apps/web/src/components/Button.tsx: 1 zamena

============================================================
📊 REZIME:
============================================================
Fajlova procesiranih: 150
Fajlova izmenjenih:   12
Ukupno zamena:        27
============================================================
```

## Biome Linter Pravilo

Projekat koristi **Biome** linter koji upozorava na console.log pozive:

```json
"suspicious": {
  "noConsole": {
    "level": "warn",
    "options": {
      "allow": ["warn", "error"]
    }
  }
}
```

Ovo dozvoljava `console.warn` i `console.error` (za kritične slučajeve), ali upozorava na `console.log` i `console.info`.

### Proverite

```bash
bun run lint
```

### Auto-fix (gde je moguće)

```bash
bun run lint:fix
```
