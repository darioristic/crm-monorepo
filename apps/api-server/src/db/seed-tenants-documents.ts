import type { User } from "@crm/types";
import { generateUUID, now } from "@crm/utils";
import { logger } from "../lib/logger";
import { sql as db } from "./client";
import { deliveryNoteQueries, invoiceQueries, orderQueries, quoteQueries } from "./queries";
import { authQueries } from "./queries/auth";
import { companyQueries } from "./queries/companies";
import { userQueries } from "./queries/users";

const DEFAULT_SEED_PASSWORD = "changeme123";

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function _pastDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

function futureDate(daysAhead: number): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
}

const PRODUCT_NAMES = [
  "Consulting Service",
  "Web Development",
  "Mobile App",
  "SEO Audit",
  "Cloud Hosting",
  "Maintenance Plan",
  "API Integration",
  "Security Review",
  "UI/UX Design",
  "Data Migration",
];

async function seedTenantCompanies(): Promise<{ id: string; name: string }[]> {
  logger.info("🏢 Creating 3 Tenant Companies...");
  const tenants = [
    { name: "Tenant Company A", industry: "Technology" },
    { name: "Tenant Company B", industry: "Finance" },
    { name: "Tenant Company C", industry: "Healthcare" },
  ];

  const results: { id: string; name: string }[] = [];

  for (const tenant of tenants) {
    const existing = await companyQueries.findByName(tenant.name);
    if (existing) {
      logger.info(`  ⏭️  Tenant "${tenant.name}" already exists`);
      results.push({ id: existing.id, name: existing.name });
    } else {
      const created = await companyQueries.createWithId({
        id: generateUUID(),
        name: tenant.name,
        industry: tenant.industry,
        address: "123 Tenant St, Tech City",
        createdAt: now(),
        updatedAt: now(),
      });
      logger.info(`  ✅ Created tenant: ${created.name}`);
      results.push({ id: created.id, name: created.name });
    }
  }
  return results;
}

async function seedUsersForTenants(tenants: { id: string; name: string }[]): Promise<User[]> {
  logger.info("👥 Creating Users for Tenants...");
  const users: User[] = [];

  for (const tenant of tenants) {
    const email = `admin@${tenant.name.toLowerCase().replace(/\s+/g, "")}.com`;
    const existing = await userQueries.findByEmail(email);

    if (existing) {
      logger.info(`  ⏭️  User "${email}" already exists`);
      users.push(existing);
    } else {
      const user: User = {
        id: generateUUID(),
        firstName: "Admin",
        lastName: tenant.name.split(" ").pop() || "User",
        email,
        role: "tenant_admin",
        companyId: tenant.id,
        status: "active",
        createdAt: now(),
        updatedAt: now(),
      };
      const created = await userQueries.createWithId(user);
      logger.info(`  ✅ Created user: ${created.email} for ${tenant.name}`);

      // Create auth credentials
      const passwordHash = await Bun.password.hash(DEFAULT_SEED_PASSWORD, {
        algorithm: "bcrypt",
        cost: 12,
      });
      await authQueries.createCredentials(created.id, passwordHash);

      users.push(created);
    }
  }
  return users;
}

async function seedCustomerCompanies(count: number): Promise<string[]> {
  logger.info(`🏢 Creating ${count} Customer Companies...`);
  const ids: string[] = [];

  for (let i = 0; i < count; i++) {
    const name = `Customer Company ${i + 1}`;
    const existing = await companyQueries.findByName(name);
    if (existing) {
      ids.push(existing.id);
    } else {
      const created = await companyQueries.createWithId({
        id: generateUUID(),
        name,
        industry: "Retail",
        address: "456 Customer Ave, Market City",
        createdAt: now(),
        updatedAt: now(),
        source: "customer",
      });
      ids.push(created.id);
    }
  }
  return ids;
}

