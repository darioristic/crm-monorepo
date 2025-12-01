import { sql as db } from "../client";

// Enhanced Company type matching midday-main structure
export interface EnhancedCompany {
  id: string;
  name: string;
  email: string | null;
  billingEmail: string | null;
  phone: string | null;
  website: string | null;
  contact: string | null;
  industry: string;
  address: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  countryCode: string | null;
  vatNumber: string | null;
  note: string | null;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  invoiceCount?: number;
  projectCount?: number;
  tags?: { id: string; name: string }[];
}

export interface CompanyTag {
  id: string;
  name: string;
}

export interface GetCompaniesParams {
  cursor?: string | null;
  pageSize?: number;
  q?: string | null;
  sort?: string[] | null;
}

export interface UpsertCompanyParams {
  id?: string;
  name: string;
  email?: string | null;
  billingEmail?: string | null;
  phone?: string | null;
  website?: string | null;
  contact?: string | null;
  industry?: string;
  address?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  countryCode?: string | null;
  vatNumber?: string | null;
  note?: string | null;
  tags?: { id: string; name: string }[];
}

// Get company by ID with related counts and tags
export async function getCompanyById(id: string): Promise<EnhancedCompany | null> {
  const [company] = await db<EnhancedCompany[]>`
    SELECT 
      c.id,
      c.name,
      c.email,
      c.billing_email as "billingEmail",
      c.phone,
      c.website,
      c.contact,
      c.industry,
      c.address,
      c.address_line_1 as "addressLine1",
      c.address_line_2 as "addressLine2",
      c.city,
      c.state,
      c.zip,
      c.country,
      c.country_code as "countryCode",
      c.vat_number as "vatNumber",
      c.note,
      COALESCE(c.token, '') as token,
      c.created_at as "createdAt",
      c.updated_at as "updatedAt",
      COALESCE(
        (SELECT COUNT(*)::int FROM invoices WHERE company_id = c.id),
        0
      ) as "invoiceCount",
      COALESCE(
        (SELECT COUNT(*)::int FROM projects WHERE client_id IN (
          SELECT id FROM contacts WHERE company = c.name
        )),
        0
      ) as "projectCount",
      COALESCE(
        (
          SELECT json_agg(
            json_build_object('id', t.id, 'name', t.name)
          )
          FROM company_tags ct
          JOIN tags t ON t.id = ct.tag_id
          WHERE ct.company_id = c.id
        ),
        '[]'::json
      ) as tags
    FROM companies c
    WHERE c.id = ${id}
  `;

  return company || null;
}

// Get paginated companies with search and sorting
export async function getCompanies(params: GetCompaniesParams): Promise<{
  meta: { cursor: string | null; hasPreviousPage: boolean; hasNextPage: boolean };
  data: EnhancedCompany[];
}> {
  const { cursor, pageSize = 25, q, sort } = params;
  const offset = cursor ? parseInt(cursor, 10) : 0;

  let orderBy = db`c.created_at DESC`;
  if (sort && sort.length === 2) {
    const [column, direction] = sort;
    const dir = direction === "asc" ? db`ASC` : db`DESC`;
    
    switch (column) {
      case "name":
        orderBy = db`c.name ${dir}`;
        break;
      case "created_at":
        orderBy = db`c.created_at ${dir}`;
        break;
      case "email":
        orderBy = db`c.email ${dir}`;
        break;
      case "contact":
        orderBy = db`c.contact ${dir}`;
        break;
    }
  }

  let whereClause = db`1=1`;
  if (q) {
    whereClause = db`(
      c.fts @@ to_tsquery('english', ${q.split(' ').join(' & ')}) 
      OR c.name ILIKE ${'%' + q + '%'}
    )`;
  }

  const data = await db<EnhancedCompany[]>`
    SELECT 
      c.id,
      c.name,
      c.email,
      c.billing_email as "billingEmail",
      c.phone,
      c.website,
      c.contact,
      c.industry,
      c.address,
      c.address_line_1 as "addressLine1",
      c.address_line_2 as "addressLine2",
      c.city,
      c.state,
      c.zip,
      c.country,
      c.country_code as "countryCode",
      c.vat_number as "vatNumber",
      c.note,
      COALESCE(c.token, '') as token,
      c.created_at as "createdAt",
      c.updated_at as "updatedAt",
      COALESCE(
        (SELECT COUNT(*)::int FROM invoices WHERE company_id = c.id),
        0
      ) as "invoiceCount",
      COALESCE(
        (
          SELECT json_agg(
            json_build_object('id', t.id, 'name', t.name)
          )
          FROM company_tags ct
          JOIN tags t ON t.id = ct.tag_id
          WHERE ct.company_id = c.id
        ),
        '[]'::json
      ) as tags
    FROM companies c
    WHERE ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ${pageSize}
    OFFSET ${offset}
  `;

  const nextCursor = data.length === pageSize ? (offset + pageSize).toString() : null;

  return {
    meta: {
      cursor: nextCursor,
      hasPreviousPage: offset > 0,
      hasNextPage: data.length === pageSize,
    },
    data,
  };
}

