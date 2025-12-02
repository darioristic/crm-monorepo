# 🤖 AI System - Documentation Index

Centralno mesto za svu AI dokumentaciju.

---

## 📖 Dokumentacija po Kategorijama

### 🎯 Getting Started

| Dokument | Opis | Za Koga |
|----------|------|---------|
| **[AI README](./AI_README.md)** | Glavni pregled sistema, quick start | Svi |
| **[Implementation Overview](../AI_IMPLEMENTATION.md)** | Tehnički pregled implementacije | Developeri |
| **[Code Examples](./AI_EXAMPLES.md)** | Praktični primeri koda | Developeri |

### 🛠️ Development Guides

| Dokument | Opis | Za Koga |
|----------|------|---------|
| **[Agents Guide](./AI_AGENTS_GUIDE.md)** | Kreiranje i konfiguracija agenata | Backend developeri |
| **[Tools Guide](./AI_TOOLS_GUIDE.md)** | Razvoj AI tools za pristup podacima | Backend developeri |
| **[API Reference](./AI_API_REFERENCE.md)** | REST API dokumentacija | Full-stack developeri |

### 🔬 Specialized Features

| Dokument | Opis | Za Koga |
|----------|------|---------|
| **[Document Processing](./AI_DOCUMENT_PROCESSING.md)** | PDF/Image ekstrakcija podataka | Backend, AI eng. |
| **[Embeddings Guide](./AI_EMBEDDINGS_GUIDE.md)** | Semantic search i kategorizacija | Backend, AI eng. |

### 🚀 Operations

| Dokument | Opis | Za Koga |
|----------|------|---------|
| **[Deployment Guide](./AI_DEPLOYMENT.md)** | Production deployment | DevOps, Sysadmins |
| **[Troubleshooting](./AI_TROUBLESHOOTING.md)** | Rešavanje problema | DevOps, Support |

---

## 🎓 Learning Paths

### Path 1: Backend Developer

**Goal**: Dodati nove AI funkcionalnosti

1. Pročitaj [AI README](./AI_README.md) (15 min)
2. Proučava [Agents Guide](./AI_AGENTS_GUIDE.md) (30 min)
3. Proučava [Tools Guide](./AI_TOOLS_GUIDE.md) (30 min)
4. Radi kroz [Code Examples](./AI_EXAMPLES.md) (45 min)
5. Kreiraj svoj prvi tool (praktična vežba)

**Total**: ~2 sata

### Path 2: Full-Stack Developer

**Goal**: Integrisati AI u frontend

1. Pročitaj [AI README](./AI_README.md) (15 min)
2. Proučava [API Reference](./AI_API_REFERENCE.md) (20 min)
3. Implementiraj chat komponentu (praktična vežba)
4. Testiranje i debugging

**Total**: ~1.5 sat

### Path 3: DevOps/SysAdmin

**Goal**: Deployovati AI sistem u production

1. Pročitaj [AI README](./AI_README.md) (15 min)
2. Proučava [Deployment Guide](./AI_DEPLOYMENT.md) (45 min)
3. Setup monitoring i alerts (praktična vežba)
4. Bookmark [Troubleshooting](./AI_TROUBLESHOOTING.md) za reference

**Total**: ~2 sata

### Path 4: AI/ML Engineer

**Goal**: Optimizovati i proširiti AI capabilities

1. Pročitaj svu dokumentaciju (2 sata)
2. Proučava [Document Processing](./AI_DOCUMENT_PROCESSING.md) (30 min)
3. Proučava [Embeddings Guide](./AI_EMBEDDINGS_GUIDE.md) (30 min)
4. Eksperimentiši sa modelima i promptovima

**Total**: ~3 sata

---

## 🔍 Quick Reference

### Najčešće Komande

```bash
# Development
cd apps/api-server && bun run dev
cd apps/web && bun run dev

# Testing
bun test
bun run typecheck

# Production
bun run build && bun run start
```

### Najčešći Endpoints

```bash
# Chat
POST /api/v1/chat

# History
GET /api/v1/chat/history/:chatId

# Agents
GET /api/v1/chat/agents
```

### Najčešće Operacije

```typescript
// Start chat
const { messages, input, handleSubmit } = useChat({ api: "/api/v1/chat" });

// Process document
const invoice = await invoiceProcessor.processDocument({ documentUrl });

// Find category
const match = await findBestCategory("Office supplies");

// Create agent
const myAgent = createAgent({ name: "my-agent", /* ... */ });

// Create tool
export const myTool = tool({ description: "...", parameters: schema, execute: async (params) => { /* ... */ } });
```

