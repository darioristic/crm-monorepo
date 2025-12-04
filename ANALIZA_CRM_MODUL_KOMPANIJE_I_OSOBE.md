# Analiza CRM Modula za Kompanije i Osobe

## Pregled

CRM modul u projektu koristi **multi-tenant arhitekturu** sa **company-scoped** pristupom za podatke. Sistem je organizovan na tri nivoa:

1. **Tenant Level** - Najviši nivo izolacije podataka
2. **Company Level** - Kompanije pripadaju tenantu i mogu imati više kontakata
3. **Contact Level** - Kontakti (osobe) pripadaju kompaniji i tenantu

---

## 1. Arhitektura i Struktura Podataka

### 1.1 Database Schema

#### Companies Table (`companies`)
```201:251:crm-monorepo/apps/api-server/drizzle/schema.ts
export const companies = pgTable("companies", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	industry: varchar({ length: 255 }).notNull(),
	address: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	email: varchar({ length: 255 }),
	billingEmail: varchar("billing_email", { length: 255 }),
	phone: varchar({ length: 50 }),
	website: varchar({ length: 255 }),
	contact: varchar({ length: 255 }),
	addressLine1: varchar("address_line_1", { length: 255 }),
	addressLine2: varchar("address_line_2", { length: 255 }),
	city: varchar({ length: 100 }),
	state: varchar({ length: 100 }),
	zip: varchar({ length: 20 }),
	country: varchar({ length: 100 }),
	countryCode: varchar("country_code", { length: 10 }),
	vatNumber: varchar("vat_number", { length: 50 }),
	note: text(),
	token: varchar({ length: 255 }).default('),
	// TODO: failed to parse database type 'tsvector'
	fts: unknown("fts").generatedAlwaysAs(sql`to_tsvector('english'::regconfig, (((((((((((((((((((COALESCE(name, ''::character varying))::text || ' '::text) || (COALESCE(contact, ''::character varying))::text) || ' '::text) || (COALESCE(phone, ''::character varying))::text) || ' '::text) || (COALESCE(email, ''::character varying))::text) || ' '::text) || (COALESCE(address_line_1, ''::character varying))::text) || ' '::text) || (COALESCE(address_line_2, ''::character varying))::text) || ' '::text) || (COALESCE(city, ''::character varying))::text) || ' '::text) || (COALESCE(state, ''::character varying))::text) || ' '::text) || (COALESCE(zip, ''::character varying))::text) || ' '::text) || (COALESCE(country, ''::character varying))::text))`),
	companyNumber: varchar("company_number", { length: 50 }),
	logoUrl: text("logo_url"),
	source: varchar({ length: 50 }).default('account').notNull(),
	tenantId: uuid("tenant_id"),
	locationId: uuid("location_id"),
	metadata: jsonb(),
}, (table) => [
	index("companies_fts_idx").using("gin", table.fts.asc().nullsLast().op("tsvector_ops")),
	index("idx_companies_company_id_tenant_id").using("btree", table.id.asc().nullsLast().op("uuid_ops"), table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_companies_country").using("btree", table.country.asc().nullsLast().op("text_ops")),
	index("idx_companies_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_companies_industry").using("btree", table.industry.asc().nullsLast().op("text_ops")),
	index("idx_companies_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("idx_companies_source").using("btree", table.source.asc().nullsLast().op("text_ops")),
	index("idx_companies_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_companies_vat_number").using("btree", table.vatNumber.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "companies_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.locationId],
			foreignColumns: [locations.id],
			name: "companies_location_id_fkey"
		}).onDelete("set null"),
]);
```

**Ključne karakteristike:**
- **tenantId** - Svaka kompanija pripada jednom tenantu
- **source** - Razlikuje kompanije po tipu: `'account'` (sistemske) ili `'customer'` (klijenti)
- **locationId** - Opciona veza sa lokacijom
- **metadata** - JSONB polje za dodatne podatke
- **fts** - Full-text search indeks za brzu pretragu

