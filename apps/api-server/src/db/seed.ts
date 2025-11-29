import type { Company, User, Project, Task, Milestone, Quote, Invoice, DeliveryNote } from "@crm/types";
import { generateUUID, now } from "@crm/utils";
import { companyQueries } from "./queries/companies";
import { userQueries } from "./queries/users";
import { authQueries } from "./queries/auth";
import { projectQueries, taskQueries, milestoneQueries } from "./queries";
import { quoteQueries, invoiceQueries, deliveryNoteQueries } from "./queries";
import db from "./client";

// Default password for seed users (development only)
const DEFAULT_SEED_PASSWORD = "changeme123";

// ============================================
// Sample Companies
// ============================================

const companies: Company[] = [
  {
    id: generateUUID(),
    name: "TechCorp Industries",
    industry: "Technology",
    address: "123 Silicon Valley Blvd, San Francisco, CA 94105",
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: generateUUID(),
    name: "Global Finance Partners",
    industry: "Finance",
    address: "456 Wall Street, New York, NY 10005",
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: generateUUID(),
    name: "HealthFirst Medical",
    industry: "Healthcare",
    address: "789 Medical Center Dr, Boston, MA 02115",
    createdAt: now(),
    updatedAt: now(),
  },
];

// ============================================
// Sample Users (will be assigned to companies)
// ============================================

function createUsers(companyIds: string[]): User[] {
  return [
    {
      id: generateUUID(),
      firstName: "John",
      lastName: "Admin",
      email: "admin@crm.local",
      role: "admin",
      companyId: companyIds[0], // TechCorp
      status: "active",
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: generateUUID(),
      firstName: "Sarah",
      lastName: "Johnson",
      email: "sarah.johnson@techcorp.com",
      role: "user",
      companyId: companyIds[0], // TechCorp
      status: "active",
      phone: "+1-555-0101",
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: generateUUID(),
      firstName: "Michael",
      lastName: "Chen",
      email: "michael.chen@globalfinance.com",
      role: "user",
      companyId: companyIds[1], // Global Finance
      status: "active",
      phone: "+1-555-0102",
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: generateUUID(),
      firstName: "Emily",
      lastName: "Davis",
      email: "emily.davis@healthfirst.com",
      role: "admin",
      companyId: companyIds[2], // HealthFirst
      status: "active",
      phone: "+1-555-0103",
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: generateUUID(),
      firstName: "James",
      lastName: "Wilson",
      email: "james.wilson@crm.local",
      role: "user",
      companyId: undefined, // No company assigned
      status: "active",
      createdAt: now(),
      updatedAt: now(),
    },
  ];
}

// ============================================
// Sample Projects (will be assigned to users)
// ============================================

function createProjects(userIds: string[]): Project[] {
  return [
    {
      id: generateUUID(),
      name: "CRM System Upgrade",
      description: "Modernize the existing CRM platform with new features",
      status: "in_progress",
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days from now
      budget: 50000,
      currency: "USD",
      managerId: userIds[0], // Admin
      teamMembers: [userIds[1], userIds[2]],
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: generateUUID(),
      name: "Mobile App Development",
      description: "Build a cross-platform mobile app for sales team",
      status: "planning",
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      endDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(), // 120 days from now
      budget: 100000,
      currency: "USD",
      managerId: userIds[1],
      teamMembers: [userIds[0], userIds[3]],
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: generateUUID(),
      name: "Data Migration Project",
      description: "Migrate legacy data to the new database system",
      status: "completed",
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      budget: 25000,
      currency: "USD",
      managerId: userIds[2],
      teamMembers: [userIds[0]],
      createdAt: now(),
      updatedAt: now(),
    },
  ];
}

