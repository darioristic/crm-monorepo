# AI Module Quick Reference

Fast reference for common AI module operations.

## Hooks Cheat Sheet

```typescript
// AI Filter Hooks
import { useInvoiceAIFilter, useCustomerAIFilter, useProductAIFilter } from "@/hooks/use-ai-filter";

const { parseQuery, result, isLoading, clear } = useInvoiceAIFilter();
await parseQuery("unpaid invoices over $1000");

// AI Search Hooks (with debounce)
import { useInvoiceAISearch, useCustomerAISearch } from "@/hooks/use-ai-search";

const { query, setQuery, filters, filterDescription } = useInvoiceAISearch(500);
```

## Visualization Components

```typescript
import { SalesFunnel, CustomerMetrics } from "@/components/analytics";

<SalesFunnel data={[
  { name: "Lead", count: 100, value: 500000 },
  { name: "Won", count: 12, value: 100000 },
]} />

<CustomerMetrics typeData={[
  { name: "Customer", count: 450 },
  { name: "Lead", count: 320 },
]} />
```

## Document Processing

```typescript
import { loadDocument, documentClassifier, invoiceProcessor } from "@crm/documents";

// Load any document
const { text } = await loadDocument({ content: blob, metadata: { mimetype: "application/pdf" } });

// Classify document type
const { type, confidence } = await documentClassifier.classify(text);

// Extract invoice data
const invoice = await invoiceProcessor.processDocument({ documentUrl: url });
```

## AI Agents

| Agent | Trigger Keywords | Example |
|-------|-----------------|---------|
| `invoices` | invoice, payment, overdue, billing | "Show overdue invoices" |
| `customers` | customer, contact, company, client | "Find tech companies" |
| `sales` | deal, pipeline, opportunity, forecast | "Deals in negotiation" |
| `analytics` | metrics, KPI, growth, trends | "What's our growth rate?" |
| `reports` | report, summary, dashboard | "Generate monthly report" |
| `general` | help, how, what is | "How do I create invoice?" |

## Filter Query Examples

### Invoices
| Query | Parsed |
|-------|--------|
| `unpaid invoices` | `{ status: ["sent", "overdue"] }` |
| `over $1000` | `{ amountRange: { min: 1000 } }` |
| `due this week` | `{ dueDateRange: {...} }` |
| `from Acme Corp` | `{ customerName: "Acme Corp" }` |

### Customers
| Query | Parsed |
|-------|--------|
| `tech companies` | `{ industry: ["Technology"] }` |
| `in California` | `{ country: "USA", city: "California" }` |
| `active customers` | `{ type: ["customer"], hasRecentActivity: true }` |
| `high value` | `{ revenueRange: { min: 50000 } }` |

### Products
| Query | Parsed |
|-------|--------|
| `cheap products` | `{ priceRange: { max: 50 } }` |
| `subscriptions` | `{ isRecurring: true }` |
| `in stock` | `{ inStock: true }` |
| `software category` | `{ category: ["Software"] }` |

## Environment Variables

```env
# Required
OPENAI_API_KEY=sk-...
MISTRAL_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...

# Feature Flags
AI_ENABLED=true
AI_CHAT_ENABLED=true
AI_DOCUMENT_PROCESSING_ENABLED=true
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/chat` | POST | Chat with AI |
| `/api/v1/chat/history/:id` | GET | Get chat history |
| `/api/ai/filters/invoices` | POST | Parse invoice query |
| `/api/ai/filters/customers` | POST | Parse customer query |
| `/api/ai/filters/products` | POST | Parse product query |
| `/api/ai/filters/vault` | POST | Parse document query |

## Supported Document Formats

| Extension | MIME Type | OCR |
|-----------|-----------|-----|
| .pdf | application/pdf | Yes |
| .docx | application/vnd.openxmlformats... | No |
| .xlsx | application/vnd.openxmlformats... | No |
| .pptx | application/vnd.openxmlformats... | No |
| .csv | text/csv | No |
| .txt | text/plain | No |
| .md | text/markdown | No |
| .rtf | application/rtf | No |

## File Locations

```
apps/web/src/
├── hooks/
│   ├── use-ai-filter.ts
│   └── use-ai-search.ts
├── components/analytics/
│   ├── sales-funnel.tsx
│   └── customer-metrics.tsx
└── app/api/ai/filters/
    ├── invoices/route.ts
    ├── customers/route.ts
    └── products/route.ts

apps/api-server/src/ai/
├── agents/
│   ├── main.ts (triage)
│   ├── general.ts
│   ├── invoices.ts
│   ├── customers.ts
│   ├── sales.ts
│   ├── analytics.ts
│   └── reports.ts
└── tools/
    ├── get-invoices.ts
    ├── get-customers.ts
    ├── get-products.ts
    └── get-quotes.ts

packages/
├── documents/src/
│   ├── classifier/
│   ├── processors/
│   └── loaders/
└── categories/src/
    └── embeddings.ts
```