#### Contacts Table (`contacts`)
```900:940:crm-monorepo/apps/api-server/drizzle/schema.ts
export const contacts = pgTable("contacts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	firstName: varchar("first_name", { length: 100 }).notNull(),
	lastName: varchar("last_name", { length: 100 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	phone: varchar({ length: 50 }),
	company: varchar({ length: 255 }),
	position: varchar({ length: 255 }),
	street: varchar({ length: 255 }),
	city: varchar({ length: 100 }),
	state: varchar({ length: 100 }),
	postalCode: varchar("postal_code", { length: 20 }),
	country: varchar({ length: 100 }),
	notes: text(),
	leadId: uuid("lead_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	tenantId: uuid("tenant_id"),
	companyId: uuid("company_id"),
}, (table) => [
	index("idx_contacts_company_name").using("btree", table.company.asc().nullsLast().op("text_ops"), table.lastName.asc().nullsLast().op("text_ops"), table.firstName.asc().nullsLast().op("text_ops")),
	index("idx_contacts_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_contacts_email_lower").using("btree", sql`lower((email)::text)`),
	index("idx_contacts_lead_id").using("btree", table.leadId.asc().nullsLast().op("uuid_ops")),
	index("idx_contacts_tenant_company").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.companyId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "contacts_lead_id_leads_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "contacts_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "contacts_company_id_fkey"
		}).onDelete("cascade"),
]);
```

**Ključne karakteristike:**
- **tenantId** - Kontakt pripada tenantu
- **companyId** - Kontakt pripada kompaniji (CASCADE delete)
- **leadId** - Opciona veza sa lead-om
- **company** - Tekstualno polje za naziv kompanije (može biti različito od companyId)

---

## 2. Domain Entities

### 2.1 Company Entity
```1:94:crm-monorepo/apps/api-server/src/domains/company/domain/company.entity.ts
export interface CompanyMetadata {
	[key: string]: unknown;
}

export class Company {
	constructor(
		public readonly id: string,
		public readonly tenantId: string,
		public readonly locationId: string | null,
		public readonly name: string,
		public readonly industry: string,
		public readonly address: string,
		public readonly email: string | null,
		public readonly phone: string | null,
		public readonly website: string | null,
		public readonly contact: string | null,
		public readonly city: string | null,
		public readonly zip: string | null,
		public readonly country: string | null,
		public readonly countryCode: string | null,
		public readonly vatNumber: string | null,
		public readonly companyNumber: string | null,
		public readonly logoUrl: string | null,
		public readonly note: string | null,
		public readonly metadata: CompanyMetadata | null,
		public readonly createdAt: Date,
		public readonly updatedAt: Date,
	) {}

	static create(
		tenantId: string,
		name: string,
		industry: string,
		address: string,
		locationId?: string,
		metadata?: CompanyMetadata,
	): Company {
		const now = new Date();
		return new Company(
			crypto.randomUUID(),
			tenantId,
			locationId || null,
			name,
			industry,
			address,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			metadata || null,
			now,
			now,
		);
	}

	belongsToTenant(tenantId: string): boolean {
		return this.tenantId === tenantId;
	}

	updateLocation(locationId: string | null): Company {
		return new Company(
			this.id,
			this.tenantId,
			locationId,
			this.name,
			this.industry,
			this.address,
			this.email,
			this.phone,
			this.website,
			this.contact,
			this.city,
			this.zip,
			this.country,
			this.countryCode,
			this.vatNumber,
			this.companyNumber,
			this.logoUrl,
			this.note,
			this.metadata,
			this.createdAt,
			new Date(),
		);
	}
}
```