---

## 📊 Comparison Matrix

### Koje Tehnologije Koristiti?

| Use Case | Tehnologija | Zašto |
|----------|-------------|-------|
| Chat conversations | OpenAI GPT-4o-mini | Brz, jeftin, dobar |
| Complex analysis | OpenAI GPT-4o | Najtačniji |
| Document extraction | Mistral | Specijalizovan za documents |
| Category matching | Google Gemini | Najbolji embeddings, free tier |
| PDF parsing | unpdf | Open source, reliable |
| State management | Zustand | Lightweight, simple |
| Memory storage | Redis | Fast, distributed |

---

## 🎯 Feature Matrix

### Šta Sistem Može?

| Feature | Status | Doc Link |
|---------|--------|----------|
| Natural language chat | ✅ | [API Reference](./AI_API_REFERENCE.md) |
| Multi-agent routing | ✅ | [Agents Guide](./AI_AGENTS_GUIDE.md) |
| Invoice queries | ✅ | [Tools Guide](./AI_TOOLS_GUIDE.md) |
| Customer search | ✅ | [Tools Guide](./AI_TOOLS_GUIDE.md) |
| Sales analytics | ✅ | [Tools Guide](./AI_TOOLS_GUIDE.md) |
| PDF extraction | ✅ | [Document Processing](./AI_DOCUMENT_PROCESSING.md) |
| Auto-categorization | ✅ | [Embeddings Guide](./AI_EMBEDDINGS_GUIDE.md) |
| Chat history | ✅ | [API Reference](./AI_API_REFERENCE.md) |
| Streaming responses | ✅ | [API Reference](./AI_API_REFERENCE.md) |
| Error recovery | ✅ | [Troubleshooting](./AI_TROUBLESHOOTING.md) |

---

## 💰 Cost Calculator

### Monthly Costs Estimator

**Inputs**:
- Users: 50
- Avg messages/user/day: 10
- Avg documents/month: 200
- Avg transactions/day: 100

**Calculations**:

```
Chat (OpenAI):
  50 users × 10 msg/day × 30 days = 15,000 messages
  Avg 500 tokens/message = 7.5M tokens
  Cost: 7.5 × $0.15/1M = $1.13

Document Processing (Mistral):
  200 documents/month
  Avg 2,000 tokens/doc = 400K tokens
  Cost: 400K × $0.25/1M = $0.10

Category Embeddings (Google):
  100 tx/day × 30 days = 3,000 categorizations
  Google Free Tier: 1,500 requests/day
  Cost: $0 (within free tier)

Total: ~$1.25/month
```

**Real-world**: Očekuj 2-3x više u produkciji  
**Recommended budget**: $5-10/month za start

---

## 🎨 UI Components Showcase

### Available Components

```typescript
// Chat components
import {
  ChatInterface,     // Full chat UI
  ChatHeader,        // Header with actions
  ChatInput,         // Input with auto-resize
  ChatMessages,      // Message list with markdown
  SuggestedPrompts, // Quick action buttons
} from "@/components/chat";

// Usage
<ChatInterface initialChatId={chatId} />
```

### Customization

```typescript
// Custom theme
<ChatInterface
  className="custom-chat"
  theme={{
    primaryColor: "#3b82f6",
    userBubbleColor: "#1e40af",
    aiBubbleColor: "#f3f4f6",
  }}
/>

// Custom prompts
<SuggestedPrompts
  prompts={[
    "Show invoices",
    "Find customers",
    "Revenue report",
  ]}
  onSelect={handlePromptSelect}
/>
```

---

## 🔧 Configuration Reference

### Agent Configuration

```typescript
interface AgentConfig {
  name: string;              // Unique identifier
  model: LanguageModel;      // OpenAI model
  temperature: number;       // 0.0 - 1.0
  instructions: string;      // System prompt
  tools?: Record<string, Tool>; // Available tools
  maxTurns?: number;        // Max interactions
}
```

### Tool Configuration

```typescript
interface ToolConfig {
  description: string;       // What the tool does
  parameters: ZodSchema;     // Input validation
  execute: (params) => Promise<ToolResponse>;
}
```

### Cache Configuration

