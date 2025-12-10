/**
 * Seed Tenant Data Script
 *
 * Seeds Cloud Native d.o.o. and Softergee d.o.o. tenants with:
 * - 3 admin users per tenant (dario, miha, tara)
 * - 25 customer organizations
 * - 25 contacts
 * - 25 customer companies
 * - 25 quotes, invoices, orders, delivery notes
 * - 25 projects, milestones, tasks
 * - 25 payments, notifications
 */

import type {
  Contact,
  DeliveryNote,
  Invoice,
  Milestone,
  NotificationType,
  Order,
  Payment,
  Project,
  Quote,
  Task,
} from "@crm/types";
import { generateUUID, now } from "@crm/utils";
import { logger } from "../lib/logger";
import { sql as db } from "./client";
import {
  contactQueries,
  deliveryNoteQueries,
  invoiceQueries,
  milestoneQueries,
  orderQueries,
  projectQueries,
  quoteQueries,
  taskQueries,
} from "./queries";
import { authQueries } from "./queries/auth";
import { notificationQueries } from "./queries/notifications";
import { paymentQueries } from "./queries/payments";
import { productCategoryQueries, productQueries } from "./queries/products";

// ============================================
// Configuration
// ============================================

const DEFAULT_PASSWORD = "changeme123";

const ADMIN_USERS = [
  { email: "dario@crm.local", firstName: "Dario", lastName: "Ristic" },
  { email: "miha@crm.local", firstName: "Miha", lastName: "Erzen" },
  { email: "tara@crm.local", firstName: "Tara", lastName: "Lahovec" },
];

const TENANT_CONFIGS = [
  {
    name: "Cloud Native d.o.o.",
    slug: "cloudnative",
    sellerCompany: {
      name: "Cloud Native d.o.o.",
      industry: "Technology",
      address: "Bulevar Mihajla Pupina 10",
      city: "Beograd",
      country: "Serbia",
      countryCode: "RS",
      zip: "11000",
      email: "info@cloudnative.rs",
      phone: "+381 11 123 4567",
      vatNumber: "123456789",
      companyNumber: "12345678",
    },
  },
  {
    name: "Softergee d.o.o.",
    slug: "softergee",
    sellerCompany: {
      name: "Softergee d.o.o.",
      industry: "Technology",
      address: "Knez Mihailova 35",
      city: "Beograd",
      country: "Serbia",
      countryCode: "RS",
      zip: "11000",
      email: "info@softergee.rs",
      phone: "+381 11 987 6543",
      vatNumber: "987654321",
      companyNumber: "87654321",
    },
  },
];

// ============================================
// Serbian Customer Companies (25)
// ============================================

const SERBIAN_CUSTOMER_COMPANIES = [
  { name: "NIS a.d.", industry: "Energy", city: "Novi Sad", address: "Narodnog fronta 12" },
  {
    name: "Telekom Srbija",
    industry: "Telecommunications",
    city: "Beograd",
    address: "Takovska 2",
  },
  { name: "Delta Holding", industry: "Retail", city: "Beograd", address: "Milentija Popovica 7b" },
  {
    name: "MK Group",
    industry: "Agriculture",
    city: "Beograd",
    address: "Bulevar Mihajla Pupina 115",
  },
  { name: "Hemofarm", industry: "Pharmaceuticals", city: "Vrsac", address: "Beogradski put bb" },
  { name: "Gorenje", industry: "Manufacturing", city: "Zajecar", address: "Industrijska zona" },
  {
    name: "Telenor Srbija",
    industry: "Telecommunications",
    city: "Beograd",
    address: "Omladinskih brigada 90",
  },
  {
    name: "Imlek",
    industry: "Food & Beverage",
    city: "Beograd",
    address: "Industrijsko naselje bb",
  },
  { name: "Sunoko", industry: "Food & Beverage", city: "Novi Sad", address: "Trg Republike 5" },
  { name: "Bambi", industry: "Food & Beverage", city: "Pozarevac", address: "Djure Djakovica 2" },
  { name: "Carnex", industry: "Food & Beverage", city: "Vrbas", address: "Josifa Marinkovica 1" },
  { name: "Komercijalna Banka", industry: "Finance", city: "Beograd", address: "Svetog Save 14" },
  { name: "AIK Banka", industry: "Finance", city: "Nis", address: "Nikole Pasica 42" },
  {
    name: "Victoria Group",
    industry: "Agriculture",
    city: "Novi Sad",
    address: "Kej oslobodjenja 30",
  },
  {
    name: "Metalac",
    industry: "Manufacturing",
    city: "Gornji Milanovac",
    address: "Kneza Aleksandra 212",
  },
  {
    name: "Dijamant",
    industry: "Food & Beverage",
    city: "Zrenjanin",
    address: "Temisvarki drum 14",
  },
  { name: "Tarkett", industry: "Manufacturing", city: "Backa Palanka", address: "Industrijska 2" },
  { name: "Tigar Tyres", industry: "Manufacturing", city: "Pirot", address: "Nikole Pasica 213" },
  { name: "Frikom", industry: "Food & Beverage", city: "Beograd", address: "Zrenjaninski put 58" },
  {
    name: "Knjaz Milos",
    industry: "Food & Beverage",
    city: "Arandjelovac",
    address: "Ilije Garašanina 7",
  },
  { name: "Jaffa", industry: "Food & Beverage", city: "Crvenka", address: "Marsal Tito 245" },
  { name: "Stark", industry: "Food & Beverage", city: "Beograd", address: "Vojvode Stepe 297" },
  { name: "Nectar", industry: "Food & Beverage", city: "Backa Palanka", address: "Industrijska 4" },
  {
    name: "Vino Zupa",
    industry: "Food & Beverage",
    city: "Aleksandrovac",
    address: "Kruševačka bb",
  },
  { name: "Swisslion", industry: "Food & Beverage", city: "Novi Sad", address: "Primorska 84" },
];

