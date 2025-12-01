# CRM API Dokumentacija

Verzija: 1.0.0
Base URL: `http://localhost:4000` (development) | `https://api.crm.example.com` (production)

## 📋 Sadržaj

- [Uvod](#uvod)
- [Autentifikacija](#autentifikacija)
- [Rate Limiting](#rate-limiting)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
  - [Health & Info](#health--info)
  - [Authentication](#authentication)
  - [Users](#users)
  - [Companies](#companies)
  - [CRM (Leads, Contacts, Deals)](#crm)
  - [Sales (Quotes, Invoices, Delivery Notes)](#sales)
  - [Projects & Tasks](#projects--tasks)
  - [Products](#products)
  - [Notifications](#notifications)
  - [Payments](#payments)
  - [Reports](#reports)
  - [API Keys](#api-keys)
  - [Background Jobs](#background-jobs)

---

## Uvod

CRM API pruža RESTful interface za upravljanje poslovnim procesima, uključujući:
- Upravljanje kontaktima i klijentima
- Prodajni procesi (quotes, invoices)
- Upravljanje projektima i taskovima
- Finansijski izvještaji
- Notifikacije i integracije

### Tehnologije

- **Runtime**: Bun 1.1.0
- **Framework**: Custom (native Bun HTTP)
- **Database**: PostgreSQL 16 + Drizzle ORM
- **Cache**: Redis 7
- **Queue**: BullMQ
- **Auth**: JWT (HS256) + HttpOnly cookies

---

## Autentifikacija

API podržava dva tipa autentifikacije:

### 1. JWT Bearer Token

Koristi se za web aplikacije i mobile klijente.

```bash
curl -H "Authorization: Bearer <your-jwt-token>" \
  https://api.crm.example.com/api/v1/users/me
```

### 2. API Key

Koristi se za backend integracije i automatizirane sisteme.

```bash
curl -H "X-API-Key: <your-api-key>" \
  https://api.crm.example.com/api/v1/contacts
```

### Login Flow

1. **Login**: POST `/api/v1/auth/login` → dobijete JWT token
2. **Store**: Token se čuva u HttpOnly cookie (automatski)
3. **Request**: Svaki request automatski šalje cookie
4. **Refresh**: POST `/api/v1/auth/refresh` → novi access token
5. **Logout**: POST `/api/v1/auth/logout` → invalidira sesiju

### Token Expiration

- **Access Token**: 15 minuta
- **Refresh Token**: 7 dana
- **Session**: 7 dana (Redis)

---

## Rate Limiting

API ima rate limiting za zaštitu od abuse-a.

### Limiti

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Default | 100 requests | 15 min |
| Login | 5 requests | 1 min |
| Auth Refresh | 10 requests | 1 min |
| Write Operations | 20 requests | 1 min |
| Reports | 30 requests | 1 min |
| Strict (sensitive) | 3 requests | 1 min |

### Response Headers

Svaki response uključuje rate limit informacije:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1638360000
```

### Rate Limit Exceeded (429)

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again in 45 seconds."
  }
}
```

---

## Response Format

Svi API odgovori koriste standardizovan format.

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 150,
    "totalPages": 8
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Optional additional context
    }
  }
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource conflict (e.g., duplicate) |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed |
| `UNAUTHORIZED` | Authentication required or failed |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `CONFLICT` | Resource already exists |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Server error |
| `INVALID_API_KEY` | API key invalid or expired |
| `INSUFFICIENT_SCOPE` | API key lacks required permissions |

---

## Endpoints

## Health & Info

### GET /health

Health check endpoint.

**Authentication**: None
**Rate Limit**: Default

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-12-01T10:00:00Z",
    "version": "1.0.0"
  }
}
```

### GET /api/v1

API information and available endpoints.

**Authentication**: None
**Rate Limit**: Default

**Response**:
```json
{
  "success": true,
  "data": {
    "name": "CRM API",
    "version": "1.0.0",
    "endpoints": {
      "auth": {
        "login": "/api/v1/auth/login",
        "logout": "/api/v1/auth/logout",
        "refresh": "/api/v1/auth/refresh",
        "me": "/api/v1/auth/me"
      },
      "companies": "/api/v1/companies",
      "users": "/api/v1/users",
      // ... ostali endpoints
    }
  }
}
```

### GET /api/v1/system/stats

System statistics (cache, queues, workers).

**Authentication**: Admin only
**Rate Limit**: Default

**Response**:
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-12-01T10:00:00Z",
    "cache": {
      "connected": true,
      "memory": "150MB"
    },
    "queues": {
      "email": { "waiting": 5, "active": 2, "completed": 1500 }
    },
    "workers": {
      "email": { "status": "running", "processed": 1000 }
    }
  }
}
```

---

## Authentication

### POST /api/v1/auth/login

User login.

**Authentication**: None
**Rate Limit**: Login (5 req/min)

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user",
      "companyId": "company-123"
    },
    "sessionId": "session-123"
  }
}
```

**Cookies Set**:
- `access_token` - JWT access token (15 min)
- `refresh_token` - JWT refresh token (7 days)
- `session_id` - Session ID (7 days)

### POST /api/v1/auth/logout

User logout.

**Authentication**: Required
**Rate Limit**: Default

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

### POST /api/v1/auth/refresh

Refresh access token.

**Authentication**: Refresh token required
**Rate Limit**: Refresh (10 req/min)

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Token refreshed"
  }
}
```

### GET /api/v1/auth/me

Get current user information.

**Authentication**: Required
**Rate Limit**: Default

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "companyId": "company-123",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

### POST /api/v1/auth/change-password

Change user password.

**Authentication**: Required
**Rate Limit**: Strict (3 req/min)

**Request**:
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword456!"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully"
  }
}
```

---

## Users

### GET /api/v1/users

List all users.

**Authentication**: Required
**Rate Limit**: Default
**Permissions**: Admin only

**Query Parameters**:
- `page` (number, default: 1)
- `pageSize` (number, default: 20, max: 100)
- `search` (string) - Search by name or email
- `role` (string) - Filter by role: `admin`, `user`
- `companyId` (string) - Filter by company
- `isActive` (boolean) - Filter active/inactive users

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "user-1",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user",
      "companyId": "company-123",
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 50,
    "totalPages": 3
  }
}
```

### GET /api/v1/users/:id

Get user by ID.

**Authentication**: Required
**Rate Limit**: Default
**Permissions**: Admin or own user

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "user-1",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "companyId": "company-123",
    "phone": "+1234567890",
    "isActive": true,
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-02T00:00:00Z"
  }
}
```

### POST /api/v1/users

Create new user.

**Authentication**: Required
**Rate Limit**: Write (20 req/min)
**Permissions**: Admin only

**Request**:
```json
{
  "email": "newuser@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "password": "SecurePassword123!",
  "role": "user",
  "companyId": "company-123",
  "phone": "+1234567890"
}
```

**Response** (201):
```json
{
  "success": true,
  "data": {
    "id": "user-new",
    "email": "newuser@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "user",
    "companyId": "company-123",
    "createdAt": "2025-12-01T10:00:00Z"
  }
}
```

### PATCH /api/v1/users/:id

Update user.

**Authentication**: Required
**Rate Limit**: Write (20 req/min)
**Permissions**: Admin or own user

**Request**:
```json
{
  "firstName": "Jane Updated",
  "phone": "+9876543210"
}
```

### DELETE /api/v1/users/:id

Delete user (soft delete).

**Authentication**: Required
**Rate Limit**: Write (20 req/min)
**Permissions**: Admin only

---

## Companies

### GET /api/v1/companies

List all companies.

**Authentication**: Required
**Rate Limit**: Default

**Query Parameters**:
- `page`, `pageSize`
- `search` - Search by name
- `isActive` - Filter active companies

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "company-1",
      "name": "Acme Corp",
      "industry": "Technology",
      "size": "50-200",
      "website": "https://acme.com",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {...}
}
```

### POST /api/v1/companies

Create company.

**Authentication**: Required
**Rate Limit**: Write
**Permissions**: Admin only

**Request**:
```json
{
  "name": "New Company Inc",
  "industry": "Finance",
  "size": "10-50",
  "website": "https://newcompany.com",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "country": "USA"
  }
}
```

---

## CRM

### Leads

#### GET /api/v1/leads

List leads.

**Query Parameters**:
- `status`: `new`, `contacted`, `qualified`, `lost`
- `assignedTo`: User ID
- `companyId`: Company ID
- `dateFrom`, `dateTo`: Date range

#### POST /api/v1/leads

Create lead.

**Request**:
```json
{
  "companyId": "company-1",
  "firstName": "Potential",
  "lastName": "Customer",
  "email": "potential@customer.com",
  "phone": "+1234567890",
  "source": "website",
  "status": "new",
  "notes": "Interested in our services"
}
```

### Contacts

#### GET /api/v1/contacts

List contacts.

#### POST /api/v1/contacts

Create contact.

**Request**:
```json
{
  "companyId": "company-1",
  "firstName": "John",
  "lastName": "Contact",
  "email": "john@company.com",
  "phone": "+1234567890",
  "position": "CTO",
  "isPrimary": true
}
```

### Deals

#### GET /api/v1/deals

List deals.

**Query Parameters**:
- `status`: `lead`, `proposal`, `negotiation`, `won`, `lost`
- `minValue`, `maxValue`: Filter by deal value
- `assignedTo`: Sales rep ID

#### POST /api/v1/deals

Create deal.

**Request**:
```json
{
  "companyId": "company-1",
  "contactId": "contact-1",
  "title": "Enterprise License Deal",
  "value": 50000,
  "currency": "USD",
  "probability": 70,
  "status": "proposal",
  "expectedCloseDate": "2025-12-31",
  "assignedTo": "user-1"
}
```

---

## Sales

### Quotes

#### GET /api/v1/quotes

List quotes.

#### POST /api/v1/quotes

Create quote.

**Request**:
```json
{
  "quoteNumber": "Q-2025-001",
  "companyId": "company-1",
  "contactId": "contact-1",
  "dealId": "deal-1",
  "items": [
    {
      "productId": "product-1",
      "quantity": 10,
      "unitPrice": 100,
      "discount": 10
    }
  ],
  "subtotal": 900,
  "tax": 90,
  "total": 990,
  "validUntil": "2025-12-31",
  "notes": "Enterprise discount applied"
}
```

### Invoices

#### GET /api/v1/invoices

List invoices.

**Query Parameters**:
- `status`: `draft`, `sent`, `paid`, `overdue`, `cancelled`
- `companyId`
- `dateFrom`, `dateTo`

#### POST /api/v1/invoices

Create invoice.

**Request**:
```json
{
  "invoiceNumber": "INV-2025-001",
  "companyId": "company-1",
  "quoteId": "quote-1",
  "items": [...],
  "subtotal": 1000,
  "tax": 100,
  "total": 1100,
  "dueDate": "2025-12-31",
  "status": "sent"
}
```

### Delivery Notes

#### GET /api/v1/delivery-notes

List delivery notes.

#### POST /api/v1/delivery-notes

Create delivery note.

---

## Projects & Tasks

### Projects

#### GET /api/v1/projects

List projects.

**Query Parameters**:
- `status`: `planning`, `active`, `on-hold`, `completed`, `cancelled`
- `companyId`
- `managerId`

#### POST /api/v1/projects

Create project.

**Request**:
```json
{
  "name": "Website Redesign",
  "description": "Complete website redesign project",
  "companyId": "company-1",
  "managerId": "user-1",
  "startDate": "2025-01-01",
  "endDate": "2025-06-30",
  "budget": 50000,
  "status": "planning"
}
```

### Milestones

#### GET /api/v1/milestones

List milestones.

#### POST /api/v1/milestones

Create milestone.

### Tasks

#### GET /api/v1/tasks

List tasks.

**Query Parameters**:
- `status`: `todo`, `in-progress`, `review`, `done`
- `assignedTo`
- `projectId`
- `milestoneId`
- `priority`: `low`, `medium`, `high`, `urgent`

#### POST /api/v1/tasks

Create task.

**Request**:
```json
{
  "title": "Design homepage mockup",
  "description": "Create initial homepage design",
  "projectId": "project-1",
  "milestoneId": "milestone-1",
  "assignedTo": "user-1",
  "priority": "high",
  "status": "todo",
  "dueDate": "2025-12-15"
}
```

---

## Products

### GET /api/v1/products

List products.

**Query Parameters**:
- `categoryId`
- `isActive`
- `isService`
- `minPrice`, `maxPrice`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "product-1",
      "name": "Enterprise License",
      "description": "Annual enterprise software license",
      "sku": "ENT-LIC-001",
      "price": 10000,
      "currency": "USD",
      "categoryId": "cat-1",
      "isService": true,
      "isActive": true
    }
  ]
}
```

### POST /api/v1/products

Create product.

**Request**:
```json
{
  "name": "Premium Support Package",
  "description": "24/7 premium support",
  "sku": "SUP-PREM-001",
  "price": 5000,
  "currency": "USD",
  "categoryId": "cat-support",
  "isService": true,
  "isActive": true
}
```

### Product Categories

#### GET /api/v1/product-categories

List product categories.

#### POST /api/v1/product-categories

Create category.

---

## Notifications

### GET /api/v1/notifications

Get user notifications.

**Authentication**: Required
**Rate Limit**: Default

**Query Parameters**:
- `isRead`: Filter read/unread
- `type`: Notification type

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "notif-1",
      "type": "deal_won",
      "title": "Deal Won!",
      "message": "Enterprise License Deal closed successfully",
      "isRead": false,
      "createdAt": "2025-12-01T10:00:00Z",
      "relatedEntityId": "deal-1"
    }
  ]
}
```

### PATCH /api/v1/notifications/:id/read

Mark notification as read.

### POST /api/v1/notifications/read-all

Mark all notifications as read.

---

## Payments

### GET /api/v1/payments

List payments.

**Query Parameters**:
- `invoiceId`
- `companyId`
- `status`: `pending`, `completed`, `failed`, `refunded`
- `paymentMethod`: `bank_transfer`, `credit_card`, `paypal`, `cash`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "payment-1",
      "invoiceId": "inv-1",
      "amount": 1100,
      "currency": "USD",
      "paymentMethod": "bank_transfer",
      "status": "completed",
      "transactionId": "TXN123456",
      "paidAt": "2025-12-01T10:00:00Z"
    }
  ]
}
```

### POST /api/v1/payments

Record payment.

**Request**:
```json
{
  "invoiceId": "inv-1",
  "amount": 1100,
  "currency": "USD",
  "paymentMethod": "bank_transfer",
  "transactionId": "TXN123456",
  "notes": "Payment received via bank transfer"
}
```

---

## Reports

### GET /api/v1/reports/sales

Sales report.

**Authentication**: Required
**Rate Limit**: Reports (30 req/min)
**Permissions**: Admin or sales manager

**Query Parameters**:
- `dateFrom`, `dateTo`
- `groupBy`: `day`, `week`, `month`, `quarter`, `year`
- `companyId`
- `userId`

**Response**:
```json
{
  "success": true,
  "data": {
    "period": {
      "from": "2025-01-01",
      "to": "2025-12-31"
    },
    "summary": {
      "totalRevenue": 500000,
      "totalDeals": 50,
      "averageDealSize": 10000,
      "conversionRate": 0.25
    },
    "breakdown": [
      {
        "period": "2025-01",
        "revenue": 45000,
        "deals": 5
      }
    ]
  }
}
```

### GET /api/v1/reports/revenue

Revenue report.

### GET /api/v1/reports/pipeline

Sales pipeline report.

### GET /api/v1/reports/customer-acquisition

Customer acquisition report.

---

## API Keys

### POST /api/v1/api-keys

Generate new API key.

**Authentication**: Required
**Rate Limit**: Strict (3 req/min)

**Request**:
```json
{
  "name": "Production Integration",
  "scopes": ["read:contacts", "write:contacts", "read:deals"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "apiKey": {
      "id": "key-1",
      "name": "Production Integration",
      "key": "crm_live_abc123...",
      "scopes": ["read:contacts", "write:contacts", "read:deals"],
      "createdAt": "2025-12-01T10:00:00Z",
      "expiresAt": null
    }
  }
}
```

**⚠️ Important**: Save the API key securely! It will only be shown once.

### GET /api/v1/api-keys

List your API keys.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "key-1",
      "name": "Production Integration",
      "keyPreview": "crm_live_abc***",
      "scopes": ["read:contacts", "write:contacts"],
      "lastUsedAt": "2025-12-01T09:00:00Z",
      "createdAt": "2025-11-01T00:00:00Z"
    }
  ]
}
```

