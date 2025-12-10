import type {
  Company,
  DeliveryNote,
  Invoice,
  Milestone,
  Notification,
  NotificationType,
  Order,
  Payment,
  Product,
  ProductCategory,
  Project,
  Quote,
  Task,
  User,
} from "@crm/types";
import { generateUUID, now } from "@crm/utils";
import { logger } from "../lib/logger";
import { sql as db } from "./client";
import {
  deliveryNoteQueries,
  invoiceQueries,
  milestoneQueries,
  orderQueries,
  projectQueries,
  quoteQueries,
  taskQueries,
} from "./queries";
import { authQueries } from "./queries/auth";
import { companyQueries } from "./queries/companies";
import { notificationQueries } from "./queries/notifications";
import { paymentQueries } from "./queries/payments";
import { productCategoryQueries, productQueries } from "./queries/products";
import { userQueries } from "./queries/users";

// Default password for seed users (development only)
const DEFAULT_SEED_PASSWORD = "changeme123";

// ============================================
// Helper Functions for Data Generation
// ============================================

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysAgo: number, daysAhead: number): string {
  const now = Date.now();
  const minTime = now - daysAgo * 24 * 60 * 60 * 1000;
  const maxTime = now + daysAhead * 24 * 60 * 60 * 1000;
  return new Date(randomNumber(minTime, maxTime)).toISOString();
}

function pastDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

function futureDate(daysAhead: number): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
}

// ============================================
// Data Arrays for Generation
// ============================================

const INDUSTRIES = [
  "Technology",
  "Finance",
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Education",
  "Real Estate",
  "Consulting",
  "Logistics",
  "Media",
  "Energy",
  "Telecommunications",
  "Automotive",
  "Hospitality",
  "Agriculture",
];

const COMPANY_PREFIXES = [
  "Tech",
  "Global",
  "Prime",
  "Digital",
  "Smart",
  "Alpha",
  "Beta",
  "Omega",
  "Nova",
  "Quantum",
  "Apex",
  "Zenith",
  "Summit",
  "Vertex",
  "Nexus",
];

const COMPANY_SUFFIXES = [
  "Corp",
  "Industries",
  "Solutions",
  "Partners",
  "Group",
  "Systems",
  "Dynamics",
  "Ventures",
  "Holdings",
  "International",
  "Labs",
  "Works",
];

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
];

const PROJECT_PREFIXES = [
  "CRM",
  "ERP",
  "Mobile App",
  "Web Portal",
  "API",
  "Dashboard",
  "Analytics",
  "Integration",
  "Migration",
  "Automation",
  "Cloud",
  "Security",
  "E-commerce",
  "Platform",
  "Infrastructure",
];

const PROJECT_ACTIONS = [
  "Development",
  "Upgrade",
  "Implementation",
  "Redesign",
  "Optimization",
  "Modernization",
  "Enhancement",
  "Deployment",
  "Integration",
  "Migration",
];

const TASK_VERBS = [
  "Design",
  "Implement",
  "Create",
  "Build",
  "Develop",
  "Configure",
  "Setup",
  "Write",
  "Test",
  "Review",
  "Optimize",
  "Debug",
  "Document",
  "Deploy",
  "Migrate",
];

const TASK_OBJECTS = [
  "database schema",
  "API endpoints",
  "user interface",
  "authentication system",
  "dashboard",
  "reports module",
  "notification system",
  "payment gateway",
  "search functionality",
  "file upload",
  "email templates",
  "admin panel",
  "mobile views",
  "analytics tracking",
  "CI/CD pipeline",
];

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
  "SSL Certificate",
  "Domain Registration",
  "Email Service",
  "Storage Upgrade",
  "Bandwidth Upgrade",
  "User Seats Pack",
  "Admin Module",
  "Workflow Automation",
  "Document Management",
  "CRM Module",
  "Inventory Module",
  "HR Module",
  "Accounting Module",
  "Project Management",
  "Time Tracking",
  "Invoice Module",
  "Quote Generator",
  "Contract Management",
  "Customer Portal",
  "Vendor Portal",
  "Partner Portal",
  "Knowledge Base",
  "Help Desk",
  "Live Chat",
  "Video Conferencing",
  "File Sharing",
  "Team Collaboration",
  "Task Management",
  "Calendar Integration",
  "API Gateway",
];

const _NOTIFICATION_TYPES: NotificationType[] = [
  "invoice_created",
  "invoice_paid",
  "invoice_overdue",
  "quote_created",
  "quote_accepted",
  "quote_rejected",
  "project_created",
  "project_completed",
  "task_assigned",
  "task_completed",
  "task_overdue",
  "lead_assigned",
  "deal_won",
  "deal_lost",
  "info",
  "warning",
  "success",
];

const CITIES = [
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Houston, TX",
  "Phoenix, AZ",
  "Philadelphia, PA",
  "San Antonio, TX",
  "San Diego, CA",
  "Dallas, TX",
  "San Jose, CA",
  "Austin, TX",
  "Jacksonville, FL",
  "Fort Worth, TX",
  "Columbus, OH",
  "Charlotte, NC",
  "San Francisco, CA",
  "Indianapolis, IN",
  "Seattle, WA",
  "Denver, CO",
  "Boston, MA",
];