### 2.2 Contact Entity
```1:70:crm-monorepo/apps/api-server/src/domains/contact/domain/contact.entity.ts
export class Contact {
	constructor(
		public readonly id: string,
		public readonly tenantId: string,
		public readonly companyId: string,
		public readonly firstName: string,
		public readonly lastName: string,
		public readonly email: string,
		public readonly phone: string | null,
		public readonly company: string | null,
		public readonly position: string | null,
		public readonly street: string | null,
		public readonly city: string | null,
		public readonly state: string | null,
		public readonly postalCode: string | null,
		public readonly country: string | null,
		public readonly notes: string | null,
		public readonly leadId: string | null,
		public readonly createdAt: Date,
		public readonly updatedAt: Date,
	) {}

	static create(
		tenantId: string,
		companyId: string,
		firstName: string,
		lastName: string,
		email: string,
	): Contact {
		const now = new Date();
		return new Contact(
			crypto.randomUUID(),
			tenantId,
			companyId,
			firstName,
			lastName,
			email,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			now,
			now,
		);
	}

	belongsToTenant(tenantId: string): boolean {
		return this.tenantId === tenantId;
	}

	belongsToCompany(companyId: string): boolean {
		return this.companyId === companyId;
	}

	belongsToTenantAndCompany(tenantId: string, companyId: string): boolean {
		return this.tenantId === tenantId && this.companyId === companyId;
	}

	getFullName(): string {
		return `${this.firstName} ${this.lastName}`;
	}
}
```

---

## 3. API Rute i Endpoints

### 3.1 CRM API Routes (`crm-api.ts`)

Ovaj fajl definiše **company-scoped** rute koje zahtevaju i tenant i company context:

```23:81:crm-monorepo/apps/api-server/src/routes/crm-api.ts
// ============================================
// Companies (tenant-scoped)
// ============================================

// List companies in tenant
router.get(
	"/api/crm/companies",
	requireAuth(
	requireTenantContext(async (_request, _url, _params, _auth, tenantContext) => {
			try {
				const tenantCompanies = await db
					.select()
					.from(companies)
					.where(eq(companies.tenantId, tenantContext.tenantId));

				return json(successResponse(tenantCompanies));
			} catch (error) {
				logger.error({ error }, "Error listing companies");
				return json(
					errorResponse("INTERNAL_ERROR", "Failed to list companies"),
					500,
				);
			}
		}),
	),
);

// Get company by ID
router.get(
	"/api/crm/companies/:id",
	requireAuth(
	requireTenantContext(async (_request, _url, _params, _auth, tenantContext) => {
			try {
				const company = await db
					.select()
					.from(companies)
					.where(
						and(
							eq(companies.id, _params.id),
							eq(companies.tenantId, tenantContext.tenantId),
						),
					)
					.limit(1);

				if (company.length === 0) {
					return json(errorResponse("NOT_FOUND", "Company not found"), 404);
				}

				return json(successResponse(company[0]));
			} catch (error) {
				logger.error({ error }, "Error getting company");
				return json(
					errorResponse("INTERNAL_ERROR", "Failed to get company"),
					500,
				);
			}
		}),
	),
);
```

**Company-scoped rute za kontakte:**
```130:167:crm-monorepo/apps/api-server/src/routes/crm-api.ts
// List contacts for a company
router.get(
	"/api/crm/companies/:companyId/contacts",
	requireAuth(
		requireTenantContext(
			requireCompanyContext(
				async (
					_request,
					_url,
					_params,
					_auth,
					tenantContext,
					companyContext,
				) => {
					try {
						const companyContacts = await db
							.select()
							.from(contacts)
							.where(
								buildCompanyScopedContactQuery(
									tenantContext.tenantId,
									companyContext.companyId,
								),
							);

						return json(successResponse(companyContacts));
					} catch (error) {
						logger.error({ error }, "Error listing contacts");
						return json(
							errorResponse("INTERNAL_ERROR", "Failed to list contacts"),
							500,
						);
					}
				},
			),
		),
	),
);
```

### 3.2 CRM Routes (`crm.ts`)

Stariji pristup koji koristi **Leads** i **Contacts** bez company context-a:

```12:102:crm-monorepo/apps/api-server/src/routes/crm.ts
// ============================================
// LEADS
// ============================================

router.get("/api/v1/leads", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return crmService.getLeads(pagination, filters);
  });
});

router.get("/api/v1/leads/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return crmService.getLeadById(params.id);
  });
});

router.post("/api/v1/leads", async (request) => {
  return withAuth(
    request,
    async () => {
      const body = await parseBody<CreateLeadRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return crmService.createLead(body);
    },
    201
  );
});

router.put("/api/v1/leads/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateLeadRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return crmService.updateLead(params.id, body);
  });
});

router.patch("/api/v1/leads/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateLeadRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return crmService.updateLead(params.id, body);
  });
});

router.delete("/api/v1/leads/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return crmService.deleteLead(params.id);
  });
});

// ============================================
// CONTACTS
// ============================================

router.get("/api/v1/contacts", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return crmService.getContacts(pagination, filters);
  });
});

router.get("/api/v1/contacts/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return crmService.getContactById(params.id);
  });
});

router.post("/api/v1/contacts", async (request) => {
  return withAuth(
    request,
    async () => {
      const body = await parseBody<CreateContactRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return crmService.createContact(body);
    },
    201
  );
});
```

**Napomena:** Ove rute (`/api/v1/leads` i `/api/v1/contacts`) **ne koriste tenant/company context** i verovatno su stariji pristup.

---

## 4. Query Helpers i Scope Enforcement

### 4.1 Query Helpers

Sistem koristi helper funkcije za izgradnju scoped queries:

```99:123:crm-monorepo/apps/api-server/src/infrastructure/db/query-helpers.ts
/**
 * Helper to build company-scoped queries for documents
 */
export function buildCompanyScopedDocumentQuery(
	tenantId: string,
	companyId: string,
) {
	return and(
		eq(documents.tenantId, tenantId),
		eq(documents.companyId, companyId),
	);
}

/**
 * Helper to build company-scoped queries for contacts
 */
export function buildCompanyScopedContactQuery(
	tenantId: string,
	companyId: string,
) {
	return and(
		eq(contacts.tenantId, tenantId),
		eq(contacts.companyId, companyId),
	);
}

/**
 * Helper to build company-scoped queries for activities
 */
export function buildCompanyScopedActivityQuery(
	tenantId: string,
	companyId: string,
) {
	return and(
		eq(activities.tenantId, tenantId),
		eq(activities.companyId, companyId),
	);
}
```

### 4.2 Company Context Middleware

Middleware koji osigurava da se pristupa samo kompanijama koje pripadaju tenantu:

```17:137:crm-monorepo/apps/api-server/src/system/company-context/middleware.ts
export function requireCompanyContext(
	handler: (
		request: CompanyScopedRequest,
		url: URL,
		params: Record<string, string>,
		auth: AuthContext,
		tenantContext: TenantContext,
		companyContext: CompanyContext,
	) => Promise<Response>,
): AuthenticatedRouteHandler {
	return async (request, url, params, auth) => {
		// This middleware should be used after requireTenantContext
		const tenantId = auth.tenantId;

		if (!tenantId) {
			return new Response(
				JSON.stringify(
					errorResponse("UNAUTHORIZED", "Tenant context required"),
				),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Extract companyId from URL params, query params, or request body
		let companyId: string | undefined;

		// Check URL params first
		companyId = params.companyId || params.id;

		// Check query params
		if (!companyId) {
			companyId = url.searchParams.get("companyId") || undefined;
		}

		// Check header X-Company-Id
		if (!companyId) {
			const headerCompanyId = request.headers.get("x-company-id") || undefined;
			companyId = headerCompanyId;
		}

		// Check request body (for POST/PUT requests)
		if (!companyId && (request.method === "POST" || request.method === "PUT")) {
            try {
                const body = (await request.clone().json().catch(() => ({}))) as { companyId?: string };
                companyId = body.companyId;
            } catch {
                // Ignore JSON parse errors
            }
		}

		if (!companyId) {
			return new Response(
				JSON.stringify(
					errorResponse("BAD_REQUEST", "Company ID is required"),
				),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Validate company access
		const validation = await companyContextManager.validateCompanyAccess(
			companyId,
			tenantId,
		);

		if (!validation.allowed) {
			return new Response(
				JSON.stringify(
					errorResponse("FORBIDDEN", validation.reason || "Company access denied"),
				),
				{
					status: 403,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Get company context
		const companyContext = await companyContextManager.getCompanyById(
			companyId,
			tenantId,
		);

		if (!companyContext) {
			return new Response(
				JSON.stringify(
					errorResponse("NOT_FOUND", "Company not found"),
				),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Get tenant context (should already be set by requireTenantContext)
		const tenantContext: TenantContext = {
			tenantId,
			tenantStatus: "active", // Will be properly set by requireTenantContext
		};

		// Attach contexts to request
		(request as CompanyScopedRequest).companyContext = companyContext;
		(request as CompanyScopedRequest).tenantContext = tenantContext;

		return handler(
			request as CompanyScopedRequest,
			url,
			params,
			auth,
			tenantContext,
			companyContext,
		);
	};
}
```