### DELETE /api/v1/api-keys/:id

Revoke API key.

---

## Background Jobs

### GET /api/v1/jobs/status

Get background jobs status.

**Authentication**: Required
**Rate Limit**: Default
**Permissions**: Admin only

**Response**:
```json
{
  "success": true,
  "data": {
    "queues": {
      "email": {
        "waiting": 5,
        "active": 2,
        "completed": 15000,
        "failed": 10
      },
      "reports": {
        "waiting": 1,
        "active": 0,
        "completed": 500,
        "failed": 2
      }
    }
  }
}
```

### POST /api/v1/jobs/email

Queue email job.

**Authentication**: Required
**Rate Limit**: Write

**Request**:
```json
{
  "to": "recipient@example.com",
  "subject": "Welcome to CRM",
  "html": "<h1>Welcome!</h1><p>Thank you for joining.</p>"
}
```

**Response** (202):
```json
{
  "success": true,
  "data": {
    "message": "Email job queued"
  }
}
```

---

## API Scopes

Za API Key autentifikaciju, dostupni su sledeći scope-ovi:

### Read Scopes
- `read:companies` - Read company data
- `read:users` - Read user data
- `read:leads` - Read leads
- `read:contacts` - Read contacts
- `read:deals` - Read deals
- `read:quotes` - Read quotes
- `read:invoices` - Read invoices
- `read:projects` - Read projects
- `read:tasks` - Read tasks
- `read:products` - Read products
- `read:payments` - Read payments
- `read:reports` - Read reports

### Write Scopes
- `write:companies` - Create/update companies
- `write:users` - Create/update users
- `write:leads` - Create/update leads
- `write:contacts` - Create/update contacts
- `write:deals` - Create/update deals
- `write:quotes` - Create/update quotes
- `write:invoices` - Create/update invoices
- `write:projects` - Create/update projects
- `write:tasks` - Create/update tasks
- `write:products` - Create/update products
- `write:payments` - Record payments

### Special Scopes
- `admin` - Full admin access (all operations)

---

## Webhooks

*Coming soon* - Webhook support za real-time notifikacije.

---

## Changelog

### Version 1.0.0 (2025-12-01)
- Initial API release
- Core CRM features
- Authentication & authorization
- Rate limiting
- API keys support
- Background jobs

---

## Support

- **Email**: support@crm.example.com
- **Documentation**: https://docs.crm.example.com
- **Status**: https://status.crm.example.com