// ============================================
// Serbian Names for Contacts
// ============================================

const SERBIAN_FIRST_NAMES = [
  "Marko",
  "Nikola",
  "Stefan",
  "Aleksandar",
  "Milos",
  "Luka",
  "Petar",
  "Vuk",
  "Ana",
  "Maja",
  "Jovana",
  "Milica",
  "Sara",
  "Tamara",
  "Jelena",
  "Katarina",
  "Dragan",
  "Zoran",
  "Nebojsa",
  "Vladimir",
  "Branislav",
  "Miroslav",
  "Dejan",
  "Ivan",
  "Marija",
  "Dragana",
  "Zorica",
  "Snezana",
  "Biljana",
  "Vesna",
  "Ljiljana",
  "Gordana",
];

const SERBIAN_LAST_NAMES = [
  "Petrovic",
  "Jovanovic",
  "Nikolic",
  "Markovic",
  "Djordjevic",
  "Stojanovic",
  "Ilic",
  "Stankovic",
  "Pavlovic",
  "Milosevic",
  "Todorovic",
  "Novakovic",
  "Kovacevic",
  "Ristic",
  "Savic",
  "Popovic",
  "Kostic",
  "Stefanovic",
  "Mitrovic",
  "Jankovic",
  "Lazic",
  "Simic",
  "Vukovic",
  "Blagojevic",
];

const POSITIONS = [
  "Direktor",
  "Finansijski direktor",
  "Komercijalni direktor",
  "IT menadzer",
  "Nabavka menadzer",
  "Prodaja menadzer",
  "Marketing menadzer",
  "HR menadzer",
  "Glavni knjigovodja",
  "Pravni savetnik",
  "Tehnicski direktor",
  "Operativni direktor",
];

// ============================================
// Product Data
// ============================================

const PRODUCT_CATEGORIES = [
  { name: "Softver", description: "Softverska resenja i licence" },
  { name: "Usluge", description: "Profesionalne usluge i konsalting" },
  { name: "Hardver", description: "Racunarska oprema" },
  { name: "Podrska", description: "Tehnicka podrska i odrzavanje" },
  { name: "Obuka", description: "Edukacija i treninzi" },
];

const PRODUCTS = [
  { name: "Enterprise License", price: 50000, category: "Softver" },
  { name: "Professional License", price: 25000, category: "Softver" },
  { name: "Basic License", price: 10000, category: "Softver" },
  { name: "Konsalting - 1 dan", price: 1500, category: "Usluge" },
  { name: "Konsalting - 5 dana", price: 6500, category: "Usluge" },
  { name: "Implementacija - Mali projekat", price: 15000, category: "Usluge" },
  { name: "Implementacija - Srednji projekat", price: 35000, category: "Usluge" },
  { name: "Implementacija - Veliki projekat", price: 75000, category: "Usluge" },
  { name: "Server - Basic", price: 25000, category: "Hardver" },
  { name: "Server - Enterprise", price: 75000, category: "Hardver" },
  { name: "Laptop - Business", price: 1500, category: "Hardver" },
  { name: "Monitor - 27 inch", price: 500, category: "Hardver" },
  { name: "Podrska - Mesecna", price: 2000, category: "Podrska" },
  { name: "Podrska - Godisnja", price: 20000, category: "Podrska" },
  { name: "SLA Premium", price: 50000, category: "Podrska" },
  { name: "Obuka - Osnovna", price: 3000, category: "Obuka" },
  { name: "Obuka - Napredna", price: 6000, category: "Obuka" },
  { name: "Obuka - Admin", price: 4500, category: "Obuka" },
  { name: "Workshop - 1 dan", price: 2500, category: "Obuka" },
  { name: "Certifikacija", price: 5000, category: "Obuka" },
  { name: "Cloud Hosting - Mesecno", price: 500, category: "Usluge" },
  { name: "Cloud Hosting - Godisnje", price: 5000, category: "Usluge" },
  { name: "Backup Service", price: 1000, category: "Podrska" },
  { name: "Security Audit", price: 8000, category: "Usluge" },
  { name: "Custom Development - Sat", price: 150, category: "Usluge" },
];