---

## 5. Database Queries

### 5.1 Company Queries

```14:230:crm-monorepo/apps/api-server/src/db/queries/companies.ts
export const companyQueries = {
	async findAll(
		pagination: PaginationParams,
		filters: FilterParams,
	): Promise<{ data: Company[]; total: number }> {
		const { page = 1, pageSize = 20 } = pagination;

		// Sanitizuj paginaciju
		const safePage = Math.max(1, Math.floor(page));
		const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
		const safeOffset = (safePage - 1) * safePageSize;

		// Gradi uslove sa query builder-om
		const qb = createQueryBuilder("companies");
		qb.addSearchCondition(
			["name", "industry", "city", "country"],
			filters.search,
		);

		// Scope to tenant if provided
		if (filters.tenantId) {
			qb.addUuidCondition("tenant_id", String(filters.tenantId));
		}

		// Show only customer companies unless overridden by explicit source filter
		if (filters.source) {
			qb.addEqualCondition("source", String(filters.source));
		} else {
			qb.addEqualCondition("source", "customer");
		}

		const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

		// Izvršavaj count
		const countQuery = `SELECT COUNT(*) FROM companies ${whereClause}`;
		const countResult = await db.unsafe(
			countQuery,
			whereValues as QueryParam[],
		);
		const total = parseInt(countResult[0].count, 10);

		// Sanitizuj sortiranje
		const sortBy = sanitizeSortColumn("companies", pagination.sortBy);
		const sortOrder = sanitizeSortOrder(pagination.sortOrder);

		// Izvršavaj select - dodaj pagination parametre na kraj
		const selectQuery = `
      SELECT * FROM companies 
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
    `;

		const data = await db.unsafe(selectQuery, [
			...whereValues,
			safePageSize,
			safeOffset,
		] as QueryParam[]);

		return { data: data.map(mapCompany), total };
	},
```

**Ključne karakteristike:**
- Automatski filtrira po `source = 'customer'` ako nije eksplicitno navedeno
- Podržava paginaciju i sortiranje
- Full-text search preko query builder-a

### 5.2 Contact Queries

