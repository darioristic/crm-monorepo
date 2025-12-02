# 🤖 AI System - Kompletna Dokumentacija

Dobrodošli u dokumentaciju AI sistema za CRM aplikaciju!

## 📚 Dokumentacija

### Osnovni Vodiči

1. **[AI Implementation Overview](../AI_IMPLEMENTATION.md)** - Brzi pregled implementacije
2. **[Agents Guide](./AI_AGENTS_GUIDE.md)** - Kako kreirati i koristiti AI agente
3. **[Tools Guide](./AI_TOOLS_GUIDE.md)** - Razvoj AI tools za pristup podacima
4. **[API Reference](./AI_API_REFERENCE.md)** - Kompletna API dokumentacija

### Advanced Vodiči

5. **[Document Processing](./AI_DOCUMENT_PROCESSING.md)** - PDF i image processing
6. **[Embeddings Guide](./AI_EMBEDDINGS_GUIDE.md)** - Semantic category matching
7. **[Deployment Guide](./AI_DEPLOYMENT.md)** - Production deployment
8. **[Troubleshooting](./AI_TROUBLESHOOTING.md)** - Rešavanje problema

---

## 🚀 Quick Start

### 1. Setup

```bash
# Install dependencies
cd crm-monorepo
bun install

# Configure API keys
cd apps/api-server
cp .env.example .env
# Edit .env and add your API keys
```

### 2. Environment Variables

```env
# Required
OPENAI_API_KEY=sk-proj-...
MISTRAL_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...

# Already configured
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://...
```

### 3. Start Development

```bash
# Terminal 1 - API Server
cd apps/api-server
bun run dev

# Terminal 2 - Web App
cd apps/web
bun run dev
```

### 4. Access Chat

```
http://localhost:3000/dashboard/chat
```

---

## 💡 Quick Examples

### Chat Examples

```javascript
// Show invoices
"Show me recent invoices";

// Overdue analysis
"Which invoices are overdue?";

// Customer search
"Find customers in IT industry";

// Sales analytics
"What's our quote conversion rate this month?";

// Product info
"Show product categories summary";
```

### API Usage

```typescript
// JavaScript/TypeScript
import { useChat } from "ai/react";

const { messages, input, handleSubmit } = useChat({
  api: "/api/v1/chat",
  body: { timezone: "Europe/Belgrade" },
});
```

```bash
# cURL
curl -X POST http://localhost:3001/api/v1/chat \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Show invoices"}' \
  --no-buffer
```

### Document Processing

```typescript
import { invoiceProcessor } from "@crm/documents";

const invoice = await invoiceProcessor.processDocument({
  documentUrl: "https://storage.com/invoice.pdf",
  companyName: "My Company",
});
```

### Category Embeddings

```typescript
import { findBestCategory } from "@crm/categories";

const match = await findBestCategory("Office chair purchase");
// Returns: { category: "Office Supplies", similarity: 0.89 }
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Input                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Main Triage Agent                         │
│                    (GPT-4o-mini)                            │
│                                                              │
│  "Show me invoices" → invoices                              │
│  "Find customers"   → customers                             │
│  "Sales report"     → sales                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Specialized Agent + Tools                      │
│                                                              │
│  Invoice Agent ──┬─→ getInvoices()                          │
│                  └─→ getOverdueInvoices()                   │
│                                                              │
│  Customer Agent ─┬─→ getCustomers()                         │
│                  ├─→ getCustomerById()                      │
│                  └─→ getIndustriesSummary()                 │
│                                                              │
│  Sales Agent ────┬─→ getQuotes()                            │
│                  └─→ getQuoteConversion()                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Formatted Response                        │
│                   (Markdown + Tables)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Features Overview

### AI Chat Assistant

| Feature             | Status | Description                                         |
| ------------------- | ------ | --------------------------------------------------- |
| Multi-agent routing | ✅     | Inteligentno rutiranje ka specijalizovanim agentima |
| Streaming responses | ✅     | Real-time progressive updates                       |
| Chat history        | ✅     | Redis-based sa 7-day TTL                            |
| Tool calling        | ✅     | 9 tools za pristup podacima                         |
| Memory management   | ✅     | User context i working memory                       |
| Suggested prompts   | ✅     | Quick actions u UI                                  |
| Error recovery      | ✅     | Retry logic sa exponential backoff                  |
| Multi-language      | ✅     | Srpski i engleski                                   |

### Document Processing

| Feature            | Status | Description                        |
| ------------------ | ------ | ---------------------------------- |
| PDF classification | ✅     | Automatsko prepoznavanje tipa      |
| Invoice extraction | ✅     | Strukturirana ekstrakcija podataka |
| Receipt extraction | ✅     | Fiskalni računi                    |
| OCR fallback       | ✅     | Za loše skenove                    |
| Multi-language     | ✅     | Detektovanje jezika                |
| Validation         | ✅     | Zod schema validation              |
| Retry logic        | ✅     | 3 attempts sa backoff              |

### Category Embeddings

| Feature           | Status | Description             |
| ----------------- | ------ | ----------------------- |
| Semantic matching | ✅     | Razume značenje teksta  |
| 20 categories     | ✅     | Expense + Income        |
| Batch processing  | ✅     | Multiple texts odjednom |
| Caching           | ✅     | In-memory cache         |
| Multi-language    | ✅     | Radi na svim jezicima   |
| Top-N matching    | ✅     | Multiple suggestions    |

---

## 📊 Tech Stack

| Component           | Technology         | Version            |
| ------------------- | ------------------ | ------------------ |
| AI Framework        | Vercel AI SDK      | 5.0.87             |
| Chat Models         | OpenAI GPT-4o-mini | Latest             |
| Document Processing | Mistral AI         | mistral-small      |
| Embeddings          | Google Gemini      | text-embedding-004 |
| PDF Processing      | unpdf              | 0.12.0             |
| State Management    | Zustand            | 5.0.9              |
| Memory Store        | Redis              | via ioredis        |
| Type Safety         | Zod                | 3.23.8             |

---

## 📈 Performance

### Benchmarks (Development)

| Operation               | Avg Time | Notes                 |
| ----------------------- | -------- | --------------------- |
| Chat routing            | ~200ms   | Triage agent decision |
| Simple query            | ~800ms   | One tool call         |
| Complex query           | ~2-3s    | Multiple tools        |
| Document classification | ~1-2s    | PDF analysis          |
| Invoice extraction      | ~3-5s    | Full extraction       |
| Embedding generation    | ~300ms   | Single text           |
| Batch embeddings (10)   | ~800ms   | Parallel processing   |

### Cost Estimates (Monthly)

**Typical Usage** (100 users, moderate activity):

| Service            | Usage            | Cost          |
| ------------------ | ---------------- | ------------- |
| OpenAI Chat        | ~500K tokens/day | ~$2.25/month  |
| Mistral Processing | ~50 docs/day     | ~$1.50/month  |
| Google Embeddings  | ~1K queries/day  | Free tier     |
| **Total**          |                  | **~$4/month** |

---

## 🛡️ Security

- ✅ JWT Authentication na svim endpoints
- ✅ Rate limiting (Redis-based)
- ✅ Input validation (Zod schemas)
- ✅ API key rotation support
- ✅ Audit logging
- ✅ CORS protection
- ✅ SQL injection prevention

---

## 🧪 Testing

```bash
# Run all tests
cd apps/api-server
bun test

