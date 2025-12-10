import { generateUUID, now } from "@crm/utils";
import { logger } from "../lib/logger";
import { sql as db } from "./client";

// ============================================
// Seed Customer Contacts and Account Companies
// ============================================

const FIRST_NAMES = [
  "John",
  "Sarah",
  "Michael",
  "Emily",
  "James",
  "Emma",
  "David",
  "Olivia",
  "Daniel",
  "Sophia",
  "Matthew",
  "Isabella",
  "Andrew",
  "Mia",
  "Christopher",
  "Charlotte",
  "Joshua",
  "Amelia",
  "Ryan",
  "Harper",
  "Nathan",
  "Evelyn",
  "Brandon",
  "Abigail",
  "Kevin",
  "Elizabeth",
  "Justin",
  "Sofia",
  "Tyler",
  "Avery",
  "William",
  "Ella",
  "Joseph",
  "Scarlett",
  "Benjamin",
  "Grace",
  "Samuel",
  "Chloe",
  "Jacob",
  "Victoria",
  "Anthony",
  "Riley",
  "Dylan",
  "Aria",
  "Ethan",
  "Lily",
  "Alexander",
  "Aubrey",
  "Nicholas",
  "Zoey",
  "Robert",
];

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
  "Lee",
  "Perez",
  "Thompson",
  "White",
  "Harris",
  "Sanchez",
  "Clark",
  "Ramirez",
  "Lewis",
  "Robinson",
  "Walker",
  "Young",
  "Allen",
  "King",
  "Wright",
  "Scott",
  "Torres",
  "Nguyen",
  "Hill",
  "Flores",
  "Green",
  "Adams",
  "Nelson",
  "Baker",
  "Hall",
  "Rivera",
  "Campbell",
  "Mitchell",
  "Carter",
  "Roberts",
  "Parker",
];

const POSITIONS = [
  "CEO",
  "CTO",
  "CFO",
  "COO",
  "VP Sales",
  "VP Marketing",
  "Director",
  "Manager",
  "Senior Manager",
  "Head of Operations",
  "Business Development",
  "Account Manager",
  "Sales Manager",
  "Marketing Manager",
  "Operations Manager",
  "Project Manager",
];

const CITIES = [
  "Belgrade",
  "Novi Sad",
  "Niš",
  "Kragujevac",
  "Subotica",
  "Zrenjanin",
  "Pančevo",
  "Čačak",
  "Kraljevo",
  "Smederevo",
  "Leskovac",
  "Valjevo",
  "Kruševac",
  "Vranje",
  "Šabac",
  "Užice",
  "Sombor",
  "Požarevac",
  "Pirot",
  "Zaječar",
];