const PROJECT_NAMES = [
  "CRM Implementacija",
  "ERP Migracija",
  "Cloud Transformacija",
  "Digitalizacija procesa",
  "Web Portal",
  "Mobile App",
  "API Integracija",
  "Data Warehouse",
  "BI Dashboard",
  "Security Assessment",
  "Infrastructure Upgrade",
  "DevOps Setup",
  "Automatizacija",
  "E-commerce platforma",
  "Customer Portal",
  "Partner Portal",
  "HR System",
  "Document Management",
  "Workflow Automation",
  "Analytics Platform",
  "Microservices Migration",
  "Legacy Modernization",
  "Performance Optimization",
  "Disaster Recovery",
  "Compliance Implementation",
];

// ============================================
// Helper Functions
// ============================================

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pastDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

function futureDate(daysAhead: number): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
}

function randomDate(daysAgo: number, daysAhead: number): string {
  const nowTime = Date.now();
  const minTime = nowTime - daysAgo * 24 * 60 * 60 * 1000;
  const maxTime = nowTime + daysAhead * 24 * 60 * 60 * 1000;
  return new Date(randomNumber(minTime, maxTime)).toISOString();
}

// ============================================
// Seeding Functions
// ============================================

async function ensureTenant(config: (typeof TENANT_CONFIGS)[0]): Promise<string> {
  logger.info(`🏢 Ensuring tenant: ${config.name}`);

  const existing = await db`
    SELECT id FROM tenants WHERE slug = ${config.slug} AND deleted_at IS NULL LIMIT 1
  `;

  if (existing.length > 0) {
    logger.info(`  ✅ Tenant "${config.name}" already exists`);
    return existing[0].id as string;
  }

  const [created] = await db`
    INSERT INTO tenants (name, slug, status, metadata, created_at, updated_at)
    VALUES (${config.name}, ${config.slug}, 'active', '{}'::jsonb, ${now()}, ${now()})
    RETURNING id
  `;

  logger.info(`  ✅ Created tenant: ${config.name}`);
  return created.id as string;
}

async function ensureAdminUsers(tenantId: string): Promise<string[]> {
  logger.info(`👥 Ensuring admin users for tenant...`);
  const userIds: string[] = [];
  const passwordHash = await Bun.password.hash(DEFAULT_PASSWORD, { algorithm: "bcrypt", cost: 12 });

  for (const admin of ADMIN_USERS) {
    // Check if user exists
    const existing = await db`SELECT id, tenant_id FROM users WHERE email = ${admin.email}`;

    let userId: string;

    if (existing.length > 0) {
      userId = existing[0].id as string;

      // Update user to be part of this tenant if not already
      if (existing[0].tenant_id !== tenantId) {
        await db`UPDATE users SET tenant_id = ${tenantId}, role = 'tenant_admin', updated_at = ${now()} WHERE id = ${userId}`;
        logger.info(`  ✅ Updated user ${admin.email} to tenant`);
      } else {
        logger.info(`  ⏭️  User ${admin.email} already in tenant`);
      }
    } else {
      // Create new user
      const [created] = await db`
        INSERT INTO users (id, first_name, last_name, email, role, tenant_id, status, created_at, updated_at)
        VALUES (${generateUUID()}, ${admin.firstName}, ${admin.lastName}, ${admin.email}, 'tenant_admin', ${tenantId}, 'active', ${now()}, ${now()})
        RETURNING id
      `;
      userId = created.id as string;
      logger.info(`  ✅ Created user: ${admin.email}`);
    }

    userIds.push(userId);

    // Ensure auth credentials
    const credExists = await authQueries.credentialsExist(userId);
    if (!credExists) {
      await authQueries.createCredentials(userId, passwordHash);
      logger.info(`  ✅ Created credentials for: ${admin.email}`);
    }

    // Ensure user_tenant_roles
    const roleExists = await db`
      SELECT 1 FROM user_tenant_roles WHERE user_id = ${userId} AND tenant_id = ${tenantId}
    `;
    if (roleExists.length === 0) {
      await db`
        INSERT INTO user_tenant_roles (id, user_id, tenant_id, role, created_at, updated_at)
        VALUES (${generateUUID()}, ${userId}, ${tenantId}, 'admin', ${now()}, ${now()})
      `;
      logger.info(`  ✅ Added user_tenant_role for: ${admin.email}`);
    }
  }

  return userIds;
}