function createMilestones(projectIds: string[]): Milestone[] {
  return [
    {
      id: generateUUID(),
      name: "Requirements Analysis",
      description: "Complete all requirement gathering and documentation",
      projectId: projectIds[0],
      status: "completed",
      dueDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      completedDate: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
      order: 1,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: generateUUID(),
      name: "Development Phase 1",
      description: "Complete core functionality development",
      projectId: projectIds[0],
      status: "in_progress",
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      order: 2,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: generateUUID(),
      name: "User Testing",
      description: "Conduct UAT with key stakeholders",
      projectId: projectIds[0],
      status: "pending",
      dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      order: 3,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: generateUUID(),
      name: "Project Kickoff",
      description: "Initial planning and team assembly",
      projectId: projectIds[1],
      status: "pending",
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      order: 1,
      createdAt: now(),
      updatedAt: now(),
    },
  ];
}

function createTasks(projectIds: string[], milestoneIds: string[], userIds: string[]): Task[] {
  return [
    {
      id: generateUUID(),
      title: "Design database schema",
      description: "Create ERD and define all tables for the new system",
      status: "done",
      priority: "high",
      projectId: projectIds[0],
      milestoneId: milestoneIds[0],
      assignedTo: userIds[1],
      dueDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      estimatedHours: 16,
      actualHours: 14,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: generateUUID(),
      title: "Implement user authentication",
      description: "Set up JWT-based authentication system",
      status: "in_progress",
      priority: "high",
      projectId: projectIds[0],
      milestoneId: milestoneIds[1],
      assignedTo: userIds[0],
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      estimatedHours: 24,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: generateUUID(),
      title: "Create API endpoints",
      description: "Build REST API for all CRUD operations",
      status: "todo",
      priority: "medium",
      projectId: projectIds[0],
      milestoneId: milestoneIds[1],
      assignedTo: userIds[2],
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      estimatedHours: 40,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: generateUUID(),
      title: "Write documentation",
      description: "Create user and technical documentation",
      status: "todo",
      priority: "low",
      projectId: projectIds[0],
      dueDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString(),
      estimatedHours: 20,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: generateUUID(),
      title: "Setup CI/CD pipeline",
      description: "Configure automated testing and deployment",
      status: "review",
      priority: "medium",
      projectId: projectIds[0],
      assignedTo: userIds[0],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      estimatedHours: 8,
      actualHours: 10,
      createdAt: now(),
      updatedAt: now(),
    },
  ];
}

// ============================================
// Sample Sales Data
// ============================================

function createQuotes(companyIds: string[], userIds: string[]): { quote: Omit<Quote, "items">; items: Omit<Quote["items"][0], "id" | "quoteId">[] }[] {
  return [
    {
      quote: {
        id: generateUUID(),
        quoteNumber: "QUO-2025-00001",
        companyId: companyIds[0],
        status: "sent",
        issueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        validUntil: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        subtotal: 15000,
        taxRate: 20,
        tax: 3000,
        total: 18000,
        notes: "Quote for CRM implementation services",
        createdBy: userIds[0],
        createdAt: now(),
        updatedAt: now(),
      },
      items: [
        { productName: "CRM Setup", description: "Initial system configuration", quantity: 1, unitPrice: 5000, discount: 0, total: 5000 },
        { productName: "Training", description: "User training sessions", quantity: 10, unitPrice: 500, discount: 0, total: 5000 },
        { productName: "Support Package", description: "6 months premium support", quantity: 1, unitPrice: 5000, discount: 0, total: 5000 },
      ],
    },
    {
      quote: {
        id: generateUUID(),
        quoteNumber: "QUO-2025-00002",
        companyId: companyIds[1],
        status: "accepted",
        issueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        subtotal: 8500,
        taxRate: 20,
        tax: 1700,
        total: 10200,
        createdBy: userIds[1],
        createdAt: now(),
        updatedAt: now(),
      },
      items: [
        { productName: "Consulting", description: "Business process consulting", quantity: 20, unitPrice: 200, discount: 0, total: 4000 },
        { productName: "Software License", description: "Annual license", quantity: 1, unitPrice: 4500, discount: 0, total: 4500 },
      ],
    },
  ];
}

