import { relations } from "drizzle-orm/relations";
import {
  activities,
  auditLogs,
  authCredentials,
  companies,
  companyTags,
  contacts,
  deals,
  deliveryNoteItems,
  deliveryNotes,
  documents,
  documentTagAssignments,
  documentTags,
  invoiceItems,
  invoices,
  leads,
  locations,
  milestones,
  notifications,
  orderItems,
  orders,
  payments,
  productCategories,
  products,
  projects,
  quoteItems,
  quotes,
  refreshTokens,
  tags,
  tasks,
  tenants,
  users,
  usersOnCompany,
  userTenantRoles,
} from "./schema";

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  auditLogs: many(auditLogs),
  documents_ownerId: many(documents, {
    relationName: "documents_ownerId_users_id",
  }),
  documents_createdBy: many(documents, {
    relationName: "documents_createdBy_users_id",
  }),
  orders: many(orders),
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  activities: many(activities),
  leads: many(leads),
  deals: many(deals),
  projects: many(projects),
  tasks: many(tasks),
  authCredentials: many(authCredentials),
  refreshTokens: many(refreshTokens),
  quotes: many(quotes),
  deliveryNotes: many(deliveryNotes),
  invoices: many(invoices),
  notifications: many(notifications),
  usersOnCompanies: many(usersOnCompany),
  userTenantRoles: many(userTenantRoles),
  payments: many(payments),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  company: one(companies, {
    fields: [documents.companyId],
    references: [companies.id],
  }),
  user_ownerId: one(users, {
    fields: [documents.ownerId],
    references: [users.id],
    relationName: "documents_ownerId_users_id",
  }),
  tenant: one(tenants, {
    fields: [documents.tenantId],
    references: [tenants.id],
  }),
  user_createdBy: one(users, {
    fields: [documents.createdBy],
    references: [users.id],
    relationName: "documents_createdBy_users_id",
  }),
  documentTagAssignments: many(documentTagAssignments),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  documents: many(documents),
  orders: many(orders),
  users: many(users),
  tenant: one(tenants, {
    fields: [companies.tenantId],
    references: [tenants.id],
  }),
  location: one(locations, {
    fields: [companies.locationId],
    references: [locations.id],
  }),
  activities: many(activities),
  quotes: many(quotes),
  deliveryNotes: many(deliveryNotes),
  invoices: many(invoices),
  companyTags: many(companyTags),
  usersOnCompanies: many(usersOnCompany),
  documentTags: many(documentTags),
  contacts: many(contacts),
  documentTagAssignments: many(documentTagAssignments),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  documents: many(documents),
  users: many(users),
  companies: many(companies),
  activities: many(activities),
  locations: many(locations),
  userTenantRoles: many(userTenantRoles),
  contacts: many(contacts),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  company: one(companies, {
    fields: [orders.companyId],
    references: [companies.id],
  }),
  contact: one(contacts, {
    fields: [orders.contactId],
    references: [contacts.id],
  }),
  quote: one(quotes, {
    fields: [orders.quoteId],
    references: [quotes.id],
  }),
  invoice: one(invoices, {
    fields: [orders.invoiceId],
    references: [invoices.id],
  }),
  user: one(users, {
    fields: [orders.createdBy],
    references: [users.id],
  }),
  orderItems: many(orderItems),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  orders: many(orders),
  deals: many(deals),
  projects: many(projects),
  quotes: many(quotes),
  deliveryNotes: many(deliveryNotes),
  invoices: many(invoices),
  lead: one(leads, {
    fields: [contacts.leadId],
    references: [leads.id],
  }),
  tenant: one(tenants, {
    fields: [contacts.tenantId],
    references: [tenants.id],
  }),
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  orders: many(orders),
  company: one(companies, {
    fields: [quotes.companyId],
    references: [companies.id],
  }),
  contact: one(contacts, {
    fields: [quotes.contactId],
    references: [contacts.id],
  }),
  user: one(users, {
    fields: [quotes.createdBy],
    references: [users.id],
  }),
  quoteItems: many(quoteItems),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  orders: many(orders),
  invoiceItems: many(invoiceItems),
  deliveryNotes: many(deliveryNotes),
  quote: one(quotes, {
    fields: [invoices.quoteId],
    references: [quotes.id],
  }),
  company: one(companies, {
    fields: [invoices.companyId],
    references: [companies.id],
  }),
  contact: one(contacts, {
    fields: [invoices.contactId],
    references: [contacts.id],
  }),
  user: one(users, {
    fields: [invoices.createdBy],
    references: [users.id],
  }),
  payments: many(payments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  companies: many(companies),
  tenant: one(tenants, {
    fields: [locations.tenantId],
    references: [tenants.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [activities.tenantId],
    references: [tenants.id],
  }),
  company: one(companies, {
    fields: [activities.companyId],
    references: [companies.id],
  }),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  user: one(users, {
    fields: [leads.assignedTo],
    references: [users.id],
  }),
  deals: many(deals),
  contacts: many(contacts),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [deals.contactId],
    references: [contacts.id],
  }),
  lead: one(leads, {
    fields: [deals.leadId],
    references: [leads.id],
  }),
  user: one(users, {
    fields: [deals.assignedTo],
    references: [users.id],
  }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [projects.clientId],
    references: [contacts.id],
  }),
  deal: one(deals, {
    fields: [projects.dealId],
    references: [deals.id],
  }),
  user: one(users, {
    fields: [projects.managerId],
    references: [users.id],
  }),
  tasks: many(tasks),
  milestones: many(milestones),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  milestone: one(milestones, {
    fields: [tasks.milestoneId],
    references: [milestones.id],
  }),
  user: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
  }),
}));

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  tasks: many(tasks),
  project: one(projects, {
    fields: [milestones.projectId],
    references: [projects.id],
  }),
}));