// ============================================
// Generator Functions
// ============================================

function generateCompanies(count: number): Company[] {
  const companies: Company[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i++) {
    let name: string;
    do {
      const prefix = randomElement(COMPANY_PREFIXES);
      const suffix = randomElement(COMPANY_SUFFIXES);
      name = `${prefix} ${suffix}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    companies.push({
      id: generateUUID(),
      name,
      industry: randomElement(INDUSTRIES),
      address: `${randomNumber(100, 9999)} ${randomElement(["Main St", "Oak Ave", "Park Blvd", "Commerce Dr", "Tech Way"])}, ${randomElement(CITIES)}`,
      createdAt: pastDate(randomNumber(30, 365)),
      updatedAt: now(),
    });
  }

  return companies;
}

function generateUsers(count: number, companyIds: string[]): User[] {
  const users: User[] = [];
  const usedEmails = new Set<string>();

  // First user is always tenant_admin
  users.push({
    id: generateUUID(),
    firstName: "Admin",
    lastName: "User",
    email: "admin@crm.local",
    role: "tenant_admin",
    companyId: companyIds[0],
    status: "active",
    createdAt: pastDate(365),
    updatedAt: now(),
  });
  usedEmails.add("admin@crm.local");

  // Add a deterministic demo user for TechCorp
  users.push({
    id: generateUUID(),
    firstName: "Sarah",
    lastName: "Johnson",
    email: "sarah.johnson@techcorp.com",
    role: "crm_user",
    companyId: companyIds[0],
    status: "active",
    createdAt: pastDate(300),
    updatedAt: now(),
  });
  usedEmails.add("sarah.johnson@techcorp.com");

  for (let i = 1; i < count; i++) {
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    let email: string;
    let counter = 0;
    do {
      const suffix = counter > 0 ? counter.toString() : "";
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${suffix}@example.com`;
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
      phone: `+1-555-${String(randomNumber(1000, 9999)).padStart(4, "0")}`,
      createdAt: pastDate(randomNumber(1, 300)),
      updatedAt: now(),
    });
  }

  return users;
}

function generateProjects(count: number, userIds: string[]): Project[] {
  const projects: Project[] = [];
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
    const durationDays = randomNumber(30, 180);

    projects.push({
      id: generateUUID(),
      name: `${randomElement(PROJECT_PREFIXES)} ${randomElement(PROJECT_ACTIONS)} ${i + 1}`,
      description: `Project for ${randomElement(PROJECT_ACTIONS).toLowerCase()} of ${randomElement(PROJECT_PREFIXES).toLowerCase()} system.`,
      status,
      startDate: pastDate(startDaysAgo),
      endDate:
        status === "completed" ? pastDate(startDaysAgo - durationDays) : futureDate(durationDays),
      budget: randomNumber(10000, 500000),
      currency: "USD",
      managerId: randomElement(userIds),
      teamMembers: [randomElement(userIds), randomElement(userIds)].filter(
        (v, i, a) => a.indexOf(v) === i
      ),
      createdAt: pastDate(startDaysAgo + 10),
      updatedAt: now(),
    });
  }

  return projects;
}

function generateMilestones(count: number, projectIds: string[]): Milestone[] {
  const milestones: Milestone[] = [];
  const statuses: Milestone["status"][] = ["pending", "in_progress", "completed"];

  for (let i = 0; i < count; i++) {
    const status = randomElement(statuses);
    const milestoneNames = [
      "Requirements Analysis",
      "Design Phase",
      "Development Sprint 1",
      "Development Sprint 2",
      "Testing Phase",
      "User Acceptance Testing",
      "Deployment",
      "Go Live",
      "Post-Launch Support",
      "Documentation",
      "Training",
      "Performance Optimization",
      "Security Review",
      "Final Review",
    ];

    milestones.push({
      id: generateUUID(),
      name: `${randomElement(milestoneNames)} - M${i + 1}`,
      description: `Milestone ${i + 1} description`,
      projectId: randomElement(projectIds),
      status,
      dueDate: randomDate(-30, 90),
      completedDate: status === "completed" ? pastDate(randomNumber(1, 30)) : undefined,
      order: (i % 5) + 1,
      createdAt: pastDate(randomNumber(30, 180)),
      updatedAt: now(),
    });
  }

  return milestones;
}