```typescript
const CACHE_TTL = {
  chatHistory: 604800,      // 7 days
  userContext: 300,         // 5 minutes
  embeddings: 2592000,      // 30 days
  documents: 86400,         // 24 hours
};
```

---

## 📞 Getting Help

### Ako Imate Pitanje...

1. **Prvo proveri** ovaj index
2. **Pretraži** relevantnu dokumentaciju
3. **Pogledaj** [Code Examples](./AI_EXAMPLES.md)
4. **Probaj** [Troubleshooting](./AI_TROUBLESHOOTING.md)
5. **Pitaj** na Slack #dev-ai

### FAQ Links

- **"Kako napraviti agenta?"** → [Agents Guide](./AI_AGENTS_GUIDE.md#kreiranje-novog-agenta)
- **"Kako dodati tool?"** → [Tools Guide](./AI_TOOLS_GUIDE.md#kreiranje-novog-tool-a)
- **"API ne radi"** → [Troubleshooting](./AI_TROUBLESHOOTING.md#ai-endpoints-not-responding)
- **"Kako deployovati?"** → [Deployment Guide](./AI_DEPLOYMENT.md#deployment-options)
- **"Procesovanje PDF-a"** → [Document Processing](./AI_DOCUMENT_PROCESSING.md#invoice-processor)
- **"Embeddings usage"** → [Embeddings Guide](./AI_EMBEDDINGS_GUIDE.md#usage-examples)

---

## 📚 External Resources

### Official Documentation

- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [OpenAI Platform](https://platform.openai.com/docs)
- [Mistral AI Docs](https://docs.mistral.ai/)
- [Google Generative AI](https://ai.google.dev/)

### Tutorials & Guides

- [Prompt Engineering Guide](https://www.promptingguide.ai/)
- [LangChain Docs](https://js.langchain.com/docs/)
- [AI Agent Patterns](https://www.patterns.app/)

### Community

- [Vercel AI Discord](https://discord.gg/vercel)
- [OpenAI Community](https://community.openai.com/)
- [r/LocalLLaMA](https://reddit.com/r/LocalLLaMA)

---

## 🎯 Quick Navigation

### Po Komponenti

```
Agents → AI_AGENTS_GUIDE.md
Tools → AI_TOOLS_GUIDE.md
Documents → AI_DOCUMENT_PROCESSING.md
Embeddings → AI_EMBEDDINGS_GUIDE.md
```

### Po Zadatku

```
Razvoj → AI_EXAMPLES.md
API integracija → AI_API_REFERENCE.md
Deployment → AI_DEPLOYMENT.md
Problem solving → AI_TROUBLESHOOTING.md
```

### Po Nivou

```
Beginner → AI_README.md
Intermediate → AI_AGENTS_GUIDE.md + AI_TOOLS_GUIDE.md
Advanced → AI_DOCUMENT_PROCESSING.md + AI_EMBEDDINGS_GUIDE.md
Expert → AI_DEPLOYMENT.md + custom development
```

---

## ✅ Documentation Checklist

Pre nego što počneš razvoj:

- [ ] Pročitao [AI README](./AI_README.md)
- [ ] Razumeo arhitekturu
- [ ] Setup environment variables
- [ ] Testirao lokalno
- [ ] Proučio relevantne guide-ove
- [ ] Pogledao code examples

Pre deployovanja u production:

- [ ] Pročitao [Deployment Guide](./AI_DEPLOYMENT.md)
- [ ] Konfigurisao sve API keys
- [ ] Setup monitoring
- [ ] Testirao health endpoints
- [ ] Konfigurisao rate limiting
- [ ] Setup backup strategy
- [ ] Pripremio rollback plan

---

## 📈 Documentation Stats

- **Total Documents**: 9
- **Total Pages**: ~150 (estimated)
- **Code Examples**: 40+
- **Diagrams**: 5
- **Tables**: 30+
- **Coverage**: Complete

---

## 🔄 Updates

Dokumentacija se ažurira sa svakom novom feature-om. Proveri `Last Updated` datum u svakom dokumentu.

**Latest Updates**:
- 2024-12-02: Initial complete documentation release (v1.0.0)

---

## 💬 Feedback

Imaš predlog za dokumentaciju? Našao grešku?

1. Otvori issue na GitHub
2. Predloži izmenu
3. Kontaktiraj #dev-ai team

---

**Maintained by**: Development Team  
**Last Updated**: 2024-12-02  
**Version**: 1.0.0