```122:208:crm-monorepo/apps/api-server/src/db/queries/index.ts
export const contactQueries = {
	async findAll(
		pagination: PaginationParams,
		filters: FilterParams,
	): Promise<{ data: Contact[]; total: number }> {
		const { page = 1, pageSize = 20 } = pagination;

		const safePage = Math.max(1, Math.floor(page));
		const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
		const safeOffset = (safePage - 1) * safePageSize;

		const qb = createQueryBuilder("contacts");
		qb.addSearchCondition(["first_name", "last_name", "email"], filters.search);

		const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

		const countQuery = `SELECT COUNT(*) FROM contacts ${whereClause}`;
		const countResult = await db.unsafe(
			countQuery,
			whereValues as QueryParam[],
		);
		const total = parseInt(countResult[0].count, 10);

		const sortBy = sanitizeSortColumn("contacts", pagination.sortBy);
		const sortOrder = sanitizeSortOrder(pagination.sortOrder);

		const selectQuery = `
      SELECT * FROM contacts
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
    `;

		const data = await db.unsafe(selectQuery, [
			...whereValues,
			safePageSize,
			safeOffset,
		] as QueryParam[]);

		return { data: data.map(mapContact), total };
	},

	async findById(id: string): Promise<Contact | null> {
		const result = await db`SELECT * FROM contacts WHERE id = ${id}`;
		return result.length > 0 ? mapContact(result[0]) : null;
	},

	async create(contact: Contact): Promise<Contact> {
		const result = await db`
      INSERT INTO contacts (
        id, first_name, last_name, email, phone, company, position,
        street, city, state, postal_code, country, notes, lead_id,
        created_at, updated_at
      ) VALUES (
        ${contact.id}, ${contact.firstName}, ${contact.lastName}, ${contact.email},
        ${contact.phone || null}, ${contact.company || null}, ${contact.position || null},
        ${contact.address?.street || null}, ${contact.address?.city || null},
        ${contact.address?.state || null}, ${contact.address?.postalCode || null},
        ${contact.address?.country || null}, ${contact.notes || null},
        ${contact.leadId || null}, ${contact.createdAt}, ${contact.updatedAt}
      )
      RETURNING *
    `;
		return mapContact(result[0]);
	},

	async update(id: string, data: Partial<Contact>): Promise<Contact> {
		const result = await db`
      UPDATE contacts SET
        first_name = COALESCE(${data.firstName ?? null}, first_name),
        last_name = COALESCE(${data.lastName ?? null}, last_name),
        email = COALESCE(${data.email ?? null}, email),
        phone = COALESCE(${data.phone ?? null}, phone),
        company = COALESCE(${data.company ?? null}, company),
        position = COALESCE(${data.position ?? null}, position),
        notes = COALESCE(${data.notes ?? null}, notes),
        updated_at = ${data.updatedAt ?? new Date().toISOString()}
      WHERE id = ${id}
      RETURNING *
    `;
		return mapContact(result[0]);
	},

	async delete(id: string): Promise<void> {
		await db`DELETE FROM contacts WHERE id = ${id}`;
	},
};
```

**Napomena:** Ove queries **ne filtriraju automatski po tenantId ili companyId**. To se mora uraditi na nivou API ruta ili servisa.

---

## 6. Frontend Integracija

### 6.1 Next.js API Routes

Frontend koristi Next.js API routes kao proxy ka backend API-ju:

```1:28:crm-monorepo/apps/web/src/app/api/crm/companies/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:3001";

export async function GET(request: NextRequest) {
	const token = request.cookies.get("access_token")?.value;

	if (!token) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const response = await fetch(`${API_URL}/api/crm/companies`, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		const data = await response.json();
		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to fetch companies" },
			{ status: 500 },
		);
	}
}
```

### 6.2 Company-scoped Contacts Route

```1:35:crm-monorepo/apps/web/src/app/api/crm/companies/[companyId]/contacts/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:3001";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ companyId: string }> },
) {
    const { companyId } = await context.params;
	const token = request.cookies.get("access_token")?.value;

	if (!token) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
        const response = await fetch(
            `${API_URL}/api/crm/companies/${companyId}/contacts`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        );

		const data = await response.json();
		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to fetch contacts" },
			{ status: 500 },
		);
	}
}
```

---

## 7. Veze sa Drugim Modulima

### 7.1 Invoices (Fakture)
- Svaka faktura ima `companyId` i opciono `contactId`
- Kada se kompanija obriše, fakture se brišu (CASCADE)

