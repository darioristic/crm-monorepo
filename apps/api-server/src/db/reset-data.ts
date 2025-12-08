import type { Company, DeliveryNote, Invoice, Order, Quote, User } from "@crm/types";
import { generateUUID, now } from "@crm/utils";
import { logger } from "../lib/logger";
import { sql as db } from "./client";
import { deliveryNoteQueries, invoiceQueries, orderQueries, quoteQueries } from "./queries";
import { authQueries } from "./queries/auth";
import { companyQueries } from "./queries/companies";
import { documentQueries } from "./queries/documents";
import { getOrCreateDefaultTenant } from "./queries/tenants";
import { userQueries } from "./queries/users";

let DEFAULT_TENANT_ID: string | null = null;

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

// ============================================
// Serbian Companies Data
// ============================================

const SERBIAN_COMPANIES = [
  { name: "NIS", industry: "Energy", city: "Novi Sad" },
  { name: "Telekom Srbija", industry: "Telecommunications", city: "Beograd" },
  { name: "Frikom", industry: "Food & Beverage", city: "Beograd" },
  { name: "Imlek", industry: "Food & Beverage", city: "Beograd" },
  { name: "Hemofarm", industry: "Pharmaceuticals", city: "Vršac" },
  { name: "Galenika", industry: "Pharmaceuticals", city: "Beograd" },
  { name: "Messer Tehnogas", industry: "Industrial Gases", city: "Beograd" },
  { name: "Tigar", industry: "Manufacturing", city: "Pirot" },
  {
    name: "Kombinat Aluminijuma Podgorica",
    industry: "Metallurgy",
    city: "Podgorica",
  },
  { name: "Energoprojekt", industry: "Construction", city: "Beograd" },
  { name: "HIP Petrohemija", industry: "Chemicals", city: "Pančevo" },
  { name: "BIP Beograd", industry: "Manufacturing", city: "Beograd" },
  { name: "FAP Famos", industry: "Automotive", city: "Kragujevac" },
  { name: "Zastava Automobili", industry: "Automotive", city: "Kragujevac" },
  {
    name: "Vodovod i kanalizacija Beograd",
    industry: "Utilities",
    city: "Beograd",
  },
  { name: "Aerodrom Nikola Tesla", industry: "Aviation", city: "Beograd" },
  { name: "Pošta Srbije", industry: "Postal Services", city: "Beograd" },
  { name: "Jat Tehnika", industry: "Aviation Services", city: "Beograd" },
  { name: "Srbija Vode", industry: "Utilities", city: "Beograd" },
  { name: "Elektroprivreda Srbije", industry: "Energy", city: "Beograd" },
  { name: "Komercijalna banka", industry: "Finance", city: "Beograd" },
  { name: "Banka Intesa", industry: "Finance", city: "Beograd" },
  { name: "Raiffeisen banka", industry: "Finance", city: "Beograd" },
  { name: "Unicredit banka", industry: "Finance", city: "Beograd" },
  { name: "Banca Intesa Beograd", industry: "Finance", city: "Beograd" },
  { name: "Delta Holding", industry: "Retail", city: "Beograd" },
  { name: "Merkator", industry: "Retail", city: "Beograd" },
  { name: "DIS", industry: "Retail", city: "Beograd" },
  { name: "Metro Cash & Carry", industry: "Retail", city: "Beograd" },
  { name: "Gomex", industry: "Retail", city: "Beograd" },
  { name: "Tehnomanija", industry: "Retail", city: "Beograd" },
  { name: "Gigatron", industry: "Retail", city: "Beograd" },
  { name: "WinWin", industry: "Retail", city: "Beograd" },
  { name: "Tehnički remont", industry: "Services", city: "Beograd" },
  { name: "Inženjering", industry: "Construction", city: "Beograd" },
  { name: "Dunav osiguranje", industry: "Insurance", city: "Beograd" },
  { name: "DDOR Novi Sad", industry: "Insurance", city: "Novi Sad" },
  { name: "Generali osiguranje", industry: "Insurance", city: "Beograd" },
  { name: "Triglav osiguranje", industry: "Insurance", city: "Beograd" },
  { name: "Blic", industry: "Media", city: "Beograd" },
  { name: "Politika", industry: "Media", city: "Beograd" },
  { name: "RTS", industry: "Media", city: "Beograd" },
  { name: "Pink Media Group", industry: "Media", city: "Beograd" },
  { name: "Prvi partizan", industry: "Manufacturing", city: "Užice" },
  { name: "Sloboda Čačak", industry: "Manufacturing", city: "Čačak" },
  { name: "Vranje", industry: "Textiles", city: "Vranje" },
  { name: "Zlatar", industry: "Food & Beverage", city: "Zrenjanin" },
  { name: "Victoria Group", industry: "Food & Beverage", city: "Beograd" },
  { name: "Carlsberg Srbija", industry: "Food & Beverage", city: "Čelarevo" },
];