function generateTasks(
  count: number,
  projectIds: string[],
  milestoneIds: string[],
  userIds: string[]
): Task[] {
  const tasks: Task[] = [];
  const statuses: Task["status"][] = ["todo", "in_progress", "review", "done"];
  const priorities: Task["priority"][] = ["low", "medium", "high", "urgent"];

  for (let i = 0; i < count; i++) {
    const status = randomElement(statuses);
    const estimatedHours = randomNumber(2, 80);

    tasks.push({
      id: generateUUID(),
      title: `${randomElement(TASK_VERBS)} ${randomElement(TASK_OBJECTS)}`,
      description: `Task ${i + 1}: ${randomElement(TASK_VERBS)} the ${randomElement(TASK_OBJECTS)} for the project.`,
      status,
      priority: randomElement(priorities),
      projectId: randomElement(projectIds),
      milestoneId: Math.random() > 0.3 ? randomElement(milestoneIds) : undefined,
      assignedTo: Math.random() > 0.2 ? randomElement(userIds) : undefined,
      dueDate: randomDate(-14, 60),
      estimatedHours,
      actualHours:
        status === "done"
          ? randomNumber(Math.floor(estimatedHours * 0.8), Math.floor(estimatedHours * 1.5))
          : undefined,
      createdAt: pastDate(randomNumber(1, 90)),
      updatedAt: now(),
    });
  }

  return tasks;
}