# Test specific component
bun test src/ai/agents/

# Type checking
bun run typecheck

# Lint
bun run lint
```

---

## 📞 Support

### Documentation Index

- Basic concepts → [Agents Guide](./AI_AGENTS_GUIDE.md)
- Creating tools → [Tools Guide](./AI_TOOLS_GUIDE.md)
- API integration → [API Reference](./AI_API_REFERENCE.md)
- Document AI → [Document Processing](./AI_DOCUMENT_PROCESSING.md)
- Embeddings → [Embeddings Guide](./AI_EMBEDDINGS_GUIDE.md)
- Going to production → [Deployment Guide](./AI_DEPLOYMENT.md)
- Problems? → [Troubleshooting](./AI_TROUBLESHOOTING.md)

### Community

- GitHub Issues: Report bugs
- Discussions: Ask questions
- Slack: #dev-ai channel

---

## 🎓 Learning Path

### Beginner

1. Read [AI Implementation Overview](../AI_IMPLEMENTATION.md)
2. Run Quick Start (see above)
3. Try example prompts
4. Explore [API Reference](./AI_API_REFERENCE.md)

### Intermediate

1. Read [Agents Guide](./AI_AGENTS_GUIDE.md)
2. Read [Tools Guide](./AI_TOOLS_GUIDE.md)
3. Create your first tool
4. Add tool to existing agent

### Advanced

1. Create custom agent
2. Implement document processing workflow
3. Set up category auto-categorization
4. Deploy to production with [Deployment Guide](./AI_DEPLOYMENT.md)

---

## 🗺️ Roadmap

### Implemented ✅

- [x] Multi-agent chat system
- [x] 9 AI tools for data access
- [x] Document classification
- [x] Invoice/receipt extraction
- [x] Category embeddings
- [x] Streaming responses
- [x] Chat history
- [x] Frontend UI

### Planned 🚧

- [ ] Voice input (speech-to-text)
- [ ] Multi-language UI
- [ ] Analytics dashboard
- [ ] Custom user agents
- [ ] Document upload in chat
- [ ] Export conversations
- [ ] AI-powered search
- [ ] Predictive analytics

---

## 📝 Changelog

### v1.0.0 (2024-12-02)

**Added:**

- Initial AI system implementation
- Multi-agent architecture
- 9 AI tools
- Document processing
- Category embeddings
- Streaming chat interface
- Complete documentation

---

## 📄 License

This AI implementation follows the main project license.

---

## 🙏 Acknowledgments

Based on [Midday](https://github.com/midday-ai/midday) architecture.

Built with:

- [Vercel AI SDK](https://sdk.vercel.ai/)
- [OpenAI](https://openai.com/)
- [Mistral AI](https://mistral.ai/)
- [Google Generative AI](https://ai.google.dev/)

---

**Last Updated**: 2024-12-02  
**Author**: Dario Ristić  
**Version**: 1.0.0
