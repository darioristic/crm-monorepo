import type {
  ApiResponse,
  PaginationParams,
  ReportFilters,
  DateRangeFilter,
  UserReport,
  CompanyReport,
  QuoteReport,
  InvoiceReport,
  DeliveryNoteReport,
  ProjectReport,
  TaskReport,
  MilestoneReport,
  SalesSummary,
  ProjectSummary,
  RevenuePoint,
  CompanyRevenue,
  TopCustomer,
  ConversionFunnel,
  InvoiceStatusBreakdown,
  TaskStatPoint,
  MilestoneBreakdown,
  TaskPriorityStats,
  ProjectDurationStats,
  AnalyticsDateRange,
} from "@crm/types";
import { successResponse, errorResponse, paginatedResponse } from "@crm/utils";
import db from "../db/client";
import { cache } from "../cache/redis";

const CACHE_TTL = 300; // 5 minutes

class ReportsService {
  // ============================================
  // CRM Reports
  // ============================================

  async getUsersReport(
    pagination: PaginationParams,
    filters: ReportFilters
  ): Promise<ApiResponse<UserReport[]>> {
    try {
      const cacheKey = `reports:users:${JSON.stringify({ pagination, filters })}`;
      const cached = await cache.get<UserReport[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { page = 1, pageSize = 20 } = pagination;
      const offset = (page - 1) * pageSize;

      let whereClause = "WHERE 1=1";
      if (filters.search) {
        whereClause += ` AND (u.first_name ILIKE '%${filters.search}%' OR u.last_name ILIKE '%${filters.search}%' OR u.email ILIKE '%${filters.search}%')`;
      }
      if (filters.companyId) {
        whereClause += ` AND u.company_id = '${filters.companyId}'`;
      }
      if (filters.role) {
        whereClause += ` AND u.role = '${filters.role}'`;
      }
      if (filters.status) {
        whereClause += ` AND u.status = '${filters.status}'`;
      }

      const countResult = await db.unsafe(`SELECT COUNT(*) FROM users u ${whereClause}`);
      const total = parseInt(countResult[0].count, 10);

      const sortBy = pagination.sortBy || "u.created_at";
      const sortOrder = pagination.sortOrder || "desc";

      const data = await db.unsafe(`
        SELECT 
          u.*,
          c.name as company_name,
          (SELECT COUNT(*) FROM projects p WHERE p.manager_id = u.id OR u.id = ANY(p.team_members)) as total_projects,
          (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = u.id) as total_tasks
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ${pageSize} OFFSET ${offset}
      `);

      const users: UserReport[] = data.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        createdAt: (row.created_at as Date).toISOString(),
        updatedAt: (row.updated_at as Date).toISOString(),
        firstName: row.first_name as string,
        lastName: row.last_name as string,
        email: row.email as string,
        role: row.role as "admin" | "user",
        companyId: row.company_id as string | undefined,
        status: row.status as "active" | "inactive" | "pending" | undefined,
        avatarUrl: row.avatar_url as string | undefined,
        phone: row.phone as string | undefined,
        lastLoginAt: row.last_login_at ? (row.last_login_at as Date).toISOString() : undefined,
        companyName: row.company_name as string | undefined,
        totalProjects: parseInt(row.total_projects as string, 10),
        totalTasks: parseInt(row.total_tasks as string, 10),
      }));

