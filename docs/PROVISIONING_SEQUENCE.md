# Provisioning Sequence Diagram

## Provisioning Workflow

```
Superadmin → POST /api/superadmin/provision
    ↓
Provisioning Service
    ↓
┌─────────────────────────────────────┐
│ 1. Validacija input podataka         │
│    - name, slug, adminEmail, etc.    │
│    - Provera postojanja slug-a       │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 2. Kreiranje tenant-a u bazi         │
│    - INSERT INTO tenants             │
│    - Status: pending → in_progress   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 3. Kreiranje default Location-a      │
│    - INSERT INTO locations           │
│    - Name: "Default Location"        │
│    - Code: "DEFAULT"                 │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 4. Kreiranje tenant admin korisnika  │
│    - Auth Service: registerUser()    │
│    - Role: tenant_admin              │
│    - Update user.tenantId            │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 5. Kreiranje user-tenant role        │
│    - INSERT INTO user_tenant_roles   │
│    - Role: admin                     │
│    - Permissions: {}                 │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 6. Generisanje API ključeva          │
│    - (Optional, može biti kasnije)   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 7. Status tracking u Redis           │
│    - Key: provisioning:status:{id}   │
│    - Status: completed              │
└─────────────────────────────────────┘
    ↓
Return ProvisioningResult
    - tenantId
    - locationId
    - adminUserId
    - status: completed
```

## Status Tracking

Provisioning status se čuva u Redis sa sledećom strukturom:

```typescript
{
  tenantId: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  step: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Idempotentnost

Provisioning je idempotentan:
- Provera postojanja tenant-a pre kreiranja
- Ako tenant već postoji sa istim slug-om, vraća se greška
- Retry logika sa exponential backoff (za buduće implementacije)

## Error Handling

U slučaju greške:
1. Status se ažurira na "failed"
2. Error message se čuva u status objektu
3. Rollback se ne izvršava automatski (soft delete može biti kasnije)
4. Superadmin može da vidi status i pokuša retry

## Retry Mechanism

Retry provisioning:
- `POST /api/superadmin/provision/:tenantId/retry`
- Proverava trenutni status
- Ako je failed, pokušava ponovo
- Ako je completed, vraća grešku

