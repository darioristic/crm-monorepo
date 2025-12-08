import type { DeliveryNote, Invoice, Order, Quote } from "@crm/types";
import { generateUUID, now } from "@crm/utils";
import { logger } from "../lib/logger";
import { sql as db } from "./client";
import { deliveryNoteQueries, invoiceQueries, orderQueries, quoteQueries } from "./queries";

// Helpers
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
  const n = Date.now();
  const minTime = n - daysAgo * 24 * 60 * 60 * 1000;
  const maxTime = n + daysAhead * 24 * 60 * 60 * 1000;
  return new Date(randomNumber(minTime, maxTime)).toISOString();
}

const PRODUCT_NAMES = [
  "Enterprise License",
  "Professional License",
  "Basic License",
  "Premium Support",
  "Training Package",
  "Consulting Hours",
  "Custom Development",
  "Data Migration",
  "System Integration",
  "Security Audit",
  "Performance Optimization",
  "Cloud Hosting",
  "API Access",
  "White Label Solution",
  "Mobile App Add-on",
  "Analytics Module",
  "Reporting Suite",
  "Backup Service",
  "Disaster Recovery",
  "Load Balancing",
];

const CITIES = ["New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", "Phoenix, AZ"];

// Generators
function generateQuotes(
  count: number,
  companyIds: string[],
  userIds: string[]
): {
  quote: Omit<Quote, "items">;
  items: Omit<Quote["items"][0], "id" | "quoteId">[];
}[] {
  const quotes: {
    quote: Omit<Quote, "items">;
    items: Omit<Quote["items"][0], "id" | "quoteId">[];
  }[] = [];
  const statuses: Quote["status"][] = ["draft", "sent", "accepted", "rejected", "expired"];

  for (let i = 0; i < count; i++) {
    // 10 items per document
    const itemCount = 10;
    const items: Omit<Quote["items"][0], "id" | "quoteId">[] = [];
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const quantity = randomNumber(1, 20);
      const unitPrice = randomNumber(100, 10000);
      const discount = Math.random() > 0.7 ? randomNumber(5, 20) : 0;
      const total = quantity * unitPrice * (1 - discount / 100);
      subtotal += total;

      items.push({
        productName: randomElement(PRODUCT_NAMES),
        description: `Service/product description for item ${j + 1}`,
        quantity,
        unitPrice,
        discount,
        total,
      });
    }

    const taxRate = 20;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    quotes.push({
      quote: {
        id: generateUUID(),
        quoteNumber: `QUO-AUTO-${String(i + 1).padStart(5, "0")}-${randomNumber(1000, 9999)}`,
        companyId: randomElement(companyIds),
        status: randomElement(statuses),
        issueDate: pastDate(randomNumber(1, 60)),
        validUntil: futureDate(randomNumber(15, 45)),
        subtotal,
        taxRate,
        tax,
        total,
        notes: `Auto-generated quote ${i + 1}`,
        createdBy: randomElement(userIds),
        createdAt: pastDate(randomNumber(1, 60)),
        updatedAt: now(),
      },
      items,
    });
  }

  return quotes;
}

function generateInvoices(
  count: number,
  companyIds: string[],
  userIds: string[]
): {
  invoice: Omit<Invoice, "items">;
  items: Omit<Invoice["items"][0], "id" | "invoiceId">[];
}[] {
  const invoices: {
    invoice: Omit<Invoice, "items">;
    items: Omit<Invoice["items"][0], "id" | "invoiceId">[];
  }[] = [];
  const statuses: Invoice["status"][] = [
    "draft",
    "sent",
    "paid",
    "partial",
    "overdue",
    "cancelled",
  ];

  for (let i = 0; i < count; i++) {
    const itemCount = 10;
    const items: Omit<Invoice["items"][0], "id" | "invoiceId">[] = [];
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const quantity = randomNumber(1, 20);
      const unitPrice = randomNumber(100, 10000);
      const discount = Math.random() > 0.7 ? randomNumber(5, 20) : 0;
      const total = quantity * unitPrice * (1 - discount / 100);
      subtotal += total;

      items.push({
        productName: randomElement(PRODUCT_NAMES),
        description: `Service/product for invoice item ${j + 1}`,
        quantity,
        unit: "pcs",
        unitPrice,
        discount,
        vatRate: 20,
        total,
      });
    }

    const taxRate = 20;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    const status = randomElement(statuses);

    let paidAmount = 0;
    if (status === "paid") paidAmount = total;
    else if (status === "partial") paidAmount = total * (randomNumber(20, 80) / 100);

    invoices.push({
      invoice: {
        id: generateUUID(),
        invoiceNumber: `INV-AUTO-${String(i + 1).padStart(5, "0")}-${randomNumber(1000, 9999)}`,
        companyId: randomElement(companyIds),
        status,
        issueDate: pastDate(randomNumber(1, 90)),
        dueDate: randomDate(-30, 60),
        grossTotal: subtotal,
        subtotal,
        discount: 0,
        taxRate,
        vatRate: 20,
        tax,
        total,
        paidAmount,
        currency: "EUR",
        notes: `Auto-generated invoice ${i + 1}`,
        createdBy: randomElement(userIds),
        createdAt: pastDate(randomNumber(1, 90)),
        updatedAt: now(),
      },
      items,
    });
  }

  return invoices;
}