      await cache.set(cacheKey, users, CACHE_TTL);
      return paginatedResponse(users, total, pagination);
    } catch (error) {
      console.error("Error fetching users report:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch users report");
    }
  }

  async getCompaniesReport(
    pagination: PaginationParams,
    filters: ReportFilters
  ): Promise<ApiResponse<CompanyReport[]>> {
    try {
      const cacheKey = `reports:companies:${JSON.stringify({ pagination, filters })}`;
      const cached = await cache.get<CompanyReport[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { page = 1, pageSize = 20 } = pagination;
      const offset = (page - 1) * pageSize;

      let whereClause = "WHERE 1=1";
      if (filters.search) {
        whereClause += ` AND (c.name ILIKE '%${filters.search}%' OR c.address ILIKE '%${filters.search}%')`;
      }
      if (filters.industry) {
        whereClause += ` AND c.industry = '${filters.industry}'`;
      }

      const countResult = await db.unsafe(`SELECT COUNT(*) FROM companies c ${whereClause}`);
      const total = parseInt(countResult[0].count, 10);

      const sortBy = pagination.sortBy || "c.created_at";
      const sortOrder = pagination.sortOrder || "desc";

      const data = await db.unsafe(`
        SELECT 
          c.*,
          (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) as total_users,
          (SELECT COUNT(*) FROM quotes q WHERE q.company_id = c.id) as total_quotes,
          (SELECT COUNT(*) FROM invoices i WHERE i.company_id = c.id) as total_invoices,
          (SELECT COALESCE(SUM(i.paid_amount), 0) FROM invoices i WHERE i.company_id = c.id) as total_revenue
        FROM companies c
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ${pageSize} OFFSET ${offset}
      `);

      const companies: CompanyReport[] = data.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        createdAt: (row.created_at as Date).toISOString(),
        updatedAt: (row.updated_at as Date).toISOString(),
        name: row.name as string,
        industry: row.industry as string,
        address: row.address as string,
        totalUsers: parseInt(row.total_users as string, 10),
        totalQuotes: parseInt(row.total_quotes as string, 10),
        totalInvoices: parseInt(row.total_invoices as string, 10),
        totalRevenue: parseFloat(row.total_revenue as string),
      }));

      await cache.set(cacheKey, companies, CACHE_TTL);
      return paginatedResponse(companies, total, pagination);
    } catch (error) {
      console.error("Error fetching companies report:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch companies report");
    }
  }

  // ============================================
  // Sales Reports
  // ============================================

  async getQuotesReport(
    pagination: PaginationParams,
    filters: ReportFilters,
    dateRange?: DateRangeFilter
  ): Promise<ApiResponse<QuoteReport[]>> {
    try {
      const cacheKey = `reports:quotes:${JSON.stringify({ pagination, filters, dateRange })}`;
      const cached = await cache.get<QuoteReport[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { page = 1, pageSize = 20 } = pagination;
      const offset = (page - 1) * pageSize;

      let whereClause = "WHERE 1=1";
      if (filters.status) {
        whereClause += ` AND q.status = '${filters.status}'`;
      }
      if (filters.companyId) {
        whereClause += ` AND q.company_id = '${filters.companyId}'`;
      }
      if (filters.userId) {
        whereClause += ` AND q.created_by = '${filters.userId}'`;
      }
      if (dateRange?.startDate) {
        whereClause += ` AND q.issue_date >= '${dateRange.startDate}'`;
      }
      if (dateRange?.endDate) {
        whereClause += ` AND q.issue_date <= '${dateRange.endDate}'`;
      }

      const countResult = await db.unsafe(`SELECT COUNT(*) FROM quotes q ${whereClause}`);
      const total = parseInt(countResult[0].count, 10);

      const sortBy = pagination.sortBy || "q.created_at";
      const sortOrder = pagination.sortOrder || "desc";

      const data = await db.unsafe(`
        SELECT 
          q.*,
          c.name as company_name,
          CONCAT(u.first_name, ' ', u.last_name) as created_by_name
        FROM quotes q
        LEFT JOIN companies c ON q.company_id = c.id
        LEFT JOIN users u ON q.created_by = u.id
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ${pageSize} OFFSET ${offset}
      `);

      const quotes: QuoteReport[] = await Promise.all(
        data.map(async (row: Record<string, unknown>) => {
          const items = await db`SELECT * FROM quote_items WHERE quote_id = ${row.id as string}`;
          return {
            id: row.id as string,
            createdAt: (row.created_at as Date).toISOString(),
            updatedAt: (row.updated_at as Date).toISOString(),
            quoteNumber: row.quote_number as string,
            companyId: row.company_id as string,
            contactId: row.contact_id as string | undefined,
            status: row.status as "draft" | "sent" | "accepted" | "rejected" | "expired",
            issueDate: (row.issue_date as Date).toISOString(),
            validUntil: (row.valid_until as Date).toISOString(),
            items: items.map((item: Record<string, unknown>) => ({
              id: item.id as string,
              quoteId: item.quote_id as string,
              productName: item.product_name as string,
              description: item.description as string | undefined,
              quantity: parseFloat(item.quantity as string),
              unitPrice: parseFloat(item.unit_price as string),
              discount: parseFloat(item.discount as string),
              total: parseFloat(item.total as string),
            })),
            subtotal: parseFloat(row.subtotal as string),
            taxRate: parseFloat(row.tax_rate as string),
            tax: parseFloat(row.tax as string),
            total: parseFloat(row.total as string),
            notes: row.notes as string | undefined,
            terms: row.terms as string | undefined,
            createdBy: row.created_by as string,
            companyName: row.company_name as string | undefined,
            createdByName: row.created_by_name as string | undefined,
          };
        })
      );

      await cache.set(cacheKey, quotes, CACHE_TTL);
      return paginatedResponse(quotes, total, pagination);
    } catch (error) {
      console.error("Error fetching quotes report:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch quotes report");
    }
  }

  async getInvoicesReport(
    pagination: PaginationParams,
    filters: ReportFilters,
    dateRange?: DateRangeFilter
  ): Promise<ApiResponse<InvoiceReport[]>> {
    try {
      const cacheKey = `reports:invoices:${JSON.stringify({ pagination, filters, dateRange })}`;
      const cached = await cache.get<InvoiceReport[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { page = 1, pageSize = 20 } = pagination;
      const offset = (page - 1) * pageSize;

      let whereClause = "WHERE 1=1";
      if (filters.status) {
        whereClause += ` AND i.status = '${filters.status}'`;
      }
      if (filters.companyId) {
        whereClause += ` AND i.company_id = '${filters.companyId}'`;
      }
      if (dateRange?.startDate) {
        whereClause += ` AND i.issue_date >= '${dateRange.startDate}'`;
      }
      if (dateRange?.endDate) {
        whereClause += ` AND i.issue_date <= '${dateRange.endDate}'`;
      }

      const countResult = await db.unsafe(`SELECT COUNT(*) FROM invoices i ${whereClause}`);
      const total = parseInt(countResult[0].count, 10);

      const sortBy = pagination.sortBy || "i.created_at";
      const sortOrder = pagination.sortOrder || "desc";

      const data = await db.unsafe(`
        SELECT 
          i.*,
          c.name as company_name,
          CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
          (i.total - i.paid_amount) as outstanding_amount
        FROM invoices i
        LEFT JOIN companies c ON i.company_id = c.id
        LEFT JOIN users u ON i.created_by = u.id
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ${pageSize} OFFSET ${offset}
      `);

      const invoices: InvoiceReport[] = await Promise.all(
        data.map(async (row: Record<string, unknown>) => {
          const items = await db`SELECT * FROM invoice_items WHERE invoice_id = ${row.id as string}`;
          return {
            id: row.id as string,
            createdAt: (row.created_at as Date).toISOString(),
            updatedAt: (row.updated_at as Date).toISOString(),
            invoiceNumber: row.invoice_number as string,
            quoteId: row.quote_id as string | undefined,
            companyId: row.company_id as string,
            contactId: row.contact_id as string | undefined,
            status: row.status as "draft" | "sent" | "paid" | "partial" | "overdue" | "cancelled",
            issueDate: (row.issue_date as Date).toISOString(),
            dueDate: (row.due_date as Date).toISOString(),
            items: items.map((item: Record<string, unknown>) => ({
              id: item.id as string,
              invoiceId: item.invoice_id as string,
              productName: item.product_name as string,
              description: item.description as string | undefined,
              quantity: parseFloat(item.quantity as string),
              unitPrice: parseFloat(item.unit_price as string),
              discount: parseFloat(item.discount as string),
              total: parseFloat(item.total as string),
            })),
            subtotal: parseFloat(row.subtotal as string),
            taxRate: parseFloat(row.tax_rate as string),
            tax: parseFloat(row.tax as string),
            total: parseFloat(row.total as string),
            paidAmount: parseFloat(row.paid_amount as string),
            notes: row.notes as string | undefined,
            terms: row.terms as string | undefined,
            createdBy: row.created_by as string,
            companyName: row.company_name as string | undefined,
            createdByName: row.created_by_name as string | undefined,
            outstandingAmount: parseFloat(row.outstanding_amount as string),
          };
        })
      );

      await cache.set(cacheKey, invoices, CACHE_TTL);
      return paginatedResponse(invoices, total, pagination);
    } catch (error) {
      console.error("Error fetching invoices report:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch invoices report");
    }
  }

  async getDeliveryNotesReport(
    pagination: PaginationParams,
    filters: ReportFilters,
    dateRange?: DateRangeFilter
  ): Promise<ApiResponse<DeliveryNoteReport[]>> {
    try {
      const cacheKey = `reports:delivery-notes:${JSON.stringify({ pagination, filters, dateRange })}`;
      const cached = await cache.get<DeliveryNoteReport[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { page = 1, pageSize = 20 } = pagination;
      const offset = (page - 1) * pageSize;

      let whereClause = "WHERE 1=1";
      if (filters.status) {
        whereClause += ` AND d.status = '${filters.status}'`;
      }
      if (filters.companyId) {
        whereClause += ` AND d.company_id = '${filters.companyId}'`;
      }
      if (dateRange?.startDate) {
        whereClause += ` AND d.created_at >= '${dateRange.startDate}'`;
      }
      if (dateRange?.endDate) {
        whereClause += ` AND d.created_at <= '${dateRange.endDate}'`;
      }

      const countResult = await db.unsafe(`SELECT COUNT(*) FROM delivery_notes d ${whereClause}`);
      const total = parseInt(countResult[0].count, 10);

      const sortBy = pagination.sortBy || "d.created_at";
      const sortOrder = pagination.sortOrder || "desc";

      const data = await db.unsafe(`
        SELECT 
          d.*,
          c.name as company_name,
          i.invoice_number
        FROM delivery_notes d
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN invoices i ON d.invoice_id = i.id
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ${pageSize} OFFSET ${offset}
      `);

      const notes: DeliveryNoteReport[] = await Promise.all(
        data.map(async (row: Record<string, unknown>) => {
          const items = await db`SELECT * FROM delivery_note_items WHERE delivery_note_id = ${row.id as string}`;
          return {
            id: row.id as string,
            createdAt: (row.created_at as Date).toISOString(),
            updatedAt: (row.updated_at as Date).toISOString(),
            deliveryNumber: row.delivery_number as string,
            invoiceId: row.invoice_id as string | undefined,
            companyId: row.company_id as string,
            contactId: row.contact_id as string | undefined,
            status: row.status as "pending" | "in_transit" | "delivered" | "returned",
            shipDate: row.ship_date ? (row.ship_date as Date).toISOString() : undefined,
            deliveryDate: row.delivery_date ? (row.delivery_date as Date).toISOString() : undefined,
            items: items.map((item: Record<string, unknown>) => ({
              id: item.id as string,
              deliveryNoteId: item.delivery_note_id as string,
              productName: item.product_name as string,
              description: item.description as string | undefined,
              quantity: parseFloat(item.quantity as string),
              unit: item.unit as string,
            })),
            shippingAddress: row.shipping_address as string,
            trackingNumber: row.tracking_number as string | undefined,
            carrier: row.carrier as string | undefined,
            notes: row.notes as string | undefined,
            createdBy: row.created_by as string,
            companyName: row.company_name as string | undefined,
            invoiceNumber: row.invoice_number as string | undefined,
          };
        })
      );

      await cache.set(cacheKey, notes, CACHE_TTL);
      return paginatedResponse(notes, total, pagination);
    } catch (error) {
      console.error("Error fetching delivery notes report:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch delivery notes report");
    }
  }

  // ============================================
  // Project Reports
  // ============================================

  async getProjectsReport(
    pagination: PaginationParams,
    filters: ReportFilters
  ): Promise<ApiResponse<ProjectReport[]>> {
    try {
      const cacheKey = `reports:projects:${JSON.stringify({ pagination, filters })}`;
      const cached = await cache.get<ProjectReport[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { page = 1, pageSize = 20 } = pagination;
      const offset = (page - 1) * pageSize;

      let whereClause = "WHERE 1=1";
      if (filters.status) {
        whereClause += ` AND p.status = '${filters.status}'`;
      }
      if (filters.userId) {
        whereClause += ` AND (p.manager_id = '${filters.userId}' OR '${filters.userId}' = ANY(p.team_members))`;
      }
      if (filters.search) {
        whereClause += ` AND p.name ILIKE '%${filters.search}%'`;
      }

      const countResult = await db.unsafe(`SELECT COUNT(*) FROM projects p ${whereClause}`);
      const total = parseInt(countResult[0].count, 10);

      const sortBy = pagination.sortBy || "p.created_at";
      const sortOrder = pagination.sortOrder || "desc";

      const data = await db.unsafe(`
        SELECT 
          p.*,
          CONCAT(u.first_name, ' ', u.last_name) as manager_name,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as completed_task_count,
          (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id) as milestone_count,
          (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id AND m.status = 'completed') as completed_milestone_count
        FROM projects p
        LEFT JOIN users u ON p.manager_id = u.id
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ${pageSize} OFFSET ${offset}
      `);

      const projects: ProjectReport[] = data.map((row: Record<string, unknown>) => {
        const taskCount = parseInt(row.task_count as string, 10);
        const completedTaskCount = parseInt(row.completed_task_count as string, 10);
        const progressPercent = taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0;

        return {
          id: row.id as string,
          createdAt: (row.created_at as Date).toISOString(),
          updatedAt: (row.updated_at as Date).toISOString(),
          name: row.name as string,
          description: row.description as string | undefined,
          status: row.status as "planning" | "in_progress" | "on_hold" | "completed" | "cancelled",
          startDate: row.start_date ? (row.start_date as Date).toISOString() : undefined,
          endDate: row.end_date ? (row.end_date as Date).toISOString() : undefined,
          budget: row.budget ? parseFloat(row.budget as string) : undefined,
          currency: row.currency as string | undefined,
          clientId: row.client_id as string | undefined,
          dealId: row.deal_id as string | undefined,
          managerId: row.manager_id as string,
          teamMembers: (row.team_members as string[]) || [],
          tags: row.tags as string[] | undefined,
          managerName: row.manager_name as string | undefined,
          taskCount,
          completedTaskCount,
          progressPercent,
          milestoneCount: parseInt(row.milestone_count as string, 10),
          completedMilestoneCount: parseInt(row.completed_milestone_count as string, 10),
        };
      });

      await cache.set(cacheKey, projects, CACHE_TTL);
      return paginatedResponse(projects, total, pagination);
    } catch (error) {
      console.error("Error fetching projects report:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch projects report");
    }
  }

  async getTasksReport(
    pagination: PaginationParams,
    filters: ReportFilters
  ): Promise<ApiResponse<TaskReport[]>> {
    try {
      const cacheKey = `reports:tasks:${JSON.stringify({ pagination, filters })}`;
      const cached = await cache.get<TaskReport[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { page = 1, pageSize = 20 } = pagination;
      const offset = (page - 1) * pageSize;

      let whereClause = "WHERE 1=1";
      if (filters.status) {
        whereClause += ` AND t.status = '${filters.status}'`;
      }
      if (filters.projectId) {
        whereClause += ` AND t.project_id = '${filters.projectId}'`;
      }
      if (filters.assignedTo) {
        whereClause += ` AND t.assigned_to = '${filters.assignedTo}'`;
      }
      if (filters.search) {
        whereClause += ` AND t.title ILIKE '%${filters.search}%'`;
      }

      const countResult = await db.unsafe(`SELECT COUNT(*) FROM tasks t ${whereClause}`);
      const total = parseInt(countResult[0].count, 10);

      const sortBy = pagination.sortBy || "t.created_at";
      const sortOrder = pagination.sortOrder || "desc";

      const data = await db.unsafe(`
        SELECT 
          t.*,
          p.name as project_name,
          m.name as milestone_name,
          CONCAT(u.first_name, ' ', u.last_name) as assigned_to_name
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN milestones m ON t.milestone_id = m.id
        LEFT JOIN users u ON t.assigned_to = u.id
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ${pageSize} OFFSET ${offset}
      `);

      const tasks: TaskReport[] = data.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        createdAt: (row.created_at as Date).toISOString(),
        updatedAt: (row.updated_at as Date).toISOString(),
        title: row.title as string,
        description: row.description as string | undefined,
        status: row.status as "todo" | "in_progress" | "review" | "done",
        priority: row.priority as "low" | "medium" | "high" | "urgent",
        projectId: row.project_id as string,
        milestoneId: row.milestone_id as string | undefined,
        assignedTo: row.assigned_to as string | undefined,
        dueDate: row.due_date ? (row.due_date as Date).toISOString() : undefined,
        estimatedHours: row.estimated_hours ? parseFloat(row.estimated_hours as string) : undefined,
        actualHours: row.actual_hours ? parseFloat(row.actual_hours as string) : undefined,
        parentTaskId: row.parent_task_id as string | undefined,
        tags: row.tags as string[] | undefined,
        projectName: row.project_name as string | undefined,
        milestoneName: row.milestone_name as string | undefined,
        assignedToName: row.assigned_to_name as string | undefined,
      }));

      await cache.set(cacheKey, tasks, CACHE_TTL);
      return paginatedResponse(tasks, total, pagination);
    } catch (error) {
      console.error("Error fetching tasks report:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch tasks report");
    }
  }

  async getMilestonesReport(
    pagination: PaginationParams,
    filters: ReportFilters
  ): Promise<ApiResponse<MilestoneReport[]>> {
    try {
      const cacheKey = `reports:milestones:${JSON.stringify({ pagination, filters })}`;
      const cached = await cache.get<MilestoneReport[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { page = 1, pageSize = 20 } = pagination;
      const offset = (page - 1) * pageSize;

      let whereClause = "WHERE 1=1";
      if (filters.status) {
        whereClause += ` AND m.status = '${filters.status}'`;
      }
      if (filters.projectId) {
        whereClause += ` AND m.project_id = '${filters.projectId}'`;
      }
      if (filters.search) {
        whereClause += ` AND m.name ILIKE '%${filters.search}%'`;
      }

      const countResult = await db.unsafe(`SELECT COUNT(*) FROM milestones m ${whereClause}`);
      const total = parseInt(countResult[0].count, 10);

      const sortBy = pagination.sortBy || "m.due_date";
      const sortOrder = pagination.sortOrder || "asc";

      const data = await db.unsafe(`
        SELECT 
          m.*,
          p.name as project_name,
          (SELECT COUNT(*) FROM tasks t WHERE t.milestone_id = m.id) as task_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.milestone_id = m.id AND t.status = 'done') as completed_task_count
        FROM milestones m
        LEFT JOIN projects p ON m.project_id = p.id
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ${pageSize} OFFSET ${offset}
      `);

      const milestones: MilestoneReport[] = data.map((row: Record<string, unknown>) => {
        const taskCount = parseInt(row.task_count as string, 10);
        const completedTaskCount = parseInt(row.completed_task_count as string, 10);
        const progressPercent = taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0;

        return {
          id: row.id as string,
          createdAt: (row.created_at as Date).toISOString(),
          updatedAt: (row.updated_at as Date).toISOString(),
          name: row.name as string,
          description: row.description as string | undefined,
          projectId: row.project_id as string,
          status: row.status as "pending" | "in_progress" | "completed" | "delayed",
          dueDate: (row.due_date as Date).toISOString(),
          completedDate: row.completed_date ? (row.completed_date as Date).toISOString() : undefined,
          order: row.sort_order as number,
          projectName: row.project_name as string | undefined,
          taskCount,
          completedTaskCount,
          progressPercent,
        };
      });

      await cache.set(cacheKey, milestones, CACHE_TTL);
      return paginatedResponse(milestones, total, pagination);
    } catch (error) {
      console.error("Error fetching milestones report:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch milestones report");
    }
  }

  // ============================================
  // Summary/Dashboard Reports
  // ============================================

  async getSalesSummary(): Promise<ApiResponse<SalesSummary>> {
    try {
      const cacheKey = "reports:sales:summary";
      const cached = await cache.get<SalesSummary>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const quoteStats = await db`
        SELECT 
          COUNT(*) as total,
          COALESCE(SUM(total), 0) as total_value,
          COUNT(CASE WHEN status IN ('draft', 'sent') THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted
        FROM quotes
      `;

      const invoiceStats = await db`
        SELECT 
          COUNT(*) as total,
          COALESCE(SUM(total), 0) as total_value,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid,
          COALESCE(SUM(total - paid_amount), 0) as unpaid_amount,
          COUNT(CASE WHEN status IN ('sent', 'partial') AND due_date < NOW() THEN 1 END) as overdue
        FROM invoices
      `;

      const summary: SalesSummary = {
        totalQuotes: parseInt(quoteStats[0].total as string, 10),
        totalQuoteValue: parseFloat(quoteStats[0].total_value as string),
        pendingQuotes: parseInt(quoteStats[0].pending as string, 10),
        acceptedQuotes: parseInt(quoteStats[0].accepted as string, 10),
        totalInvoices: parseInt(invoiceStats[0].total as string, 10),
        totalInvoiceValue: parseFloat(invoiceStats[0].total_value as string),
        paidInvoices: parseInt(invoiceStats[0].paid as string, 10),
        unpaidAmount: parseFloat(invoiceStats[0].unpaid_amount as string),
        overdueInvoices: parseInt(invoiceStats[0].overdue as string, 10),
      };

      await cache.set(cacheKey, summary, 60); // 1 minute cache for summary
      return successResponse(summary);
    } catch (error) {
      console.error("Error fetching sales summary:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch sales summary");
    }
  }

  async getProjectSummary(): Promise<ApiResponse<ProjectSummary>> {
    try {
      const cacheKey = "reports:projects:summary";
      const cached = await cache.get<ProjectSummary>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const projectStats = await db`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
        FROM projects
      `;

      const taskStats = await db`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'done' THEN 1 END) as completed,
          COUNT(CASE WHEN due_date < NOW() AND status != 'done' THEN 1 END) as overdue
        FROM tasks
      `;

      const milestoneStats = await db`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
        FROM milestones
      `;

      const summary: ProjectSummary = {
        totalProjects: parseInt(projectStats[0].total as string, 10),
        activeProjects: parseInt(projectStats[0].active as string, 10),
        completedProjects: parseInt(projectStats[0].completed as string, 10),
        totalTasks: parseInt(taskStats[0].total as string, 10),
        completedTasks: parseInt(taskStats[0].completed as string, 10),
        overdueTasks: parseInt(taskStats[0].overdue as string, 10),
        totalMilestones: parseInt(milestoneStats[0].total as string, 10),
        completedMilestones: parseInt(milestoneStats[0].completed as string, 10),
      };

      await cache.set(cacheKey, summary, 60); // 1 minute cache for summary
      return successResponse(summary);
    } catch (error) {
      console.error("Error fetching project summary:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch project summary");
    }
  }

  // ============================================
  // Sales Analytics
  // ============================================

  async getRevenueOverTime(
    dateRange: AnalyticsDateRange
  ): Promise<ApiResponse<RevenuePoint[]>> {
    try {
      const cacheKey = `analytics:revenue:${JSON.stringify(dateRange)}`;
      const cached = await cache.get<RevenuePoint[]>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const data = await db.unsafe(`
        SELECT 
          DATE(issue_date) as date,
          COALESCE(SUM(paid_amount), 0) as revenue,
          COUNT(*) as invoice_count
        FROM invoices
        WHERE issue_date >= '${dateRange.from}' 
          AND issue_date <= '${dateRange.to}'
          AND status IN ('paid', 'partial')
        GROUP BY DATE(issue_date)
        ORDER BY date ASC
      `);

      const points: RevenuePoint[] = data.map((row: Record<string, unknown>) => ({
        date: (row.date as Date).toISOString().split('T')[0],
        revenue: parseFloat(row.revenue as string),
        invoiceCount: parseInt(row.invoice_count as string, 10),
      }));

      await cache.set(cacheKey, points, CACHE_TTL);
      return successResponse(points);
    } catch (error) {
      console.error("Error fetching revenue over time:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch revenue data");
    }
  }

  async getRevenueByCompany(
    dateRange: AnalyticsDateRange,
    limit: number = 10
  ): Promise<ApiResponse<CompanyRevenue[]>> {
    try {
      const cacheKey = `analytics:revenue-by-company:${JSON.stringify({ dateRange, limit })}`;
      const cached = await cache.get<CompanyRevenue[]>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const data = await db.unsafe(`
        SELECT 
          c.id as company_id,
          c.name as company_name,
          c.industry,
          COALESCE(SUM(i.paid_amount), 0) as revenue,
          COUNT(i.id) as invoice_count
        FROM companies c
        LEFT JOIN invoices i ON c.id = i.company_id 
          AND i.issue_date >= '${dateRange.from}' 
          AND i.issue_date <= '${dateRange.to}'
        GROUP BY c.id, c.name, c.industry
        HAVING COALESCE(SUM(i.paid_amount), 0) > 0
        ORDER BY revenue DESC
        LIMIT ${limit}
      `);

      const companies: CompanyRevenue[] = data.map((row: Record<string, unknown>) => ({
        companyId: row.company_id as string,
        companyName: row.company_name as string,
        industry: row.industry as string | undefined,
        revenue: parseFloat(row.revenue as string),
        invoiceCount: parseInt(row.invoice_count as string, 10),
      }));

      await cache.set(cacheKey, companies, CACHE_TTL);
      return successResponse(companies);
    } catch (error) {
      console.error("Error fetching revenue by company:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch company revenue data");
    }
  }

  async getTopCustomers(
    dateRange: AnalyticsDateRange,
    limit: number = 10
  ): Promise<ApiResponse<TopCustomer[]>> {
    try {
      const cacheKey = `analytics:top-customers:${JSON.stringify({ dateRange, limit })}`;
      const cached = await cache.get<TopCustomer[]>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const data = await db.unsafe(`
        SELECT 
          c.id as company_id,
          c.name as company_name,
          c.industry,
          COALESCE(SUM(i.total), 0) as total_revenue,
          COALESCE(SUM(i.paid_amount), 0) as paid_revenue,
          COUNT(DISTINCT i.id) as invoice_count,
          COUNT(DISTINCT q.id) as quote_count,
          CASE 
            WHEN COUNT(DISTINCT q.id) > 0 
            THEN ROUND((COUNT(DISTINCT i.id)::decimal / COUNT(DISTINCT q.id)::decimal) * 100, 2)
            ELSE 0 
          END as conversion_rate
        FROM companies c
        LEFT JOIN invoices i ON c.id = i.company_id 
          AND i.issue_date >= '${dateRange.from}' 
          AND i.issue_date <= '${dateRange.to}'
        LEFT JOIN quotes q ON c.id = q.company_id 
          AND q.issue_date >= '${dateRange.from}' 
          AND q.issue_date <= '${dateRange.to}'
        GROUP BY c.id, c.name, c.industry
        HAVING COALESCE(SUM(i.total), 0) > 0 OR COUNT(DISTINCT q.id) > 0
        ORDER BY total_revenue DESC
        LIMIT ${limit}
      `);

      const customers: TopCustomer[] = data.map((row: Record<string, unknown>) => ({
        companyId: row.company_id as string,
        companyName: row.company_name as string,
        industry: row.industry as string | undefined,
        totalRevenue: parseFloat(row.total_revenue as string),
        paidRevenue: parseFloat(row.paid_revenue as string),
        invoiceCount: parseInt(row.invoice_count as string, 10),
        quoteCount: parseInt(row.quote_count as string, 10),
        conversionRate: parseFloat(row.conversion_rate as string),
      }));

      await cache.set(cacheKey, customers, CACHE_TTL);
      return successResponse(customers);
    } catch (error) {
      console.error("Error fetching top customers:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch top customers data");
    }
  }

  async getConversionFunnel(
    dateRange: AnalyticsDateRange
  ): Promise<ApiResponse<ConversionFunnel>> {
    try {
      const cacheKey = `analytics:conversion-funnel:${JSON.stringify(dateRange)}`;
      const cached = await cache.get<ConversionFunnel>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const quoteStats = await db.unsafe(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status IN ('sent', 'accepted', 'rejected', 'expired') THEN 1 END) as sent,
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted
        FROM quotes
        WHERE issue_date >= '${dateRange.from}' AND issue_date <= '${dateRange.to}'
      `);

      const invoiceFromQuotes = await db.unsafe(`
        SELECT COUNT(DISTINCT i.id) as converted
        FROM invoices i
        INNER JOIN quotes q ON i.quote_id = q.id
        WHERE q.issue_date >= '${dateRange.from}' AND q.issue_date <= '${dateRange.to}'
      `);

      const paidFromQuotes = await db.unsafe(`
        SELECT COUNT(DISTINCT i.id) as paid
        FROM invoices i
        INNER JOIN quotes q ON i.quote_id = q.id
        WHERE q.issue_date >= '${dateRange.from}' 
          AND q.issue_date <= '${dateRange.to}'
          AND i.status = 'paid'
      `);

      const avgDays = await db.unsafe(`
        SELECT COALESCE(AVG(
          EXTRACT(EPOCH FROM (i.created_at - q.issue_date)) / 86400
        ), 0) as avg_days
        FROM invoices i
        INNER JOIN quotes q ON i.quote_id = q.id
        WHERE q.issue_date >= '${dateRange.from}' AND q.issue_date <= '${dateRange.to}'
      `);

      const totalQuotes = parseInt(quoteStats[0].total as string, 10);
      const convertedToInvoice = parseInt(invoiceFromQuotes[0].converted as string, 10);

      const funnel: ConversionFunnel = {
        totalQuotes,
        sentQuotes: parseInt(quoteStats[0].sent as string, 10),
        acceptedQuotes: parseInt(quoteStats[0].accepted as string, 10),
        convertedToInvoice,
        paidInvoices: parseInt(paidFromQuotes[0].paid as string, 10),
        conversionRate: totalQuotes > 0 ? Math.round((convertedToInvoice / totalQuotes) * 100) : 0,
        avgDaysToConvert: Math.round(parseFloat(avgDays[0].avg_days as string) * 10) / 10,
      };

      await cache.set(cacheKey, funnel, CACHE_TTL);
      return successResponse(funnel);
    } catch (error) {
      console.error("Error fetching conversion funnel:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch conversion funnel data");
    }
  }

  async getInvoiceStatusBreakdown(
    dateRange: AnalyticsDateRange
  ): Promise<ApiResponse<InvoiceStatusBreakdown[]>> {
    try {
      const cacheKey = `analytics:invoice-status:${JSON.stringify(dateRange)}`;
      const cached = await cache.get<InvoiceStatusBreakdown[]>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const data = await db.unsafe(`
        SELECT 
          status,
          COUNT(*) as count,
          COALESCE(SUM(total), 0) as total_value
        FROM invoices
        WHERE issue_date >= '${dateRange.from}' AND issue_date <= '${dateRange.to}'
        GROUP BY status
        ORDER BY count DESC
      `);

      const breakdown: InvoiceStatusBreakdown[] = data.map((row: Record<string, unknown>) => ({
        status: row.status as "draft" | "sent" | "paid" | "partial" | "overdue" | "cancelled",
        count: parseInt(row.count as string, 10),
        totalValue: parseFloat(row.total_value as string),
      }));

      await cache.set(cacheKey, breakdown, CACHE_TTL);
      return successResponse(breakdown);
    } catch (error) {
      console.error("Error fetching invoice status breakdown:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch invoice status data");
    }
  }

  // ============================================
  // Project Analytics
  // ============================================

  async getTaskStatsOverTime(
    dateRange: AnalyticsDateRange,
    projectId?: string
  ): Promise<ApiResponse<TaskStatPoint[]>> {
    try {
      const cacheKey = `analytics:task-stats:${JSON.stringify({ dateRange, projectId })}`;
      const cached = await cache.get<TaskStatPoint[]>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      let projectFilter = "";
      if (projectId) {
        projectFilter = `AND project_id = '${projectId}'`;
      }

      const created = await db.unsafe(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM tasks
        WHERE created_at >= '${dateRange.from}' 
          AND created_at <= '${dateRange.to}'
          ${projectFilter}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);

      const completed = await db.unsafe(`
        SELECT 
          DATE(updated_at) as date,
          COUNT(*) as count
        FROM tasks
        WHERE status = 'done'
          AND updated_at >= '${dateRange.from}' 
          AND updated_at <= '${dateRange.to}'
          ${projectFilter}
        GROUP BY DATE(updated_at)
        ORDER BY date ASC
      `);

      // Build a map of dates
      const dateMap = new Map<string, TaskStatPoint>();
      
      const startDate = new Date(dateRange.from);
      const endDate = new Date(dateRange.to);
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        dateMap.set(dateStr, { date: dateStr, created: 0, completed: 0, pending: 0 });
      }

      for (const row of created) {
        const dateStr = (row.date as Date).toISOString().split('T')[0];
        const point = dateMap.get(dateStr);
        if (point) {
          point.created = parseInt(row.count as string, 10);
        }
      }

      for (const row of completed) {
        const dateStr = (row.date as Date).toISOString().split('T')[0];
        const point = dateMap.get(dateStr);
        if (point) {
          point.completed = parseInt(row.count as string, 10);
        }
      }

      // Calculate running pending count
      let runningPending = 0;
      const points = Array.from(dateMap.values());
      for (const point of points) {
        runningPending += point.created - point.completed;
        point.pending = Math.max(0, runningPending);
      }

      await cache.set(cacheKey, points, CACHE_TTL);
      return successResponse(points);
    } catch (error) {
      console.error("Error fetching task stats over time:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch task stats data");
    }
  }

  async getMilestoneBreakdown(
    projectId?: string
  ): Promise<ApiResponse<MilestoneBreakdown[]>> {
    try {
      const cacheKey = `analytics:milestone-breakdown:${projectId || 'all'}`;
      const cached = await cache.get<MilestoneBreakdown[]>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      let projectFilter = "";
      if (projectId) {
        projectFilter = `WHERE project_id = '${projectId}'`;
      }

      const data = await db.unsafe(`
        SELECT 
          status,
          COUNT(*) as count
        FROM milestones
        ${projectFilter}
        GROUP BY status
      `);

      const total = data.reduce((sum: number, row: Record<string, unknown>) => 
        sum + parseInt(row.count as string, 10), 0);

      const breakdown: MilestoneBreakdown[] = data.map((row: Record<string, unknown>) => {
        const count = parseInt(row.count as string, 10);
        return {
          status: row.status as "pending" | "in_progress" | "completed" | "delayed",
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        };
      });

      await cache.set(cacheKey, breakdown, CACHE_TTL);
      return successResponse(breakdown);
    } catch (error) {
      console.error("Error fetching milestone breakdown:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch milestone breakdown data");
    }
  }

  async getTasksByPriority(
    projectId?: string
  ): Promise<ApiResponse<TaskPriorityStats[]>> {
    try {
      const cacheKey = `analytics:tasks-by-priority:${projectId || 'all'}`;
      const cached = await cache.get<TaskPriorityStats[]>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      let projectFilter = "";
      if (projectId) {
        projectFilter = `WHERE project_id = '${projectId}'`;
      }

      const data = await db.unsafe(`
        SELECT 
          priority,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'done' THEN 1 END) as completed_count
        FROM tasks
        ${projectFilter}
        GROUP BY priority
        ORDER BY 
          CASE priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END
      `);

      const total = data.reduce((sum: number, row: Record<string, unknown>) => 
        sum + parseInt(row.count as string, 10), 0);

      const stats: TaskPriorityStats[] = data.map((row: Record<string, unknown>) => {
        const count = parseInt(row.count as string, 10);
        return {
          priority: row.priority as "low" | "medium" | "high" | "urgent",
          count,
          completedCount: parseInt(row.completed_count as string, 10),
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        };
      });

      await cache.set(cacheKey, stats, CACHE_TTL);
      return successResponse(stats);
    } catch (error) {
      console.error("Error fetching tasks by priority:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch tasks by priority data");
    }
  }

  async getProjectDurationStats(): Promise<ApiResponse<ProjectDurationStats>> {
    try {
      const cacheKey = "analytics:project-duration";
      const cached = await cache.get<ProjectDurationStats>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const data = await db.unsafe(`
        SELECT 
          AVG(EXTRACT(EPOCH FROM (
            COALESCE(end_date, NOW()) - start_date
          )) / 86400) as avg_duration,
          MIN(EXTRACT(EPOCH FROM (
            COALESCE(end_date, NOW()) - start_date
          )) / 86400) as min_duration,
          MAX(EXTRACT(EPOCH FROM (
            COALESCE(end_date, NOW()) - start_date
          )) / 86400) as max_duration,
          COUNT(CASE WHEN status = 'completed' AND end_date <= 
            (SELECT MAX(due_date) FROM milestones m WHERE m.project_id = projects.id)
          THEN 1 END)::decimal / NULLIF(COUNT(CASE WHEN status = 'completed' THEN 1 END), 0) * 100 as on_time_pct
        FROM projects
        WHERE start_date IS NOT NULL
      `);

      const stats: ProjectDurationStats = {
        avgDurationDays: Math.round(parseFloat(data[0].avg_duration as string) || 0),
        minDurationDays: Math.round(parseFloat(data[0].min_duration as string) || 0),
        maxDurationDays: Math.round(parseFloat(data[0].max_duration as string) || 0),
        onTimePercentage: Math.round(parseFloat(data[0].on_time_pct as string) || 0),
      };

      await cache.set(cacheKey, stats, CACHE_TTL);
      return successResponse(stats);
    } catch (error) {
      console.error("Error fetching project duration stats:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch project duration stats");
    }
  }
}

export const reportsService = new ReportsService();