async function seedDocumentsForTenant(tenantId: string, userId: string, customerIds: string[]) {
  logger.info(`📄 Seeding documents for Tenant ID: ${tenantId}`);

  // Create Quotes
  const quoteIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const items = [
      {
        productName: randomElement(PRODUCT_NAMES),
        description: "Service description",
        quantity: randomNumber(1, 10),
        unitPrice: randomNumber(100, 1000),
        discount: 0,
        total: 0, // calculated by service/query but needed for type
      },
    ].map((item) => ({ ...item, total: item.quantity * item.unitPrice }));

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.2;

    const quote = await quoteQueries.create(
      {
        id: generateUUID(),
        quoteNumber: `QUO-${tenantId.substring(0, 4)}-${i}`,
        companyId: randomElement(customerIds), // Customer
        status: "sent",
        issueDate: now(),
        validUntil: futureDate(30),
        subtotal,
        taxRate: 20,
        tax,
        total: subtotal + tax,
        createdBy: userId,
        createdAt: now(),
        updatedAt: now(),
        // IMPORTANT: We need to manually handle the "seller" aspect if we are seeding directly via queries.
        // The `create` query helper usually doesn't take `sellerCompanyId`.
        // However, the `salesService` uses `sellerCompanyId` to generate `fromDetails`.
        // Since we are using queries directly here, `fromDetails` won't be auto-populated unless we do it.
        // But for the purpose of "list" and "creation" tests, this might be enough.
      },
      items
    );
    quoteIds.push(quote.id);
  }
  logger.info(`  ✅ Created ${quoteIds.length} Quotes`);

  // Create Invoices
  const invoiceIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const items = [
      {
        productName: randomElement(PRODUCT_NAMES),
        description: "Service description",
        quantity: randomNumber(1, 10),
        unitPrice: randomNumber(100, 1000),
        discount: 0,
        total: 0,
      },
    ].map((item) => ({ ...item, total: item.quantity * item.unitPrice }));

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.2;

    const invoice = await invoiceQueries.create(
      {
        id: generateUUID(),
        invoiceNumber: `INV-${tenantId.substring(0, 4)}-${i}`,
        companyId: randomElement(customerIds), // Customer
        status: "sent",
        issueDate: now(),
        dueDate: futureDate(30),
        subtotal,
        taxRate: 20,
        tax,
        total: subtotal + tax,
        paidAmount: 0,
        createdBy: userId,
        createdAt: now(),
        updatedAt: now(),
      },
      items
    );
    invoiceIds.push(invoice.id);
  }
  logger.info(`  ✅ Created ${invoiceIds.length} Invoices`);

  // Create Delivery Notes
  for (let i = 0; i < 3; i++) {
    const items = [
      {
        productName: randomElement(PRODUCT_NAMES),
        description: "Delivery item",
        quantity: randomNumber(1, 5),
        unit: "pcs",
        unitPrice: 100,
        discount: 0,
      },
    ];

    await deliveryNoteQueries.create(
      {
        id: generateUUID(),
        deliveryNumber: `DEL-${tenantId.substring(0, 4)}-${i}`,
        companyId: randomElement(customerIds),
        status: "pending",
        shippingAddress: "123 Shipping Lane",
        subtotal: 0,
        taxRate: 0,
        tax: 0,
        total: 0,
        createdBy: userId,
        createdAt: now(),
        updatedAt: now(),
      },
      items
    );
  }
  logger.info(`  ✅ Created 3 Delivery Notes`);

  // Create Orders
  for (let i = 0; i < 3; i++) {
    const items = [
      {
        productName: randomElement(PRODUCT_NAMES),
        description: "Order item",
        quantity: randomNumber(1, 5),
        unitPrice: 200,
        discount: 0,
        total: 1000,
      },
    ];

    await orderQueries.create(
      {
        companyId: randomElement(customerIds),
        status: "pending",
        subtotal: 1000,
        tax: 200,
        total: 1200,
        currency: "USD",
        createdBy: userId,
      },
      items
    );
  }
  logger.info(`  ✅ Created 3 Orders`);
}

export async function seedTenantsAndDocuments() {
  logger.info("\n🌱 Starting Tenant & Document Seed...\n");

  try {
    const tenants = await seedTenantCompanies();
    const users = await seedUsersForTenants(tenants);
    const customerIds = await seedCustomerCompanies(5);

    for (let i = 0; i < tenants.length; i++) {
      const tenant = tenants[i];
      const user = users[i];
      await seedDocumentsForTenant(tenant.id, user.id, customerIds);
    }

    logger.info("\n✅ Tenant & Document seeding completed!\n");
  } catch (error) {
    logger.error("\n❌ Seed failed:", error);
    throw error;
  }
}

// CLI runner
if (import.meta.main) {
  try {
    await seedTenantsAndDocuments();
    await db.end();
    process.exit(0);
  } catch (error) {
    logger.error("Seed error:", error);
    await db.end();
    process.exit(1);
  }
}