function generateQuotes(
  count: number,
  companyIds: string[],
  userIds: string[]
): { quote: Omit<Quote, "items">; items: Omit<Quote["items"][0], "id" | "quoteId">[] }[] {
  const quotes: {
    quote: Omit<Quote, "items">;
    items: Omit<Quote["items"][0], "id" | "quoteId">[];
  }[] = [];
  const statuses: Quote["status"][] = ["draft", "sent", "accepted", "rejected", "expired"];

  for (let i = 0; i < count; i++) {
    const itemCount = randomNumber(1, 5);
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
        quoteNumber: `QUO-2025-${String(i + 1).padStart(5, "0")}`,
        companyId: randomElement(companyIds),
        status: randomElement(statuses),
        issueDate: pastDate(randomNumber(1, 60)),
        validUntil: futureDate(randomNumber(15, 45)),
        subtotal,
        taxRate,
        tax,
        total,
        notes: Math.random() > 0.5 ? `Quote notes for customer - reference ${i + 1}` : undefined,
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
): { invoice: Omit<Invoice, "items">; items: Omit<Invoice["items"][0], "id" | "invoiceId">[] }[] {
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
    const itemCount = randomNumber(1, 5);
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
        unitPrice,
        discount,
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
        invoiceNumber: `INV-2025-${String(i + 1).padStart(5, "0")}`,
        quoteId: Math.random() > 0.5 && quoteIds.length > 0 ? randomElement(quoteIds) : undefined,
        companyId: randomElement(companyIds),
        status,
        issueDate: pastDate(randomNumber(1, 90)),
        dueDate: randomDate(-30, 60),
        subtotal,
        taxRate,
        tax,
        total,
        paidAmount,
        notes: Math.random() > 0.6 ? `Invoice notes - reference ${i + 1}` : undefined,
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
  quoteIds: string[],
  invoiceIds: string[],
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
    const itemCount = randomNumber(1, 5);
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
        orderNumber: `ORD-2025-${String(i + 1).padStart(5, "0")}`,
        companyId: randomElement(companyIds),
        quoteId: Math.random() > 0.5 && quoteIds.length > 0 ? randomElement(quoteIds) : undefined,
        invoiceId:
          Math.random() > 0.5 && invoiceIds.length > 0 ? randomElement(invoiceIds) : undefined,
        status,
        subtotal,
        tax,
        total,
        currency: "EUR",
        notes: Math.random() > 0.5 ? `Order notes - reference ${i + 1}` : undefined,
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
  const carriers = ["FedEx", "UPS", "DHL", "USPS", "Local Courier"];

  for (let i = 0; i < count; i++) {
    const itemCount = randomNumber(1, 4);
    const items: Omit<DeliveryNote["items"][0], "id" | "deliveryNoteId">[] = [];

    for (let j = 0; j < itemCount; j++) {
      const quantity = randomNumber(1, 10);
      const unitPrice = randomNumber(100, 10000);
      const discount = Math.random() > 0.8 ? randomNumber(5, 15) : 0;
      items.push({
        productName: randomElement(PRODUCT_NAMES),
        description: `Delivery item ${j + 1} description`,
        quantity,
        unit: randomElement(["pcs", "set", "box", "pack"]),
        unitPrice,
        discount,
      });
    }

    const status = randomElement(statuses);

    notes.push({
      note: {
        id: generateUUID(),
        deliveryNumber: `DEL-2025-${String(i + 1).padStart(5, "0")}`,
        invoiceId:
          Math.random() > 0.3 && invoiceIds.length > 0 ? randomElement(invoiceIds) : undefined,
        companyId: randomElement(companyIds),
        status,
        subtotal: 0,
        taxRate: 0,
        tax: 0,
        total: 0,
        shipDate: status !== "pending" ? pastDate(randomNumber(1, 30)) : undefined,
        deliveryDate: status === "delivered" ? pastDate(randomNumber(1, 14)) : undefined,
        shippingAddress: `${randomNumber(100, 9999)} ${randomElement(["Main St", "Oak Ave", "Park Blvd"])}, ${randomElement(CITIES)}`,
        trackingNumber:
          status !== "pending" ? `TRK${randomNumber(100000000, 999999999)}` : undefined,
        carrier: status !== "pending" ? randomElement(carriers) : undefined,
        notes: Math.random() > 0.6 ? `Delivery notes - reference ${i + 1}` : undefined,
        createdBy: randomElement(userIds),
        createdAt: pastDate(randomNumber(1, 60)),
        updatedAt: now(),
      },
      items,
    });
  }

  return notes;
}

function generateProductCategories(): ProductCategory[] {
  const categories: ProductCategory[] = [];

  // Parent categories
  const parentCategories = [
    { name: "Software", description: "Software products and licenses" },
    { name: "Services", description: "Professional services and consulting" },
    { name: "Hardware", description: "Hardware and equipment" },
    { name: "Support", description: "Support and maintenance packages" },
    { name: "Training", description: "Training and education" },
  ];

  const parentIds: string[] = [];

  parentCategories.forEach((cat, i) => {
    const id = generateUUID();
    parentIds.push(id);
    categories.push({
      id,
      name: cat.name,
      description: cat.description,
      parentId: undefined,
      sortOrder: i + 1,
      isActive: true,
      createdAt: pastDate(365),
      updatedAt: now(),
    });
  });

  // Child categories
  const childCategories = [
    { name: "Enterprise Software", parentIndex: 0 },
    { name: "SaaS Solutions", parentIndex: 0 },
    { name: "Consulting", parentIndex: 1 },
    { name: "Implementation", parentIndex: 1 },
    { name: "Servers", parentIndex: 2 },
  ];

  childCategories.forEach((cat, i) => {
    categories.push({
      id: generateUUID(),
      name: cat.name,
      description: `${cat.name} category`,
      parentId: parentIds[cat.parentIndex],
      sortOrder: i + 1,
      isActive: true,
      createdAt: pastDate(300),
      updatedAt: now(),
    });
  });

  return categories;
}

function generateProducts(count: number, categoryIds: string[]): Product[] {
  const products: Product[] = [];

  for (let i = 0; i < count; i++) {
    const basePrice = randomNumber(100, 50000);

    products.push({
      id: generateUUID(),
      sku: `PRD-${String(i + 1).padStart(5, "0")}`,
      name: PRODUCT_NAMES[i % PRODUCT_NAMES.length],
      description: `${PRODUCT_NAMES[i % PRODUCT_NAMES.length]} - comprehensive solution for your business needs.`,
      categoryId: randomElement(categoryIds),
      unitPrice: basePrice,
      costPrice: Math.floor(basePrice * 0.6),
      currency: "USD",
      stockQuantity: randomNumber(0, 500),
      minStockLevel: randomNumber(5, 20),
      unit: randomElement(["pcs", "license", "hour", "month", "year"]),
      taxRate: 0.2,
      isService:
        ["hour", "month", "year"].includes(
          (products[products.length] as unknown as { unit?: string })?.unit ?? "pcs"
        ) || false,
      isActive: Math.random() > 0.1,
      createdAt: pastDate(randomNumber(30, 365)),
      updatedAt: now(),
    });
  }

  return products;
}

function generatePayments(count: number, invoiceIds: string[], userIds: string[]): Payment[] {
  const payments: Payment[] = [];
  const methods: Payment["paymentMethod"][] = [
    "bank_transfer",
    "credit_card",
    "cash",
    "check",
    "other",
  ];
  const statuses: Payment["status"][] = ["completed", "pending", "failed", "refunded"];

  for (let i = 0; i < count; i++) {
    payments.push({
      id: generateUUID(),
      invoiceId: randomElement(invoiceIds),
      amount: randomNumber(500, 50000),
      currency: "USD",
      paymentMethod: randomElement(methods),
      status: randomElement(statuses),
      paymentDate: pastDate(randomNumber(1, 90)),
      reference: `PAY-${randomNumber(100000, 999999)}`,
      transactionId: Math.random() > 0.3 ? `TXN${randomNumber(10000000, 99999999)}` : undefined,
      notes: Math.random() > 0.6 ? `Payment note ${i + 1}` : undefined,
      recordedBy: randomElement(userIds),
      createdAt: pastDate(randomNumber(1, 90)),
      updatedAt: now(),
    });
  }

  return payments;
}

function generateNotifications(count: number, userIds: string[]): Notification[] {
  const notifications: Notification[] = [];
  const messages = [
    {
      type: "invoice_created" as NotificationType,
      title: "New Invoice Created",
      message: "Invoice has been created and is ready for review.",
    },
    {
      type: "invoice_paid" as NotificationType,
      title: "Invoice Paid",
      message: "Payment has been received for your invoice.",
    },
    {
      type: "invoice_overdue" as NotificationType,
      title: "Invoice Overdue",
      message: "Invoice is overdue. Please follow up with the customer.",
    },
    {
      type: "quote_created" as NotificationType,
      title: "New Quote Created",
      message: "A new quote has been created for review.",
    },
    {
      type: "quote_accepted" as NotificationType,
      title: "Quote Accepted",
      message: "Your quote has been accepted by the customer.",
    },
    {
      type: "quote_rejected" as NotificationType,
      title: "Quote Rejected",
      message: "Unfortunately, your quote was rejected.",
    },
    {
      type: "project_created" as NotificationType,
      title: "New Project Started",
      message: "A new project has been created and assigned.",
    },
    {
      type: "project_completed" as NotificationType,
      title: "Project Completed",
      message: "Congratulations! The project has been completed.",
    },
    {
      type: "task_assigned" as NotificationType,
      title: "New Task Assigned",
      message: "You have been assigned a new task.",
    },
    {
      type: "task_completed" as NotificationType,
      title: "Task Completed",
      message: "A task has been marked as completed.",
    },
    {
      type: "task_overdue" as NotificationType,
      title: "Task Overdue",
      message: "A task is overdue and needs attention.",
    },
    {
      type: "deal_won" as NotificationType,
      title: "Deal Won!",
      message: "Congratulations! A deal has been won.",
    },
    {
      type: "info" as NotificationType,
      title: "System Update",
      message: "System maintenance scheduled for this weekend.",
    },
    {
      type: "warning" as NotificationType,
      title: "Action Required",
      message: "Your attention is required on a pending item.",
    },
    {
      type: "success" as NotificationType,
      title: "Success",
      message: "Operation completed successfully.",
    },
  ];

  for (let i = 0; i < count; i++) {
    const template = randomElement(messages);

    notifications.push({
      id: generateUUID(),
      userId: randomElement(userIds),
      type: template.type,
      channel: randomElement(["in_app", "email", "both"]) as "in_app" | "email" | "both",
      title: `${template.title} #${i + 1}`,
      message: template.message,
      link:
        Math.random() > 0.5
          ? `/dashboard/${randomElement(["invoices", "quotes", "projects", "tasks"])}`
          : undefined,
      isRead: Math.random() > 0.6,
      readAt: Math.random() > 0.6 ? pastDate(randomNumber(1, 14)) : undefined,
      emailSent: false,
      createdAt: pastDate(randomNumber(1, 30)),
    });
  }

  return notifications;
}

// ============================================
// Seed Functions
// ============================================

async function seedCompanies(companies: Company[]): Promise<string[]> {
  logger.info("📦 Seeding companies...");
  const ids: string[] = [];

  for (const company of companies) {
    try {
      const existing = await companyQueries.findByName(company.name);
      if (existing) {
        logger.info(`  ⏭️  Company "${company.name}" already exists`);
        ids.push(existing.id);
      } else {
        const created = await companyQueries.createWithId(company);
        logger.info(`  ✅ Created company: ${created.name}`);
        ids.push(created.id);
      }
    } catch (error) {
      logger.error(
        { error, companyName: company.name },
        `  ❌ Failed to create company ${company.name}`
      );
    }
  }

  return ids;
}

async function seedUsers(users: User[]): Promise<string[]> {
  logger.info("👥 Seeding users...");
  const ids: string[] = [];

  for (const user of users) {
    try {
      const existing = await userQueries.findByEmail(user.email);
      if (existing) {
        logger.info(`  ⏭️  User "${user.email}" already exists`);
        ids.push(existing.id);
      } else {
        const created = await userQueries.createWithId(user);
        logger.info(`  ✅ Created user: ${created.firstName} ${created.lastName}`);
        ids.push(created.id);
      }
    } catch (error) {
      logger.error({ error, email: user.email }, `  ❌ Failed to create user ${user.email}`);
    }
  }

  return ids;
}

async function seedAuthCredentials(): Promise<void> {
  logger.info("🔐 Seeding auth credentials...");

  const passwordHash = await Bun.password.hash(DEFAULT_SEED_PASSWORD, {
    algorithm: "bcrypt",
    cost: 12,
  });

  const users = await db`SELECT id, email FROM users`;

  for (const user of users) {
    try {
      const exists = await authQueries.credentialsExist(user.id as string);
      if (exists) {
        logger.info(`  ⏭️  Credentials for "${user.email}" already exist`);
      } else {
        await authQueries.createCredentials(user.id as string, passwordHash);
        logger.info(`  ✅ Created credentials for: ${user.email}`);
      }
    } catch (error) {
      logger.error(
        { error, email: user.email },
        `  ❌ Failed to create credentials for ${user.email}`
      );
    }
  }

  logger.info(`\n  ℹ️  Default password for all seed users: "${DEFAULT_SEED_PASSWORD}"`);
}

async function seedProjects(projects: Project[]): Promise<string[]> {
  logger.info("📁 Seeding projects...");
  const ids: string[] = [];

  for (const project of projects) {
    try {
      const created = await projectQueries.create(project);
      logger.info(`  ✅ Created project: ${created.name}`);
      ids.push(created.id);
    } catch (error) {
      logger.error(
        { error, projectName: project.name },
        `  ❌ Failed to create project ${project.name}`
      );
    }
  }

  return ids;
}

async function seedMilestones(milestones: Milestone[]): Promise<string[]> {
  logger.info("🎯 Seeding milestones...");
  const ids: string[] = [];

  for (const milestone of milestones) {
    try {
      const created = await milestoneQueries.create(milestone);
      logger.info(`  ✅ Created milestone: ${created.name}`);
      ids.push(created.id);
    } catch (error) {
      logger.error(
        { error, milestoneName: milestone.name },
        `  ❌ Failed to create milestone ${milestone.name}`
      );
    }
  }

  return ids;
}

async function seedTasks(tasks: Task[]): Promise<void> {
  logger.info("✅ Seeding tasks...");

  for (const task of tasks) {
    try {
      const created = await taskQueries.create(task);
      logger.info(`  ✅ Created task: ${created.title}`);
    } catch (error) {
      logger.error({ error, taskTitle: task.title }, `  ❌ Failed to create task ${task.title}`);
    }
  }
}

async function seedQuotes(
  quotes: { quote: Omit<Quote, "items">; items: Omit<Quote["items"][0], "id" | "quoteId">[] }[]
): Promise<string[]> {
  logger.info("📝 Seeding quotes...");
  const ids: string[] = [];

  for (const { quote, items } of quotes) {
    try {
      const created = await quoteQueries.create(quote, items);
      logger.info(`  ✅ Created quote: ${created.quoteNumber}`);
      ids.push(created.id);
    } catch (error: unknown) {
      const e = (error as { message?: string; code?: string; detail?: string }) || {};
      logger.error(
        { error, message: e.message },
        `  ❌ Failed to create quote ${quote.quoteNumber}`
      );
      if (e.code) logger.error({ code: e.code }, "     Error code");
      if (e.detail) logger.error({ detail: e.detail }, "     Detail");
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
      const created = await invoiceQueries.create(invoice, items);
      logger.info(`  ✅ Created invoice: ${created.invoiceNumber}`);
      ids.push(created.id);
    } catch (error) {
      logger.error(
        { error, invoiceNumber: invoice.invoiceNumber },
        `  ❌ Failed to create invoice ${invoice.invoiceNumber}`
      );
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
        logger.info(`  ✅ Created order: ${result.data.orderNumber}`);
        ids.push(result.data.id);
      } else {
        logger.error(
          { error: result.error?.message, orderNumber: order.orderNumber },
          `  ❌ Failed to create order ${order.orderNumber}`
        );
      }
    } catch (error: unknown) {
      const e = (error as { message?: string; code?: string; detail?: string }) || {};
      logger.error(
        { error, message: e.message },
        `  ❌ Failed to create order ${order.orderNumber}`
      );
      if (e.code) logger.error({ code: e.code }, "     Error code");
      if (e.detail) logger.error({ detail: e.detail }, "     Detail");
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
      const created = await deliveryNoteQueries.create(note, items);
      logger.info(`  ✅ Created delivery note: ${created.deliveryNumber}`);
    } catch (error) {
      logger.error(
        { error, deliveryNumber: note.deliveryNumber },
        `  ❌ Failed to create delivery note ${note.deliveryNumber}`
      );
    }
  }
}