function generateOrders(
  count: number,
  companyIds: string[],
  userIds: string[]
): {
  order: Omit<Order, "items">;
  items: Array<{
    productName: string;
    description?: string | null;
    quantity: number;
    unitPrice: number;
    discount?: number;
    total: number;
  }>;
}[] {
  const orders: {
    order: Omit<Order, "items">;
    items: Array<{
      productName: string;
      description?: string | null;
      quantity: number;
      unitPrice: number;
      discount?: number;
      total: number;
    }>;
  }[] = [];
  const statuses: Order["status"][] = [
    "pending",
    "processing",
    "completed",
    "cancelled",
    "refunded",
  ];

  for (let i = 0; i < count; i++) {
    const itemCount = 10;
    const items: Array<{
      productName: string;
      description?: string | null;
      quantity: number;
      unitPrice: number;
      discount?: number;
      total: number;
    }> = [];
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const quantity = randomNumber(1, 20);
      const unitPrice = randomNumber(100, 10000);
      const discount = Math.random() > 0.7 ? randomNumber(5, 20) : 0;
      const total = quantity * unitPrice * (1 - discount / 100);
      subtotal += total;

      items.push({
        productName: randomElement(PRODUCT_NAMES),
        description: `Order item ${j + 1} description`,
        quantity,
        unitPrice,
        discount,
        total,
      });
    }

    const taxRate = 20;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    const status = randomElement(statuses);

    orders.push({
      order: {
        id: generateUUID(),
        orderNumber: `ORD-AUTO-${String(i + 1).padStart(5, "0")}-${randomNumber(1000, 9999)}`,
        companyId: randomElement(companyIds),
        contactId: null,
        quoteId: null,
        invoiceId: null,
        status,
        subtotal,
        tax,
        total,
        currency: "EUR",
        notes: `Auto-generated order ${i + 1}`,
        createdBy: randomElement(userIds),
        createdAt: pastDate(randomNumber(1, 90)),
        updatedAt: now(),
      },
      items,
    });
  }

  return orders;
}

function generateDeliveryNotes(
  count: number,
  companyIds: string[],
  userIds: string[]
): {
  note: Omit<DeliveryNote, "items">;
  items: Omit<DeliveryNote["items"][0], "id" | "deliveryNoteId">[];
}[] {
  const notes: {
    note: Omit<DeliveryNote, "items">;
    items: Omit<DeliveryNote["items"][0], "id" | "deliveryNoteId">[];
  }[] = [];
  const statuses: DeliveryNote["status"][] = ["pending", "in_transit", "delivered", "returned"];
  const carriers = ["FedEx", "UPS", "DHL", "USPS", "Local Courier"];

  for (let i = 0; i < count; i++) {
    const itemCount = 10;
    const items: Omit<DeliveryNote["items"][0], "id" | "deliveryNoteId">[] = [];

    for (let j = 0; j < itemCount; j++) {
      const quantity = randomNumber(1, 10);
      const unitPrice = randomNumber(100, 10000);
      const discount = 0;
      const total = quantity * unitPrice;
      items.push({
        productName: randomElement(PRODUCT_NAMES),
        description: `Delivery item ${j + 1} description`,
        quantity,
        unit: randomElement(["pcs", "set", "box", "pack"]),
        unitPrice,
        discount,
        total,
      });
    }

    const status = randomElement(statuses);
    const dnSubtotal = items.reduce((acc, it) => acc + (it.total ?? it.quantity * it.unitPrice), 0);
    const dnTaxRate = 0;
    const dnTax = dnSubtotal * (dnTaxRate / 100);
    const dnTotal = dnSubtotal + dnTax;

    notes.push({
      note: {
        id: generateUUID(),
        deliveryNumber: `DEL-AUTO-${String(i + 1).padStart(5, "0")}-${randomNumber(1000, 9999)}`,
        companyId: randomElement(companyIds),
        status,
        subtotal: dnSubtotal,
        taxRate: dnTaxRate,
        tax: dnTax,
        total: dnTotal,
        shipDate: status !== "pending" ? pastDate(randomNumber(1, 30)) : undefined,
        deliveryDate: status === "delivered" ? pastDate(randomNumber(1, 14)) : undefined,
        shippingAddress: `${randomNumber(100, 9999)} ${randomElement(["Main St", "Oak Ave", "Park Blvd"])}, ${randomElement(CITIES)}`,
        trackingNumber:
          status !== "pending" ? `TRK${randomNumber(100000000, 999999999)}` : undefined,
        carrier: status !== "pending" ? randomElement(carriers) : undefined,
        notes: `Auto-generated delivery note ${i + 1}`,
        createdBy: randomElement(userIds),
        createdAt: pastDate(randomNumber(1, 60)),
        updatedAt: now(),
      },
      items,
    });
  }

  return notes;
}

