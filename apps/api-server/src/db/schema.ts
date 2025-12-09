import { logger } from "../lib/logger";
import { sql as db } from "./client";

// SQL schema for CRM database
// Run this to initialize the database tables

export async function createSchema(): Promise<void> {
  logger.info("Creating database schema...");

  // Create enum type for user roles
  await db`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('admin', 'user');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  // Create enum type for company roles
  await db`
    DO $$ BEGIN
      CREATE TYPE company_role AS ENUM ('owner', 'member', 'admin');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  // Create enum type for company types (seller vs customer)
  await db`
    DO $$ BEGIN
      CREATE TYPE company_type AS ENUM ('seller', 'customer');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  // Companies table (must be created before users due to FK)
  await db`
    CREATE TABLE IF NOT EXISTS companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      industry VARCHAR(255) NOT NULL,
      address TEXT NOT NULL,
      company_type company_type DEFAULT 'customer',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Users table with company relation
  await db`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      role user_role NOT NULL DEFAULT 'user',
      company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
      status VARCHAR(50) DEFAULT 'active',
      avatar_url TEXT,
      phone VARCHAR(50),
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Users on Company table (many-to-many relationship)
  await db`
    CREATE TABLE IF NOT EXISTS users_on_company (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      role company_role NOT NULL DEFAULT 'member',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, company_id)
    )
  `;

  // Leads table
  await db`
    CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      company VARCHAR(255),
      position VARCHAR(255),
      status VARCHAR(50) NOT NULL DEFAULT 'new',
      source VARCHAR(50) NOT NULL DEFAULT 'website',
      assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
      value DECIMAL(15, 2),
      notes TEXT,
      tags TEXT[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Contacts table
  await db`
    CREATE TABLE IF NOT EXISTS contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      company VARCHAR(255),
      position VARCHAR(255),
      street VARCHAR(255),
      city VARCHAR(100),
      state VARCHAR(100),
      postal_code VARCHAR(20),
      country VARCHAR(100),
      notes TEXT,
      lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Deals table
  await db`
    CREATE TABLE IF NOT EXISTS deals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      value DECIMAL(15, 2) NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'USD',
      stage VARCHAR(50) NOT NULL DEFAULT 'discovery',
      priority VARCHAR(50) NOT NULL DEFAULT 'medium',
      probability INTEGER NOT NULL DEFAULT 20,
      expected_close_date TIMESTAMPTZ,
      actual_close_date TIMESTAMPTZ,
      contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
      lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
      assigned_to UUID NOT NULL REFERENCES users(id),
      tags TEXT[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Projects table
  await db`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'planning',
      start_date TIMESTAMPTZ,
      end_date TIMESTAMPTZ,
      budget DECIMAL(15, 2),
      currency VARCHAR(3),
      client_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
      deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
      manager_id UUID NOT NULL REFERENCES users(id),
      team_members UUID[],
      tags TEXT[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Milestones table
  await db`
    CREATE TABLE IF NOT EXISTS milestones (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      due_date TIMESTAMPTZ NOT NULL,
      completed_date TIMESTAMPTZ,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Tasks table
  await db`
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'todo',
      priority VARCHAR(50) NOT NULL DEFAULT 'medium',
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
      assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
      due_date TIMESTAMPTZ,
      estimated_hours DECIMAL(6, 2),
      actual_hours DECIMAL(6, 2),
      parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
      tags TEXT[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Activities table
  await db`
    CREATE TABLE IF NOT EXISTS activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      user_id UUID NOT NULL REFERENCES users(id),
      entity_type VARCHAR(50) NOT NULL,
      entity_id UUID NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ============================================
  // Sales Module Tables
  // ============================================

  // Quotes (Ponude) table
  await db`
    CREATE TABLE IF NOT EXISTS quotes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quote_number VARCHAR(50) UNIQUE NOT NULL,
      customer_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      seller_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      valid_until TIMESTAMPTZ NOT NULL,
      subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
      tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
      tax DECIMAL(15, 2) NOT NULL DEFAULT 0,
      total DECIMAL(15, 2) NOT NULL DEFAULT 0,
      notes TEXT,
      terms TEXT,
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Quote Items table
  await db`
    CREATE TABLE IF NOT EXISTS quote_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      product_name VARCHAR(255) NOT NULL,
      description TEXT,
      quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
      unit_price DECIMAL(15, 2) NOT NULL,
      discount DECIMAL(5, 2) NOT NULL DEFAULT 0,
      total DECIMAL(15, 2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Invoices (Fakture) table
  await db`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_number VARCHAR(50) UNIQUE NOT NULL,
      quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
      customer_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      seller_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      due_date TIMESTAMPTZ NOT NULL,
      subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
      tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
      tax DECIMAL(15, 2) NOT NULL DEFAULT 0,
      total DECIMAL(15, 2) NOT NULL DEFAULT 0,
      paid_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
      notes TEXT,
      terms TEXT,
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Invoice Items table
  await db`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      product_name VARCHAR(255) NOT NULL,
      description TEXT,
      quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
      unit_price DECIMAL(15, 2) NOT NULL,
      discount DECIMAL(5, 2) NOT NULL DEFAULT 0,
      total DECIMAL(15, 2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Delivery Notes (Otpremnice) table
  await db`
    CREATE TABLE IF NOT EXISTS delivery_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      delivery_number VARCHAR(50) UNIQUE NOT NULL,
      invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
      customer_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      seller_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      ship_date TIMESTAMPTZ,
      delivery_date TIMESTAMPTZ,
      shipping_address TEXT NOT NULL,
      tracking_number VARCHAR(100),
      carrier VARCHAR(100),
      notes TEXT,
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Delivery Note Items table
  await db`
    CREATE TABLE IF NOT EXISTS delivery_note_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      delivery_note_id UUID NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
      product_name VARCHAR(255) NOT NULL,
      description TEXT,
      quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
      unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ============================================
  // Product Catalog Tables
  // ============================================

  // Product Categories table
  await db`
    CREATE TABLE IF NOT EXISTS product_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Products table
  await db`
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      sku VARCHAR(100) UNIQUE,
      description TEXT,
      unit_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
      cost_price DECIMAL(15, 2),
      currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
      unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
      tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
      category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
      stock_quantity DECIMAL(10, 2),
      min_stock_level DECIMAL(10, 2),
      is_active BOOLEAN NOT NULL DEFAULT true,
      is_service BOOLEAN NOT NULL DEFAULT false,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Create indexes for companies
  await db`CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name)`;
  await db`CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry)`;
  await db`CREATE INDEX IF NOT EXISTS idx_companies_company_type ON companies(company_type)`;

  // Create indexes for users
  await db`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
  await db`CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`;

  // Create indexes for users_on_company
  await db`CREATE INDEX IF NOT EXISTS idx_users_on_company_user_id ON users_on_company(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_users_on_company_company_id ON users_on_company(company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_users_on_company_role ON users_on_company(role)`;

  // Create indexes for leads
  await db`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to)`;
  await db`CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email)`;

  // Create indexes for contacts
  await db`CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email)`;
  await db`CREATE INDEX IF NOT EXISTS idx_contacts_lead_id ON contacts(lead_id)`;

  // Create indexes for deals
  await db`CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage)`;
  await db`CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to)`;

  // Create indexes for projects
  await db`CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_projects_manager_id ON projects(manager_id)`;

  // Create indexes for milestones
  await db`CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_milestones_due_date ON milestones(due_date)`;

  // Create indexes for tasks
  await db`CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON tasks(milestone_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to)`;

  // Create indexes for activities
  await db`CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id)`;

  // Create indexes for quotes
  await db`CREATE INDEX IF NOT EXISTS idx_quotes_customer_company_id ON quotes(customer_company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_quotes_seller_company_id ON quotes(seller_company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON quotes(created_by)`;
  await db`CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id)`;

  // Create indexes for invoices
  await db`CREATE INDEX IF NOT EXISTS idx_invoices_customer_company_id ON invoices(customer_company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_invoices_seller_company_id ON invoices(seller_company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_invoices_quote_id ON invoices(quote_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by)`;
  await db`CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id)`;

  // Create indexes for delivery notes
  await db`CREATE INDEX IF NOT EXISTS idx_delivery_notes_customer_company_id ON delivery_notes(customer_company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_delivery_notes_seller_company_id ON delivery_notes(seller_company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_delivery_notes_invoice_id ON delivery_notes(invoice_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_delivery_notes_status ON delivery_notes(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_delivery_notes_created_by ON delivery_notes(created_by)`;
  await db`CREATE INDEX IF NOT EXISTS idx_delivery_note_items_delivery_note_id ON delivery_note_items(delivery_note_id)`;

  // Create indexes for products
  await db`CREATE INDEX IF NOT EXISTS idx_product_categories_parent_id ON product_categories(parent_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_product_categories_is_active ON product_categories(is_active)`;
  await db`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)`;
  await db`CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active)`;
  await db`CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`;

  // ============================================
  // Notifications Table
  // ============================================

  // Create enum type for notification types
  await db`
    DO $$ BEGIN
      CREATE TYPE notification_type AS ENUM (
        'info', 'success', 'warning', 'error',
        'invoice_created', 'invoice_paid', 'invoice_overdue',
        'quote_created', 'quote_accepted', 'quote_rejected',
        'task_assigned', 'task_completed', 'task_overdue',
        'project_created', 'project_completed',
        'lead_assigned', 'deal_won', 'deal_lost',
        'system', 'mention', 'reminder'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  // Create enum type for notification channels
  await db`
    DO $$ BEGIN
      CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'both');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  // Notifications table
  await db`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type notification_type NOT NULL DEFAULT 'info',
      channel notification_channel NOT NULL DEFAULT 'in_app',
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      link VARCHAR(500),
      entity_type VARCHAR(50),
      entity_id UUID,
      is_read BOOLEAN NOT NULL DEFAULT false,
      read_at TIMESTAMPTZ,
      email_sent BOOLEAN NOT NULL DEFAULT false,
      email_sent_at TIMESTAMPTZ,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Create indexes for notifications
  await db`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`;
  await db`CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type)`;
  await db`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id)`;

  // ============================================
  // Payments Table
  // ============================================

  // Create enum type for payment methods
  await db`
    DO $$ BEGIN
      CREATE TYPE payment_method AS ENUM (
        'cash', 'credit_card', 'debit_card', 'bank_transfer', 
        'check', 'paypal', 'stripe', 'other'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  // Create enum type for payment status
  await db`
    DO $$ BEGIN
      CREATE TYPE payment_status AS ENUM (
        'pending', 'completed', 'failed', 'refunded', 'cancelled'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  // Payments table
  await db`
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      amount DECIMAL(15, 2) NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
      payment_method payment_method NOT NULL DEFAULT 'bank_transfer',
      status payment_status NOT NULL DEFAULT 'completed',
      payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reference VARCHAR(255),
      transaction_id VARCHAR(255),
      notes TEXT,
      metadata JSONB,
      recorded_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Create indexes for payments
  await db`CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_payments_recorded_by ON payments(recorded_by)`;
  await db`CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference)`;

  // ============================================
  // Team Invites Table
  // ============================================

  // Create enum type for invite status
  await db`
    DO $$ BEGIN
      CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'rejected', 'expired', 'cancelled');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  // Team invites table
  await db`
    CREATE TABLE IF NOT EXISTS team_invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL,
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      role company_role NOT NULL DEFAULT 'member',
      status invite_status NOT NULL DEFAULT 'pending',
      invited_by UUID NOT NULL REFERENCES users(id),
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
      accepted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(email, company_id, status) 
        WHERE status = 'pending'
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_team_invites_company_id ON team_invites(company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email)`;
  await db`CREATE INDEX IF NOT EXISTS idx_team_invites_status ON team_invites(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites(token)`;
  await db`CREATE INDEX IF NOT EXISTS idx_team_invites_expires_at ON team_invites(expires_at)`;

  // ============================================
  // Notification Settings Table
  // ============================================

  // Notification settings table (user preferences for notifications)
  await db`
    CREATE TABLE IF NOT EXISTS notification_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      notification_type VARCHAR(100) NOT NULL,
      channel VARCHAR(50) NOT NULL, -- 'in_app', 'email', 'push'
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, notification_type, channel)
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_notification_settings_type ON notification_settings(notification_type)`;

  // ============================================
  // Orders Table
  // ============================================

  // Create enum type for order status
  await db`
    DO $$ BEGIN
      CREATE TYPE order_status AS ENUM ('pending', 'processing', 'completed', 'cancelled', 'refunded');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  // Orders table
  await db`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_number VARCHAR(50) UNIQUE NOT NULL,
      customer_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      seller_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
      quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
      invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
      status order_status NOT NULL DEFAULT 'pending',
      subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
      tax DECIMAL(15, 2) NOT NULL DEFAULT 0,
      total DECIMAL(15, 2) NOT NULL DEFAULT 0,
      currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
      notes TEXT,
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_orders_customer_company_id ON orders(customer_company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_orders_seller_company_id ON orders(seller_company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number)`;
  await db`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)`;

  // Order Items table
  await db`
    CREATE TABLE IF NOT EXISTS order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_name VARCHAR(255) NOT NULL,
      description TEXT,
      quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
      unit_price DECIMAL(15, 2) NOT NULL,
      discount DECIMAL(5, 2) NOT NULL DEFAULT 0,
      total DECIMAL(15, 2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`;

  // ============================================
  // Connected Accounts (Bank Accounts) Table
  // ============================================

  // Connected accounts table (for bank accounts and external integrations)
  await db`
    CREATE TABLE IF NOT EXISTS connected_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      account_type VARCHAR(50) NOT NULL DEFAULT 'bank', -- 'bank', 'stripe', 'paypal', etc.
      account_name VARCHAR(255) NOT NULL,
      account_number VARCHAR(255),
      bank_name VARCHAR(255),
      iban VARCHAR(50),
      swift VARCHAR(50),
      currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
      balance DECIMAL(15, 2) DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      metadata JSONB,
      connected_by UUID NOT NULL REFERENCES users(id),
      connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_connected_accounts_company_id ON connected_accounts(company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_connected_accounts_account_type ON connected_accounts(account_type)`;
  await db`CREATE INDEX IF NOT EXISTS idx_connected_accounts_is_active ON connected_accounts(is_active)`;

  logger.info("✅ Database schema created successfully");
}

export async function dropSchema(): Promise<void> {
  logger.info("Dropping database schema...");

  // Drop new tables first (due to FK constraints)
  await db`DROP TABLE IF EXISTS connected_accounts CASCADE`;
  await db`DROP TABLE IF EXISTS order_items CASCADE`;
  await db`DROP TABLE IF EXISTS orders CASCADE`;
  await db`DROP TYPE IF EXISTS order_status`;
  await db`DROP TABLE IF EXISTS notification_settings CASCADE`;
  await db`DROP TABLE IF EXISTS team_invites CASCADE`;
  await db`DROP TYPE IF EXISTS invite_status`;

  // Drop Payments table
  await db`DROP TABLE IF EXISTS payments CASCADE`;
  await db`DROP TYPE IF EXISTS payment_method`;
  await db`DROP TYPE IF EXISTS payment_status`;

  // Drop Notifications table
  await db`DROP TABLE IF EXISTS notifications CASCADE`;
  await db`DROP TYPE IF EXISTS notification_type`;
  await db`DROP TYPE IF EXISTS notification_channel`;

  // Drop Product tables
  await db`DROP TABLE IF EXISTS products CASCADE`;
  await db`DROP TABLE IF EXISTS product_categories CASCADE`;

  // Drop Sales Module tables (due to FK constraints)
  await db`DROP TABLE IF EXISTS delivery_note_items CASCADE`;
  await db`DROP TABLE IF EXISTS delivery_notes CASCADE`;
  await db`DROP TABLE IF EXISTS invoice_items CASCADE`;
  await db`DROP TABLE IF EXISTS invoices CASCADE`;
  await db`DROP TABLE IF EXISTS quote_items CASCADE`;
  await db`DROP TABLE IF EXISTS quotes CASCADE`;

  // Drop other tables
  await db`DROP TABLE IF EXISTS activities CASCADE`;
  await db`DROP TABLE IF EXISTS tasks CASCADE`;
  await db`DROP TABLE IF EXISTS milestones CASCADE`;
  await db`DROP TABLE IF EXISTS projects CASCADE`;
  await db`DROP TABLE IF EXISTS deals CASCADE`;
  await db`DROP TABLE IF EXISTS contacts CASCADE`;
  await db`DROP TABLE IF EXISTS leads CASCADE`;
  await db`DROP TABLE IF EXISTS users_on_company CASCADE`;
  await db`DROP TABLE IF EXISTS users CASCADE`;
  await db`DROP TABLE IF EXISTS companies CASCADE`;
  await db`DROP TYPE IF EXISTS company_type`;
  await db`DROP TYPE IF EXISTS company_role`;
  await db`DROP TYPE IF EXISTS user_role`;

  logger.info("✅ Database schema dropped");
}

// Run schema creation if this file is executed directly
if (import.meta.main) {
  await createSchema();
  process.exit(0);
}
