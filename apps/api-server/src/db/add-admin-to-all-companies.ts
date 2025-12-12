import { generateUUID, now } from "@crm/utils";
import type { Contact } from "@crm/types";
import { logger } from "../lib/logger";
import { sql as db } from "./client";
import { companyQueries } from "./queries/companies";
import { documentQueries } from "./queries/documents";
import {
  contactQueries,
  documentTagAssignmentQueries,
  documentTagQueries,
  invoiceQueries,
  orderQueries,
  projectQueries,
  quoteQueries,
} from "./queries/index";
import { getOrCreateDefaultTenant } from "./queries/tenants";

/**
 * Script to add admin users to 3 account companies for multi-tenant testing.
 *
 * This script:
 * - Finds all admin users
 * - Finds the first 3 account companies (tenant companies)
 * - Removes admin users from all other account companies
 * - Adds admin users to these 3 companies only
 *
 * Note: Only ACCOUNT companies (source = 'account' or NULL) are used, not CUSTOMER companies.
 * Customer companies are clients and don't use the app directly.
 *
 * Usage: Run this script to ensure admin users have access to exactly 3 companies for testing.
 */
export async function addAdminToAllCompanies(): Promise<void> {
  logger.info("🔍 Finding all admin users...");

  // Get or create default tenant first
  logger.info("📋 Getting or creating default tenant...");
  const defaultTenantId = await getOrCreateDefaultTenant();
  logger.info(`✅ Default tenant ID: ${defaultTenantId}\n`);

  // Find ALL admin users (not just one)
  const adminUsers = await db`
    SELECT id, first_name, last_name, email FROM users WHERE role = 'admin' ORDER BY created_at ASC
  `;

  if (adminUsers.length === 0) {
    logger.info("⚠️  No admin users found. Create an admin user first.");
    return;
  }

  logger.info(`✅ Found ${adminUsers.length} admin user(s):`);
  adminUsers.forEach((admin) => {
    const a = admin as { id: string; email: string };
    logger.info(`   - ${a.email} (${a.id})`);
  });

  // Ensure admin users have tenantId
  logger.info("\n👤 Ensuring admin users have tenantId...");
  for (const admin of adminUsers) {
    const a = admin as { id: string; email: string };
    const userCheck = await db`
      SELECT tenant_id FROM users WHERE id = ${a.id}
    `;
    if (!userCheck[0]?.tenant_id) {
      await db`
        UPDATE users 
        SET tenant_id = ${defaultTenantId}, updated_at = NOW()
        WHERE id = ${a.id}
      `;
      logger.info(`   ✅ Assigned tenantId to ${a.email}`);
    }
  }

  // Target exactly these 3 account companies for admin access
  logger.info("\n🔍 Ensuring target account companies exist and are fully populated...");
  const desiredCompanies = [
    {
      name: "Platforma d.o.o.",
      industry: "IT Services",
      address: "Bulevar Zorana Đinđića 123, 11070 Beograd, Srbija",
      email: "info@platforma.rs",
      phone: "+381 11 123 4567",
      website: "https://platforma.rs",
      contact: "Marko Marković",
      city: "Beograd",
      zip: "11070",
      country: "Serbia",
      countryCode: "RS",
      vatNumber: "RS123456789",
      companyNumber: "12345678",
      logoUrl: null,
      note: "Tenant company for admin access",
    },
    {
      name: "Cloud Native d.o.o.",
      industry: "Cloud Consulting",
      address: "Savska 5, 11000 Beograd, Srbija",
      email: "contact@cloudnative.rs",
      phone: "+381 64 555 1234",
      website: "https://cloudnative.rs",
      contact: "Jovana Jovanović",
      city: "Beograd",
      zip: "11000",
      country: "Serbia",
      countryCode: "RS",
      vatNumber: "RS987654321",
      companyNumber: "87654321",
      logoUrl: null,
      note: "Tenant company for admin access",
    },
    {
      name: "Softergee d.o.o.",
      industry: "Software Development",
      address: "Kneza Miloša 33, 11000 Beograd, Srbija",
      email: "office@softergee.rs",
      phone: "+381 63 777 888",
      website: "https://softergee.rs",
      contact: "Petar Petrović",
      city: "Beograd",
      zip: "11000",
      country: "Serbia",
      countryCode: "RS",
      vatNumber: "RS112233445",
      companyNumber: "33445566",
      logoUrl: null,
      note: "Tenant company for admin access",
    },
  ];

  // Ensure companies exist with full information
  const ensuredCompanies: Array<{ id: string; name: string }> = [];
  for (const dc of desiredCompanies) {
    const existing = await companyQueries.findByName(dc.name);
    if (!existing) {
      // Create company using createCompany from companies-members to ensure tenantId is set
      const { createCompany } = await import("./queries/companies-members");
      const adminUserId = (adminUsers[0] as { id: string }).id;
      const companyId = await createCompany({
        name: dc.name,
        industry: dc.industry,
        address: dc.address,
        userId: adminUserId,
        email: dc.email,
        phone: dc.phone,
        website: dc.website,
        contact: dc.contact,
        city: dc.city,
        zip: dc.zip,
        country: dc.country,
        countryCode: dc.countryCode,
        vatNumber: dc.vatNumber,
        companyNumber: dc.companyNumber,
        note: dc.note,
        logoUrl: dc.logoUrl ?? undefined,
        source: "account",
      });
      ensuredCompanies.push({ id: companyId, name: dc.name });
      logger.info(`  ✓ Created company: ${dc.name}`);
    } else {
      // Update missing fields to ensure completeness, including tenantId
      await db`
        UPDATE companies SET
          industry = COALESCE(${dc.industry}, industry),
          address = COALESCE(${dc.address}, address),
          email = COALESCE(${dc.email}, email),
          phone = COALESCE(${dc.phone}, phone),
          website = COALESCE(${dc.website}, website),
          contact = COALESCE(${dc.contact}, contact),
          city = COALESCE(${dc.city}, city),
          zip = COALESCE(${dc.zip}, zip),
          country = COALESCE(${dc.country}, country),
          country_code = COALESCE(${dc.countryCode}, country_code),
          vat_number = COALESCE(${dc.vatNumber}, vat_number),
          company_number = COALESCE(${dc.companyNumber}, company_number),
          logo_url = COALESCE(${dc.logoUrl}, logo_url),
          note = COALESCE(${dc.note}, note),
          source = 'account',
          tenant_id = COALESCE(tenant_id, ${defaultTenantId}),
          updated_at = NOW()
        WHERE id = ${existing.id}
      `;
      ensuredCompanies.push({ id: existing.id, name: existing.name });
      logger.info(`  ✓ Ensured company data: ${existing.name}`);
    }
  }

  // Validate completeness: VAT and Company Number must be present
  for (const comp of ensuredCompanies) {
    const [row] = await db`
      SELECT vat_number, company_number, address, name FROM companies WHERE id = ${comp.id}
    `;
    if (!row?.vat_number || !row?.company_number || !row?.address) {
      throw new Error(
        `Company ${row?.name || comp.id} missing required VAT/company number/address`
      );
    }
  }

  logger.info(`✅ Target companies prepared: ${ensuredCompanies.map((c) => c.name).join(", ")}`);

  // Ensure 25 CUSTOMER companies exist (Bill-to targets)
  logger.info("\n📦 Ensuring 25 customer companies for billing exist...");
  const customerCompaniesSeed = Array.from({ length: 25 }).map((_, idx) => ({
    name: `Customer ${String(idx + 1).padStart(2, "0")} d.o.o.`,
    industry: "Customer",
    address: `Nemanjina ${10 + idx}, 11000 Beograd, Srbija`,
    email: `office.customer${idx + 1}@example.rs`,
    phone: `+381 60 ${String(100000 + idx).padStart(6, "0")}`,
    website: `https://customer${idx + 1}.example.rs`,
    contact: `Kontakt ${idx + 1}`,
    city: "Beograd",
    zip: "11000",
    country: "Serbia",
    countryCode: "RS",
    vatNumber: `RS${String(200000000 + idx)}`,
    companyNumber: `${10000000 + idx}`,
    logoUrl: null,
    note: "Seeded customer company",
  }));

  const customerCompanies: Array<{
    id: string;
    name: string;
    address: string;
    email: string;
    phone: string;
    vatNumber: string;
    companyNumber: string;
    city?: string;
    zip?: string;
    country?: string;
    website?: string;
  }> = [];
  for (const cust of customerCompaniesSeed) {
    const existing = await companyQueries.findByName(cust.name);
    if (!existing) {
      const inserted = await db`
        INSERT INTO companies (
          name, industry, address, email, phone, website, contact,
          city, zip, country, country_code, vat_number, company_number, logo_url, note, source,
          created_at, updated_at
        ) VALUES (
          ${cust.name}, ${cust.industry}, ${cust.address}, ${cust.email}, ${cust.phone}, ${cust.website}, ${cust.contact},
          ${cust.city}, ${cust.zip}, ${cust.country}, ${cust.countryCode}, ${cust.vatNumber}, ${cust.companyNumber}, ${cust.logoUrl}, ${cust.note}, 'customer',
          NOW(), NOW()
        ) RETURNING *
      `;
      const row = inserted[0] as Record<string, unknown>;
      customerCompanies.push({
        id: row.id as string,
        name: row.name as string,
        address: row.address as string,
        email: (row.email as string) || "",
        phone: (row.phone as string) || "",
        vatNumber: (row.vat_number as string) || "",
        companyNumber: (row.company_number as string) || "",
        city: (row.city as string) || undefined,
        zip: (row.zip as string) || undefined,
        country: (row.country as string) || undefined,
        website: (row.website as string) || undefined,
      });
      logger.info(`  ✓ Created customer company: ${cust.name}`);
    } else {
      customerCompanies.push({
        id: existing.id,
        name: existing.name,
        address: existing.address,
        email: existing.email || "",
        phone: existing.phone || "",
        vatNumber: existing.vatNumber || "",
        companyNumber: existing.companyNumber || "",
        city: existing.city || undefined,
        zip: existing.zip || undefined,
        country: existing.country || undefined,
        website: existing.website || undefined,
      });
    }
  }
  logger.info(`✅ Customer companies ready: ${customerCompanies.length}`);

  // Remove admin users from all other account companies first
  logger.info("\n🧹 Removing admin users from all other companies (keeping only these 3)...");
  const companyIds = ensuredCompanies.map((c) => c.id);

  for (const admin of adminUsers) {
    const companiesToRemove = await db`
      SELECT c.id, c.name
      FROM users_on_company uoc
      INNER JOIN companies c ON uoc.company_id = c.id
      WHERE uoc.user_id = ${admin.id}
        AND (c.source IS NULL OR c.source != 'customer')
    `;

    // Filter out the 3 companies we want to keep
    const toRemove = companiesToRemove.filter(
      (c) => !companyIds.includes((c as { id: string }).id)
    );

    if (toRemove.length > 0) {
      logger.info(`  Removing ${admin.email} from ${toRemove.length} companies...`);
      for (const company of toRemove) {
        await db`
          DELETE FROM users_on_company
          WHERE user_id = ${admin.id} AND company_id = ${company.id}
        `;
      }
    }
  }

  logger.info("✅ Cleanup completed!");

  // Delete other account companies (non-customer) not in the target list
  logger.info("\n🗑️  Deleting other account companies not in target list...");
  const placeholders = companyIds.map((_, i) => `$${i + 1}`).join(", ");
  const otherCompanies = await db.unsafe(
    `SELECT id, name FROM companies WHERE (source IS NULL OR source != 'customer') AND id NOT IN (${placeholders})`,
    companyIds
  );
  for (const oc of otherCompanies) {
    logger.info(`  - Deleting: ${oc.name} (${oc.id})`);
    // Remove memberships to avoid FK issues
    await db`DELETE FROM users_on_company WHERE company_id = ${oc.id}`;
    // Delete documents for the company
    await db`DELETE FROM documents WHERE company_id = ${oc.id}`;
    // Delete the company
    await db`DELETE FROM companies WHERE id = ${oc.id}`;
  }
  logger.info("✅ Deletion completed!");

  // Add ALL admin users to target ACCOUNT companies
  let totalAddedCount = 0;
  let totalSkippedCount = 0;

  for (const admin of adminUsers) {
    logger.info(`\n👤 Processing admin: ${admin.email}...`);
    let addedCount = 0;
    let skippedCount = 0;

    for (const company of ensuredCompanies) {
      // Check if already a member
      const existing = await db`
        SELECT id FROM users_on_company 
        WHERE user_id = ${admin.id} AND company_id = ${company.id}
      `;

      if (existing.length === 0) {
        await db`
          INSERT INTO users_on_company (user_id, company_id, role, created_at)
          VALUES (${admin.id}, ${company.id}, 'admin', ${now()})
          ON CONFLICT (user_id, company_id) DO NOTHING
        `;
        logger.info(`  ✓ Added ${admin.email} to ${company.name}`);
        addedCount++;
      } else {
        skippedCount++;
      }
    }

    logger.info(
      `  ✅ ${admin.email}: Added to ${addedCount} new companies, already member of ${skippedCount}`
    );
    totalAddedCount += addedCount;
    totalSkippedCount += skippedCount;
  }

  logger.info("\n✅ Completed!");
  logger.info(`   - Total added: ${totalAddedCount} new memberships`);
  logger.info(`   - Total already members: ${totalSkippedCount}`);
  logger.info(`   - Account companies: ${ensuredCompanies.length}`);
  logger.info(`   - Admin users processed: ${adminUsers.length}`);

  // Set active company for admin users to the first target company
  if (ensuredCompanies.length > 0) {
    const primaryCompanyId = ensuredCompanies[0].id;
    logger.info("\n🏷️  Setting active company for admin users...");
    for (const admin of adminUsers) {
      await db`
        UPDATE users SET company_id = ${primaryCompanyId}, updated_at = NOW()
        WHERE id = ${admin.id}
      `;
    }
    logger.info("  ✓ Active company set for all admin users");
  }

  // Seed exactly 25 documents per company and a few projects connected to each company
  logger.info("\n📄 Seeding documents and projects for each company...");
  for (const company of ensuredCompanies) {
    // Reset documents for deterministic state
    await db`DELETE FROM documents WHERE company_id = ${company.id}`;
    const docTitles = [
      "Ugovor o saradnji",
      "Faktura 001",
      "Faktura 002",
      "Sertifikat ISO",
      "Ponuda 2025/01",
      "Politika bezbednosti",
      "Plan projekata",
      "Specifikacija usluga",
      "NDA",
      "Ugovor o licenci",
      "Pravilnik o radu",
      "Procena rizika",
      "Plan kvaliteta",
      "Faktura 003",
      "Faktura 004",
      "Garancija",
      "Uputstvo",
      "Izveštaj Q1",
      "Izveštaj Q2",
      "Plan budžeta",
      "Tehnička dokumentacija",
      "Specifikacija proizvoda",
      "Ponuda 2025/02",
      "Sertifikat bezbednosti",
      "Zapisnik",
    ];
    const createdDocIds: string[] = [];
    for (let i = 0; i < 25; i++) {
      const title = `${docTitles[i % docTitles.length]} - ${company.name}`;
      const name = `${title.replace(/\s+/g, "_")}_${i + 1}.pdf`;
      const doc = await documentQueries.create({
        name,
        pathTokens: [company.id, name],
        metadata: {
          mimetype: "application/pdf",
          originalName: name,
          size: 2048 + i,
        },
        companyId: company.id,
        ownerId: (adminUsers[0] as { id: string }).id,
      });
      createdDocIds.push(doc.id);
      await documentQueries.updateProcessingStatus([name], company.id, "completed");
      await db`UPDATE documents SET title = ${title} WHERE id = ${doc.id}`;
    }
    logger.info(`  ✓ Seeded 25 documents for ${company.name}`);
    const docCount = await documentQueries.count(company.id);
    logger.info(`     • Document count: ${docCount}`);

    // Create document tags per company and assign based on title
    const tagDefs = [
      { name: "Ugovori", slug: "ugovor" },
      { name: "Fakture", slug: "faktura" },
      { name: "Sertifikati", slug: "sertifikat" },
      { name: "Ponude", slug: "ponuda" },
    ];
    const tagIds = await documentTagQueries.upsert(
      tagDefs.map((t) => ({ ...t, companyId: company.id }))
    );
    const tagIdBySlug: Record<string, string> = {};
    tagIds.forEach((t) => {
      tagIdBySlug[t.slug] = t.id;
    });
    const assignments: Array<{
      documentId: string;
      tagId: string;
      companyId: string;
    }> = [];
    for (const docId of createdDocIds) {
      const [row] = await db`SELECT title FROM documents WHERE id = ${docId}`;
      const t: string = row.title as string;
      if (t.includes("Ugovor"))
        assignments.push({
          documentId: docId,
          tagId: tagIdBySlug.ugovor,
          companyId: company.id,
        });
      if (t.includes("Faktura"))
        assignments.push({
          documentId: docId,
          tagId: tagIdBySlug.faktura,
          companyId: company.id,
        });
      if (t.includes("Sertifikat"))
        assignments.push({
          documentId: docId,
          tagId: tagIdBySlug.sertifikat,
          companyId: company.id,
        });
      if (t.includes("Ponuda"))
        assignments.push({
          documentId: docId,
          tagId: tagIdBySlug.ponuda,
          companyId: company.id,
        });
    }
    await documentTagAssignmentQueries.createMany(assignments);

    // Create several customers (contacts) for this company
    const contacts: string[] = [];
    const baseEmails = ["sales", "accounting", "office", "it", "support"];
    for (let ci = 0; ci < 5; ci++) {
      const email = `${baseEmails[ci]}@${company.name.replace(/\s+/g, "").toLowerCase()}.customers.rs`;
      const newContact: Contact = {
        id: generateUUID(),
        firstName: "Kupac",
        lastName: `${ci + 1}`,
        email,
        phone: `+381 60 000 0${100 + ci}`,
        company: `${company.name} Kupac ${ci + 1}`,
        position: "",
        address: {
          street: "",
          city: "Beograd",
          state: "",
          postalCode: "11000",
          country: "Serbia",
        },
        notes: null,
        leadId: null,
        createdAt: now(),
        updatedAt: now(),
      };
      const c = await contactQueries.create(newContact);
      contacts.push(c.id);
    }

    // Create 3 projects linked via client_id (contact) when available
    const projectNames = ["Implementacija CRM", "Migracija na cloud", "Razvoj portala"];
    for (const pName of projectNames) {
      await projectQueries.create({
        id: generateUUID(),
        name: pName,
        description: `${pName} za ${company.name}`,
        status: "planning",
        startDate: now(),
        endDate: undefined,
        budget: undefined,
        currency: "EUR",
        clientId: contacts[0] || undefined,
        dealId: undefined,
        managerId: (adminUsers[0] as { id: string }).id,
        teamMembers: [],
        tags: [],
        createdAt: now(),
        updatedAt: now(),
      });
    }
    logger.info(`  ✓ Created projects for ${company.name}`);

    // Create 3 quotes with items
    const quoteStatuses = ["draft", "sent", "accepted"] as const;
    const productNames = [
      "Konzultantske usluge",
      "Razvoj softvera",
      "Održavanje sistema",
      "Cloud usluge",
    ];
    const quotesCreatedIds: string[] = [];
    for (let qi = 0; qi < 3; qi++) {
      const qid = generateUUID();
      const items = Array.from({ length: 3 }).map((_, idx) => {
        const quantity = 1 + idx;
        const unitPrice = 500 + idx * 250;
        const discount = idx === 2 ? 10 : 0;
        const total = quantity * unitPrice * (1 - discount / 100);
        return {
          productName: productNames[(qi + idx) % productNames.length],
          description: `Stavka ${idx + 1}`,
          quantity,
          unitPrice,
          discount,
          total,
        };
      });
      const subtotal = items.reduce((s, i) => s + i.total, 0);
      const taxRate = 20;
      const tax = subtotal * (taxRate / 100);
      const total = subtotal + tax;
      const issueDate = new Date().toISOString();
      const validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

      const quoteNumber = await quoteQueries.generateNumber();
      await quoteQueries.create(
        {
          id: qid,
          quoteNumber,
          companyId: company.id,
          contactId: contacts[qi % contacts.length] || undefined,
          status: quoteStatuses[qi],
          issueDate,
          validUntil,
          subtotal,
          taxRate,
          tax,
          total,
          notes: `Ponuda ${qi + 1} za ${company.name}`,
          terms: undefined,
          createdBy: (adminUsers[0] as { id: string }).id,
          createdAt: issueDate,
          updatedAt: issueDate,
        },
        items
      );
      quotesCreatedIds.push(qid);
    }
    logger.info(`  ✓ Created quotes for ${company.name}`);

    // Create 3 invoices, one linked to a quote when possible
    const invoiceStatuses = ["sent", "paid", "overdue"] as const;
    const invoicesCreatedIds: string[] = [];
    for (let ii = 0; ii < 3; ii++) {
      const iid = generateUUID();
      const items = Array.from({ length: 2 }).map((_, idx) => {
        const quantity = 2 + idx;
        const unitPrice = 800 + idx * 300;
        const discount = idx === 1 ? 5 : 0;
        const total = quantity * unitPrice * (1 - discount / 100);
        return {
          productName: productNames[(ii + idx) % productNames.length],
          description: `Faktura stavka ${idx + 1}`,
          quantity,
          unitPrice,
          discount,
          total,
        };
      });
      const subtotal = items.reduce((s, i) => s + i.total, 0);
      const taxRate = 20;
      const tax = subtotal * (taxRate / 100);
      const total = subtotal + tax;
      const status = invoiceStatuses[ii];
      const paidAmount = status === "paid" ? total : 0;
      const issueDate = new Date().toISOString();
      const dueDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();

      const invoiceNumber = await invoiceQueries.generateNumber();
      const customerCompany =
        customerCompanies[(ii + ensuredCompanies.indexOf(company)) % customerCompanies.length];
      const customerContactId = undefined;
      const fromDetails = {
        name: company.name,
        address: desiredCompanies.find((d) => d.name === company.name)?.address,
        city: desiredCompanies.find((d) => d.name === company.name)?.city,
        zip: desiredCompanies.find((d) => d.name === company.name)?.zip,
        country: desiredCompanies.find((d) => d.name === company.name)?.country,
        email: desiredCompanies.find((d) => d.name === company.name)?.email,
        phone: desiredCompanies.find((d) => d.name === company.name)?.phone,
        vatNumber: desiredCompanies.find((d) => d.name === company.name)?.vatNumber,
        companyNumber: desiredCompanies.find((d) => d.name === company.name)?.companyNumber,
        website: desiredCompanies.find((d) => d.name === company.name)?.website,
      };
      const customerDetails = {
        name: customerCompany.name,
        address: customerCompany.address,
        city: customerCompany.city,
        zip: customerCompany.zip,
        country: customerCompany.country,
        email: customerCompany.email,
        phone: customerCompany.phone,
        vatNumber: customerCompany.vatNumber,
        companyNumber: customerCompany.companyNumber,
        website: customerCompany.website,
      };
      await invoiceQueries.create(
        {
          id: iid,
          invoiceNumber,
          quoteId: quotesCreatedIds[ii] || undefined,
          companyId: company.id,
          contactId: customerContactId,
          status,
          issueDate,
          dueDate,
          grossTotal: subtotal,
          subtotal,
          discount: 0,
          taxRate,
          vatRate: 20,
          tax,
          total,
          paidAmount,
          currency: "EUR",
          notes: `Faktura ${ii + 1} za ${company.name}`,
          terms: undefined,
          fromDetails,
          customerDetails,
          logoUrl: undefined,
          templateSettings: undefined,
          createdBy: (adminUsers[0] as { id: string }).id,
          createdAt: issueDate,
          updatedAt: issueDate,
        },
        items
      );
      invoicesCreatedIds.push(iid);
    }
    logger.info(`  ✓ Created invoices for ${company.name}`);

    // Create 3 orders, optionally linked to above quote/invoice
    const orderStatuses = ["pending", "processing", "completed"] as const;
    for (let oi = 0; oi < 3; oi++) {
      const items = Array.from({ length: 2 }).map((_, idx) => {
        const quantity = 1 + idx;
        const unitPrice = 600 + idx * 200;
        const discount = idx === 1 ? 0 : 0;
        const total = quantity * unitPrice * (1 - discount / 100);
        return {
          productName: productNames[(oi + idx) % productNames.length],
          description: `Naručivanje stavka ${idx + 1}`,
          quantity,
          unitPrice,
          discount,
          total,
        };
      });
      const subtotal = items.reduce((s, i) => s + i.total, 0);
      const tax = subtotal * 0.2;
      const total = subtotal + tax;
      await orderQueries.create(
        {
          companyId: company.id,
          contactId: contacts[oi % contacts.length] || undefined,
          quoteId: quotesCreatedIds[oi] || undefined,
          invoiceId: invoicesCreatedIds[oi] || undefined,
          status: orderStatuses[oi],
          subtotal,
          tax,
          total,
          currency: "EUR",
          notes: `Narudžba ${oi + 1} za ${company.name}`,
          createdBy: (adminUsers[0] as { id: string }).id,
        },
        items
      );
    }
    logger.info(`  ✓ Created orders for ${company.name}`);
    const finalDocCount = await documentQueries.count(company.id);
    logger.info(`     • Final document count for ${company.name}: ${finalDocCount}`);
  }
}

// Run if executed directly
if (import.meta.main) {
  addAdminToAllCompanies()
    .then(async () => {
      logger.info("\n✨ Script completed successfully!");
      await db.end();
      process.exit(0);
    })
    .catch(async (error) => {
      logger.error("\n❌ Script failed:", error);
      await db.end();
      process.exit(1);
    });
}