const STREETS = [
  "Knez Mihailova",
  "Terazije",
  "Kralja Milana",
  "Bulevar Kralja Aleksandra",
  "Nemanjina",
  "Vuka Karadžića",
  "Masarikova",
  "Bulevar Revolucije",
  "Trg Republike",
  "Obilićev venac",
  "Kosovska",
  "Bulevar Despota Stefana",
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function seedCustomerData() {
  logger.info("🌱 Starting customer data seed...");

  try {
    // 1. Get all customer companies (source = 'customer')
    const customerCompanies = await db`
      SELECT id, name FROM companies WHERE source = 'customer' ORDER BY created_at DESC LIMIT 10
    `;

    if (customerCompanies.length === 0) {
      logger.info("⚠️  No customer companies found. Creating some first...");

      // Create 10 customer companies first
      const newCustomerCompanies = [];
      for (let i = 0; i < 10; i++) {
        const companyId = generateUUID();
        const companyName = `Customer Company ${i + 1} d.o.o.`;

        await db`
          INSERT INTO companies (id, name, industry, address, email, source, created_at, updated_at)
          VALUES (
            ${companyId},
            ${companyName},
            'Retail',
            ${`${randomElement(STREETS)} ${randomNumber(1, 100)}, ${randomElement(CITIES)}`},
            ${`contact${i + 1}@customer${i + 1}.com`},
            'customer',
            ${now()},
            ${now()}
          )
        `;

        newCustomerCompanies.push({ id: companyId, name: companyName });
      }

      customerCompanies.push(...newCustomerCompanies);
    }

    logger.info(`📦 Found ${customerCompanies.length} customer companies`);

    // 2. Create 50 customer contacts
    const contacts = [];
    for (let i = 0; i < 50; i++) {
      const firstName = randomElement(FIRST_NAMES);
      const lastName = randomElement(LAST_NAMES);
      const company = randomElement(customerCompanies);
      const position = randomElement(POSITIONS);
      const city = randomElement(CITIES);
      const street = randomElement(STREETS);
      const streetNumber = randomNumber(1, 200);

      const contact = {
        id: generateUUID(),
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${company.name.toLowerCase().replace(/\s+/g, "").replace(/\./g, "")}.com`,
        phone: `+381 ${randomNumber(10, 99)} ${randomNumber(100, 999)} ${randomNumber(1000, 9999)}`,
        company: company.name,
        position,
        street: `${street} ${streetNumber}`,
        city,
        state: null,
        postalCode: `${randomNumber(10000, 99999)}`,
        country: "Serbia",
        notes: `Contact for ${company.name}`,
        createdAt: now(),
        updatedAt: now(),
      };

      contacts.push(contact);
    }

    // Insert contacts in batches
    logger.info("👥 Creating 50 customer contacts...");
    for (const contact of contacts) {
      await db`
        INSERT INTO contacts (
          id, first_name, last_name, email, phone, company, position,
          street, city, state, postal_code, country, notes,
          created_at, updated_at
        ) VALUES (
          ${contact.id}, ${contact.firstName}, ${contact.lastName}, ${contact.email},
          ${contact.phone}, ${contact.company}, ${contact.position},
          ${contact.street}, ${contact.city}, ${contact.state}, ${contact.postalCode},
          ${contact.country}, ${contact.notes}, ${contact.createdAt}, ${contact.updatedAt}
        )
      `;
    }

    logger.info(`✅ Created ${contacts.length} customer contacts`);

    // 3. Create 3 account companies for admin switching
    logger.info("🏢 Creating 3 account companies for admin switching...");
    const accountCompanies = [];
    const accountCompanyNames = [
      "Admin Test Company Alpha",
      "Admin Test Company Beta",
      "Admin Test Company Gamma",
    ];

    for (let i = 0; i < 3; i++) {
      const companyId = generateUUID();
      const companyName = accountCompanyNames[i];

      await db`
        INSERT INTO companies (id, name, industry, address, email, source, created_at, updated_at)
        VALUES (
          ${companyId},
          ${companyName},
          'Technology',
          ${`${randomElement(STREETS)} ${randomNumber(1, 100)}, ${randomElement(CITIES)}`},
          ${`admin${i + 1}@testcompany.com`},
          'account',
          ${now()},
          ${now()}
        )
      `;

      accountCompanies.push({ id: companyId, name: companyName });
    }

    logger.info(
      { companies: accountCompanies.map((c) => c.name) },
      `✅ Created ${accountCompanies.length} account companies`
    );

    // 4. Get first admin user and add them to all 3 account companies
    const adminUser = await db`
      SELECT id, first_name, last_name, email FROM users WHERE role = 'admin' LIMIT 1
    `;

    if (adminUser.length > 0) {
      const admin = adminUser[0];
      logger.info(`👤 Adding admin user (${admin.email}) to all account companies...`);

      for (const company of accountCompanies) {
        // Check if already a member
        const existing = await db`
          SELECT id FROM users_on_company 
          WHERE user_id = ${admin.id} AND company_id = ${company.id}
        `;

        if (existing.length === 0) {
          await db`
            INSERT INTO users_on_company (user_id, company_id, role, created_at)
            VALUES (${admin.id}, ${company.id}, 'admin', ${now()})
          `;
          logger.info(`  ✓ Added admin to ${company.name}`);
        } else {
          logger.info(`  ⏭️  Admin already member of ${company.name}`);
        }
      }
    } else {
      logger.info("⚠️  No admin user found. Create an admin user first.");
    }

    logger.info("✅ Customer data seed completed!");
    return {
      customerContacts: contacts.length,
      accountCompanies: accountCompanies.length,
      customerCompanies: customerCompanies.length,
    };
  } catch (error) {
    logger.error({ error }, "❌ Error seeding customer data");
    throw error;
  }
}

// Run if called directly
if (import.meta.main) {
  seedCustomerData()
    .then((result) => {
      logger.info({ result }, "\n📊 Seed Summary");
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, "Seed failed");
      process.exit(1);
    });
}
