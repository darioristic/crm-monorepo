# TODO Komentari - Analiza i Prioriteti

Ovaj dokument sadrži analizu svih TODO komentara u projektu i njihovu prioritizaciju.

## Prioritet 1: Kritični (Blokira funkcionalnost)

### 1.1 Invite Sistem
**Lokacija**: `apps/web/src/components/forms/invite-form.tsx:46`
- **Status**: Neimplementiran API poziv
- **Opis**: Forma postoji ali ne šalje stvarne invite-e
- **Prioritet**: Visok - korisnici ne mogu da pozovu članove tima

**Lokacija**: `apps/web/src/components/tables/pending-invites/index.tsx:27`
- **Status**: Neimplementiran `getTeamInvites` API poziv
- **Opis**: Tabela ne prikazuje postojeće invite-e
- **Prioritet**: Visok - korisnici ne vide pending invite-e

**Lokacija**: `apps/web/src/components/tables/pending-invites/columns.tsx:62`
- **Status**: Neimplementiran `deleteInvite` API poziv
- **Opis**: Ne može se otkazati invite
- **Prioritet**: Visok - funkcionalnost nepotpuna

### 1.2 Notification Settings
**Lokacija**: `apps/web/src/components/notification-settings.tsx:45`
- **Status**: Neimplementiran API poziv
- **Opis**: Koristi placeholder podatke umesto stvarnih postavki
- **Prioritet**: Visok - korisnici ne mogu da upravljaju notifikacijama

**Lokacija**: `apps/web/src/components/notification-setting.tsx:32`
- **Status**: Neimplementiran API poziv za update
- **Opis**: Ne može se ažurirati status notifikacije
- **Prioritet**: Visok

### 1.3 Error Tracking
**Lokacija**: `apps/web/src/lib/logger.ts:66`
- **Status**: Neimplementirana Sentry integracija
- **Opis**: Greške se samo loguju u konzolu, nema error tracking servisa
- **Prioritet**: Visok - otežava debugging u production

## Prioritet 2: Visok (Uticaj na UX)

### 2.1 Connected Accounts
**Lokacija**: `apps/web/src/components/connected-accounts.tsx:25`
- **Status**: Neimplementirana lista bankovnih računa
- **Opis**: Prikazuje samo placeholder poruku
- **Prioritet**: Visok - ključna funkcionalnost za finansije

### 2.2 Orders Data Table
**Lokacija**: `apps/web/src/components/orders.tsx:18`
- **Status**: Neimplementirana orders tabela
- **Opis**: Prikazuje samo placeholder poruku
- **Prioritet**: Visok - neophodna za sales modul

### 2.3 Checkout Flow
**Lokacija**: `apps/web/src/components/plans.tsx:23`
- **Status**: Neimplementiran checkout flow
- **Opis**: Prikazuje samo toast poruku "coming soon"
- **Prioritet**: Visok - blokira monetizaciju

## Prioritet 3: Srednji (Nice to have)

### 3.1 Company Logo u Invoice
**Lokacija**: `apps/web/src/app/i/[token]/invoice-public-view.tsx:82`
- **Status**: TODO za zamenjivanje sa stvarnim logo-om
- **Opis**: Treba učitati logo iz company settings-a
- **Prioritet**: Srednji - nije kritično

### 3.2 Test Coverage
**Lokacija**: `docs/TESTING.md:111,136`
- **Status**: TODO za routes i component testove
- **Opis**: Dokumentacija navodi da treba dodati testove
- **Prioritet**: Srednji - poboljšanje kvaliteta koda

## Plan Implementacije

### Faza 1: Backend API Endpoints
1. ✅ Kreirati `apps/api-server/src/routes/invites.ts`
2. ✅ Kreirati `apps/api-server/src/routes/notifications.ts`
3. ✅ Kreirati `apps/api-server/src/routes/connected-accounts.ts`
4. ✅ Kreirati `apps/api-server/src/routes/orders.ts`

### Faza 2: Frontend Integracija
1. ✅ Dovršiti `invite-form.tsx` sa API pozivom
2. ✅ Dovršiti `pending-invites/index.tsx` sa API pozivom
3. ✅ Dovršiti `notification-settings.tsx` sa API pozivom
4. ✅ Dovršiti `connected-accounts.tsx` sa API pozivom
5. ✅ Dovršiti `orders.tsx` sa API pozivom
6. ✅ Dovršiti `plans.tsx` sa checkout flow-om

### Faza 3: Error Tracking
1. ✅ Implementirati Sentry u backend
2. ✅ Implementirati Sentry u frontend
3. ✅ Dodati Error Boundary komponente

### Faza 4: Test Coverage
1. ✅ Dodati testove za API routes
2. ✅ Dodati testove za frontend komponente