async function ensureSellerCompany(
  tenantId: string,
  config: (typeof TENANT_CONFIGS)[0],
  _userIds: string[]
): Promise<string> {
  logger.info(`🏭 Ensuring tenant account: ${config.sellerCompany.name}`);

  // Seller companies are stored in tenant_accounts table
  const existing = await db`
    SELECT id FROM tenant_accounts WHERE tenant_id = ${tenantId}
  `;

  let accountId: string;

  if (existing.length > 0) {
    accountId = existing[0].id as string;
    logger.info(`  ⏭️  Tenant account already exists`);
  } else {
    const c = config.sellerCompany;
    const [created] = await db`
      INSERT INTO tenant_accounts (
        id, tenant_id, name, industry, address, city, country, country_code, zip,
        email, phone, vat_number, company_number, created_at, updated_at
      ) VALUES (
        ${generateUUID()}, ${tenantId}, ${c.name}, ${c.industry}, ${c.address}, ${c.city},
        ${c.country}, ${c.countryCode}, ${c.zip}, ${c.email}, ${c.phone}, ${c.vatNumber},
        ${c.companyNumber}, ${now()}, ${now()}
      )
      RETURNING id
    `;
    accountId = created.id as string;
    logger.info(`  ✅ Created tenant account: ${c.name}`);
  }

  return accountId;
}

async function seedCustomerCompanies(tenantId: string, count: number): Promise<string[]> {
  logger.info(`📦 Seeding ${count} customer companies...`);
  const companyIds: string[] = [];

  for (let i = 0; i < Math.min(count, SERBIAN_CUSTOMER_COMPANIES.length); i++) {
    const c = SERBIAN_CUSTOMER_COMPANIES[i];

    // Check if company already exists for this tenant
    const existing = await db`
      SELECT id FROM companies WHERE tenant_id = ${tenantId} AND name = ${c.name}
    `;

    if (existing.length > 0) {
      companyIds.push(existing[0].id as string);
      continue;
    }

    const [created] = await db`
      INSERT INTO companies (
        id, tenant_id, name, industry, address, city, country, country_code,
        source, company_type, created_at, updated_at
      ) VALUES (
        ${generateUUID()}, ${tenantId}, ${c.name}, ${c.industry}, ${c.address}, ${c.city},
        'Serbia', 'RS', 'customer', 'customer', ${pastDate(randomNumber(30, 365))}, ${now()}
      )
      RETURNING id
    `;
    companyIds.push(created.id as string);
    logger.info(`  ✅ Created customer company: ${c.name}`);
  }

  return companyIds;
}