// Seed Functions
async function seedQuotes(
  quotes: {
    quote: Omit<Quote, "items">;
    items: Omit<Quote["items"][0], "id" | "quoteId">[];
  }[]
): Promise<string[]> {
  logger.info("📝 Seeding quotes...");
  const ids: string[] = [];

  for (const { quote, items } of quotes) {
    try {
      const generatedNumber = await quoteQueries.generateNumber();
      const created = await quoteQueries.create({ ...quote, quoteNumber: generatedNumber }, items);
      ids.push(created.id);
    } catch (error) {
      logger.error(`  ❌ Failed to create quote ${quote.quoteNumber}:`, error);
    }
  }
  return ids;
}

async function seedInvoices(
  invoices: {
    invoice: Omit<Invoice, "items">;
    items: Omit<Invoice["items"][0], "id" | "invoiceId">[];
  }[]
): Promise<string[]> {
  logger.info("💵 Seeding invoices...");
  const ids: string[] = [];

  for (const { invoice, items } of invoices) {
    try {
      const generatedNumber = await invoiceQueries.generateNumber();
      const created = await invoiceQueries.create(
        { ...invoice, invoiceNumber: generatedNumber },
        items
      );
      ids.push(created.id);
    } catch (error) {
      logger.error(`  ❌ Failed to create invoice ${invoice.invoiceNumber}:`, error);
    }
  }
  return ids;
}

async function seedOrders(
  orders: {
    order: Omit<Order, "items">;
    items: Array<{
      productName: string;
      description?: string | null;
      quantity: number;
      unitPrice: number;
      discount?: number;
      total: number;
    }>;
  }[]
): Promise<string[]> {
  logger.info("🛒 Seeding orders...");
  const ids: string[] = [];

  for (const { order, items } of orders) {
    try {
      const result = await orderQueries.create(order, items);
      if (result.success && result.data) {
        ids.push(result.data.id);
      } else {
        logger.error(`  ❌ Failed to create order ${order.orderNumber}: ${result.error?.message}`);
      }
    } catch (error) {
      logger.error(`  ❌ Failed to create order ${order.orderNumber}:`, error);
    }
  }
  return ids;
}

async function seedDeliveryNotes(
  notes: {
    note: Omit<DeliveryNote, "items">;
    items: Omit<DeliveryNote["items"][0], "id" | "deliveryNoteId">[];
  }[]
): Promise<void> {
  logger.info("📦 Seeding delivery notes...");

  for (const { note, items } of notes) {
    try {
      await deliveryNoteQueries.create(note, items);
    } catch (error) {
      logger.error(`  ❌ Failed to create delivery note ${note.deliveryNumber}:`, error);
    }
  }
}

// Main execution
async function main() {
  logger.info("🚀 Starting sales data seeding...");

  try {
    const companies = await db`SELECT id, name FROM companies`;
    const users = await db`SELECT id, company_id FROM users`;

    if (companies.length === 0 || users.length === 0) {
      logger.error("❌ No companies or users found. Run 'bun db:seed' first.");
      process.exit(1);
    }

    const userIds = users.map((u) => u.id as string);
    const usersByCompany = new Map<string, string[]>();
    for (const u of users) {
      const cid = (u.company_id as string) || "";
      if (!usersByCompany.has(cid)) usersByCompany.set(cid, []);
      usersByCompany.get(cid)!.push(u.id as string);
    }

    let totalQuotes = 0;
    let totalInvoices = 0;
    let totalOrders = 0;
    let totalDeliveryNotes = 0;

    for (const company of companies) {
      const companyId = company.id as string;
      const companyUserIds = usersByCompany.get(companyId) ?? userIds;

      const quotesData = generateQuotes(50, [companyId], companyUserIds);
      const quoteIds = await seedQuotes(quotesData);
      totalQuotes += quoteIds.length;

      const invoicesData = generateInvoices(50, [companyId], companyUserIds);
      const invoiceIds = await seedInvoices(invoicesData);
      totalInvoices += invoiceIds.length;

      const ordersData = generateOrders(50, [companyId], companyUserIds);
      const orderIds = await seedOrders(ordersData);
      totalOrders += orderIds.length;

      const deliveryNotesData = generateDeliveryNotes(50, [companyId], companyUserIds);
      await seedDeliveryNotes(deliveryNotesData);
      totalDeliveryNotes += 50;
    }

    logger.info(`✅ Created Quotes: ${totalQuotes}`);
    logger.info(`✅ Created Invoices: ${totalInvoices}`);
    logger.info(`✅ Created Orders: ${totalOrders}`);
    logger.info(`✅ Created Delivery Notes: ${totalDeliveryNotes}`);

    logger.info("\n✨ Seeding completed successfully!");
  } catch (error) {
    logger.error("\n❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();
