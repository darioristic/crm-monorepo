# Multitenant CRM Arhitektura

## Pregled

Potpuna rekonstrukcija aplikacije u enterprise multitenant CRM sa tri potpuno odvojena sloja, stroga izolacija podataka i clean architecture organizacija.

## Arhitektura Slojeva

### 1. Superadmin Sloj (`/superadmin`)

**Path**: `/superadmin/*`  
**API**: `/api/superadmin/*`  
**Auth**: Poseban superadmin auth middleware

**Funkcionalnosti**:
- Pregled svih tenant-a
- Kreiranje, brisanje, suspendovanje tenant-a
- Sistemski health monitoring
- Logovi i metrike
- Globalni feature toggles
- Provisioning kontrola

**Izolacija**: Superadmin vidi sve tenant-e, ali ne učestvuje u tenant context-u.

### 2. Tenant Admin Sloj (`/tenant-admin`)

**Path**: `/tenant-admin/*`  
**API**: `/api/tenant-admin/*`  
**Auth**: Tenant-scoped auth sa tenantId u JWT

**Funkcionalnosti**:
- Upravljanje korisnicima (roles & permissions)
- Upravljanje kompanijama
- Upravljanje Location entitetima
- CRM konfiguracije
- Feature konfiguracija po tenant-u

**Izolacija**: Tenant admin vidi samo svoj tenant, ne vidi druge tenant-e.

### 3. CRM Korisnički Sloj (`/crm`)

**Path**: `/crm/*`  
**API**: `/api/crm/*`  
**Auth**: Tenant + Company scoped auth

**Funkcionalnosti**:
- Rad sa kompanijama (selectedCompanyId context)
- Dokumenti (samo za izabranu kompaniju)
- Kontakti (samo za izabranu kompaniju)
- Aktivnosti (samo za izabranu kompaniju)

**Izolacija**: Korisnik vidi samo dokumente kompanije koju je trenutno izabrao.

## Database Schema

### Core Tables

- **tenants**: Glavna tabela za tenant-e
- **locations**: Lokacije unutar tenant-a
- **companies**: Kompanije sa tenantId i locationId
- **users**: Korisnici sa tenantId (null za superadmin)
- **user_tenant_roles**: Veza između korisnika i tenant-a sa role-ovima
- **documents**: Dokumenti sa tenantId i companyId
- **contacts**: Kontakti sa tenantId i companyId
- **activities**: Aktivnosti sa tenantId i companyId

### Indexes

Svi entiteti imaju indexe na tenantId i kombinacije tenantId + companyId za optimalne performanse.

## Middleware i Context Management

### Tenant Context Middleware

- Ekstraktuje tenantId iz JWT tokena
- Validira tenant postojanje i status
- Postavlja tenant context u request
- Blokira pristup ako tenant suspended/deleted

### Company Context Middleware

- Ekstraktuje companyId iz query params ili body
- Validira company pripada tenant-u
- Postavlja company context u request
- Obavezno za sve CRM API pozive

## Provisioning Servis

### Workflow

1. Validacija input podataka
2. Kreiranje tenant-a u bazi
3. Kreiranje default Location-a
4. Kreiranje inicijalnog tenant admin korisnika
5. Generisanje API ključeva
6. Registracija u System Registry
7. Vraćanje provisioning status-a

### Idempotentnost

- Provjera postojanja tenant-a pre kreiranja
- Retry logika sa exponential backoff
- Status tracking u Redis

## Query Isolation

### Database Query Helpers

- `withTenantIsolation(query, tenantId)`: Automatska tenant izolacija
- `withCompanyIsolation(query, tenantId, companyId)`: Automatska company izolacija
- `enforceTenantScope(table, tenantId)`: Enforce tenant scope
- `enforceCompanyScope(table, tenantId, companyId)`: Enforce company scope

## API Routing

### Superadmin API
- `GET /api/superadmin/tenants` - Lista svih tenant-a
- `GET /api/superadmin/tenants/:id` - Detalji tenant-a
- `PUT /api/superadmin/tenants/:id` - Ažuriranje tenant-a
- `DELETE /api/superadmin/tenants/:id` - Brisanje tenant-a
- `GET /api/superadmin/tenants/:id/health` - Health check
- `GET /api/superadmin/tenants/:id/logs` - Logovi
- `GET /api/superadmin/tenants/:id/metrics` - Metrike
- `POST /api/superadmin/provision` - Provisioning
- `GET /api/superadmin/provision/:tenantId/status` - Provisioning status

### Tenant Admin API
- `GET /api/tenant-admin/users` - Lista korisnika
- `GET /api/tenant-admin/companies` - Lista kompanija
- `GET /api/tenant-admin/locations` - Lista lokacija
- `POST /api/tenant-admin/locations` - Kreiranje lokacije
- `GET /api/tenant-admin/settings` - Tenant settings

### CRM API
- `GET /api/crm/companies` - Lista kompanija (tenant-scoped)
- `GET /api/crm/companies/:id` - Detalji kompanije
- `GET /api/crm/companies/:companyId/documents` - Dokumenti kompanije
- `GET /api/crm/companies/:companyId/contacts` - Kontakti kompanije
- `GET /api/crm/companies/:companyId/activities` - Aktivnosti kompanije

## Folder Struktura

```
apps/api-server/src/
├── api/
│   ├── superadmin/   # Superadmin API routes
│   ├── tenant-admin/ # Tenant Admin API routes
│   └── crm/          # CRM API routes
├── domains/          # Domain-driven modules
│   ├── tenant/
│   ├── location/
│   ├── company/
│   ├── document/
│   ├── contact/
│   └── activity/
├── system/
│   ├── provisioning/ # Provisioning servis
│   ├── tenant-context/ # Tenant context manager
│   ├── company-context/ # Company context manager
│   └── auth/         # Auth engine
└── infrastructure/
    ├── db/           # Database adapters
    └── cache/         # Redis adapters
```

## Security i Izolacija

### Tenant Izolacija
- Svi entiteti moraju imati tenantId
- API routing i middleware striktno vezuju svaki request za tenantId
- Database query-ji automatski filtriraju po tenantId

### Company Izolacija
- Svi kompanijski entiteti moraju imati companyId
- API routing i middleware striktno vezuju svaki request za companyId
- Database query-ji automatski filtriraju po tenantId + companyId

### Superadmin Izolacija
- Superadmin vidi sve tenant-e
- Superadmin ne učestvuje u tenant context-u
- Superadmin ne može pristupiti tenant-scoped resursima

## Migracije

Migracija `020_create_multitenant_schema` kreira:
- tenants tabelu
- locations tabelu
- user_tenant_roles tabelu
- documents tabelu
- Dodaje tenantId i companyId kolone u postojeće tabele
- Kreira sve potrebne indexe

## Testiranje

Testovi treba da pokrivaju:
- Tenant izolaciju
- Company izolaciju
- Provisioning workflow
- Auth za sve tri sloja
- Middleware validaciju