async function seedProductCategories(categories: ProductCategory[]): Promise<string[]> {
  logger.info("📂 Seeding product categories...");
  const ids: string[] = [];

  // First seed parent categories (no parentId)
  const parents = categories.filter((c) => !c.parentId);
  for (const category of parents) {
    try {
      const created = await productCategoryQueries.create({
        name: category.name,
        description: category.description,
        parentId: undefined,
        isActive: category.isActive,
      });
      logger.info(`  ✅ Created category: ${created.name}`);
      ids.push(created.id);
    } catch (error) {
      logger.error(
        { error, categoryName: category.name },
        `  ❌ Failed to create category ${category.name}`
      );
    }
  }

  // Then seed child categories
  const children = categories.filter((c) => c.parentId);
  for (const category of children) {
    try {
      // Find parent ID from our created categories
      const parentIndex = parents.findIndex(
        (p) => categories.find((c) => c.id === category.parentId)?.name === p.name
      );
      const parentId = parentIndex >= 0 ? ids[parentIndex] : undefined;

      const created = await productCategoryQueries.create({
        name: category.name,
        description: category.description,
        parentId,
        isActive: category.isActive,
      });
      logger.info(`  ✅ Created category: ${created.name}`);
      ids.push(created.id);
    } catch (error) {
      logger.error(
        { error, categoryName: category.name },
        `  ❌ Failed to create category ${category.name}`
      );
    }
  }

  return ids;
}

