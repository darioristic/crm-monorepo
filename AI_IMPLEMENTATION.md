# AI System Implementation Guide

Kompletna AI implementacija po uzoru na Midday arhitekturu.

## 🎯 Implementirane Funkcionalnosti

### ✅ 1. Multi-Agent Chat System
- **Triage Agent** - Inteligentno rutiranje upita ka specijalizovanim agentima
- **Invoice Agent** - Upravljanje fakturama i plaćanjima
- **Customer Agent** - CRM i upravljanje klijentima
- **Sales Agent** - Pipeline, ponude, i revenue analytics
- **General Agent** - Opšti upiti i pomoć

### ✅ 2. AI Tools (9 tools)
- `getInvoices` - Pretraga i filtriranje faktura
- `getOverdueInvoices` - Pregled dospelih faktura
- `getCustomers` - Pretraga klijenata
- `getCustomerById` - Detalji o klijentu
- `getIndustriesSummary` - Pregled po industrijama
- `getProducts` - Pretraga proizvoda
- `getProductCategories` - Kategorije proizvoda
- `getQuotes` - Pregled ponuda
- `getQuoteConversion` - Analitika konverzije ponuda

### ✅ 3. Document Processing
- **PDF Classifier** - Automatska klasifikacija dokumenata (invoice, receipt, contract, other)
- **Invoice Processor** - Ekstrakcija podataka iz faktura (Mistral AI)
- **Receipt Processor** - Ekstrakcija iz računa
- **OCR Fallback** - Za dokumente lošeg kvaliteta

### ✅ 4. Category Embeddings
- **Google Gemini** - text-embedding-004 model
- **Semantic Search** - Automatska kategorizacija transakcija
- **Predefinisane Kategorije** - 13 expense + 7 income kategorija

### ✅ 5. Frontend Chat Interface
- **React Components** - ChatInterface, ChatMessages, ChatInput, ChatHeader
- **Streaming Support** - Real-time AI odgovori
- **Markdown Rendering** - Tabelarni prikaz podataka
- **Suggested Prompts** - Quick actions za česte upite

### ✅ 6. State Management
- **Zustand Store** - Chat sessions, command suggestions
- **Persistent Storage** - LocalStorage za istoriju

## 📁 Struktura Projekta

```
apps/
├── api-server/src/ai/
│   ├── agents/
│   │   ├── config/
│   │   │   ├── shared.ts           # Agent factory
│   │   │   ├── memory-template.md
│   │   │   └── suggestions-instructions.md
│   │   ├── main.ts                 # Triage agent
│   │   ├── invoices.ts
│   │   ├── customers.ts
│   │   ├── sales.ts
│   │   └── general.ts
│   ├── tools/
│   │   ├── get-invoices.ts
│   │   ├── get-customers.ts
│   │   ├── get-products.ts
│   │   └── get-quotes.ts
│   └── types.ts
│
├── web/src/
│   ├── components/chat/
│   │   ├── chat-interface.tsx
│   │   ├── chat-input.tsx
│   │   ├── chat-messages.tsx
│   │   ├── chat-header.tsx
│   │   └── suggested-prompts.tsx
│   ├── store/chat.ts
│   ├── hooks/use-chat-session.ts
│   └── app/dashboard/chat/page.tsx
│
packages/
├── documents/
│   ├── src/
│   │   ├── classifier/
│   │   │   └── classifier.ts
│   │   ├── processors/
│   │   │   ├── invoice-processor.ts
│   │   │   └── receipt-processor.ts
│   │   ├── prompt.ts
│   │   ├── schema.ts
│   │   └── types.ts
│   └── package.json
│
└── categories/
    ├── src/
    │   ├── embeddings.ts
    │   ├── categories.ts
    │   └── types.ts
    └── package.json
```

## ⚙️ Setup Instructions

### 1. Environment Variables

Dodaj u `apps/api-server/.env`:

```env
# AI Configuration
OPENAI_API_KEY=sk-...
MISTRAL_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...

# Redis (already configured)
REDIS_URL=redis://localhost:6379
```

