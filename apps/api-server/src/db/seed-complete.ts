/**
 * Complete Seed Script - All Modules
 *
 * Seeds Cloud Native d.o.o. and Softergee d.o.o. tenants with FULL data:
 * - Tenants & Tenant Accounts
 * - Admin users (dario, miha, tara)
 * - Customer companies (25 per tenant)
 * - Contacts (50 per tenant)
 * - Leads (25 per tenant)
 * - Deals (25 per tenant)
 * - Products & Categories
 * - Quotes, Invoices, Orders, Delivery Notes (25 each per tenant)
 * - Projects, Milestones, Tasks
 * - Payments
 * - Notifications
 * - Activities
 * - Connected Accounts
 * - Documents
 */

import type {
  Contact,
  Deal,
  DeliveryNote,
  Invoice,
  Lead,
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
  dealQueries,
  deliveryNoteQueries,
  invoiceQueries,
  leadQueries,
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
    prefix: "CN",
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
      website: "https://cloudnative.rs",
    },
  },
  {
    name: "Softergee d.o.o.",
    slug: "softergee",
    prefix: "SG",
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
      website: "https://softergee.rs",
    },
  },
];

// ============================================
// Serbian Customer Companies (25)
// ============================================

const SERBIAN_CUSTOMER_COMPANIES = [
  {
    name: "NIS a.d.",
    industry: "Energy",
    city: "Novi Sad",
    address: "Narodnog fronta 12",
    vatNumber: "100002567",
    companyNumber: "20084388",
  },
  {
    name: "Telekom Srbija",
    industry: "Telecommunications",
    city: "Beograd",
    address: "Takovska 2",
    vatNumber: "100000100",
    companyNumber: "17162543",
  },
  {
    name: "Delta Holding",
    industry: "Retail",
    city: "Beograd",
    address: "Milentija Popovica 7b",
    vatNumber: "100050789",
    companyNumber: "17432044",
  },
  {
    name: "MK Group",
    industry: "Agriculture",
    city: "Beograd",
    address: "Bulevar Mihajla Pupina 115",
    vatNumber: "100078234",
    companyNumber: "20118938",
  },
  {
    name: "Hemofarm",
    industry: "Pharmaceuticals",
    city: "Vrsac",
    address: "Beogradski put bb",
    vatNumber: "100012456",
    companyNumber: "08009651",
  },
  {
    name: "Gorenje",
    industry: "Manufacturing",
    city: "Zajecar",
    address: "Industrijska zona",
    vatNumber: "100034567",
    companyNumber: "17654321",
  },
  {
    name: "Telenor Srbija",
    industry: "Telecommunications",
    city: "Beograd",
    address: "Omladinskih brigada 90",
    vatNumber: "100023789",
    companyNumber: "20147881",
  },
  {
    name: "Imlek",
    industry: "Food & Beverage",
    city: "Beograd",
    address: "Industrijsko naselje bb",
    vatNumber: "100045678",
    companyNumber: "07042779",
  },
  {
    name: "Sunoko",
    industry: "Food & Beverage",
    city: "Novi Sad",
    address: "Trg Republike 5",
    vatNumber: "100056789",
    companyNumber: "08036560",
  },
  {
    name: "Bambi",
    industry: "Food & Beverage",
    city: "Pozarevac",
    address: "Djure Djakovica 2",
    vatNumber: "100067890",
    companyNumber: "07152493",
  },
  {
    name: "Carnex",
    industry: "Food & Beverage",
    city: "Vrbas",
    address: "Josifa Marinkovica 1",
    vatNumber: "100078901",
    companyNumber: "08003343",
  },
  {
    name: "Komercijalna Banka",
    industry: "Finance",
    city: "Beograd",
    address: "Svetog Save 14",
    vatNumber: "100089012",
    companyNumber: "07737068",
  },
  {
    name: "AIK Banka",
    industry: "Finance",
    city: "Nis",
    address: "Nikole Pasica 42",
    vatNumber: "100090123",
    companyNumber: "07705719",
  },
  {
    name: "Victoria Group",
    industry: "Agriculture",
    city: "Novi Sad",
    address: "Kej oslobodjenja 30",
    vatNumber: "100001234",
    companyNumber: "08144630",
  },
  {
    name: "Metalac",
    industry: "Manufacturing",
    city: "Gornji Milanovac",
    address: "Kneza Aleksandra 212",
    vatNumber: "100012345",
    companyNumber: "07167121",
  },
  {
    name: "Dijamant",
    industry: "Food & Beverage",
    city: "Zrenjanin",
    address: "Temisvarki drum 14",
    vatNumber: "100023456",
    companyNumber: "08064474",
  },
  {
    name: "Tarkett",
    industry: "Manufacturing",
    city: "Backa Palanka",
    address: "Industrijska 2",
    vatNumber: "100034568",
    companyNumber: "08047880",
  },
  {
    name: "Tigar Tyres",
    industry: "Manufacturing",
    city: "Pirot",
    address: "Nikole Pasica 213",
    vatNumber: "100045679",
    companyNumber: "07119011",
  },
  {
    name: "Frikom",
    industry: "Food & Beverage",
    city: "Beograd",
    address: "Zrenjaninski put 58",
    vatNumber: "100056780",
    companyNumber: "07034601",
  },
  {
    name: "Knjaz Milos",
    industry: "Food & Beverage",
    city: "Arandjelovac",
    address: "Ilije Garasanina 7",
    vatNumber: "100067891",
    companyNumber: "07103115",
  },
  {
    name: "Jaffa",
    industry: "Food & Beverage",
    city: "Crvenka",
    address: "Marsal Tito 245",
    vatNumber: "100078902",
    companyNumber: "08030510",
  },
  {
    name: "Stark",
    industry: "Food & Beverage",
    city: "Beograd",
    address: "Vojvode Stepe 297",
    vatNumber: "100089013",
    companyNumber: "07035870",
  },
  {
    name: "Nectar",
    industry: "Food & Beverage",
    city: "Backa Palanka",
    address: "Industrijska 4",
    vatNumber: "100090124",
    companyNumber: "08057389",
  },
  {
    name: "Vino Zupa",
    industry: "Food & Beverage",
    city: "Aleksandrovac",
    address: "Krusevacka bb",
    vatNumber: "100001235",
    companyNumber: "07105177",
  },
  {
    name: "Swisslion",
    industry: "Food & Beverage",
    city: "Novi Sad",
    address: "Primorska 84",
    vatNumber: "100012346",
    companyNumber: "08640050",
  },
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
  { name: "Enterprise License", price: 50000, category: "Softver", sku: "SW-ENT" },
  { name: "Professional License", price: 25000, category: "Softver", sku: "SW-PRO" },
  { name: "Basic License", price: 10000, category: "Softver", sku: "SW-BAS" },
  { name: "Konsalting - 1 dan", price: 1500, category: "Usluge", sku: "SVC-C1D" },
  { name: "Konsalting - 5 dana", price: 6500, category: "Usluge", sku: "SVC-C5D" },
  { name: "Implementacija - Mali projekat", price: 15000, category: "Usluge", sku: "SVC-IMP-S" },
  { name: "Implementacija - Srednji projekat", price: 35000, category: "Usluge", sku: "SVC-IMP-M" },
  { name: "Implementacija - Veliki projekat", price: 75000, category: "Usluge", sku: "SVC-IMP-L" },
  { name: "Server - Basic", price: 25000, category: "Hardver", sku: "HW-SRV-B" },
  { name: "Server - Enterprise", price: 75000, category: "Hardver", sku: "HW-SRV-E" },
  { name: "Laptop - Business", price: 1500, category: "Hardver", sku: "HW-LAP-B" },
  { name: "Monitor - 27 inch", price: 500, category: "Hardver", sku: "HW-MON-27" },
  { name: "Podrska - Mesecna", price: 2000, category: "Podrska", sku: "SUP-MON" },
  { name: "Podrska - Godisnja", price: 20000, category: "Podrska", sku: "SUP-ANN" },
  { name: "SLA Premium", price: 50000, category: "Podrska", sku: "SUP-SLA-P" },
  { name: "Obuka - Osnovna", price: 3000, category: "Obuka", sku: "TRN-BAS" },
  { name: "Obuka - Napredna", price: 6000, category: "Obuka", sku: "TRN-ADV" },
  { name: "Obuka - Admin", price: 4500, category: "Obuka", sku: "TRN-ADM" },
  { name: "Workshop - 1 dan", price: 2500, category: "Obuka", sku: "TRN-WS1" },
  { name: "Certifikacija", price: 5000, category: "Obuka", sku: "TRN-CRT" },
  { name: "Cloud Hosting - Mesecno", price: 500, category: "Usluge", sku: "SVC-CLD-M" },
  { name: "Cloud Hosting - Godisnje", price: 5000, category: "Usluge", sku: "SVC-CLD-A" },
  { name: "Backup Service", price: 1000, category: "Podrska", sku: "SUP-BCK" },
  { name: "Security Audit", price: 8000, category: "Usluge", sku: "SVC-SEC" },
  { name: "Custom Development - Sat", price: 150, category: "Usluge", sku: "SVC-DEV-H" },
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

const DEAL_TITLES = [
  "Enterprise CRM Implementation",
  "Cloud Migration Project",
  "Annual Support Contract",
  "Security Audit & Compliance",
  "Data Analytics Platform",
  "Custom Development",
  "Infrastructure Upgrade",
  "Mobile App Development",
  "ERP Integration",
  "Business Intelligence Solution",
  "Disaster Recovery Setup",
  "DevOps Transformation",
  "Legacy System Modernization",
  "E-commerce Platform",
  "API Gateway Implementation",
  "Microservices Architecture",
  "Machine Learning POC",
  "IoT Solution",
  "Customer Portal",
  "Partner Integration",
];

const ACTIVITY_TYPES = ["call", "meeting", "email", "note", "task"];
const ACTIVITY_TITLES = [
  "Telefonski poziv sa klijentom",
  "Sastanak - prezentacija resenja",
  "Email - ponuda poslata",
  "Beleska - zahtevi klijenta",
  "Pregled dokumentacije",
  "Demo prezentacija",
  "Follow-up poziv",
  "Ugovorni pregovori",
  "Tehnicka diskusija",
  "Planirani sastanak",
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

function generatePhone(): string {
  return `+381 ${randomNumber(60, 69)} ${randomNumber(1000000, 9999999)}`;
}

function generateEmail(firstName: string, lastName: string, domain: string): string {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
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
    const existing = await db`SELECT id, tenant_id FROM users WHERE email = ${admin.email}`;

    let userId: string;

    if (existing.length > 0) {
      userId = existing[0].id as string;

      if (existing[0].tenant_id !== tenantId) {
        await db`UPDATE users SET tenant_id = ${tenantId}, role = 'tenant_admin', updated_at = ${now()} WHERE id = ${userId}`;
        logger.info(`  ✅ Updated user ${admin.email} to tenant`);
      } else {
        logger.info(`  ⏭️  User ${admin.email} already in tenant`);
      }
    } else {
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

    // Ensure user_active_tenant
    const activeTenantExists = await db`
      SELECT 1 FROM user_active_tenant WHERE user_id = ${userId}
    `;
    if (activeTenantExists.length === 0) {
      await db`
        INSERT INTO user_active_tenant (user_id, active_tenant_id)
        VALUES (${userId}, ${tenantId})
      `;
    }
  }

  return userIds;
}

async function ensureTenantAccount(
  tenantId: string,
  config: (typeof TENANT_CONFIGS)[0]
): Promise<string> {
  logger.info(`🏭 Ensuring tenant account: ${config.sellerCompany.name}`);

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
        email, phone, website, vat_number, company_number, created_at, updated_at
      ) VALUES (
        ${generateUUID()}, ${tenantId}, ${c.name}, ${c.industry}, ${c.address}, ${c.city},
        ${c.country}, ${c.countryCode}, ${c.zip}, ${c.email}, ${c.phone}, ${c.website},
        ${c.vatNumber}, ${c.companyNumber}, ${now()}, ${now()}
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
        source, company_type, vat_number, company_number, email, phone,
        created_at, updated_at
      ) VALUES (
        ${generateUUID()}, ${tenantId}, ${c.name}, ${c.industry}, ${c.address}, ${c.city},
        'Serbia', 'RS', 'customer', 'customer', ${c.vatNumber}, ${c.companyNumber},
        ${generateEmail("kontakt", c.name.toLowerCase().replace(/\s+/g, ""), "example.rs")},
        ${generatePhone()}, ${pastDate(randomNumber(30, 365))}, ${now()}
      )
      RETURNING id
    `;
    companyIds.push(created.id as string);
  }

  logger.info(`  ✅ Created ${companyIds.length} customer companies`);
  return companyIds;
}

async function seedContacts(
  tenantId: string,
  count: number,
  companyIds: string[]
): Promise<string[]> {
  logger.info(`👤 Seeding ${count} contacts...`);
  const contactIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const firstName = randomElement(SERBIAN_FIRST_NAMES);
    const lastName = randomElement(SERBIAN_LAST_NAMES);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.rs`;
    const companyId = companyIds[i % companyIds.length];

    const company = await db`SELECT name FROM companies WHERE id = ${companyId}`;
    const companyName = company.length > 0 ? (company[0].name as string) : undefined;

    const contact: Contact & { tenantId: string } = {
      id: generateUUID(),
      tenantId,
      firstName,
      lastName,
      email,
      phone: generatePhone(),
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

async function seedLeads(count: number, userIds: string[]): Promise<string[]> {
  logger.info(`🎯 Seeding ${count} leads...`);
  const leadIds: string[] = [];
  const statuses: Lead["status"][] = [
    "new",
    "contacted",
    "qualified",
    "proposal",
    "negotiation",
    "won",
    "lost",
  ];
  const sources: Lead["source"][] = [
    "website",
    "referral",
    "cold_call",
    "email",
    "social_media",
    "advertisement",
    "other",
  ];

  for (let i = 0; i < count; i++) {
    const firstName = randomElement(SERBIAN_FIRST_NAMES);
    const lastName = randomElement(SERBIAN_LAST_NAMES);
    const company = SERBIAN_CUSTOMER_COMPANIES[i % SERBIAN_CUSTOMER_COMPANIES.length];

    const lead: Lead = {
      id: generateUUID(),
      name: `${firstName} ${lastName}`,
      email: generateEmail(firstName, lastName, "lead.rs"),
      phone: generatePhone(),
      company: company.name,
      position: randomElement(POSITIONS),
      status: randomElement(statuses),
      source: randomElement(sources),
      assignedTo: randomElement(userIds),
      value: randomNumber(5000, 100000),
      notes: `Potencijalni klijent iz ${company.industry} industrije.`,
      tags: [company.industry.toLowerCase(), randomElement(["hot", "warm", "cold"])],
      createdAt: pastDate(randomNumber(1, 180)),
      updatedAt: now(),
    };

    try {
      const created = await leadQueries.create(lead);
      leadIds.push(created.id);
    } catch (e) {
      logger.error({ error: e }, `Failed to create lead`);
    }
  }

  logger.info(`  ✅ Created ${leadIds.length} leads`);
  return leadIds;
}

async function seedDeals(
  count: number,
  userIds: string[],
  contactIds: string[],
  leadIds: string[]
): Promise<string[]> {
  logger.info(`💼 Seeding ${count} deals...`);
  const dealIds: string[] = [];
  const stages: Deal["stage"][] = [
    "discovery",
    "proposal",
    "negotiation",
    "contract",
    "closed_won",
    "closed_lost",
  ];
  const priorities: Deal["priority"][] = ["low", "medium", "high", "urgent"];

  for (let i = 0; i < count; i++) {
    const stage = randomElement(stages);
    const value = randomNumber(10000, 200000);

    const deal: Deal = {
      id: generateUUID(),
      title: DEAL_TITLES[i % DEAL_TITLES.length],
      description: `Poslovni proces: ${DEAL_TITLES[i % DEAL_TITLES.length]}`,
      value,
      currency: "EUR",
      stage,
      priority: randomElement(priorities),
      probability:
        stage === "closed_won" ? 100 : stage === "closed_lost" ? 0 : randomNumber(10, 90),
      expectedCloseDate: futureDate(randomNumber(30, 180)),
      actualCloseDate:
        stage === "closed_won" || stage === "closed_lost"
          ? pastDate(randomNumber(1, 30))
          : undefined,
      contactId: contactIds.length > 0 ? contactIds[i % contactIds.length] : undefined,
      leadId: leadIds.length > 0 ? leadIds[i % leadIds.length] : undefined,
      assignedTo: randomElement(userIds),
      tags: ["enterprise", randomElement(["software", "consulting", "support"])],
      createdAt: pastDate(randomNumber(30, 180)),
      updatedAt: now(),
    };

    try {
      const created = await dealQueries.create(deal);
      dealIds.push(created.id);
    } catch (e) {
      logger.error({ error: e }, `Failed to create deal`);
    }
  }

  logger.info(`  ✅ Created ${dealIds.length} deals`);
  return dealIds;
}

async function seedProductCategories(): Promise<Map<string, string>> {
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

    // Check if product already exists
    const existing = await db`SELECT id FROM products WHERE sku = ${p.sku} LIMIT 1`;
    if (existing.length > 0) {
      productIds.push(existing[0].id as string);
      continue;
    }

    try {
      const created = await productQueries.create({
        sku: p.sku,
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
  prefix: string
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
  prefix: string
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
  prefix: string
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
  prefix: string
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

async function seedActivities(
  tenantId: string,
  count: number,
  companyIds: string[],
  userIds: string[],
  dealIds: string[],
  leadIds: string[]
): Promise<void> {
  logger.info(`📋 Seeding ${count} activities...`);
  let created = 0;

  for (let i = 0; i < count; i++) {
    const activityType = randomElement(ACTIVITY_TYPES);
    const title = randomElement(ACTIVITY_TITLES);
    const entityTypes = ["deal", "lead", "company", "contact"];
    const entityType = randomElement(entityTypes);

    let entityId: string;
    if (entityType === "deal" && dealIds.length > 0) {
      entityId = randomElement(dealIds);
    } else if (entityType === "lead" && leadIds.length > 0) {
      entityId = randomElement(leadIds);
    } else {
      entityId = randomElement(companyIds);
    }

    try {
      await db`
        INSERT INTO activities (
          id, tenant_id, company_id, user_id, type, title, description,
          entity_type, entity_id, metadata, created_at, updated_at
        ) VALUES (
          ${generateUUID()}, ${tenantId}, ${randomElement(companyIds)}, ${randomElement(userIds)},
          ${activityType}, ${title}, ${`${title} - automatski generisana aktivnost`},
          ${entityType}, ${entityId}, ${JSON.stringify({ source: "seed" })}::jsonb,
          ${pastDate(randomNumber(1, 90))}, ${now()}
        )
      `;
      created++;
    } catch (e) {
      logger.error({ error: e }, "Failed to create activity");
    }
  }

  logger.info(`  ✅ Created ${created} activities`);
}

async function seedConnectedAccounts(
  count: number,
  companyIds: string[],
  userIds: string[]
): Promise<void> {
  logger.info(`🏦 Seeding ${count} connected accounts...`);
  const bankNames = [
    "Banca Intesa",
    "UniCredit Bank",
    "Raiffeisen Banka",
    "Komercijalna Banka",
    "AIK Banka",
    "OTP Banka",
    "Erste Bank",
  ];
  let created = 0;

  for (let i = 0; i < Math.min(count, companyIds.length); i++) {
    const companyId = companyIds[i];
    const bankName = randomElement(bankNames);

    try {
      await db`
        INSERT INTO connected_accounts (
          id, company_id, account_type, account_name, account_number, bank_name,
          iban, swift, currency, balance, is_active, connected_by, connected_at,
          created_at, updated_at
        ) VALUES (
          ${generateUUID()}, ${companyId}, 'bank', ${`${bankName} - Tekuci racun`},
          ${`265-${randomNumber(1000000000, 9999999999)}-${randomNumber(10, 99)}`},
          ${bankName},
          ${`RS35${randomNumber(100, 999)}00${randomNumber(100000000000000, 999999999999999)}`},
          ${`${bankName.substring(0, 4).toUpperCase()}RSRX`},
          'EUR', ${randomNumber(10000, 500000)}, true, ${randomElement(userIds)}, ${pastDate(randomNumber(30, 365))},
          ${now()}, ${now()}
        )
      `;
      created++;
    } catch (e) {
      logger.error({ error: e }, "Failed to create connected account");
    }
  }

  logger.info(`  ✅ Created ${created} connected accounts`);
}

async function seedDocuments(
  tenantId: string,
  count: number,
  companyIds: string[],
  userIds: string[]
): Promise<void> {
  logger.info(`📄 Seeding ${count} documents...`);
  const documentTypes = [
    { name: "Ugovor", ext: "pdf" },
    { name: "Ponuda", ext: "pdf" },
    { name: "Faktura", ext: "pdf" },
    { name: "Specifikacija", ext: "docx" },
    { name: "Prezentacija", ext: "pptx" },
    { name: "Izvestaj", ext: "xlsx" },
    { name: "Beleska", ext: "txt" },
    { name: "Tehnicka dokumentacija", ext: "pdf" },
  ];
  let created = 0;

  for (let i = 0; i < count; i++) {
    const docType = randomElement(documentTypes);
    const company = SERBIAN_CUSTOMER_COMPANIES[i % SERBIAN_CUSTOMER_COMPANIES.length];
    const companyId = companyIds[i % companyIds.length];
    const documentNumber = `DOC-${String(i + 1).padStart(5, "0")}`;
    const fileName = `${docType.name}_${company.name.replace(/\s+/g, "_")}_${documentNumber}.${docType.ext}`;

    try {
      await db`
        INSERT INTO documents (
          id, tenant_id, company_id, owner_id, name, title, summary,
          path_tokens, metadata, processing_status, created_at, updated_at
        ) VALUES (
          ${generateUUID()}, ${tenantId}, ${companyId}, ${randomElement(userIds)},
          ${fileName}, ${`${docType.name} - ${company.name}`},
          ${`${docType.name} dokument za kompaniju ${company.name}`},
          ${["documents", company.name.replace(/\s+/g, "-").toLowerCase(), fileName]},
          ${JSON.stringify({
            size: randomNumber(10000, 5000000),
            mimetype:
              docType.ext === "pdf"
                ? "application/pdf"
                : docType.ext === "docx"
                  ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  : "application/octet-stream",
            originalName: fileName,
          })}::jsonb,
          'completed', ${pastDate(randomNumber(1, 180))}, ${now()}
        )
      `;
      created++;
    } catch (e) {
      logger.error({ error: e }, "Failed to create document");
    }
  }

  logger.info(`  ✅ Created ${created} documents`);
}

// ============================================
// Main Function
// ============================================

async function seedComplete(): Promise<void> {
  logger.info("\n🌱 Starting COMPLETE data seeding...\n");
  logger.info("This will seed ALL modules with development data.\n");

  // Seed products and categories first (global, not tenant-specific)
  const categoryMap = await seedProductCategories();
  await seedProducts(categoryMap);

  for (const config of TENANT_CONFIGS) {
    logger.info(`\n${"═".repeat(60)}`);
    logger.info(`🏢 Processing tenant: ${config.name}`);
    logger.info(`${"═".repeat(60)}\n`);

    try {
      // 1. Ensure tenant exists
      const tenantId = await ensureTenant(config);

      // 2. Ensure admin users
      const userIds = await ensureAdminUsers(tenantId);

      // 3. Ensure tenant account (seller company)
      await ensureTenantAccount(tenantId, config);

      // 4. Seed customer companies
      const customerCompanyIds = await seedCustomerCompanies(tenantId, 25);

      // 5. Seed contacts
      const contactIds = await seedContacts(tenantId, 50, customerCompanyIds);

      // 6. Seed leads
      const leadIds = await seedLeads(25, userIds);

      // 7. Seed deals
      const dealIds = await seedDeals(25, userIds, contactIds, leadIds);

      // 8. Seed quotes
      await seedQuotes(25, customerCompanyIds, userIds, tenantId, config.prefix);

      // 9. Seed invoices
      const invoiceIds = await seedInvoices(
        25,
        customerCompanyIds,
        userIds,
        tenantId,
        config.prefix
      );

      // 10. Seed orders
      await seedOrders(25, customerCompanyIds, userIds, tenantId, config.prefix);

      // 11. Seed delivery notes
      await seedDeliveryNotes(25, customerCompanyIds, invoiceIds, userIds, tenantId, config.prefix);

      // 12. Seed payments
      await seedPayments(25, invoiceIds, userIds);

      // 13. Seed projects
      const projectIds = await seedProjects(25, userIds);

      // 14. Seed milestones
      const milestoneIds = await seedMilestones(25, projectIds);

      // 15. Seed tasks
      await seedTasks(50, projectIds, milestoneIds, userIds);

      // 16. Seed notifications
      await seedNotifications(30, userIds);

      // 17. Seed activities
      await seedActivities(tenantId, 50, customerCompanyIds, userIds, dealIds, leadIds);

      // 18. Seed connected accounts
      await seedConnectedAccounts(10, customerCompanyIds, userIds);

      // 19. Seed documents
      await seedDocuments(tenantId, 30, customerCompanyIds, userIds);

      logger.info(`\n✅ Completed seeding for: ${config.name}\n`);
    } catch (error) {
      logger.error({ error, tenant: config.name }, `❌ Failed to seed tenant: ${config.name}`);
    }
  }

  logger.info("\n🎉 COMPLETE data seeding finished!\n");
  logger.info(`${"═".repeat(60)}`);
  logger.info(`📊 Summary per tenant:`);
  logger.info(`   - 3 Admin users`);
  logger.info(`   - 25 Customer companies`);
  logger.info(`   - 50 Contacts`);
  logger.info(`   - 25 Leads`);
  logger.info(`   - 25 Deals`);
  logger.info(`   - 25 Products (5 categories)`);
  logger.info(`   - 25 Quotes`);
  logger.info(`   - 25 Invoices`);
  logger.info(`   - 25 Orders`);
  logger.info(`   - 25 Delivery notes`);
  logger.info(`   - 25 Payments`);
  logger.info(`   - 25 Projects`);
  logger.info(`   - 25 Milestones`);
  logger.info(`   - 50 Tasks`);
  logger.info(`   - 30 Notifications`);
  logger.info(`   - 50 Activities`);
  logger.info(`   - 10 Connected accounts`);
  logger.info(`   - 30 Documents`);
  logger.info(`${"═".repeat(60)}`);
  logger.info(`\nℹ️  Default password for all users: "${DEFAULT_PASSWORD}"`);
  logger.info(`\n📧 Test users:`);
  for (const user of ADMIN_USERS) {
    logger.info(`   - ${user.email}`);
  }
  logger.info("");
}

// CLI runner
if (import.meta.main) {
  seedComplete()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, "Complete seed failed");
      process.exit(1);
    });
}

export { seedComplete };