async function seedProducts(products: Product[], categoryIds: string[]): Promise<string[]> {
  logger.info("🛍️  Seeding products...");
  const ids: string[] = [];

  for (const product of products) {
    try {
      // Reassign category from generated data
      const productData = {
        ...product,
        categoryId: randomElement(categoryIds),
      };

      const created = await productQueries.create({
        sku: productData.sku,
        name: productData.name,
        description: productData.description,
        categoryId: productData.categoryId,
        unitPrice: productData.unitPrice,
        costPrice: productData.costPrice,
        currency: productData.currency,
        stockQuantity: productData.stockQuantity,
        minStockLevel: productData.minStockLevel,
        unit: productData.unit,
        taxRate: 0.2,
        isService: ["hour", "month", "year"].includes(productData.unit),
        isActive: productData.isActive,
      });
      logger.info(`  ✅ Created product: ${created.name}`);
      ids.push(created.id);
    } catch (error) {
      logger.error(
        { error, productName: product.name },
        `  ❌ Failed to create product ${product.name}`
      );
    }
  }

  return ids;
}

async function seedPayments(payments: Payment[]): Promise<void> {
  logger.info("💳 Seeding payments...");

  for (const payment of payments) {
    try {
      if (!payment.invoiceId) {
        logger.info(`  ⏭️  Skipping payment ${payment.reference}: No invoice ID`);
        continue;
      }
      if (!payment.recordedBy) {
        logger.info(`  ⏭️  Skipping payment ${payment.reference}: No recorded by user`);
        continue;
      }
      const created = await paymentQueries.create(
        {
          invoiceId: payment.invoiceId,
          amount: payment.amount,
          currency: payment.currency,
          paymentMethod: payment.paymentMethod,
          paymentDate: payment.paymentDate,
          reference: payment.reference,
          transactionId: payment.transactionId,
          notes: payment.notes,
        },
        payment.recordedBy
      );
      logger.info(`  ✅ Created payment: ${created.reference}`);
    } catch (error: unknown) {
      const _message = error instanceof Error ? error.message : String(error);
      const code = (error as { code?: string }).code;
      logger.error({ error, reference: payment.reference }, "  ❌ Failed to create payment");
      if (code) logger.error({ code }, "     Error code");
    }
  }
}