async function seedContacts(count: number, companyIds: string[]): Promise<string[]> {
  logger.info(`👤 Seeding ${count} contacts...`);
  const contactIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const firstName = randomElement(SERBIAN_FIRST_NAMES);
    const lastName = randomElement(SERBIAN_LAST_NAMES);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.rs`;
    const companyId = companyIds[i % companyIds.length];

    // Get company name
    const company = await db`SELECT name FROM companies WHERE id = ${companyId}`;
    const companyName = company.length > 0 ? (company[0].name as string) : undefined;

    const contact: Contact = {
      id: generateUUID(),
      firstName,
      lastName,
      email,
      phone: `+381 ${randomNumber(60, 69)} ${randomNumber(1000000, 9999999)}`,
      company: companyName,
      position: randomElement(POSITIONS),
      createdAt: pastDate(randomNumber(1, 180)),
      updatedAt: now(),
    };

    try {
      await contactQueries.create(contact);
      contactIds.push(contact.id);
    } catch {
      // Contact might already exist
    }
  }

  logger.info(`  ✅ Created ${contactIds.length} contacts`);
  return contactIds;
}

async function seedProductCategories(_tenantId: string): Promise<Map<string, string>> {
  logger.info(`📂 Seeding product categories...`);
  const categoryMap = new Map<string, string>();

  for (const cat of PRODUCT_CATEGORIES) {
    try {
      const created = await productCategoryQueries.create({
        name: cat.name,
        description: cat.description,
        isActive: true,
      });
      categoryMap.set(cat.name, created.id);
      logger.info(`  ✅ Created category: ${cat.name}`);
    } catch {
      // Category might exist
      const existing = await db`SELECT id FROM product_categories WHERE name = ${cat.name} LIMIT 1`;
      if (existing.length > 0) {
        categoryMap.set(cat.name, existing[0].id as string);
      }
    }
  }

  return categoryMap;
}

async function seedProducts(categoryMap: Map<string, string>): Promise<string[]> {
  logger.info(`🛍️  Seeding products...`);
  const productIds: string[] = [];

  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i];
    const categoryId = categoryMap.get(p.category);

    try {
      const created = await productQueries.create({
        sku: `PRD-T-${String(i + 1).padStart(5, "0")}`,
        name: p.name,
        description: `${p.name} - profesionalno resenje`,
        categoryId,
        unitPrice: p.price,
        costPrice: Math.floor(p.price * 0.6),
        currency: "EUR",
        stockQuantity: randomNumber(10, 100),
        minStockLevel: 5,
        unit: "pcs",
        taxRate: 0.2,
        isService: p.category === "Usluge" || p.category === "Obuka",
        isActive: true,
      });
      productIds.push(created.id);
    } catch {
      // Product might exist
    }
  }

  logger.info(`  ✅ Created ${productIds.length} products`);
  return productIds;
}

async function seedQuotes(
  count: number,
  companyIds: string[],
  userIds: string[],
  tenantId: string,
  tenantSlug: string
): Promise<string[]> {
  logger.info(`📝 Seeding ${count} quotes...`);
  const quoteIds: string[] = [];
  const statuses: Quote["status"][] = ["draft", "sent", "accepted", "rejected", "expired"];

  for (let i = 0; i < count; i++) {
    const itemCount = randomNumber(1, 4);
    const items: {
      productName: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      total: number;
    }[] = [];
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const product = randomElement(PRODUCTS);
      const quantity = randomNumber(1, 10);
      const discount = Math.random() > 0.7 ? randomNumber(5, 15) : 0;
      const total = quantity * product.price * (1 - discount / 100);
      subtotal += total;
      items.push({
        productName: product.name,
        description: `${product.name} - kolicina ${quantity}`,
        quantity,
        unitPrice: product.price,
        discount,
        total,
      });
    }

    const tax = subtotal * 0.2;
    const total = subtotal + tax;
    const prefix = tenantSlug === "cloudnative" ? "CN" : "SG";

    const quote: Omit<Quote, "items"> & { sellerCompanyId: string } = {
      id: generateUUID(),
      quoteNumber: `${prefix}-QUO-${String(i + 1).padStart(5, "0")}`,
      companyId: randomElement(companyIds),
      sellerCompanyId: tenantId,
      status: randomElement(statuses),
      issueDate: pastDate(randomNumber(1, 60)),
      validUntil: futureDate(randomNumber(15, 45)),
      subtotal,
      taxRate: 20,
      tax,
      total,
      createdBy: randomElement(userIds),
      createdAt: pastDate(randomNumber(1, 60)),
      updatedAt: now(),
    };

    try {
      const created = await quoteQueries.create(quote, items);
      quoteIds.push(created.id);
    } catch (_e) {
      logger.error({ error: _e }, `Failed to create quote ${quote.quoteNumber}`);
    }
  }

  logger.info(`  ✅ Created ${quoteIds.length} quotes`);
  return quoteIds;
}

async function seedInvoices(
  count: number,
  companyIds: string[],
  userIds: string[],
  tenantId: string,
  tenantSlug: string
): Promise<string[]> {
  logger.info(`💵 Seeding ${count} invoices...`);
  const invoiceIds: string[] = [];
  const statuses: Invoice["status"][] = [
    "draft",
    "sent",
    "paid",
    "partial",
    "overdue",
    "cancelled",
  ];

  for (let i = 0; i < count; i++) {
    const itemCount = randomNumber(1, 4);
    const items: {
      productName: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      total: number;
    }[] = [];
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const product = randomElement(PRODUCTS);
      const quantity = randomNumber(1, 10);
      const discount = Math.random() > 0.7 ? randomNumber(5, 15) : 0;
      const total = quantity * product.price * (1 - discount / 100);
      subtotal += total;
      items.push({
        productName: product.name,
        description: `${product.name}`,
        quantity,
        unitPrice: product.price,
        discount,
        total,
      });
    }

    const tax = subtotal * 0.2;
    const total = subtotal + tax;
    const status = randomElement(statuses);
    let paidAmount = 0;
    if (status === "paid") paidAmount = total;
    else if (status === "partial") paidAmount = total * (randomNumber(20, 80) / 100);

    const prefix = tenantSlug === "cloudnative" ? "CN" : "SG";

    const invoice: Omit<Invoice, "items"> & { sellerCompanyId: string } = {
      id: generateUUID(),
      invoiceNumber: `${prefix}-INV-${String(i + 1).padStart(5, "0")}`,
      companyId: randomElement(companyIds),
      sellerCompanyId: tenantId,
      status,
      issueDate: pastDate(randomNumber(1, 90)),
      dueDate: randomDate(-30, 60),
      subtotal,
      taxRate: 20,
      tax,
      total,
      paidAmount,
      createdBy: randomElement(userIds),
      createdAt: pastDate(randomNumber(1, 90)),
      updatedAt: now(),
    };

    try {
      const created = await invoiceQueries.create(invoice, items);
      invoiceIds.push(created.id);
    } catch (_e) {
      logger.error({ error: _e }, `Failed to create invoice ${invoice.invoiceNumber}`);
    }
  }

  logger.info(`  ✅ Created ${invoiceIds.length} invoices`);
  return invoiceIds;
}

async function seedOrders(
  count: number,
  companyIds: string[],
  userIds: string[],
  tenantId: string,
  tenantSlug: string
): Promise<string[]> {
  logger.info(`🛒 Seeding ${count} orders...`);
  const orderIds: string[] = [];
  const statuses: Order["status"][] = [
    "pending",
    "processing",
    "completed",
    "cancelled",
    "refunded",
  ];

  for (let i = 0; i < count; i++) {
    const itemCount = randomNumber(1, 4);
    const items: {
      productName: string;
      description: string | null;
      quantity: number;
      unitPrice: number;
      discount?: number;
      total: number;
    }[] = [];
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const product = randomElement(PRODUCTS);
      const quantity = randomNumber(1, 10);
      const discount = Math.random() > 0.7 ? randomNumber(5, 15) : 0;
      const total = quantity * product.price * (1 - discount / 100);
      subtotal += total;
      items.push({
        productName: product.name,
        description: `${product.name}`,
        quantity,
        unitPrice: product.price,
        discount,
        total,
      });
    }

    const tax = subtotal * 0.2;
    const total = subtotal + tax;
    const prefix = tenantSlug === "cloudnative" ? "CN" : "SG";

    const order: Omit<Order, "items"> & { sellerCompanyId: string } = {
      id: generateUUID(),
      orderNumber: `${prefix}-ORD-${String(i + 1).padStart(5, "0")}`,
      companyId: randomElement(companyIds),
      sellerCompanyId: tenantId,
      status: randomElement(statuses),
      subtotal,
      tax,
      total,
      currency: "EUR",
      createdBy: randomElement(userIds),
      createdAt: pastDate(randomNumber(1, 90)),
      updatedAt: now(),
    };

    try {
      const result = await orderQueries.create(order, items);
      if (result.success && result.data) {
        orderIds.push(result.data.id);
      }
    } catch (_e) {
      logger.error({ error: _e }, `Failed to create order ${order.orderNumber}`);
    }
  }

  logger.info(`  ✅ Created ${orderIds.length} orders`);
  return orderIds;
}

async function seedDeliveryNotes(
  count: number,
  companyIds: string[],
  invoiceIds: string[],
  userIds: string[],
  tenantId: string,
  tenantSlug: string
): Promise<void> {
  logger.info(`📦 Seeding ${count} delivery notes...`);
  const statuses: DeliveryNote["status"][] = ["pending", "in_transit", "delivered", "returned"];
  const carriers = ["DHL", "FedEx", "UPS", "Post Express", "City Express"];
  let created = 0;

  for (let i = 0; i < count; i++) {
    const itemCount = randomNumber(1, 3);
    const items: {
      productName: string;
      description: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      discount: number;
    }[] = [];

    for (let j = 0; j < itemCount; j++) {
      const product = randomElement(PRODUCTS);
      items.push({
        productName: product.name,
        description: `Isporuka: ${product.name}`,
        quantity: randomNumber(1, 5),
        unit: "pcs",
        unitPrice: product.price,
        discount: 0,
      });
    }

    const status = randomElement(statuses);
    const prefix = tenantSlug === "cloudnative" ? "CN" : "SG";
    const company = SERBIAN_CUSTOMER_COMPANIES[i % SERBIAN_CUSTOMER_COMPANIES.length];

    const note: Omit<DeliveryNote, "items"> & { sellerCompanyId: string } = {
      id: generateUUID(),
      deliveryNumber: `${prefix}-DEL-${String(i + 1).padStart(5, "0")}`,
      invoiceId: invoiceIds.length > 0 ? invoiceIds[i % invoiceIds.length] : undefined,
      companyId: companyIds[i % companyIds.length],
      sellerCompanyId: tenantId,
      status,
      subtotal: 0,
      taxRate: 0,
      tax: 0,
      total: 0,
      shipDate: status !== "pending" ? pastDate(randomNumber(1, 30)) : undefined,
      deliveryDate: status === "delivered" ? pastDate(randomNumber(1, 14)) : undefined,
      shippingAddress: `${company.address}, ${company.city}`,
      trackingNumber: status !== "pending" ? `TRK${randomNumber(100000000, 999999999)}` : undefined,
      carrier: status !== "pending" ? randomElement(carriers) : undefined,
      createdBy: randomElement(userIds),
      createdAt: pastDate(randomNumber(1, 60)),
      updatedAt: now(),
    };

    try {
      await deliveryNoteQueries.create(note, items);
      created++;
    } catch (e) {
      logger.error({ error: e }, `Failed to create delivery note ${note.deliveryNumber}`);
    }
  }

  logger.info(`  ✅ Created ${created} delivery notes`);
}

async function seedPayments(count: number, invoiceIds: string[], userIds: string[]): Promise<void> {
  logger.info(`💳 Seeding ${count} payments...`);
  const methods: Payment["paymentMethod"][] = ["bank_transfer", "credit_card", "cash", "check"];
  let created = 0;

  for (let i = 0; i < Math.min(count, invoiceIds.length); i++) {
    const payment = {
      invoiceId: invoiceIds[i],
      amount: randomNumber(1000, 50000),
      currency: "EUR",
      paymentMethod: randomElement(methods),
      paymentDate: pastDate(randomNumber(1, 60)),
      reference: `PAY-${randomNumber(100000, 999999)}`,
      transactionId: `TXN${randomNumber(10000000, 99999999)}`,
      notes: `Uplata za fakturu`,
    };

    try {
      await paymentQueries.create(payment, randomElement(userIds));
      created++;
    } catch (_e) {
      // Payment might fail due to constraints
    }
  }

  logger.info(`  ✅ Created ${created} payments`);
}

async function seedProjects(count: number, userIds: string[]): Promise<string[]> {
  logger.info(`📁 Seeding ${count} projects...`);
  const projectIds: string[] = [];
  const statuses: Project["status"][] = [
    "planning",
    "in_progress",
    "on_hold",
    "completed",
    "cancelled",
  ];

  for (let i = 0; i < count; i++) {
    const status = randomElement(statuses);
    const startDaysAgo = randomNumber(1, 180);

    const project: Project = {
      id: generateUUID(),
      name: PROJECT_NAMES[i % PROJECT_NAMES.length],
      description: `Projekat: ${PROJECT_NAMES[i % PROJECT_NAMES.length]}`,
      status,
      startDate: pastDate(startDaysAgo),
      endDate:
        status === "completed"
          ? pastDate(randomNumber(1, startDaysAgo))
          : futureDate(randomNumber(30, 180)),
      budget: randomNumber(10000, 200000),
      currency: "EUR",
      managerId: randomElement(userIds),
      teamMembers: [randomElement(userIds), randomElement(userIds)].filter(
        (v, idx, a) => a.indexOf(v) === idx
      ),
      createdAt: pastDate(startDaysAgo + 10),
      updatedAt: now(),
    };

    try {
      const created = await projectQueries.create(project);
      projectIds.push(created.id);
    } catch (e) {
      logger.error({ error: e }, `Failed to create project ${project.name}`);
    }
  }

  logger.info(`  ✅ Created ${projectIds.length} projects`);
  return projectIds;
}

async function seedMilestones(count: number, projectIds: string[]): Promise<string[]> {
  logger.info(`🎯 Seeding ${count} milestones...`);
  const milestoneIds: string[] = [];
  const statuses: Milestone["status"][] = ["pending", "in_progress", "completed"];
  const names = [
    "Analiza zahteva",
    "Dizajn resenja",
    "Razvoj - Sprint 1",
    "Razvoj - Sprint 2",
    "Testiranje",
    "UAT",
    "Deployment",
    "Go Live",
    "Post-launch podrska",
  ];

  for (let i = 0; i < count; i++) {
    const milestone: Milestone = {
      id: generateUUID(),
      name: `${names[i % names.length]} - M${i + 1}`,
      description: `Milestone ${i + 1} za projekat`,
      projectId: projectIds[i % projectIds.length],
      status: randomElement(statuses),
      dueDate: randomDate(-30, 90),
      order: (i % 5) + 1,
      createdAt: pastDate(randomNumber(30, 180)),
      updatedAt: now(),
    };

    try {
      const created = await milestoneQueries.create(milestone);
      milestoneIds.push(created.id);
    } catch (e) {
      logger.error({ error: e }, `Failed to create milestone ${milestone.name}`);
    }
  }

  logger.info(`  ✅ Created ${milestoneIds.length} milestones`);
  return milestoneIds;
}

async function seedTasks(
  count: number,
  projectIds: string[],
  milestoneIds: string[],
  userIds: string[]
): Promise<void> {
  logger.info(`✅ Seeding ${count} tasks...`);
  const statuses: Task["status"][] = ["todo", "in_progress", "review", "done"];
  const priorities: Task["priority"][] = ["low", "medium", "high", "urgent"];
  const taskTitles = [
    "Kreiranje dokumentacije",
    "Code review",
    "Unit testovi",
    "API integracija",
    "UI dizajn",
    "Database schema",
    "Performance optimizacija",
    "Bug fix",
    "Feature implementation",
    "Deployment setup",
    "Security audit",
    "Data migration",
  ];
  let created = 0;

  for (let i = 0; i < count; i++) {
    const status = randomElement(statuses);
    const estimatedHours = randomNumber(2, 40);

    const task: Task = {
      id: generateUUID(),
      title: `${taskTitles[i % taskTitles.length]} - T${i + 1}`,
      description: `Task ${i + 1}: ${taskTitles[i % taskTitles.length]}`,
      status,
      priority: randomElement(priorities),
      projectId: projectIds[i % projectIds.length],
      milestoneId: milestoneIds.length > 0 ? milestoneIds[i % milestoneIds.length] : undefined,
      assignedTo: Math.random() > 0.2 ? randomElement(userIds) : undefined,
      dueDate: randomDate(-14, 60),
      estimatedHours,
      actualHours:
        status === "done"
          ? randomNumber(Math.floor(estimatedHours * 0.8), Math.floor(estimatedHours * 1.5))
          : undefined,
      createdAt: pastDate(randomNumber(1, 90)),
      updatedAt: now(),
    };

    try {
      await taskQueries.create(task);
      created++;
    } catch (e) {
      logger.error({ error: e }, `Failed to create task ${task.title}`);
    }
  }

  logger.info(`  ✅ Created ${created} tasks`);
}

async function seedNotifications(count: number, userIds: string[]): Promise<void> {
  logger.info(`🔔 Seeding ${count} notifications...`);
  const types: NotificationType[] = [
    "invoice_created",
    "invoice_paid",
    "invoice_overdue",
    "quote_created",
    "quote_accepted",
    "project_created",
    "task_assigned",
    "task_completed",
    "info",
    "success",
  ];
  let created = 0;

  for (let i = 0; i < count; i++) {
    const type = randomElement(types);
    const notification = {
      userId: randomElement(userIds),
      type,
      channel: randomElement(["in_app", "email", "both"]) as "in_app" | "email" | "both",
      title: `Obavestenje #${i + 1}`,
      message: `Automatski generisano obavestenje tipa: ${type}`,
      link: `/dashboard`,
    };

    try {
      await notificationQueries.create(notification);
      created++;
    } catch (_e) {
      // Notification might fail
    }
  }

  logger.info(`  ✅ Created ${created} notifications`);
}