// ============================================
// Serbian Names Data
// ============================================

const SERBIAN_FIRST_NAMES = [
  "Marko",
  "Nikola",
  "Stefan",
  "Luka",
  "Filip",
  "Ana",
  "Marija",
  "Jovana",
  "Milica",
  "Sofija",
  "Milan",
  "Nenad",
  "Dragan",
  "Zoran",
  "Ivan",
  "Jelena",
  "Tanja",
  "Snežana",
  "Vesna",
  "Gordana",
  "Dejan",
  "Bojan",
  "Nemanja",
  "Vladimir",
  "Slobodan",
  "Katarina",
  "Jasmina",
  "Biljana",
  "Dragana",
  "Natasha",
  "Petar",
  "Mladen",
  "Dušan",
  "Veljko",
  "Aleksandar",
  "Tamara",
  "Aleksandra",
  "Nevena",
  "Dunja",
  "Andrijana",
];

const SERBIAN_LAST_NAMES = [
  "Jovanović",
  "Nikolić",
  "Petrović",
  "Marković",
  "Đorđević",
  "Stojanović",
  "Ilić",
  "Stanković",
  "Pavlović",
  "Milovanović",
  "Popović",
  "Radić",
  "Stefanović",
  "Milanović",
  "Aleksić",
  "Vasić",
  "Tomić",
  "Kostić",
  "Janković",
  "Mihajlović",
  "Božić",
  "Vuković",
  "Lukić",
  "Simić",
  "Nikolić",
  "Ristić",
  "Mladenović",
  "Veljković",
  "Nedić",
  "Mitrović",
];

// ============================================
// Product Names
// ============================================

const PRODUCT_NAMES = [
  "Web Development",
  "Software Consulting",
  "Cloud Services",
  "Database Management",
  "Security Audit",
  "System Integration",
  "Mobile App Development",
  "API Development",
  "DevOps Services",
  "IT Support",
  "Network Setup",
  "Data Analytics",
  "Digital Marketing",
  "SEO Services",
  "Content Creation",
  "Graphic Design",
  "UI/UX Design",
  "Brand Identity",
  "Project Management",
  "Business Consulting",
  "Training Services",
];

// ============================================
// Delete Functions
// ============================================

async function deleteAllDocuments(): Promise<void> {
  logger.info("\n🧹 Brisanje svih dokumenata...\n");

  const safeDelete = async (table: string, name: string) => {
    try {
      await db.unsafe(`DELETE FROM ${table}`);
      logger.info(`  ✅ Obrisano: ${name}`);
    } catch (error: unknown) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "42P01") {
        logger.info(`  ⏭️  Tabela ${table} ne postoji, preskačem`);
      } else {
        logger.error(`  ❌ Greška pri brisanju ${table}`);
        throw error as Error;
      }
    }
  };

  // Delete in reverse order of dependencies
  await safeDelete("payments", "payments");
  await safeDelete("delivery_note_items", "stavke otpremnica");
  await safeDelete("delivery_notes", "otpremnice");
  await safeDelete("order_items", "stavke porudžbina");
  await safeDelete("orders", "porudžbine");
  await safeDelete("invoice_items", "stavke faktura");
  await safeDelete("invoices", "fakture");
  await safeDelete("quote_items", "stavke ponuda");
  await safeDelete("quotes", "ponude");
  await safeDelete("notifications", "notifikacije");
  await safeDelete("products", "proizvodi");
  await safeDelete("product_categories", "kategorije proizvoda");

  logger.info("\n✅ Svi dokumenti su obrisani!\n");
}

async function deleteAllUsersAndCompanies(): Promise<void> {
  logger.info("\n🧹 Brisanje svih korisnika i kompanija...\n");

  const safeDelete = async (table: string, name: string) => {
    try {
      await db.unsafe(`DELETE FROM ${table}`);
      logger.info(`  ✅ Obrisano: ${name}`);
    } catch (error: unknown) {
      const code = typeof error === "object" && error && (error as { code?: string }).code;
      if (code === "42P01") {
        logger.info(`  ⏭️  Tabela ${table} ne postoji, preskačem`);
      } else {
        logger.error(`  ❌ Greška pri brisanju ${table}`);
        throw error as Error;
      }
    }
  };

  // Delete in reverse order of dependencies
  // First delete entities that reference users
  await safeDelete("activities", "aktivnosti");
  await safeDelete("tasks", "zadaci");
  await safeDelete("milestones", "milestoni");
  await safeDelete("projects", "projekti");
  await safeDelete("deals", "poslovi");
  await safeDelete("contacts", "kontakti");
  await safeDelete("leads", "potencijalni klijenti");

  // Then delete user-related tables
  await safeDelete("users_on_company", "veze korisnika i kompanija");
  await safeDelete("auth_credentials", "autentifikacije");
  await safeDelete("sessions", "sesije");
  await safeDelete("users", "korisnici");
  await safeDelete("companies", "kompanije");

  logger.info("\n✅ Svi korisnici i kompanije su obrisani!\n");
}