export const authCredentialsRelations = relations(authCredentials, ({ one }) => ({
  user: one(users, {
    fields: [authCredentials.userId],
    references: [users.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteItems.quoteId],
    references: [quotes.id],
  }),
}));

export const deliveryNotesRelations = relations(deliveryNotes, ({ one, many }) => ({
  invoice: one(invoices, {
    fields: [deliveryNotes.invoiceId],
    references: [invoices.id],
  }),
  company: one(companies, {
    fields: [deliveryNotes.companyId],
    references: [companies.id],
  }),
  contact: one(contacts, {
    fields: [deliveryNotes.contactId],
    references: [contacts.id],
  }),
  user: one(users, {
    fields: [deliveryNotes.createdBy],
    references: [users.id],
  }),
  deliveryNoteItems: many(deliveryNoteItems),
}));

export const companyTagsRelations = relations(companyTags, ({ one }) => ({
  company: one(companies, {
    fields: [companyTags.companyId],
    references: [companies.id],
  }),
  tag: one(tags, {
    fields: [companyTags.tagId],
    references: [tags.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  companyTags: many(companyTags),
}));

export const productsRelations = relations(products, ({ one }) => ({
  productCategory: one(productCategories, {
    fields: [products.categoryId],
    references: [productCategories.id],
  }),
}));

export const productCategoriesRelations = relations(productCategories, ({ many }) => ({
  products: many(products),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const usersOnCompanyRelations = relations(usersOnCompany, ({ one }) => ({
  user: one(users, {
    fields: [usersOnCompany.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [usersOnCompany.companyId],
    references: [companies.id],
  }),
}));

export const userTenantRolesRelations = relations(userTenantRoles, ({ one }) => ({
  user: one(users, {
    fields: [userTenantRoles.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [userTenantRoles.tenantId],
    references: [tenants.id],
  }),
}));

export const documentTagsRelations = relations(documentTags, ({ one, many }) => ({
  company: one(companies, {
    fields: [documentTags.companyId],
    references: [companies.id],
  }),
  documentTagAssignments: many(documentTagAssignments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  user: one(users, {
    fields: [payments.recordedBy],
    references: [users.id],
  }),
}));

export const deliveryNoteItemsRelations = relations(deliveryNoteItems, ({ one }) => ({
  deliveryNote: one(deliveryNotes, {
    fields: [deliveryNoteItems.deliveryNoteId],
    references: [deliveryNotes.id],
  }),
}));

export const documentTagAssignmentsRelations = relations(documentTagAssignments, ({ one }) => ({
  document: one(documents, {
    fields: [documentTagAssignments.documentId],
    references: [documents.id],
  }),
  documentTag: one(documentTags, {
    fields: [documentTagAssignments.tagId],
    references: [documentTags.id],
  }),
  company: one(companies, {
    fields: [documentTagAssignments.companyId],
    references: [companies.id],
  }),
}));
