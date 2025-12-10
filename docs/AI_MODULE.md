# AI Module Documentation

Complete documentation for the CRM AI module, including agents, filters, hooks, and visualizations.

## Table of Contents

1. [Overview](#overview)
2. [AI Agents](#ai-agents)
3. [AI Filter Endpoints](#ai-filter-endpoints)
4. [Frontend Hooks](#frontend-hooks)
5. [Visualizations](#visualizations)
6. [Document Processing](#document-processing)
7. [Configuration](#configuration)
8. [Examples](#examples)

---

## Overview

The CRM AI module provides intelligent features for:
- **Natural language search** - Parse queries like "unpaid invoices over $1000"
- **AI Chat assistants** - 7 specialized agents for different business domains
- **Document processing** - Extract data from PDFs, Office documents, images
- **Analytics visualizations** - Sales funnel, customer metrics charts

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  Hooks                    │  Components                      │
│  ├── useAIFilter          │  ├── SalesFunnel                │
│  ├── useAISearch          │  ├── CustomerMetrics            │
│  └── useChatSession       │  └── ChatInterface              │
├─────────────────────────────────────────────────────────────┤
│                    API Endpoints                             │
│  /api/ai/filters/*        │  /api/v1/chat                   │
├─────────────────────────────────────────────────────────────┤
│                    Backend (API Server)                      │
├─────────────────────────────────────────────────────────────┤
│  Agents                   │  Tools                          │
│  ├── triage (main)        │  ├── getInvoices               │
│  ├── general              │  ├── getCustomers              │
│  ├── invoices             │  ├── getProducts               │
│  ├── customers            │  ├── getQuotes                 │
│  ├── sales                │  └── ...                       │
│  ├── analytics            │                                 │
│  └── reports              │                                 │
├─────────────────────────────────────────────────────────────┤
│                    Packages                                  │
│  @crm/documents           │  @crm/categories                │
│  ├── DocumentClassifier   │  ├── CategoryEmbeddings        │
│  ├── InvoiceProcessor     │  └── findBestCategory          │
│  ├── DocumentLoader       │                                 │
│  └── ReceiptProcessor     │                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## AI Agents

### Available Agents

| Agent | Purpose | Example Queries |
|-------|---------|-----------------|
| `general` | General help, navigation | "How do I create an invoice?" |
| `invoices` | Invoice management | "Show overdue invoices" |
| `customers` | Customer relationships | "Find tech companies in Croatia" |
| `sales` | Pipeline & deals | "What deals are in negotiation?" |
| `analytics` | Metrics & KPIs | "What's our growth rate?" |
| `reports` | Report generation | "Generate monthly sales report" |

### Triage (Main) Agent

The triage agent automatically routes user messages to the appropriate specialist:

```typescript
// User: "Show me unpaid invoices over $1000"
// Triage routes to: invoices agent

// User: "Generate a monthly report"
// Triage routes to: reports agent
```

### Agent Capabilities

#### General Agent
- Answer general CRM questions
- Help with navigation
- Explain terminology
- Web search capabilities

#### Invoices Agent
- Search/filter invoices by status, date, customer, amount
- Analyze payment patterns
- Track overdue invoices
- Provide collection insights

**Statuses:** `draft`, `sent`, `paid`, `overdue`, `cancelled`, `partial`

#### Customers Agent
- Search customers by name, email, company
- View customer details and contacts
- Analyze customer activity
- Track lifetime value
- Industry segmentation

**Types:** `lead`, `prospect`, `customer`, `churned`, `partner`

#### Sales Agent
- Search deals by stage, value, customer
- Analyze pipeline health
- Track conversion rates
- Revenue forecasting

**Stages:** `lead`, `qualified`, `proposal`, `negotiation`, `won`, `lost`

#### Analytics Agent
- Calculate KPIs and metrics
- Analyze growth rates
- Compare periods
- Identify trends
- Performance analysis

**Metrics:**
- Revenue growth (MoM, YoY)
- Conversion rates
- Average deal size
- Customer lifetime value
- Pipeline velocity

#### Reports Agent
- Generate sales reports
- Customer activity summaries
- Invoice aging reports
- Executive summaries
- Period comparisons

---

## AI Filter Endpoints

Natural language query parsing for search interfaces.

### Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/ai/filters/invoices` | Parse invoice search queries |
| `POST /api/ai/filters/customers` | Parse customer search queries |
| `POST /api/ai/filters/products` | Parse product search queries |
| `POST /api/ai/filters/vault` | Parse document search queries |

### Invoice Filter

**Request:**
```json
{
  "query": "unpaid invoices over $1000 from last month"
}
```

**Response:**
```json
{
  "status": ["sent", "overdue"],
  "amountRange": { "min": 1000 },
  "dateRange": { "start": "2024-11-01", "end": "2024-11-30" }
}
```

**Supported Filters:**
- `status` - Invoice status array
- `dateRange` - Invoice date range
- `dueDateRange` - Due date range
- `amountRange` - Amount min/max
- `customerName` - Customer filter
- `searchQuery` - Text search
- `sortBy` - date, amount, dueDate, customer
- `sortOrder` - asc, desc

**Query Examples:**
| Query | Parsed Result |
|-------|---------------|
| "overdue invoices" | `{ status: ["overdue"] }` |
| "paid last month" | `{ status: ["paid"], dateRange: {...} }` |
| "invoices over $5000" | `{ amountRange: { min: 5000 } }` |
| "due this week" | `{ dueDateRange: {...} }` |

### Customer Filter

**Request:**
```json
{
  "query": "tech companies in California",
  "availableIndustries": ["Technology", "Healthcare", "Finance"]
}
```

**Response:**
```json
{
  "industry": ["Technology"],
  "country": "USA",
  "city": "California"
}
```

**Supported Filters:**
- `type` - Customer type array
- `industry` - Industry array
- `country` - Country name
- `city` - City name
- `hasRecentActivity` - Activity filter
- `createdDateRange` - Creation date range
- `revenueRange` - Revenue min/max
- `sortBy` - name, revenue, createdAt, lastActivity

**Query Examples:**
| Query | Parsed Result |
|-------|---------------|
| "active enterprise customers" | `{ type: ["customer"], hasRecentActivity: true, revenueRange: { min: 50000 } }` |
| "new leads from last month" | `{ type: ["lead"], createdDateRange: {...} }` |
| "churned healthcare companies" | `{ type: ["churned"], industry: ["Healthcare"] }` |

### Product Filter

**Request:**
```json
{
  "query": "premium software subscriptions in stock",
  "availableCategories": ["Software", "Hardware", "Services"]
}
```

**Response:**
```json
{
  "category": ["Software"],
  "priceRange": { "min": 500 },
  "isRecurring": true,
  "inStock": true
}
```

**Supported Filters:**
- `status` - Product status array
- `category` - Category array
- `priceRange` - Price min/max
- `inStock` - Stock availability
- `isRecurring` - Subscription filter
- `hasTax` - Taxable filter
- `sortBy` - name, price, createdAt, popularity

---

## Frontend Hooks

### useAIFilter Hooks

Basic filter parsing hooks.

```typescript
import {
  useInvoiceAIFilter,
  useCustomerAIFilter,
  useProductAIFilter,
  useVaultAIFilter
} from "@/hooks/use-ai-filter";

// Invoice filter
const { parseQuery, result, isLoading, error, clear } = useInvoiceAIFilter();

// Parse a query
const filters = await parseQuery("unpaid invoices over $1000");
// filters = { status: ["sent", "overdue"], amountRange: { min: 1000 } }

// Customer filter with industries
const customerFilter = useCustomerAIFilter();
await customerFilter.parseQuery("tech companies", ["Technology", "Healthcare"]);

// Product filter with categories
const productFilter = useProductAIFilter();
await productFilter.parseQuery("cheap software", ["Software", "Hardware"]);
```

### useAISearch Hooks

Higher-level hooks with debouncing and auto-parsing.

```typescript
import {
  useInvoiceAISearch,
  useCustomerAISearch,
  useProductAISearch,
  useVaultAISearch
} from "@/hooks/use-ai-search";

function InvoiceSearch() {
  const {
    query,           // Current query string
    setQuery,        // Update query
    filters,         // Parsed filter result
    filterDescription, // Human-readable description
    isLoading,       // Parsing in progress
    isParsing,       // Debounce pending
    error,           // Error message
    clear,           // Reset everything
    applyFilter      // Add manual filter
  } = useInvoiceAISearch(500); // 500ms debounce

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search invoices..."
      />

      {isParsing && <span>Thinking...</span>}

      {filterDescription && (
        <div className="text-sm text-muted">
          Filters: {filterDescription}
        </div>
      )}

      {/* Use filters to fetch data */}
      <InvoiceList filters={filters} />
    </div>
  );
}
```

### Helper Functions

```typescript
import {
  filterResultToSearchParams,
  describeFilter
} from "@/hooks/use-ai-filter";

// Convert filter to URL params
const params = filterResultToSearchParams(filters);
// URLSearchParams { status: "sent,overdue", amountRange.min: "1000" }

// Get human-readable description
const description = describeFilter(filters, "invoices");
// "Status: sent, overdue | Min amount: $1000"
```

---

## Visualizations

### SalesFunnel

Displays sales pipeline as a funnel chart.

```typescript
import { SalesFunnel, DEFAULT_FUNNEL_STAGES } from "@/components/analytics";

// With custom data
<SalesFunnel
  data={[
    { name: "Lead", count: 100, value: 500000 },
    { name: "Qualified", count: 60, value: 350000 },
    { name: "Proposal", count: 35, value: 200000 },
    { name: "Negotiation", count: 20, value: 150000 },
    { name: "Won", count: 12, value: 100000 },
  ]}
  title="Sales Pipeline"
  description="Q4 2024 deals"
  showValue={true}
  showConversion={true}
  height={300}
/>

// With preset data
<SalesFunnel data={DEFAULT_FUNNEL_STAGES} />
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `FunnelStage[]` | required | Stage data |
| `title` | `string` | "Sales Funnel" | Card title |
| `description` | `string` | - | Card description |
| `showValue` | `boolean` | true | Show monetary values |
| `showConversion` | `boolean` | true | Show conversion rates |
| `height` | `number` | 300 | Chart height |

### CustomerMetrics

Displays customer analytics with pie chart and growth trends.

```typescript
import {
  CustomerMetrics,
  SAMPLE_CUSTOMER_TYPES,
  SAMPLE_GROWTH_DATA
} from "@/components/analytics";

<CustomerMetrics
  typeData={[
    { name: "Customer", count: 450 },
    { name: "Prospect", count: 180 },
    { name: "Lead", count: 320 },
    { name: "Partner", count: 45 },
    { name: "Churned", count: 85 },
  ]}
  growthData={[
    { period: "Jan", customers: 850, newCustomers: 45, churned: 12 },
    { period: "Feb", customers: 890, newCustomers: 52, churned: 8 },
    { period: "Mar", customers: 940, newCustomers: 60, churned: 10 },
    // ...
  ]}
  metrics={[
    { label: "Total Customers", value: "1,080", change: 12 },
    { label: "New This Month", value: "72", change: 8 },
    { label: "Churned", value: "12", change: -5 },
    { label: "Avg. Revenue", value: "$2.5K", change: 15 },
  ]}
  title="Customer Analytics"
/>
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `typeData` | `CustomerTypeData[]` | Customer distribution |
| `growthData` | `CustomerGrowthData[]` | Growth over time |
| `metrics` | `CustomerMetric[]` | KPI cards |
| `title` | `string` | Card title |
| `description` | `string` | Card description |

---

## Document Processing

### Document Loader

Extract text from various document formats.

```typescript
import { loadDocument, isFileTypeSupported } from "@crm/documents";

// Check if format is supported
if (isFileTypeSupported("application/pdf")) {
  // Load and extract text
  const result = await loadDocument({
    content: fileBlob,
    metadata: {
      mimetype: "application/pdf",
      filename: "invoice.pdf"
    }
  });

  console.log(result.text);      // Extracted text
  console.log(result.pageCount); // Number of pages (PDF only)
}
```

**Supported Formats:**
| Format | MIME Type | OCR Support |
|--------|-----------|-------------|
| PDF | application/pdf | Yes (Mistral) |
| Word | application/vnd.openxmlformats-officedocument.wordprocessingml.document | - |
| Excel | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | - |
| PowerPoint | application/vnd.openxmlformats-officedocument.presentationml.presentation | - |
| CSV | text/csv | - |
| Text | text/plain | - |
| Markdown | text/markdown | - |
| RTF | application/rtf | - |
| OpenDocument | application/vnd.oasis.opendocument.* | - |

### Document Classifier

Classify documents using AI.

```typescript
import { documentClassifier } from "@crm/documents";

// Classify text document
const result = await documentClassifier.classify(documentText);
// { type: "invoice", confidence: 0.95, language: "en" }

// Classify image
const imageResult = await documentClassifier.classifyImage({
  content: base64ImageData
});
```

**Document Types:** `invoice`, `receipt`, `contract`, `other`

### Invoice Processor

Extract structured data from invoices.

```typescript
import { invoiceProcessor } from "@crm/documents";

const invoice = await invoiceProcessor.processDocument({
  documentUrl: "https://example.com/invoice.pdf",
  companyName: "My Company" // Optional, improves extraction
});

// Result:
{
  type: "invoice",
  invoiceNumber: "INV-2024-001",
  invoiceDate: "2024-12-01",
  dueDate: "2024-12-31",
  vendorName: "Supplier Inc",
  customerName: "Customer Corp",
  totalAmount: 1500.00,
  currency: "EUR",
  lineItems: [
    { description: "Service", quantity: 1, unitPrice: 1500, total: 1500 }
  ]
}
```

### Category Embeddings

Semantic category matching using embeddings.

```typescript
import { categoryEmbeddings, findBestCategory } from "@crm/categories";

// Find best matching category for text
const match = await findBestCategory("software development services");
// { category: { id: "services", name: "Services" }, similarity: 0.92 }

// Find top 3 categories
const topCategories = await findTopCategories("cloud hosting", 3);
```

---

## Configuration

### Environment Variables

```env
# OpenAI (required for chat)
OPENAI_API_KEY=sk-...

# Mistral (required for document processing)
MISTRAL_API_KEY=...

# Google (required for embeddings)
GOOGLE_GENERATIVE_AI_API_KEY=...

# Feature flags
AI_ENABLED=true
AI_CHAT_ENABLED=true
AI_DOCUMENT_PROCESSING_ENABLED=true
AI_EMBEDDINGS_ENABLED=true

# Model configuration
AI_DEFAULT_MODEL=gpt-4o-mini
AI_CHAT_MODEL=gpt-4o-mini

# Rate limiting
AI_RATE_LIMIT_PER_USER=60
AI_RATE_LIMIT_WINDOW=60
```

---

## Examples

### Complete Invoice Search Component

```typescript
"use client";

import { useState } from "react";
import { useInvoiceAISearch } from "@/hooks/use-ai-search";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, X } from "lucide-react";

export function InvoiceSearchBar() {
  const {
    query,
    setQuery,
    filters,
    filterDescription,
    isLoading,
    clear,
  } = useInvoiceAISearch();

  return (
    <div className="space-y-2">
      <div className="relative">
        <Sparkles className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search invoices... try 'unpaid invoices over $1000'"
          className="pl-10 pr-10"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />
        )}
        {query && !isLoading && (
          <button
            onClick={clear}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {filterDescription && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">AI understood:</span>
          <Badge variant="secondary">{filterDescription}</Badge>
        </div>
      )}
    </div>
  );
}
```

### Dashboard with Analytics

```typescript
"use client";

import { SalesFunnel, CustomerMetrics } from "@/components/analytics";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";

export function AnalyticsDashboard() {
  const { data: pipelineData } = useApi(() => api.sales.getPipeline());
  const { data: customerData } = useApi(() => api.customers.getMetrics());

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <SalesFunnel
        data={pipelineData?.stages || []}
        title="Sales Pipeline"
        description="Current quarter"
      />

      <CustomerMetrics
        typeData={customerData?.byType || []}
        growthData={customerData?.growth || []}
        title="Customer Overview"
      />
    </div>
  );
}
```

### Chat with AI Assistant

```typescript
"use client";

import { useChat } from "@ai-sdk/react";

export function AIChat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/v1/chat",
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === "user" ? "text-right" : "text-left"}
          >
            <div className={`inline-block p-3 rounded-lg ${
              message.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            }`}>
              {message.content}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask about invoices, customers, sales..."
          className="w-full p-2 border rounded"
          disabled={isLoading}
        />
      </form>
    </div>
  );
}
```

---

## Troubleshooting

### Common Issues

**1. AI features not working**
- Check `OPENAI_API_KEY` is set
- Verify `AI_ENABLED=true`
- Check API rate limits

**2. Document processing fails**
- Verify `MISTRAL_API_KEY` is set
- Check file format is supported
- Ensure file size is under limit

**3. Embeddings not working**
- Set `GOOGLE_GENERATIVE_AI_API_KEY`
- Enable `AI_EMBEDDINGS_ENABLED=true`

**4. Chat history lost**
- Check Redis connection
- Verify `REDIS_URL` is correct
- History expires after 7 days

---

## API Reference

### Chat API

```
POST /api/v1/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "Show me overdue invoices",
  "chatId": "optional-uuid",
  "timezone": "Europe/Zagreb"
}

Response: Server-sent events (streaming)
```

### Filter APIs

```
POST /api/ai/filters/invoices
POST /api/ai/filters/customers
POST /api/ai/filters/products
POST /api/ai/filters/vault

Content-Type: application/json

{
  "query": "natural language query",
  "availableTags": ["optional", "context"]
}
```

---

*Last updated: December 2024*