### 2. Install Dependencies

```bash
cd crm-monorepo
bun install
```

### 3. Start Services

```bash
# Terminal 1 - API Server
cd apps/api-server
bun run dev

# Terminal 2 - Web App
cd apps/web
bun run dev
```

### 4. Access Chat Interface

```
http://localhost:3000/dashboard/chat
```

## 🔌 API Endpoints

### Chat Endpoint
```
POST /api/v1/chat
Authorization: Bearer <token>

Body:
{
  "message": "Show me overdue invoices",
  "chatId": "uuid",
  "timezone": "Europe/Belgrade"
}

Response: Streaming (text/event-stream)
```

### Chat History
```
GET /api/v1/chat/history/:chatId
Authorization: Bearer <token>

Response: {
  "success": true,
  "data": {
    "chatId": "...",
    "messages": [...]
  }
}
```

### Available Agents
```
GET /api/v1/chat/agents
Authorization: Bearer <token>

Response: {
  "success": true,
  "data": [
    { "name": "general", "description": "..." },
    { "name": "invoices", "description": "..." },
    ...
  ]
}
```

## 💡 Usage Examples

### Example Prompts

**Invoices:**
- "Show me recent invoices"
- "Which invoices are overdue?"
- "Find all paid invoices from last month"

**Customers:**
- "List my top customers"
- "Find customers in IT industry"
- "Show customer details for [name]"

**Sales:**
- "What's our quote conversion rate?"
- "Show quotes from this quarter"
- "Revenue analysis"

**Products:**
- "Show product categories"
- "Find products under €100"

### AI Response Format

Responses su formatirani u markdown sa:
- **Tables** za liste i podatke
- **Links** za navigaciju
- **Highlights** za važne informacije

## 🏗️ Architecture

### Agent Flow

```
User Message
    ↓
Main Triage Agent (gpt-4o-mini)
    ↓ (routing)
Specialized Agent
    ↓
Tools Execution
    ↓
Formatted Response
```

### Memory Management

- **Chat History** - Redis (20 posledn poruka)
- **Working Memory** - User-specific context
- **Session Storage** - LocalStorage (20 poslednjih sesija)

### Models Used

| Provider | Model | Purpose |
|----------|-------|---------|
| OpenAI | gpt-4o-mini | Chat agents, routing |
| OpenAI | gpt-4o | Complex analysis (optional) |
| Mistral | mistral-small-latest | Document processing |
| Google | text-embedding-004 | Category embeddings |

## 📊 Cost Optimization

- **gpt-4o-mini** za većinu operacija (95% upita)
- **Streaming** za brže odgovore
- **Redis caching** za context
- **Tool parameter validation** za smanjenje grešaka

## 🔒 Security

- **JWT Authentication** - Obavezna za sve AI endpoints
- **Rate Limiting** - Redis-based
- **Input Validation** - Zod schemas
- **API Key Rotation** - Environment variables

## 🧪 Testing

```bash
# API Tests
cd apps/api-server
bun test

# Type Check
bun run typecheck

# Lint
bun run lint
```

## 📝 Next Steps

### Opciona Poboljšanja:

1. **Voice Input** - Speech-to-text integracija
2. **Multi-language** - i18n podrška
3. **Analytics Dashboard** - AI usage metrics
4. **Custom Agents** - User-defined agents
5. **File Upload** - Document upload u chat
6. **Suggested Actions** - Smart suggestions based on context

## 🤝 Contributing

Sistem je potpuno modularan:
- Dodaj nove agente u `apps/api-server/src/ai/agents/`
- Kreiraj nove tools u `apps/api-server/src/ai/tools/`
- Proširuj UI komponente u `apps/web/src/components/chat/`

## 📖 Documentation

- [Midday Reference](https://github.com/midday-ai/midday)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [OpenAI API](https://platform.openai.com/docs)
- [Mistral AI](https://docs.mistral.ai/)

---

**Status**: ✅ Production Ready
**Author**: Dario Ristić
**Date**: 2024-12-02