### 7.2 Quotes (Ponude)
- Svaka ponuda ima `companyId` i opciono `contactId`
- Kada se kompanija obriše, ponude se brišu (CASCADE)

### 7.3 Orders (Narudžbe)
- Svaka narudžba ima `companyId` i opciono `contactId`
- Kada se kompanija obriše, narudžbe se brišu (CASCADE)

### 7.4 Documents (Dokumenti)
- Dokumenti imaju `companyId` i `tenantId`
- Kada se kompanija obriše, dokumenti se brišu (CASCADE)

### 7.5 Activities (Aktivnosti)
- Aktivnosti imaju `companyId` i `tenantId`
- Kada se kompanija obriše, aktivnosti se brišu (CASCADE)

---

## 8. Ključne Karakteristike i Obrasci

### 8.1 Multi-Tenant Izolacija
- **Tenant Level**: Sve kompanije pripadaju tenantu
- **Company Level**: Kontakti, dokumenti i aktivnosti pripadaju kompaniji
- **Cascade Delete**: Brisanje kompanije briše sve povezane podatke

### 8.2 Company Source
- `source = 'account'` - Sistemske kompanije (npr. kompanija korisnika)
- `source = 'customer'` - Klijenti (default za CRM kompanije)

### 8.3 Company Context
- Middleware `requireCompanyContext` validira pristup kompaniji
- Company ID se može proslediti kroz:
  - URL parametre (`:companyId` ili `:id`)
  - Query parametre (`?companyId=...`)
  - Header (`X-Company-Id`)
  - Request body (`{ companyId: ... }`)

### 8.4 Full-Text Search
- Companies tabela ima `fts` (full-text search) indeks
- Omogućava brzu pretragu po nazivu, kontaktu, telefonu, emailu, adresi, itd.

---

## 9. Potencijalni Problemi i Preporuke

### 9.1 Identifikovani Problemi

1. **Dva različita pristupa CRM modulu:**
   - `/api/v1/leads` i `/api/v1/contacts` - bez tenant/company context-a
   - `/api/crm/companies` i `/api/crm/companies/:companyId/contacts` - sa context-om
   - **Preporuka**: Unifikovati pristup i koristiti samo company-scoped rute

2. **Contact queries ne filtriraju po tenantId/companyId:**
   - `contactQueries.findAll()` ne filtrira automatski po tenantu ili kompaniji
   - **Preporuka**: Dodati automatsko filtriranje ili koristiti query helpers

3. **Company queries filtriraju po source:**
   - Automatski filtrira po `source = 'customer'` ako nije eksplicitno navedeno
   - **Preporuka**: Dokumentovati ovo ponašanje ili omogućiti eksplicitno filtriranje svih kompanija

### 9.2 Preporuke za Poboljšanja

1. **Unifikovati API pristup:**
   - Koristiti samo `/api/crm/companies` i `/api/crm/companies/:companyId/contacts`
   - Deprecirati `/api/v1/leads` i `/api/v1/contacts`

2. **Dodati automatsko filtriranje u queries:**
   - `contactQueries.findAll()` treba da prima `tenantId` i `companyId` parametre
   - Automatski dodavati WHERE uslove za izolaciju podataka

3. **Dodati validaciju:**
   - Proveriti da li `companyId` u contact queries pripada tenantu
   - Dodati validaciju pre kreiranja kontakta

4. **Poboljšati dokumentaciju:**
   - Dokumentovati razliku između `source = 'account'` i `source = 'customer'`
   - Objasniti kada koristiti koji pristup

---

## 10. Zaključak

CRM modul za kompanije i osobe koristi **multi-tenant arhitekturu** sa **company-scoped** pristupom. Sistem je dobro organizovan sa jasnom hijerarhijom:

- **Tenant** → **Company** → **Contact**

Ključne karakteristike:
- ✅ Multi-tenant izolacija podr