// Create or update a company
export async function upsertCompany(params: UpsertCompanyParams): Promise<EnhancedCompany> {
  const { id, tags: inputTags, ...rest } = params;
  const isNew = !id;

  // Generate a unique token for new companies
  const token = isNew 
    ? `comp_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`
    : undefined;

  let company: EnhancedCompany;

  if (isNew) {
    const [created] = await db<EnhancedCompany[]>`
      INSERT INTO companies (
        name, email, billing_email, phone, website, contact,
        industry, address, address_line_1, address_line_2,
        city, state, zip, country, country_code, vat_number, note, token
      ) VALUES (
        ${rest.name},
        ${rest.email || null},
        ${rest.billingEmail || null},
        ${rest.phone || null},
        ${rest.website || null},
        ${rest.contact || null},
        ${rest.industry || 'Other'},
        ${rest.address || ''},
        ${rest.addressLine1 || null},
        ${rest.addressLine2 || null},
        ${rest.city || null},
        ${rest.state || null},
        ${rest.zip || null},
        ${rest.country || null},
        ${rest.countryCode || null},
        ${rest.vatNumber || null},
        ${rest.note || null},
        ${token}
      )
      RETURNING 
        id, name, email, 
        billing_email as "billingEmail",
        phone, website, contact, industry, address,
        address_line_1 as "addressLine1",
        address_line_2 as "addressLine2",
        city, state, zip, country,
        country_code as "countryCode",
        vat_number as "vatNumber",
        note, token,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;
    company = created;
  } else {
    const [updated] = await db<EnhancedCompany[]>`
      UPDATE companies SET
        name = ${rest.name},
        email = ${rest.email || null},
        billing_email = ${rest.billingEmail || null},
        phone = ${rest.phone || null},
        website = ${rest.website || null},
        contact = ${rest.contact || null},
        industry = COALESCE(${rest.industry || null}, industry),
        address = COALESCE(${rest.address || null}, address),
        address_line_1 = ${rest.addressLine1 || null},
        address_line_2 = ${rest.addressLine2 || null},
        city = ${rest.city || null},
        state = ${rest.state || null},
        zip = ${rest.zip || null},
        country = ${rest.country || null},
        country_code = ${rest.countryCode || null},
        vat_number = ${rest.vatNumber || null},
        note = ${rest.note || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING 
        id, name, email, 
        billing_email as "billingEmail",
        phone, website, contact, industry, address,
        address_line_1 as "addressLine1",
        address_line_2 as "addressLine2",
        city, state, zip, country,
        country_code as "countryCode",
        vat_number as "vatNumber",
        note, token,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;
    company = updated;
  }

  // Handle tags
  if (inputTags !== undefined) {
    // Get current tags
    const currentTags = await db<{ tagId: string }[]>`
      SELECT tag_id as "tagId" FROM company_tags WHERE company_id = ${company.id}
    `;
    
    const currentTagIds = new Set(currentTags.map(t => t.tagId));
    const inputTagIds = new Set(inputTags.map(t => t.id));

    // Tags to add
    const tagsToAdd = inputTags.filter(t => !currentTagIds.has(t.id));
    // Tags to remove
    const tagIdsToRemove = Array.from(currentTagIds).filter(id => !inputTagIds.has(id));

    // Insert new tags
    for (const tag of tagsToAdd) {
      await db`
        INSERT INTO company_tags (company_id, tag_id)
        VALUES (${company.id}, ${tag.id})
        ON CONFLICT (company_id, tag_id) DO NOTHING
      `;
    }

    // Remove old tags
    if (tagIdsToRemove.length > 0) {
      await db`
        DELETE FROM company_tags 
        WHERE company_id = ${company.id} 
        AND tag_id = ANY(${tagIdsToRemove}::uuid[])
      `;
    }
  }

  // Return complete company data
  return (await getCompanyById(company.id))!;
}

// Delete a company
export async function deleteCompany(id: string): Promise<EnhancedCompany | null> {
  const company = await getCompanyById(id);
  if (!company) return null;

  await db`DELETE FROM companies WHERE id = ${id}`;
  
  return company;
}

// Search companies for autocomplete
export async function searchCompanies(query: string, limit = 10): Promise<EnhancedCompany[]> {
  return db<EnhancedCompany[]>`
    SELECT 
      id, name, email, industry, city, country
    FROM companies
    WHERE name ILIKE ${'%' + query + '%'}
    OR email ILIKE ${'%' + query + '%'}
    ORDER BY name ASC
    LIMIT ${limit}
  `;
}

// Tags CRUD operations
export async function getTags(): Promise<CompanyTag[]> {
  return db<CompanyTag[]>`SELECT id, name FROM tags ORDER BY name ASC`;
}

export async function createTag(name: string): Promise<CompanyTag> {
  const [tag] = await db<CompanyTag[]>`
    INSERT INTO tags (name) VALUES (${name})
    RETURNING id, name
  `;
  return tag;
}

export async function updateTag(id: string, name: string): Promise<CompanyTag> {
  const [tag] = await db<CompanyTag[]>`
    UPDATE tags SET name = ${name}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, name
  `;
  return tag;
}

export async function deleteTag(id: string): Promise<void> {
  await db`DELETE FROM tags WHERE id = ${id}`;
}