async function seedNotifications(notifications: Notification[]): Promise<void> {
  logger.info("🔔 Seeding notifications...");

  for (const notification of notifications) {
    try {
      const created = await notificationQueries.create({
        userId: notification.userId,
        type: notification.type,
        channel: notification.channel,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        entityType: notification.entityType,
        entityId: notification.entityId,
      });
      logger.info(`  ✅ Created notification: ${created.title}`);
    } catch (error) {
      logger.error(
        { error, title: notification.title },
        `  ❌ Failed to create notification ${notification.title}`
      );
    }
  }
}

// ============================================
// Main Seed Function
// ============================================

export async function seed(): Promise<void> {
  logger.info("\n🌱 Starting database seed with 50 objects per module...\n");

  try {
    // Generate all data
    const companiesData = generateCompanies(50);
    // Ensure TechCorp exists as the first company for predictable demo accounts
    companiesData.unshift({
      id: generateUUID(),
      name: "TechCorp",
      industry: "Technology",
      address: "123 Tech Street, Beograd",
      createdAt: pastDate(365),
      updatedAt: now(),
    });

    // Seed companies first
    const companyIds = await seedCompanies(companiesData);
    logger.info(`\n  📊 Companies seeded: ${companyIds.length}\n`);

    // Generate and seed users
    const usersData = generateUsers(50, companyIds);
    const userIds = await seedUsers(usersData);
    logger.info(`\n  📊 Users seeded: ${userIds.length}\n`);

    // Seed auth credentials
    await seedAuthCredentials();
    logger.info("");

    // Get all user IDs from database
    const dbUsers = await db`SELECT id FROM users ORDER BY created_at ASC`;
    const allUserIds = dbUsers.map((u) => u.id as string);

    // Generate and seed projects
    const projectsData = generateProjects(50, allUserIds);
    const projectIds = await seedProjects(projectsData);
    logger.info(`\n  📊 Projects seeded: ${projectIds.length}\n`);

    // Generate and seed milestones
    const milestonesData = generateMilestones(50, projectIds);
    const milestoneIds = await seedMilestones(milestonesData);
    logger.info(`\n  📊 Milestones seeded: ${milestoneIds.length}\n`);

    // Generate and seed tasks
    const tasksData = generateTasks(50, projectIds, milestoneIds, allUserIds);
    await seedTasks(tasksData);
    logger.info(`\n  📊 Tasks seeded: 50\n`);

    // Generate and seed quotes
    const quotesData = generateQuotes(50, companyIds, allUserIds);
    const quoteIds = await seedQuotes(quotesData);
    logger.info(`\n  📊 Quotes seeded: ${quoteIds.length}\n`);

    // Generate and seed invoices
    const invoicesData = generateInvoices(50, companyIds, quoteIds, allUserIds);
    const invoiceIds = await seedInvoices(invoicesData);
    logger.info(`\n  📊 Invoices seeded: ${invoiceIds.length}\n`);

    // Get companies that have users (for orders to be visible)
    // Use the same companyIds that were used for users to ensure orders are visible
    // If no companies with users, fall back to all companyIds
    const companiesWithUsers = await db`
      SELECT DISTINCT company_id FROM users WHERE company_id IS NOT NULL
    `;
    const companyIdsWithUsers = companiesWithUsers.map(
      (row: Record<string, unknown>) => row.company_id as string
    );

    // Generate and seed orders only for companies that have users
    // This ensures orders will be visible when users log in
    const ordersData = generateOrders(
      50,
      companyIdsWithUsers.length > 0 ? companyIdsWithUsers : companyIds,
      quoteIds,
      invoiceIds,
      allUserIds
    );
    const orderIds = await seedOrders(ordersData);
    logger.info(`\n  📊 Orders seeded: ${orderIds.length}\n`);

    // Generate and seed delivery notes
    const deliveryNotesData = generateDeliveryNotes(50, companyIds, invoiceIds, allUserIds);
    await seedDeliveryNotes(deliveryNotesData);
    logger.info(`\n  📊 Delivery Notes seeded: 50\n`);

    // Generate and seed product categories
    const categoriesData = generateProductCategories();
    const categoryIds = await seedProductCategories(categoriesData);
    logger.info(`\n  📊 Product Categories seeded: ${categoryIds.length}\n`);

    // Generate and seed products
    const productsData = generateProducts(50, categoryIds);
    await seedProducts(productsData, categoryIds);
    logger.info(`\n  📊 Products seeded: 50\n`);

    // Generate and seed payments
    const paymentsData = generatePayments(50, invoiceIds, allUserIds);
    await seedPayments(paymentsData);
    logger.info(`\n  📊 Payments seeded: 50\n`);

    // Generate and seed notifications
    const notificationsData = generateNotifications(50, allUserIds);
    await seedNotifications(notificationsData);
    logger.info(`\n  📊 Notifications seeded: 50\n`);

    // Summary
    const companyCount = await companyQueries.count();
    const userCount = await userQueries.count();
    const projectCount = await db`SELECT COUNT(*) FROM projects`;
    const taskCount = await taskQueries.count();
    const milestoneCount = await milestoneQueries.count();
    const quoteCount = await quoteQueries.count();
    const invoiceCount = await invoiceQueries.count();
    const orderCount = await db`SELECT COUNT(*) FROM orders`;
    const deliveryCount = await deliveryNoteQueries.count();
    const categoryCount = await db`SELECT COUNT(*) FROM product_categories`;
    const productCount = await db`SELECT COUNT(*) FROM products`;
    const paymentCount = await db`SELECT COUNT(*) FROM payments`;
    const notificationCount = await db`SELECT COUNT(*) FROM notifications`;

    logger.info("\n📊 Final Seed Summary:");
    logger.info("═".repeat(40));
    logger.info(`   Companies:          ${companyCount}`);
    logger.info(`   Users:              ${userCount}`);
    logger.info(`   Projects:           ${parseInt(projectCount[0].count as string, 10)}`);
    logger.info(`   Tasks:              ${taskCount}`);
    logger.info(`   Milestones:         ${milestoneCount}`);
    logger.info(`   Quotes:             ${quoteCount}`);
    logger.info(`   Invoices:           ${invoiceCount}`);
    logger.info(`   Orders:             ${parseInt(orderCount[0].count as string, 10)}`);
    logger.info(`   Delivery Notes:     ${deliveryCount}`);
    logger.info(`   Product Categories: ${parseInt(categoryCount[0].count as string, 10)}`);
    logger.info(`   Products:           ${parseInt(productCount[0].count as string, 10)}`);
    logger.info(`   Payments:           ${parseInt(paymentCount[0].count as string, 10)}`);
    logger.info(`   Notifications:      ${parseInt(notificationCount[0].count as string, 10)}`);
    logger.info("═".repeat(40));
    logger.info("\n✅ Database seeding completed!\n");
  } catch (error) {
    logger.error({ error }, "\n❌ Seed failed");
    throw error;
  }
}