function createInvoices(companyIds: string[], quoteIds: string[], userIds: string[]): { invoice: Omit<Invoice, "items">; items: Omit<Invoice["items"][0], "id" | "invoiceId">[] }[] {
  return [
    {
      invoice: {
        id: generateUUID(),
        invoiceNumber: "INV-2025-00001",
        quoteId: quoteIds[1], // Based on accepted quote
        companyId: companyIds[1],
        status: "paid",
        issueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        subtotal: 8500,
        taxRate: 20,
        tax: 1700,
        total: 10200,
        paidAmount: 10200,
        createdBy: userIds[0],
        createdAt: now(),
        updatedAt: now(),
      },
      items: [
        { productName: "Consulting", description: "Business process consulting", quantity: 20, unitPrice: 200, discount: 0, total: 4000 },
        { productName: "Software License", description: "Annual license", quantity: 1, unitPrice: 4500, discount: 0, total: 4500 },
      ],
    },
    {
      invoice: {
        id: generateUUID(),
        invoiceNumber: "INV-2025-00002",
        companyId: companyIds[2],
        status: "sent",
        issueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        dueDate: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000).toISOString(),
        subtotal: 12000,
        taxRate: 20,
        tax: 2400,
        total: 14400,
        paidAmount: 0,
        notes: "Healthcare data integration project",
        createdBy: userIds[1],
        createdAt: now(),
        updatedAt: now(),
      },
      items: [
        { productName: "Data Integration", description: "EHR system integration", quantity: 1, unitPrice: 8000, discount: 0, total: 8000 },
        { productName: "Custom Development", description: "Additional custom features", quantity: 20, unitPrice: 200, discount: 0, total: 4000 },
      ],
    },
  ];
}

function createDeliveryNotes(companyIds: string[], invoiceIds: string[], userIds: string[]): { note: Omit<DeliveryNote, "items">; items: Omit<DeliveryNote["items"][0], "id" | "deliveryNoteId">[] }[] {
  return [
    {
      note: {
        id: generateUUID(),
        deliveryNumber: "DEL-2025-00001",
        invoiceId: invoiceIds[0],
        companyId: companyIds[1],
        status: "delivered",
        shipDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        deliveryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        shippingAddress: "456 Wall Street, New York, NY 10005",
        trackingNumber: "TRK123456789",
        carrier: "FedEx",
        createdBy: userIds[0],
        createdAt: now(),
        updatedAt: now(),
      },
      items: [
        { productName: "Software License Key", description: "License activation code", quantity: 1, unit: "pcs" },
        { productName: "Documentation Package", description: "User manuals and guides", quantity: 1, unit: "set" },
      ],
    },
    {
      note: {
        id: generateUUID(),
        deliveryNumber: "DEL-2025-00002",
        companyId: companyIds[0],
        status: "pending",
        shippingAddress: "123 Silicon Valley Blvd, San Francisco, CA 94105",
        notes: "Please call before delivery",
        createdBy: userIds[1],
        createdAt: now(),
        updatedAt: now(),
      },
      items: [
        { productName: "Hardware Kit", description: "Server hardware components", quantity: 3, unit: "pcs" },
        { productName: "Installation Media", description: "USB drives with software", quantity: 5, unit: "pcs" },
      ],
    },
  ];
}

// ============================================
// Seed Functions
// ============================================

async function seedCompanies(): Promise<string[]> {
  console.log("📦 Seeding companies...");
  const ids: string[] = [];

  for (const company of companies) {
    try {
      const existing = await companyQueries.findByName(company.name);
      if (existing) {
        console.log(`  ⏭️  Company "${company.name}" already exists`);
        ids.push(existing.id);
      } else {
        const created = await companyQueries.createWithId(company);
        console.log(`  ✅ Created company: ${created.name}`);
        ids.push(created.id);
      }
    } catch (error) {
      console.error(`  ❌ Failed to create company ${company.name}:`, error);
    }
  }

  return ids;
}

async function seedUsers(companyIds: string[]): Promise<void> {
  console.log("👥 Seeding users...");
  const users = createUsers(companyIds);

  for (const user of users) {
    try {
      const existing = await userQueries.findByEmail(user.email);
      if (existing) {
        console.log(`  ⏭️  User "${user.email}" already exists`);
      } else {
        const created = await userQueries.createWithId(user);
        console.log(
          `  ✅ Created user: ${created.firstName} ${created.lastName} (${created.email})`
        );
      }
    } catch (error) {
      console.error(`  ❌ Failed to create user ${user.email}:`, error);
    }
  }
}

