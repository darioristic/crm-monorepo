# API Endpoints Documentation

Kompletna dokumentacija svih API endpoint-a u CRM sistemu.

## Base URL

- Development: `http://localhost:3001`
- Production: `https://api.yourdomain.com`

## Authentication

Većina endpoint-a zahteva autentifikaciju preko JWT tokena koji se šalje kao HTTP-only cookie.

### Headeri

- `Authorization: Bearer <token>`
- `X-CSRF-Token: <token>`
- `X-Company-Id: <uuid>` — identifikacija aktivne kompanije za multitenant skopiranje.

## Endpoints

### Health Check

#### GET /health

Proverava da li je server dostupan.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Authentication

#### POST /api/v1/auth/login

Prijavljuje korisnika.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}
```

#### GET /api/v1/auth/me

Vraća informacije o trenutno prijavljenom korisniku.

#### POST /api/v1/auth/logout

Odjavljuje korisnika.

#### POST /api/v1/auth/refresh

Osvežava access token.

### Companies

#### GET /api/v1/companies/current

Vraća trenutno aktivnu kompaniju korisnika.

#### GET /api/v1/companies

Vraća listu svih kompanija korisnika.

#### POST /api/v1/companies

Kreira novu kompaniju.

#### GET /api/v1/companies/:id

Vraća detalje kompanije po ID-u.

#### PUT /api/v1/companies/:id

Ažurira kompaniju.

#### DELETE /api/v1/companies/:id

Briše kompaniju.

### Invites

#### GET /api/v1/invites

Vraća listu pending invite-a za trenutnu kompaniju.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "invitee@example.com",
      "role": "member",
      "status": "pending",
      "expiresAt": "2024-01-08T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST /api/v1/invites

Kreira novi invite.

**Request Body:**

```json
{
  "email": "invitee@example.com",
  "role": "member"
}
```

#### DELETE /api/v1/invites/:id

Briše invite.

#### POST /api/v1/invites/accept/:token

Prihvata invite preko tokena.

### Notification Settings

#### GET /api/v1/notification-settings

Vraća postavke notifikacija za trenutnog korisnika.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "notificationType": "invoice.created",
      "channel": "email",
      "enabled": true
    }
  ]
}
```

#### PATCH /api/v1/notification-settings

Ažurira postavku notifikacije.

**Request Body:**

```json
{
  "notificationType": "invoice.created",
  "channel": "email",
  "enabled": false
}
```

### Notifications

#### GET /api/v1/notifications

Vraća listu notifikacija za trenutnog korisnika.

**Query Parameters:**

- `page` - Broj stranice (default: 1)
- `pageSize` - Broj stavki po stranici (default: 20)
- `isRead` - Filter po pročitanoj statusu (true/false)
- `type` - Filter po tipu notifikacije

#### GET /api/v1/notifications/unread-count

Vraća broj nepročitanih notifikacija.

#### PATCH /api/v1/notifications/:id/read

Označava notifikaciju kao pročitanu.

#### POST /api/v1/notifications/mark-all-read

Označava sve notifikacije kao pročitane.

### Sales

#### GET /api/v1/quotes

Vraća listu ponuda.
Company-scoped: koristi `X-Company-Id` ili aktivnu kompaniju korisnika.

#### POST /api/v1/quotes

Kreira novu ponudu.

#### GET /api/v1/invoices

Vraća listu faktura.
Company-scoped: koristi `X-Company-Id` ili aktivnu kompaniju korisnika.

#### POST /api/v1/invoices

Kreira novu fakturu.

#### GET /api/v1/delivery-notes

Vraća listu otpremnica.
Company-scoped: koristi `X-Company-Id` ili aktivnu kompaniju korisnika.

#### GET /api/v1/orders

Vraća listu narudžbi.
Company-scoped: koristi `X-Company-Id` ili aktivnu kompaniju korisnika.

### Projects

#### GET /api/v1/projects

Vraća listu projekata.

#### POST /api/v1/projects

Kreira novi projekat.

### Products

#### GET /api/v1/products

Vraća listu proizvoda.

#### POST /api/v1/products

Kreira novi proizvod.

## Error Responses

Svi endpoint-i vraćaju standardizovan error response:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

### Common Error Codes

- `UNAUTHORIZED` (401) - Korisnik nije prijavljen
- `FORBIDDEN` (403) - Korisnik nema dozvolu
- `NOT_FOUND` (404) - Resurs nije pronađen
- `VALIDATION_ERROR` (400) - Nevalidni podaci
- `CONFLICT` (409) - Konflikt (npr. duplikat)
- `INTERNAL_ERROR` (500) - Interna greška servera

## Rate Limiting

API koristi rate limiting. Headers za rate limit informacije:

- `X-RateLimit-Limit` - Maksimalan broj zahteva
- `X-RateLimit-Remaining` - Preostali broj zahteva
- `X-RateLimit-Reset` - Vreme resetovanja (Unix timestamp)

## Pagination

Endpoints koji podržavaju paginaciju vraćaju meta informacije:

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 100,
    "totalPages": 5
  }
}
```