export async function unseed(): Promise<void> {
  logger.info("\n🧹 Clearing all data...\n");

  const safeDelete = async (table: string, name: string) => {
    try {
      await db.unsafe(`DELETE FROM ${table}`);
      logger.info(`  ✅ Deleted ${name}`);
    } catch (error: unknown) {
      const e = error as { code?: string };
      if (e?.code === "42P01") {
        logger.info(`  ⏭️  Table ${table} does not exist, skipping`);
      } else {
        throw error;
      }
    }
  };

  try {
    // Delete in reverse order of dependencies
    await safeDelete("notifications", "notifications");
    await safeDelete("payments", "payments");
    await safeDelete("delivery_note_items", "delivery note items");
    await safeDelete("delivery_notes", "delivery notes");
    await safeDelete("order_items", "order items");
    await safeDelete("orders", "orders");
    await safeDelete("invoice_items", "invoice items");
    await safeDelete("invoices", "invoices");
    await safeDelete("quote_items", "quote items");
    await safeDelete("quotes", "quotes");
    await safeDelete("tasks", "tasks");
    await safeDelete("milestones", "milestones");
    await safeDelete("projects", "projects");
    await safeDelete("products", "products");
    await safeDelete("product_categories", "product categories");
    await safeDelete("auth_credentials", "auth credentials");
    await safeDelete("sessions", "sessions");
    await safeDelete("users", "users");
    await safeDelete("companies", "companies");

    logger.info("\n✅ All data cleared!\n");
  } catch (error) {
    logger.error({ error }, "\n❌ Unseed failed");
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
      case "reseed":
        await unseed();
        await seed();
        break;
      default:
        logger.info(`Unknown command: ${command}`);
        logger.info("Available commands: seed, unseed, clear, reseed");
        process.exit(1);
    }
    await db.end();
    process.exit(0);
  } catch (error) {
    logger.error({ error }, "Seed error");
    await db.end();
    process.exit(1);
  }
}