async function seedAuthCredentials(): Promise<void> {
  console.log("🔐 Seeding auth credentials...");
  
  // Hash the default password using Bun
  const passwordHash = await Bun.password.hash(DEFAULT_SEED_PASSWORD, {
    algorithm: "bcrypt",
    cost: 12,
  });
  
  // Get all users
  const users = await db`SELECT id, email FROM users`;
  
  for (const user of users) {
    try {
      const exists = await authQueries.credentialsExist(user.id as string);
      if (exists) {
        console.log(`  ⏭️  Credentials for "${user.email}" already exist`);
      } else {
        await authQueries.createCredentials(user.id as string, passwordHash);
        console.log(`  ✅ Created credentials for: ${user.email}`);
      }
    } catch (error) {
      console.error(`  ❌ Failed to create credentials for ${user.email}:`, error);
    }
  }
  
  console.log(`\n  ℹ️  Default password for all seed users: "${DEFAULT_SEED_PASSWORD}"`);
}

async function clearSeedData(): Promise<void> {
  console.log("🗑️  Clearing seed data...");

  // Delete users first (due to FK constraints)
  const users = createUsers(companies.map((c) => c.id));
  for (const user of users) {
    try {
      const existing = await userQueries.findByEmail(user.email);
      if (existing) {
        await userQueries.delete(existing.id);
        console.log(`  ✅ Deleted user: ${user.email}`);
      }
    } catch (error) {
      console.error(`  ❌ Failed to delete user ${user.email}:`, error);
    }
  }

  // Delete companies
  for (const company of companies) {
    try {
      const existing = await companyQueries.findByName(company.name);
      if (existing) {
        await companyQueries.delete(existing.id);
        console.log(`  ✅ Deleted company: ${company.name}`);
      }
    } catch (error) {
      console.error(`  ❌ Failed to delete company ${company.name}:`, error);
    }
  }
}

async function seedProjects(userIds: string[]): Promise<string[]> {
  console.log("📁 Seeding projects...");
  const ids: string[] = [];
  const projects = createProjects(userIds);

  for (const project of projects) {
    try {
      const created = await projectQueries.create(project);
      console.log(`  ✅ Created project: ${created.name}`);
      ids.push(created.id);
    } catch (error) {
      console.error(`  ❌ Failed to create project ${project.name}:`, error);
    }
  }

  return ids;
}

async function seedMilestones(projectIds: string[]): Promise<string[]> {
  console.log("🎯 Seeding milestones...");
  const ids: string[] = [];
  const milestones = createMilestones(projectIds);

  for (const milestone of milestones) {
    try {
      const created = await milestoneQueries.create(milestone);
      console.log(`  ✅ Created milestone: ${created.name}`);
      ids.push(created.id);
    } catch (error) {
      console.error(`  ❌ Failed to create milestone ${milestone.name}:`, error);
    }
  }

  return ids;
}

async function seedTasks(projectIds: string[], milestoneIds: string[], userIds: string[]): Promise<void> {
  console.log("✅ Seeding tasks...");
  const tasks = createTasks(projectIds, milestoneIds, userIds);

  for (const task of tasks) {
    try {
      const created = await taskQueries.create(task);
      console.log(`  ✅ Created task: ${created.title}`);
    } catch (error) {
      console.error(`  ❌ Failed to create task ${task.title}:`, error);
    }
  }
}

async function seedQuotes(companyIds: string[], userIds: string[]): Promise<string[]> {
  console.log("📝 Seeding quotes...");
  const ids: string[] = [];
  const quotes = createQuotes(companyIds, userIds);

  for (const { quote, items } of quotes) {
    try {
      const created = await quoteQueries.create(quote, items);
      console.log(`  ✅ Created quote: ${created.quoteNumber}`);
      ids.push(created.id);
    } catch (error) {
      console.error(`  ❌ Failed to create quote ${quote.quoteNumber}:`, error);
    }
  }

  return ids;
}