// ============================================
// Generate Functions
// ============================================

function generateSerbianCompanies(count: number): Company[] {
  const companies: Company[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i++) {
    const companyData = SERBIAN_COMPANIES[i % SERBIAN_COMPANIES.length];
    let name = companyData.name;
    let counter = 0;

    // Ensure unique names
    while (usedNames.has(name)) {
      counter++;
      name = `${companyData.name} ${counter > 1 ? counter : ""}`.trim();
    }
    usedNames.add(name);

    const streetNumber = randomNumber(1, 200);
    const streets = [
      "Bulevar Kralja Aleksandra",
      "Kneza Miloša",
      "Nemanjina",
      "Svetogorska",
      "Terazije",
    ];
    const street = randomElement(streets);

    companies.push({
      id: generateUUID(),
      name,
      industry: companyData.industry,
      address: `${streetNumber} ${street}, ${companyData.city}`,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.rs`,
      phone: `+381-${randomNumber(10, 99)}-${randomNumber(100, 999)}-${randomNumber(100, 9999)}`,
      city: companyData.city,
      country: "Srbija",
      countryCode: "RS",
      createdAt: pastDate(randomNumber(30, 365)),
      updatedAt: now(),
    });
  }

  return companies;
}

function generateSerbianUsers(count: number, companyIds: string[]): User[] {
  const users: User[] = [];
  const usedEmails = new Set<string>();

  for (let i = 0; i < count; i++) {
    const firstName = randomElement(SERBIAN_FIRST_NAMES);
    const lastName = randomElement(SERBIAN_LAST_NAMES);
    let email: string;
    let counter = 0;

    do {
      const suffix = counter > 0 ? counter.toString() : "";
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${suffix}@example.rs`;
      counter++;
    } while (usedEmails.has(email));
    usedEmails.add(email);

    users.push({
      id: generateUUID(),
      firstName,
      lastName,
      email,
      role: i < 5 ? "tenant_admin" : "crm_user",
      companyId: randomElement(companyIds),
      status: randomElement(["active", "active", "active", "inactive"]),
      phone: `+381-${randomNumber(60, 69)}-${randomNumber(100, 999)}-${randomNumber(100, 9999)}`,
      createdAt: pastDate(randomNumber(1, 300)),
      updatedAt: now(),
    });
  }

  return users;
}

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
    const itemCount = randomNumber(2, 10);
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
        description: `Opis proizvoda/usluge ${j + 1}`,
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

    quotes.push({
      quote: {
        id: generateUUID(),
        quoteNumber: `PON-2025-${String(i + 1).padStart(5, "0")}`,
        companyId: randomElement(companyIds),
        status,
        issueDate: pastDate(randomNumber(1, 60)),
        validUntil: futureDate(randomNumber(15, 45)),
        subtotal,
        taxRate,
        tax,
        total,
        notes: Math.random() > 0.5 ? `Napomena za ponudu ${i + 1}` : undefined,
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
  quoteIds: string[],
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
    const itemCount = randomNumber(2, 10);
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
        description: `Opis stavke fakture ${j + 1}`,
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
    const paidAmount = status === "paid" ? total : status === "partial" ? total * 0.5 : 0;

    invoices.push({
      invoice: {
        id: generateUUID(),
        invoiceNumber: `FAK-2025-${String(i + 1).padStart(5, "0")}`,
        quoteId: Math.random() > 0.7 && quoteIds.length > 0 ? randomElement(quoteIds) : undefined,
        companyId: randomElement(companyIds),
        status,
        issueDate: pastDate(randomNumber(1, 60)),
        dueDate: futureDate(randomNumber(15, 45)),
        subtotal,
        taxRate,
        tax,
        total,
        paidAmount,
        currency: "RSD",
        notes: Math.random() > 0.5 ? `Napomena za fakturu ${i + 1}` : undefined,
        createdBy: randomElement(userIds),
        createdAt: pastDate(randomNumber(1, 60)),
        updatedAt: now(),
      },
      items,
    });
  }

  return invoices;
}

function generateDeliveryNotes(
  count: number,
  companyIds: string[],
  invoiceIds: string[],
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
  const carriers = ["BEX", "Post Express", "DHL", "FedEx", "Pošta Srbije"];
  const cities = ["Beograd", "Novi Sad", "Niš", "Kragujevac", "Subotica"];

  for (let i = 0; i < count; i++) {
    const itemCount = randomNumber(2, 10);
    const items: Omit<DeliveryNote["items"][0], "id" | "deliveryNoteId">[] = [];
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const quantity = randomNumber(1, 20);
      const unitPrice = randomNumber(100, 10000);
      const discount = Math.random() > 0.8 ? randomNumber(5, 15) : 0;
      const total = quantity * unitPrice * (1 - discount / 100);
      subtotal += total;

      items.push({
        productName: randomElement(PRODUCT_NAMES),
        description: `Opis artikla ${j + 1}`,
        quantity,
        unit: randomElement(["pcs", "set", "box", "pack", "kg", "m"]),
        unitPrice,
        discount,
        total,
      });
    }

    const taxRate = 20;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    const status = randomElement(statuses);

    const streetNumber = randomNumber(1, 200);
    const streets = ["Bulevar Kralja Aleksandra", "Kneza Miloša", "Nemanjina", "Svetogorska"];
    const street = randomElement(streets);
    const city = randomElement(cities);

    notes.push({
      note: {
        id: generateUUID(),
        deliveryNumber: `OTP-2025-${String(i + 1).padStart(5, "0")}`,
        invoiceId:
          Math.random() > 0.3 && invoiceIds.length > 0 ? randomElement(invoiceIds) : undefined,
        companyId: randomElement(companyIds),
        status,
        shipDate: status !== "pending" ? pastDate(randomNumber(1, 30)) : undefined,
        deliveryDate: status === "delivered" ? pastDate(randomNumber(1, 14)) : undefined,
        shippingAddress: `${streetNumber} ${street}, ${city}`,
        trackingNumber:
          status !== "pending" ? `TRK${randomNumber(100000000, 999999999)}` : undefined,
        carrier: status !== "pending" ? randomElement(carriers) : undefined,
        taxRate,
        subtotal,
        tax,
        total,
        notes: Math.random() > 0.6 ? `Napomena za otpremnicu ${i + 1}` : undefined,
        createdBy: randomElement(userIds),
        createdAt: pastDate(randomNumber(1, 60)),
        updatedAt: now(),
      },
      items,
    });
  }

  return notes;
}

function generateOrders(
  count: number,
  companyIds: string[],
  quoteIds: string[],
  invoiceIds: string[],
  userIds: string[]
): Array<{
  orderNumber: string;
  companyId: string;
  contactId?: string | null;
  quoteId?: string | null;
  invoiceId?: string | null;
  status: Order["status"];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  notes?: string | null;
  createdBy: string;
}> {
  const orders: Array<{
    orderNumber: string;
    companyId: string;
    contactId?: string | null;
    quoteId?: string | null;
    invoiceId?: string | null;
    status: Order["status"];
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
    notes?: string | null;
    createdBy: string;
  }> = [];
  const statuses: Order["status"][] = [
    "pending",
    "processing",
    "completed",
    "cancelled",
    "refunded",
  ];

  for (let i = 0; i < count; i++) {
    const subtotal = randomNumber(5000, 500000);
    const tax = subtotal * 0.2;
    const total = subtotal + tax;
    const status = randomElement(statuses);

    orders.push({
      orderNumber: `NAR-2025-${String(i + 1).padStart(5, "0")}`,
      companyId: randomElement(companyIds),
      contactId: null,
      quoteId: Math.random() > 0.5 && quoteIds.length > 0 ? randomElement(quoteIds) : null,
      invoiceId: Math.random() > 0.5 && invoiceIds.length > 0 ? randomElement(invoiceIds) : null,
      status,
      subtotal,
      tax,
      total,
      currency: "RSD",
      notes: Math.random() > 0.5 ? `Napomena za narudžbinu ${i + 1}` : null,
      createdBy: randomElement(userIds),
    });
  }

  return orders;
}

// ============================================
// Seed Functions
// ============================================

async function seedCompanies(companies: Company[]): Promise<string[]> {
  logger.info(`\n🏢 Kreiranje ${companies.length} kompanija...\n`);
  const companyIds: string[] = [];

  for (const company of companies) {
    try {
      const created = await companyQueries.create(company);
      companyIds.push(created.id);

      // Assign tenant_id to the created company for tenant context
      if (DEFAULT_TENANT_ID) {
        await db`
					UPDATE companies
					SET tenant_id = ${DEFAULT_TENANT_ID}, updated_at = NOW()
					WHERE id = ${created.id}
				`;
      }
      logger.info(`  ✅ Kreirana kompanija: ${created.name}`);
    } catch (error: unknown) {
      logger.error(`  ❌ Greška pri kreiranju kompanije ${company.name}`);
      throw error as Error;
    }
  }

  return companyIds;
}

async function seedUsers(users: User[]): Promise<string[]> {
  logger.info(`\n👥 Kreiranje ${users.length} korisnika...\n`);
  const userIds: string[] = [];
  const DEFAULT_PASSWORD = "changeme123";

  // Hash password once for all users
  const passwordHash = await Bun.password.hash(DEFAULT_PASSWORD, {
    algorithm: "bcrypt",
    cost: 12,
  });

  for (const user of users) {
    try {
      const created = await userQueries.create(user);
      userIds.push(created.id);

      // Create auth credential with hashed password
      const exists = await authQueries.credentialsExist(created.id);
      if (!exists) {
        await authQueries.createCredentials(created.id, passwordHash);
      }

      // Assign tenant_id to user for tenant context
      if (DEFAULT_TENANT_ID) {
        await db`
					UPDATE users
					SET tenant_id = ${DEFAULT_TENANT_ID}, updated_at = NOW()
					WHERE id = ${created.id}
				`;
      }

      // Ensure membership in users_on_company for company dropdown and access
      if (user.companyId) {
        const role = user.role === "tenant_admin" ? "admin" : "member";
        // Insert membership if not already present
        const existingMembership = await db`
					SELECT 1 FROM users_on_company
					WHERE user_id = ${created.id} AND company_id = ${user.companyId}
					LIMIT 1
				`;
        if (existingMembership.length === 0) {
          await db`
						INSERT INTO users_on_company (user_id, company_id, role, created_at)
						VALUES (${created.id}, ${user.companyId}, ${role}, NOW())
					`;
        }
      }

      logger.info(`  ✅ Kreiran korisnik: ${user.firstName} ${user.lastName} (${user.email})`);
    } catch (error: unknown) {
      logger.error(`  ❌ Greška pri kreiranju korisnika ${user.email}`);
      throw error as Error;
    }
  }

  logger.info(`\n  ℹ️  Podrazumevana lozinka za sve korisnike: "${DEFAULT_PASSWORD}"`);

  return userIds;
}

async function seedQuotes(
  quotes: {
    quote: Omit<Quote, "items">;
    items: Omit<Quote["items"][0], "id" | "quoteId">[];
  }[]
): Promise<string[]> {
  logger.info(`\n📋 Kreiranje ${quotes.length} ponuda...\n`);
  const quoteIds: string[] = [];

  for (const { quote, items } of quotes) {
    try {
      const created = await quoteQueries.create(quote, items);
      quoteIds.push(created.id);
      logger.info(`  ✅ Kreirana ponuda: ${created.quoteNumber}`);
    } catch (error: unknown) {
      logger.error(`  ❌ Greška pri kreiranju ponude ${quote.quoteNumber}`);
      throw error as Error;
    }
  }

  return quoteIds;
}

async function seedInvoices(
  invoices: {
    invoice: Omit<Invoice, "items">;
    items: Omit<Invoice["items"][0], "id" | "invoiceId">[];
  }[]
): Promise<string[]> {
  logger.info(`\n💵 Kreiranje ${invoices.length} faktura...\n`);
  const invoiceIds: string[] = [];

  for (const { invoice, items } of invoices) {
    try {
      const created = await invoiceQueries.create(invoice, items);
      invoiceIds.push(created.id);
      logger.info(`  ✅ Kreirana faktura: ${created.invoiceNumber}`);
    } catch (error: unknown) {
      logger.error(`  ❌ Greška pri kreiranju fakture ${invoice.invoiceNumber}`);
      throw error as Error;
    }
  }

  return invoiceIds;
}

async function seedDeliveryNotes(
  notes: {
    note: Omit<DeliveryNote, "items">;
    items: Omit<DeliveryNote["items"][0], "id" | "deliveryNoteId">[];
  }[]
): Promise<void> {
  logger.info(`\n📦 Kreiranje ${notes.length} otpremnica...\n`);

  for (const { note, items } of notes) {
    try {
      const created = await deliveryNoteQueries.create(note, items);
      logger.info(`  ✅ Kreirana otpremnica: ${created.deliveryNumber}`);
    } catch (error: unknown) {
      logger.error(`  ❌ Greška pri kreiranju otpremnice ${note.deliveryNumber}`);
      throw error as Error;
    }
  }
}

async function seedOrders(
  orders: Array<{
    orderNumber: string;
    companyId: string;
    contactId?: string | null;
    quoteId?: string | null;
    invoiceId?: string | null;
    status: Order["status"];
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
    notes?: string | null;
    createdBy: string;
  }>
): Promise<void> {
  logger.info(`\n🛒 Kreiranje ${orders.length} narudžbina...\n`);

  for (const order of orders) {
    try {
      const result = await orderQueries.create(order);
      if (result.success && result.data) {
        logger.info(`  ✅ Kreirana narudžbina: ${result.data.orderNumber}`);
      } else {
        logger.error(
          `  ❌ Greška pri kreiranju narudžbine ${order.orderNumber}: ${result.error?.message || "Nepoznata greška"}`
        );
      }
    } catch (_error: unknown) {
      logger.error(`  ❌ Greška pri kreiranju narudžbine ${order.orderNumber}`);
    }
  }
}

// ============================================
// Main Reset Function
// ============================================

export async function resetAndSeedData(): Promise<void> {
  logger.info("\n🚀 Pokretanje reset-a baze podataka i kreiranje novih podataka...\n");

  try {
    // Step 1: Delete all documents
    await deleteAllDocuments();

    // Step 2: Delete all users and companies
    await deleteAllUsersAndCompanies();

    // Step 2.1: Ensure default tenant exists and capture its ID
    DEFAULT_TENANT_ID = await getOrCreateDefaultTenant();

    // Step 3: Create demo company (TechCorp) first
    logger.info("🏢 Kreiranje demo kompanije...\n");
    const techCorp = await companyQueries.create({
      name: "TechCorp",
      industry: "Technology",
      address: "123 Tech Street, Beograd",
      email: "info@techcorp.com",
      phone: "+381-11-123-4567",
      city: "Beograd",
      country: "Srbija",
      countryCode: "RS",
    });
    // Assign tenant to TechCorp
    if (DEFAULT_TENANT_ID) {
      await db`
				UPDATE companies
				SET tenant_id = ${DEFAULT_TENANT_ID}, updated_at = NOW()
				WHERE id = ${techCorp.id}
			`;
    }
    logger.info(`  ✅ Kreirana demo kompanija: TechCorp\n`);

    // Step 4: Generate and create 50 Serbian companies
    const companies = generateSerbianCompanies(50);
    const companyIds = await seedCompanies(companies);
    logger.info(`\n  📊 Kreirano kompanija: ${companyIds.length}\n`);

    // Add TechCorp to the list
    const allCompanyIds = [techCorp.id, ...companyIds];

    // Step 5: Create demo users first (admin and sarah)
    const demoUsers: User[] = [
      {
        id: generateUUID(),
        firstName: "Admin",
        lastName: "User",
        email: "admin@crm.local",
        role: "tenant_admin",
        companyId: allCompanyIds[0],
        status: "active",
        createdAt: pastDate(365),
        updatedAt: now(),
      },
      {
        id: generateUUID(),
        firstName: "Sarah",
        lastName: "Johnson",
        email: "sarah.johnson@techcorp.com",
        role: "crm_user",
        companyId: techCorp.id,
        status: "active",
        createdAt: pastDate(300),
        updatedAt: now(),
      },
    ];

    const demoUserIds = await seedUsers(demoUsers);
    logger.info(`\n  📊 Kreirano demo korisnika: ${demoUserIds.length}\n`);

    // Step 6: Generate and create additional users (1-5 per company)
    const totalUsers = allCompanyIds.reduce((sum) => sum + randomNumber(1, 5), 0);
    const users = generateSerbianUsers(totalUsers, allCompanyIds);
    const additionalUserIds = await seedUsers(users);
    logger.info(`\n  📊 Kreirano dodatnih korisnika: ${additionalUserIds.length}\n`);

    // Combine all user IDs
    const userIds = [...demoUserIds, ...additionalUserIds];

    // Step 7: Generate and create 50 documents (mixed types)
    // ~12-13 of each type
    const quoteCount = 13;
    const invoiceCount = 13;
    const deliveryNoteCount = 12;
    const orderCount = 12;

    // Create quotes
    const quotesData = generateQuotes(quoteCount, allCompanyIds, userIds);
    const quoteIds = await seedQuotes(quotesData);
    logger.info(`\n  📊 Kreirano ponuda: ${quoteIds.length}\n`);

    // Create invoices
    const invoicesData = generateInvoices(invoiceCount, allCompanyIds, quoteIds, userIds);
    const invoiceIds = await seedInvoices(invoicesData);
    logger.info(`\n  📊 Kreirano faktura: ${invoiceIds.length}\n`);

    // Create delivery notes
    const deliveryNotesData = generateDeliveryNotes(
      deliveryNoteCount,
      allCompanyIds,
      invoiceIds,
      userIds
    );
    await seedDeliveryNotes(deliveryNotesData);
    logger.info(`\n  📊 Kreirano otpremnica: ${deliveryNoteCount}\n`);

    // Create orders
    const ordersData = generateOrders(orderCount, allCompanyIds, quoteIds, invoiceIds, userIds);
    await seedOrders(ordersData);
    logger.info(`\n  📊 Kreirano narudžbina: ${orderCount}\n`);

    // Seed Vault documents for TechCorp
    const ownerId = demoUserIds[0];
    const sampleDocs = [
      {
        name: "Onboarding Guide.pdf",
        pathTokens: [techCorp.id, "guides", "onboarding.pdf"],
        metadata: { mimetype: "application/pdf", size: 120384 },
      },
      {
        name: "Price List 2025.xlsx",
        pathTokens: [techCorp.id, "pricing", "2025-price-list.xlsx"],
        metadata: {
          mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          size: 80312,
        },
      },
      {
        name: "Contract Template.docx",
        pathTokens: [techCorp.id, "legal", "contract-template.docx"],
        metadata: {
          mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size: 152300,
        },
      },
      {
        name: "Brand Guidelines.pdf",
        pathTokens: [techCorp.id, "branding", "brand-guidelines.pdf"],
        metadata: { mimetype: "application/pdf", size: 223400 },
      },
      {
        name: "TechCorp Invoice Sample.pdf",
        pathTokens: [techCorp.id, "samples", "invoice-sample.pdf"],
        metadata: { mimetype: "application/pdf", size: 93456 },
      },
    ];

    for (const doc of sampleDocs) {
      await documentQueries.create({
        name: doc.name,
        pathTokens: doc.pathTokens,
        metadata: doc.metadata,
        companyId: techCorp.id,
        ownerId,
      });
    }
    logger.info(`\n  📊 Kreirano vault dokumenata: ${sampleDocs.length}\n`);

    const adminId = demoUserIds[0];
    const qNum1 = await quoteQueries.generateNumber();
    const qId1 = generateUUID();
    await quoteQueries.create(
      {
        id: qId1,
        quoteNumber: qNum1,
        companyId: techCorp.id,
        status: "sent",
        issueDate: now(),
        validUntil: futureDate(30),
        subtotal: 120000,
        taxRate: 20,
        tax: 24000,
        total: 144000,
        notes: "Ponuda za implementaciju CRM-a",
        terms: "Plaćanje 30 dana",
        createdBy: adminId,
        createdAt: now(),
        updatedAt: now(),
      },
      [
        {
          productName: "Implementacija",
          description: "Instalacija i podešavanje sistema",
          quantity: 1,
          unitPrice: 120000,
          discount: 0,
          total: 120000,
        },
      ]
    );

    const qNum2 = await quoteQueries.generateNumber();
    const qId2 = generateUUID();
    await quoteQueries.create(
      {
        id: qId2,
        quoteNumber: qNum2,
        companyId: techCorp.id,
        status: "accepted",
        issueDate: pastDate(10),
        validUntil: futureDate(20),
        subtotal: 80000,
        taxRate: 20,
        tax: 16000,
        total: 96000,
        notes: "Ponuda za obuku",
        terms: "Plaćanje odmah",
        createdBy: adminId,
        createdAt: pastDate(10),
        updatedAt: now(),
      },
      [
        {
          productName: "Obuka",
          description: "Obuka za tim",
          quantity: 2,
          unitPrice: 40000,
          discount: 0,
          total: 80000,
        },
      ]
    );

    const invNum1 = await invoiceQueries.generateNumber();
    const invId1 = generateUUID();
    await invoiceQueries.create(
      {
        id: invId1,
        invoiceNumber: invNum1,
        quoteId: qId2,
        companyId: techCorp.id,
        status: "sent",
        issueDate: pastDate(7),
        dueDate: futureDate(14),
        grossTotal: 80000,
        subtotal: 80000,
        discount: 0,
        taxRate: 20,
        vatRate: 20,
        tax: 16000,
        total: 96000,
        paidAmount: 0,
        currency: "RSD",
        notes: "Faktura za obuku",
        terms: "Plaćanje 14 dana",
        createdBy: adminId,
        createdAt: pastDate(7),
        updatedAt: now(),
      },
      [
        {
          productName: "Obuka",
          description: "Obuka za tim",
          quantity: 2,
          unit: "usluga",
          unitPrice: 40000,
          discount: 0,
          vatRate: 20,
          total: 80000,
        },
      ]
    );

    await orderQueries.create(
      {
        companyId: techCorp.id,
        contactId: null,
        quoteId: qId2,
        invoiceId: invId1,
        status: "processing",
        subtotal: 80000,
        tax: 16000,
        total: 96000,
        currency: "RSD",
        notes: "Narudžba za obuku",
        sellerCompanyId: techCorp.id,
        createdBy: adminId,
      },
      [
        {
          productName: "Obuka",
          description: "Obuka za tim",
          quantity: 2,
          unitPrice: 40000,
          discount: 0,
          total: 80000,
        },
      ]
    );

    await deliveryNoteQueries.create(
      {
        id: generateUUID(),
        deliveryNumber: "DEL-2025-00001",
        invoiceId: invId1,
        companyId: techCorp.id,
        status: "in_transit",
        shipDate: now(),
        shippingAddress: "Beograd, Savska 1",
        taxRate: 20,
        subtotal: 80000,
        tax: 16000,
        total: 96000,
        notes: "Isporuka obuke",
        terms: "",
        fromDetails: null,
        customerDetails: null,
        createdBy: adminId,
        createdAt: now(),
        updatedAt: now(),
      },
      [
        {
          productName: "Obuka",
          description: "Obuka za tim",
          quantity: 2,
          unit: "usluga",
          unitPrice: 40000,
          discount: 0,
          total: 80000,
        },
      ]
    );

    for (let i = 0; i < 8; i++) {
      const qNum = await quoteQueries.generateNumber();
      const qId = generateUUID();
      const qSubtotal = 50000 + i * 5000;
      const qTax = Math.round(qSubtotal * 0.2);
      const qTotal = qSubtotal + qTax;
      await quoteQueries.create(
        {
          id: qId,
          quoteNumber: qNum,
          companyId: techCorp.id,
          status: i % 2 === 0 ? "sent" : "accepted",
          issueDate: pastDate(15 - i),
          validUntil: futureDate(15 + i),
          subtotal: qSubtotal,
          taxRate: 20,
          tax: qTax,
          total: qTotal,
          notes: "Demo ponuda",
          terms: "",
          createdBy: adminId,
          createdAt: pastDate(15 - i),
          updatedAt: now(),
        },
        [
          {
            productName: "Usluga",
            description: "",
            quantity: 1 + (i % 3),
            unitPrice: Math.round(qSubtotal / (1 + (i % 3))),
            discount: 0,
            total: qSubtotal,
          },
        ]
      );

      const invNum = await invoiceQueries.generateNumber();
      const invId = generateUUID();
      await invoiceQueries.create(
        {
          id: invId,
          invoiceNumber: invNum,
          quoteId: i % 2 === 1 ? qId : undefined,
          companyId: techCorp.id,
          status: i % 3 === 0 ? "partial" : "sent",
          issueDate: pastDate(10 - i),
          dueDate: futureDate(10 + i),
          grossTotal: qSubtotal,
          subtotal: qSubtotal,
          discount: 0,
          taxRate: 20,
          vatRate: 20,
          tax: qTax,
          total: qTotal,
          paidAmount: i % 3 === 0 ? Math.round(qTotal / 2) : 0,
          currency: "RSD",
          notes: "Demo faktura",
          terms: "",
          createdBy: adminId,
          createdAt: pastDate(10 - i),
          updatedAt: now(),
        },
        [
          {
            productName: "Usluga",
            description: "",
            quantity: 1 + (i % 3),
            unit: "usluga",
            unitPrice: Math.round(qSubtotal / (1 + (i % 3))),
            discount: 0,
            vatRate: 20,
            total: qSubtotal,
          },
        ]
      );

      await orderQueries.create(
        {
          companyId: techCorp.id,
          contactId: null,
          quoteId: i % 2 === 1 ? qId : null,
          invoiceId: invId,
          status:
            i % 4 === 0
              ? "processing"
              : i % 4 === 1
                ? "completed"
                : i % 4 === 2
                  ? "pending"
                  : "cancelled",
          subtotal: qSubtotal,
          tax: qTax,
          total: qTotal,
          currency: "RSD",
          notes: "Demo narudžba",
          sellerCompanyId: techCorp.id,
          createdBy: adminId,
        },
        [
          {
            productName: "Usluga",
            description: "",
            quantity: 1 + (i % 3),
            unitPrice: Math.round(qSubtotal / (1 + (i % 3))),
            discount: 0,
            total: qSubtotal,
          },
        ]
      );

      await deliveryNoteQueries.create(
        {
          id: generateUUID(),
          deliveryNumber: `DEL-2025-${String(2 + i).padStart(5, "0")}`,
          invoiceId: invId,
          companyId: techCorp.id,
          status: i % 3 === 0 ? "pending" : i % 3 === 1 ? "in_transit" : "delivered",
          shipDate: pastDate(5 - i),
          shippingAddress: "Beograd, Savska 1",
          taxRate: 20,
          subtotal: qSubtotal,
          tax: qTax,
          total: qTotal,
          notes: "Demo isporuka",
          terms: "",
          fromDetails: null,
          customerDetails: null,
          createdBy: adminId,
          createdAt: pastDate(5 - i),
          updatedAt: now(),
        },
        [
          {
            productName: "Usluga",
            description: "",
            quantity: 1 + (i % 3),
            unit: "usluga",
            unitPrice: Math.round(qSubtotal / (1 + (i % 3))),
            discount: 0,
            total: qSubtotal,
          },
        ]
      );
    }

    // Final summary
    logger.info("\n✅ Reset baze podataka uspešno završen!\n");
    logger.info("═".repeat(50));
    logger.info(`   Kompanije:          ${allCompanyIds.length}`);
    logger.info(`   Korisnici:          ${userIds.length}`);
    logger.info(`   Ponude:             ${quoteIds.length}`);
    logger.info(`   Fakture:            ${invoiceIds.length}`);
    logger.info(`   Otpremnice:         ${deliveryNoteCount}`);
    logger.info(`   Narudžbine:         ${orderCount}`);
    logger.info(
      `   Ukupno dokumenata:  ${quoteIds.length + invoiceIds.length + deliveryNoteCount + orderCount}`
    );
    logger.info("═".repeat(50));
    logger.info("\n📋 Demo Credentials:");
    logger.info("═".repeat(50));
    logger.info("   Admin: admin@crm.local");
    logger.info("   User:  sarah.johnson@techcorp.com");
    logger.info("   Password: changeme123");
    logger.info("═".repeat(50));
    logger.info("\n");
  } catch (error) {
    logger.error("\n❌ Reset baze podataka neuspešan:", error);
    throw error;
  }
}

// CLI runner
if (import.meta.main) {
  try {
    await resetAndSeedData();
    await db.end();
    process.exit(0);
  } catch (error) {
    logger.error("Greška pri reset-u:", error);
    await db.end();
    process.exit(1);
  }
}
