# AI Tools - Developer Guide

Kompletan vodič za kreiranje i korišćenje AI tools u CRM sistemu.

## 📋 Sadržaj

1. [Uvod u Tools](#uvod-u-tools)
2. [Tool Anatomija](#tool-anatomija)
3. [Kreiranje Novog Tool-a](#kreiranje-novog-tool-a)
4. [Tool Patterns](#tool-patterns)
5. [Best Practices](#best-practices)
6. [API Reference](#api-reference)

---

## Uvod u Tools

AI Tools su funkcije koje agenti mogu pozivati da bi pristupili podacima, izvršili operacije, ili interagovali sa sistemom.

### Postojeći Tools

| Tool | Parametri | Povratna Vrednost | Agent |
|------|-----------|-------------------|-------|
| `getInvoices` | pageSize, status, search | Invoice list + summary | invoices |
| `getOverdueInvoices` | - | Overdue invoices | invoices |
| `getCustomers` | pageSize, search, industry, country | Customer list | customers |
| `getCustomerById` | customerId | Customer details | customers |
| `getIndustriesSummary` | - | Industries overview | customers |
| `getProducts` | pageSize, search, category | Product list | general |
| `getProductCategories` | - | Categories summary | general |
| `getQuotes` | pageSize, status, search | Quote list | sales |
| `getQuoteConversion` | period | Conversion analytics | sales |

---

## Tool Anatomija

### Tool Structure

```typescript
import { tool } from "ai";
import { z } from "zod";
import type { ToolResponse } from "../types";

// 1. Define schema
const myToolSchema = z.object({
  param1: z.string().describe("Parameter description"),
  param2: z.number().optional().describe("Optional parameter"),
});

// 2. Infer types
type MyToolParams = z.infer<typeof myToolSchema>;

// 3. Create tool
export const myTool = tool({
  description: "Clear description of what this tool does",
  parameters: myToolSchema,
  execute: async (params: MyToolParams): Promise<ToolResponse> => {
    const { param1, param2 } = params;
    
    try {
      // 4. Execute logic
      const result = await fetchData(param1, param2);
      
      // 5. Format response
      return {
        text: formatResponse(result),
        link: {
          text: "View details",
          url: `/path/to/${result.id}`,
        },
      };
    } catch (error) {
      // 6. Handle errors
      return {
        text: `Error: ${error.message}`,
      };
    }
  },
});
```

### ToolResponse Type

```typescript
interface ToolResponse {
  text: string;          // Markdown formatted text
  link?: {              // Optional navigation link
    text: string;       // Link text
    url: string;        // Link URL
  };
}
```

---

## Kreiranje Novog Tool-a

### Example: Get Projects Tool

**Fajl**: `apps/api-server/src/ai/tools/get-projects.ts`

```typescript
import { tool } from "ai";
import { z } from "zod";
import { sql as db } from "../../db/client";
import type { ToolResponse } from "../types";

// ========================================
// 1. Define Schema
// ========================================
const getProjectsSchema = z.object({
  pageSize: z
    .number()
    .min(1)
    .max(50)
    .default(10)
    .describe("Number of projects to return"),
  status: z
    .enum(["planning", "in_progress", "completed", "on_hold"])
    .optional()
    .describe("Filter by project status"),
  search: z
    .string()
    .optional()
    .describe("Search by project name"),
});

type GetProjectsParams = z.infer<typeof getProjectsSchema>;

// ========================================
// 2. Create Tool
// ========================================
export const getProjectsTool = tool({
  description: "Search and retrieve projects with filtering options",
  parameters: getProjectsSchema,
  
  execute: async (params: GetProjectsParams): Promise<ToolResponse> => {
    const { pageSize = 10, status, search } = params;

    try {
      // ========================================
      // 3. Build Query
      // ========================================
      let query = `
        SELECT p.*, c.name as client_name
        FROM projects p
        LEFT JOIN companies c ON p.client_id = c.id
        WHERE 1=1
      `;
      const queryParams: (string | number)[] = [];

      if (status) {
        queryParams.push(status);
        query += ` AND p.status = $${queryParams.length}`;
      }

      if (search) {
        queryParams.push(`%${search}%`);
        query += ` AND p.name ILIKE $${queryParams.length}`;
      }

      queryParams.push(pageSize);
      query += ` ORDER BY p.created_at DESC LIMIT $${queryParams.length}`;

      // ========================================
      // 4. Execute Query
      // ========================================
      const result = await db.unsafe(query, queryParams);

      if (result.length === 0) {
        return { text: "No projects found matching your criteria." };
      }

      // ========================================
      // 5. Format Response
      // ========================================
      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("sr-RS", {
          style: "currency",
          currency: "EUR",
        }).format(amount);
      };

      const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("sr-RS");
      };

      // Build markdown table
      const tableRows = result
        .map((project: Record<string, unknown>) => {
          const budget = formatCurrency(
            parseFloat(project.budget as string) || 0
          );
          const deadline = project.deadline
            ? formatDate(project.deadline as string)
            : "N/A";
          return `| ${project.name} | ${project.client_name || "N/A"} | ${project.status} | ${budget} | ${deadline} |`;
        })
        .join("\n");

      // Calculate summary stats
      const totalBudget = result.reduce(
        (sum: number, p: Record<string, unknown>) =>
          sum + (parseFloat(p.budget as string) || 0),
        0
      );

      const completedCount = result.filter(
        (p: Record<string, unknown>) => p.status === "completed"
      ).length;

      const response = `| Project | Client | Status | Budget | Deadline |
|---------|--------|--------|--------|----------|
${tableRows}

**Summary**: ${result.length} projects | Total Budget: ${formatCurrency(totalBudget)} | Completed: ${completedCount}`;

      // ========================================
      // 6. Return with Link
      // ========================================
      return {
        text: response,
        link: {
          text: "View all projects",
          url: "/dashboard/projects",
        },
      };
    } catch (error) {
      // ========================================
      // 7. Error Handling
      // ========================================
      return {
        text: `Failed to retrieve projects: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
});

// ========================================
// 8. Export
// ========================================
export default getProjectsTool;
```

### Registracija Tool-a

**1. Dodaj u tools index** (`apps/api-server/src/ai/tools/index.ts`):

```typescript
export { getProjectsTool } from "./get-projects";

export const allTools = {
  // ... existing tools
  getProjects: () => import("./get-projects").then((m) => m.getProjectsTool),
};
```

**2. Dodaj u relevantne agente**:

```typescript
// apps/api-server/src/ai/agents/projects.ts
export const projectsAgent = createAgent({
  name: "projects",
  // ...
  tools: {
    getProjects: getProjectsTool,
  },
});
```

---

## Tool Patterns

### Pattern 1: Simple Data Retrieval

Za čitanje podataka bez filtera:

```typescript
export const getAccountBalanceTool = tool({
  description: "Get current account balance",
  parameters: z.object({}),  // No params
  execute: async (_params): Promise<ToolResponse> => {
    const balance = await db`
      SELECT SUM(amount) as total FROM transactions
    `;
    return {
      text: `Current balance: €${balance[0].total}`,
    };
  },
});
```

### Pattern 2: Filtered List

Za liste sa filter parametrima:

```typescript
const schema = z.object({
  pageSize: z.number().default(10),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  category: z.string().optional(),
});

export const getTransactionsTool = tool({
  description: "Get transactions with filters",
  parameters: schema,
  execute: async (params) => {
    // Build dynamic query based on params
    // Return filtered results
  },
});
```

### Pattern 3: Aggregation

Za izračunavanja i statistike:

```typescript
export const getRevenueSummaryTool = tool({
  description: "Get revenue summary with analytics",
  parameters: z.object({
    period: z.enum(["week", "month", "quarter", "year"]),
  }),
  execute: async ({ period }) => {
    const days = periodToDays(period);
    
    const stats = await db`
      SELECT 
        SUM(total) as revenue,
        COUNT(*) as invoices,
        AVG(total) as avg_invoice
      FROM invoices
      WHERE created_at >= NOW() - INTERVAL '${days} days'
    `;
    
    return {
      text: formatSummary(stats[0]),
    };
  },
});
```

### Pattern 4: Detail View

Za pojedinačne entitete:

```typescript
export const getInvoiceDetailsTool = tool({
  description: "Get detailed invoice information",
  parameters: z.object({
    invoiceId: z.string(),
  }),
  execute: async ({ invoiceId }) => {
    const invoice = await invoiceQueries.findById(invoiceId);
    
    if (!invoice) {
      return { text: `Invoice ${invoiceId} not found.` };
    }
    
    return {
      text: formatInvoiceDetails(invoice),
      link: {
        text: "View invoice",
        url: `/invoices/${invoiceId}`,
      },
    };
  },
});
```

### Pattern 5: Multi-Step Analysis

Za kompleksne analize:

```typescript
export const getCustomerAnalysisTool = tool({
  description: "Comprehensive customer analysis",
  parameters: z.object({
    customerId: z.string(),
  }),
  execute: async ({ customerId }) => {
    // Step 1: Get customer
    const customer = await getCustomer(customerId);
    
    // Step 2: Get invoices
    const invoices = await getCustomerInvoices(customerId);
    
    // Step 3: Calculate metrics
    const metrics = calculateCustomerMetrics(invoices);
    
    // Step 4: Format comprehensive report
    return {
      text: formatCustomerReport(customer, invoices, metrics),
    };
  },
});
```

---

## Best Practices

### 1. Schema Design

**✅ GOOD:**
```typescript
z.object({
  pageSize: z.number().min(1).max(50).default(10)
    .describe("Number of results to return (1-50)"),
  status: z.enum(["active", "inactive"])
    .optional()
    .describe("Filter by status"),
})
```

**❌ BAD:**
```typescript
z.object({
  size: z.number(),  // No constraints, no description
  s: z.string(),     // Unclear name
})
```

### 2. Response Formatting

**✅ GOOD - Structured:**
```typescript
const response = `## Customer List

| Name | Industry | Revenue |
|------|----------|---------|
| ACME | Tech | €50,000 |
| Corp | Finance | €75,000 |

**Total**: 2 customers | **Revenue**: €125,000`;
```

**❌ BAD - Unstructured:**
```typescript
const response = `Found customers: ACME (Tech, €50k), Corp (Finance, €75k)`;
```

### 3. Error Messages

**✅ GOOD:**
```typescript
catch (error) {
  return {
    text: `Unable to retrieve invoices. ${error.message}. Please try again or contact support.`,
  };
}
```

**❌ BAD:**
```typescript
catch (error) {
  return { text: "Error" };
}
```

### 4. Localization

```typescript
// Use user's locale from context
const formatCurrency = (amount: number, locale: string, currency: string) => {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
};

const formatDate = (date: string, locale: string) => {
  return new Date(date).toLocaleDateString(locale);
};
```

### 5. Performance

```typescript
// ✅ Use pagination
pageSize: z.number().min(1).max(50).default(10)

// ✅ Use indices
await db`SELECT * FROM invoices WHERE company_id = ${id}  -- indexed`

// ✅ Limit joins
// Only join what you need to display

// ❌ Avoid N+1 queries
// Use joins or batch queries instead
```

---

## Tool Response Examples

### Example 1: List with Table

```markdown
| Invoice # | Status | Amount | Due Date |
|-----------|--------|--------|----------|
| INV-001 | Paid | €1,000 | 2024-01-15 |
| INV-002 | Overdue | €2,500 | 2024-01-10 |

**Summary**: 2 invoices | Total: €3,500 | Overdue: 1
```

### Example 2: Single Entity

```markdown
**ACME Corporation**

- **Industry**: Technology
- **Location**: Belgrade, Serbia
- **Email**: contact@acme.com
- **Phone**: +381 11 123 4567
- **Revenue**: €125,000 (YTD)

**Recent Activity**:
- 5 invoices (€75,000)
- 3 quotes (€50,000)
- Last contact: 2024-11-30
```

### Example 3: Analytics

```markdown
## Revenue Analysis (Q4 2024)

📈 **Total Revenue**: €350,000 (+15% from Q3)
💰 **Average Deal**: €12,500
📊 **Conversion Rate**: 67%

### Top 3 Customers:
1. ACME Corp - €125,000 (36%)
2. TechCo - €85,000 (24%)
3. StartupX - €60,000 (17%)
```

---

## Testing Tools

### Unit Test Example

```typescript
import { describe, it, expect, vi } from "vitest";
import { getProjectsTool } from "./get-projects";
import * as db from "../../db/client";

describe("getProjectsTool", () => {
  it("should return formatted projects", async () => {
    // Mock database
    vi.spyOn(db, "unsafe").mockResolvedValue([
      {
        name: "Project A",
        status: "in_progress",
        budget: 10000,
        deadline: "2024-12-31",
      },
    ]);

    const result = await getProjectsTool.execute({
      pageSize: 10,
    });

    expect(result.text).toContain("Project A");
    expect(result.text).toContain("in_progress");
    expect(result.link?.url).toBe("/dashboard/projects");
  });

  it("should handle empty results", async () => {
    vi.spyOn(db, "unsafe").mockResolvedValue([]);

    const result = await getProjectsTool.execute({ pageSize: 10 });

    expect(result.text).toBe("No projects found matching your criteria.");
  });

  it("should handle errors gracefully", async () => {
    vi.spyOn(db, "unsafe").mockRejectedValue(new Error("DB error"));

    const result = await getProjectsTool.execute({ pageSize: 10 });

    expect(result.text).toContain("Failed to retrieve projects");
  });
});
```

---

## Troubleshooting

### Common Issues

**Tool se ne poziva**
- Proveri da li je tool dodat u agent's tools config
- Proveri description - da li jasno opisuje šta tool radi
- Proveri parameter descriptions

**Timeout errors**
- Smanji pageSize default vrednost
- Dodaj database indices
- Optimizuj queries

**Type errors**
- Uvek definišite type iz schema: `type Params = z.infer<typeof schema>`
- Koristite taj type u execute funkciji

**Format issues**
- Koristi markdown tables za strukturirane podatke
- Dodaj summary statistike
- Include link za navigaciju

---

## Resources

- [Vercel AI SDK Tools](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)
- [Zod Documentation](https://zod.dev/)
- [Markdown Guide](https://www.markdownguide.org/)

---

**Last Updated**: 2024-12-02  
**Version**: 1.0.0