async function seedInvoices(companyIds: string[], quoteIds: string[], userIds: string[]): Promise<string[]> {
  console.log("💵 Seeding invoices...");
  const ids: string[] = [];
  const invoices = createInvoices(companyIds, quoteIds, userIds);

  for (const { invoice, items } of invoices) {
    try {
      const created = await invoiceQueries.create(invoice, items);
      console.log(`  ✅ Created invoice: ${created.invoiceNumber}`);
      ids.push(created.id);
    } catch (error) {
      console.error(`  ❌ Failed to create invoice ${invoice.invoiceNumber}:`, error);
    }
  }

  return ids;
}

async function seedDeliveryNotes(companyIds: string[], invoiceIds: string[], userIds: string[]): Promise<void> {
  console.log("📦 Seeding delivery notes...");
  const notes = createDeliveryNotes(companyIds, invoiceIds, userIds);

  for (const { note, items } of notes) {
    try {
      const created = await deliveryNoteQueries.create(note, items);
      console.log(`  ✅ Created delivery note: ${created.deliveryNumber}`);
    } catch (error) {
      console.error(`  ❌ Failed to create delivery note ${note.deliveryNumber}:`, error);
    }
  }
}

export async function seed(): Promise<void> {
  console.log("\n🌱 Starting database seed...\n");

  try {
    // Seed companies first
    const companyIds = await seedCompanies();
    console.log("");

    // Then seed users with company references
    await seedUsers(companyIds);
    console.log("");

    // Seed auth credentials for users
    await seedAuthCredentials();
    console.log("");

    // Get created user IDs
    const users = await db`SELECT id FROM users ORDER BY created_at ASC`;
    const userIds = users.map((u) => u.id as string);

    // Seed projects
    const projectIds = await seedProjects(userIds);
    console.log("");

    // Seed milestones
    const milestoneIds = await seedMilestones(projectIds);
    console.log("");

    // Seed tasks
    await seedTasks(projectIds, milestoneIds, userIds);
    console.log("");

    // Seed quotes
    const quoteIds = await seedQuotes(companyIds, userIds);
    console.log("");

    // Seed invoices
    const invoiceIds = await seedInvoices(companyIds, quoteIds, userIds);
    console.log("");

    // Seed delivery notes
    await seedDeliveryNotes(companyIds, invoiceIds, userIds);
    console.log("");

    // Summary
    const companyCount = await companyQueries.count();
    const userCount = await userQueries.count();
    const projectCount = await db`SELECT COUNT(*) FROM projects`;
    const taskCount = await taskQueries.count();
    const milestoneCount = await milestoneQueries.count();
    const quoteCount = await quoteQueries.count();
    const invoiceCount = await invoiceQueries.count();
    const deliveryCount = await deliveryNoteQueries.count();

    console.log("📊 Seed Summary:");
    console.log(`   Companies: ${companyCount}`);
    console.log(`   Users: ${userCount}`);
    console.log(`   Projects: ${parseInt(projectCount[0].count as string, 10)}`);
    console.log(`   Tasks: ${taskCount}`);
    console.log(`   Milestones: ${milestoneCount}`);
    console.log(`   Quotes: ${quoteCount}`);
    console.log(`   Invoices: ${invoiceCount}`);
    console.log(`   Delivery Notes: ${deliveryCount}`);
    console.log("\n✅ Database seeding completed!\n");
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    throw error;
  }
}

export async function unseed(): Promise<void> {
  console.log("\n🧹 Removing seed data...\n");

  try {
    await clearSeedData();
    console.log("\n✅ Seed data removed!\n");
  } catch (error) {
    console.error("\n❌ Unseed failed:", error);
    throw error;
  }
}

// CLI runner
if (import.meta.main) {
  const command = process.argv[2] || "seed";

  try {
    switch (command) {
      case "seed":
        await seed();
        break;
      case "unseed":
      case "clear":
        await unseed();
        break;
      default:
        console.log(`Unknown command: ${command}`);
        console.log("Available commands: seed, unseed");
        process.exit(1);
    }
    await db.end();
    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error);
    await db.end();
    process.exit(1);
  }
}