// ============================================
// Main Function
// ============================================

async function seedTenantData(): Promise<void> {
  logger.info("\n🌱 Starting tenant data seeding...\n");

  for (const config of TENANT_CONFIGS) {
    logger.info(`\n${"═".repeat(50)}`);
    logger.info(`🏢 Processing tenant: ${config.name}`);
    logger.info(`${"═".repeat(50)}\n`);

    try {
      // 1. Ensure tenant exists
      const tenantId = await ensureTenant(config);

      // 2. Ensure admin users
      const userIds = await ensureAdminUsers(tenantId);

      // 3. Ensure seller company
      await ensureSellerCompany(tenantId, config, userIds);

      // 4. Seed customer companies
      const customerCompanyIds = await seedCustomerCompanies(tenantId, 25);

      // 5. Seed contacts
      await seedContacts(25, customerCompanyIds);

      // 6. Seed product categories and products
      const categoryMap = await seedProductCategories(tenantId);
      await seedProducts(categoryMap);

      // 7. Seed quotes
      const _quoteIds = await seedQuotes(25, customerCompanyIds, userIds, tenantId, config.slug);

      // 8. Seed invoices
      const invoiceIds = await seedInvoices(25, customerCompanyIds, userIds, tenantId, config.slug);

      // 9. Seed orders
      await seedOrders(25, customerCompanyIds, userIds, tenantId, config.slug);

      // 10. Seed delivery notes
      await seedDeliveryNotes(25, customerCompanyIds, invoiceIds, userIds, tenantId, config.slug);

      // 11. Seed payments
      await seedPayments(25, invoiceIds, userIds);

      // 12. Seed projects
      const projectIds = await seedProjects(25, userIds);

      // 13. Seed milestones
      const milestoneIds = await seedMilestones(25, projectIds);

      // 14. Seed tasks
      await seedTasks(25, projectIds, milestoneIds, userIds);

      // 15. Seed notifications
      await seedNotifications(25, userIds);

      logger.info(`\n✅ Completed seeding for: ${config.name}\n`);
    } catch (error) {
      logger.error({ error, tenant: config.name }, `❌ Failed to seed tenant: ${config.name}`);
    }
  }

  logger.info("\n🎉 Tenant data seeding completed!\n");
  logger.info(`ℹ️  Default password for all users: "${DEFAULT_PASSWORD}"\n`);
}

// CLI runner
if (import.meta.main) {
  seedTenantData()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, "Seed tenant data failed");
      process.exit(1);
    });
}

export { seedTenantData };
