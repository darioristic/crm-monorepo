# AI Agents - Developer Guide

Kompletni vodič za rad sa AI agentima u CRM sistemu.

## 📋 Sadržaj

1. [Uvod](#uvod)
2. [Agent Arhitektura](#agent-arhitektura)
3. [Kreiranje Novog Agenta](#kreiranje-novog-agenta)
4. [Agent Configuration](#agent-configuration)
5. [Memory Management](#memory-management)
6. [Best Practices](#best-practices)

---

## Uvod

AI agent sistem je baziran na **multi-agent arhitekturi** gde svaki agent ima specifičnu domenu odgovornosti. Glavni triage agent analizira korisnički upit i rutira ga ka odgovarajućem specijalizovanom agentu.

### Postojeći Agenti

| Agent | Domena | Model | Tools |
|-------|--------|-------|-------|
| `main` | Triage & Routing | gpt-4o-mini | - |
| `general` | General Q&A | gpt-4o-mini | All tools |
| `invoices` | Invoice Management | gpt-4o-mini | 2 tools |
| `customers` | CRM & Customers | gpt-4o-mini | 3 tools |
| `sales` | Sales Pipeline | gpt-4o-mini | 4 tools |

---

## Agent Arhitektura

### Agent Lifecycle

```
1. User Input
   ↓
2. Main Agent (Triage)
   ├─ Analyze intent
   ├─ Determine domain
   └─ Route to specialist
   ↓
3. Specialized Agent
   ├─ Load context
   ├─ Execute tools
   └─ Format response
   ↓
4. Stream Response
```

### Agent Components

Svaki agent se sastoji od:

```typescript
interface Agent {
  name: string;              // Jedinstveni identifikator
  model: LanguageModel;      // AI model (OpenAI)
  temperature: number;       // Kreativnost (0-1)
  instructions: string;      // System prompt
  tools?: Record<string, Tool>; // Dostupni alati
  maxTurns?: number;        // Max interakcija
}
```

---

## Kreiranje Novog Agenta

### Korak 1: Definisanje Agenta

Kreirajte novi fajl `apps/api-server/src/ai/agents/moj-agent.ts`:

```typescript
import { openai } from "@ai-sdk/openai";
import {
  COMMON_AGENT_RULES,
  createAgent,
  formatContextForLLM,
} from "./config/shared";

export const mojAgent = createAgent({
  name: "moj-agent",
  model: openai("gpt-4o-mini"),
  temperature: 0.3,
  
  instructions: (ctx) => `You are a specialized assistant for [DOMAIN].

<background-data>
${formatContextForLLM(ctx)}
</background-data>

${COMMON_AGENT_RULES}

<capabilities>
- List your agent's main capabilities
- What can it do?
- What data can it access?
</capabilities>

<response_guidelines>
- Be specific and actionable
- Use tables for structured data
- Include relevant metrics
- Provide links to relevant pages
</response_guidelines>`,

  tools: {
    // Dodaj relevantne tools
  },
  
  maxTurns: 5,
});
```

### Korak 2: Dodavanje u Registry

Ažuriraj `apps/api-server/src/ai/agents/main.ts`:

```typescript
import { mojAgent } from "./moj-agent";

export const AVAILABLE_AGENTS = {
  general: generalAgent,
  invoices: invoicesAgent,
  customers: customersAgent,
  sales: salesAgent,
  mojAgent: mojAgent,  // ← DODAJ
} as const;
```

### Korak 3: Dodavanje u Routing

Ažuriraj triage agent instructions u `main.ts`:

```typescript
instructions: (ctx) => `Route user requests to the appropriate specialist.

<agent-capabilities>
general: General questions, greetings, help
invoices: Invoice management, payments
customers: Customer relationships, CRM
sales: Sales pipeline, quotes, revenue
mojAgent: [OPIS DOMENE]  ← DODAJ
</agent-capabilities>`,
```

### Korak 4: Export

Dodaj u `apps/api-server/src/ai/agents/index.ts`:

```typescript
export { mojAgent } from "./moj-agent";
```

---

## Agent Configuration

### Temperature Settings

```typescript
{
  temperature: 0.1,  // Faktički, deterministički (routing, data queries)
  temperature: 0.3,  // Balansiran (general purpose)
  temperature: 0.7,  // Kreativan (content generation)
}
```

### Model Selection

```typescript
// Za većinu agenata
model: openai("gpt-4o-mini")

// Za kompleksne analize
model: openai("gpt-4o")

// Za embeddings
model: openai.embedding("text-embedding-3-small")
```

### Max Turns

```typescript
maxTurns: 1,  // Single-shot (triage)
maxTurns: 3,  // Simple tasks
maxTurns: 5,  // Complex workflows
maxTurns: 10, // Multi-step processes
```

---

## Memory Management

### Chat History

Chat istorija se čuva u Redis-u sa TTL od 7 dana:

```typescript
// Učitavanje istorije
const history = await getChatHistory(chatId, limit);

// Čuvanje poruke
await saveChatMessage(chatId, {
  role: "assistant",
  content: text,
});

// Brisanje istorije
await clearChatHistory(chatId);
```

### Working Memory

User-specific kontekst koji persista kroz više sesija:

```typescript
// Učitavanje radnog konteksta
const memory = await getWorkingMemory(userId);

// Čuvanje konteksta
await saveWorkingMemory(userId, memoryContent);
```

### Context Format

```typescript
export interface AppContext {
  userId: string;           // Scoped: "userId:teamId"
  fullName: string;         // User display name
  companyName: string;      // Team/company name
  baseCurrency: string;     // EUR, USD, RSD
  locale: string;           // sr-RS, en-US
  currentDateTime: string;  // ISO 8601
  timezone: string;         // Europe/Belgrade
  chatId: string;           // Current session
  teamId?: string;          // Team identifier
}
```

---

## Best Practices

### 1. Instructions Writing

**✅ GOOD:**
```typescript
instructions: (ctx) => `You are an invoice specialist for ${ctx.companyName}.

<capabilities>
- Search invoices by status, date, customer
- Analyze payment patterns
- Identify overdue accounts
</capabilities>

<response_format>
- Use tables for multiple invoices
- Include currency formatting
- Show total amounts
- Highlight overdue items in warnings
</response_format>`
```

**❌ BAD:**
```typescript
instructions: "You help with invoices and stuff."
```

### 2. Tool Selection

Dodajte samo relevantne tools za agenta:

```typescript
// ✅ GOOD - Samo relevantni tools
tools: {
  getInvoices: getInvoicesTool,
  getOverdueInvoices: getOverdueInvoicesTool,
}

// ❌ BAD - Svi tools
tools: allTools
```

### 3. Error Handling

```typescript
export const myAgent = createAgent({
  // ...config
  onError: (error) => {
    logger.error({ error, agent: "myAgent" }, "Agent error");
    return "I encountered an error. Please try again.";
  },
});
```

### 4. Response Formatting

Koristite markdown za strukturirane odgovore:

```typescript
const response = `## Invoice Summary

| Invoice # | Status | Amount | Due Date |
|-----------|--------|--------|----------|
| INV-001 | Paid | €1,000 | 2024-01-15 |
| INV-002 | Overdue | €2,500 | 2024-01-10 |

**Total Outstanding**: €2,500
⚠️ 1 invoice is overdue`;
```

### 5. Context Usage

Uvek koristite user context za personalizaciju:

```typescript
instructions: (ctx) => `
Current Date: ${ctx.currentDateTime}
Company: ${ctx.companyName}
Currency: ${ctx.baseCurrency}
Timezone: ${ctx.timezone}

Use this information for:
- Date calculations (overdue, upcoming)
- Currency formatting
- Time-sensitive queries
`
```

---

## Advanced Patterns

### Multi-Step Workflows

```typescript
export const workflowAgent = createAgent({
  name: "workflow",
  model: openai("gpt-4o-mini"),
  temperature: 0.3,
  maxTurns: 10,  // ← Allow multiple turns
  
  instructions: (ctx) => `Execute multi-step workflows:
  
1. Analyze request
2. Break into steps
3. Execute each step
4. Validate results
5. Provide summary`,

  tools: {
    // All necessary tools
  },
});
```

### Conditional Logic

```typescript
instructions: (ctx) => `
<conditional_rules>
IF user asks about overdue invoices:
  - Use getOverdueInvoices tool
  - Highlight in red/warning format
  - Suggest follow-up actions

IF user asks about top customers:
  - Use getCustomers tool
  - Sort by total revenue
  - Include contact information
</conditional_rules>
`
```

### Tool Chaining

```typescript
// Agent može automatski lanati tools
export const analyticsAgent = createAgent({
  // ...
  instructions: `
When analyzing customer value:
1. First call getCustomers to get list
2. Then call getInvoices for each customer
3. Calculate lifetime value
4. Present ranked table
`,
});
```

---

## Testing Agents

### Unit Testing

```typescript
import { describe, it, expect } from "vitest";
import { mojAgent } from "./moj-agent";

describe("Moj Agent", () => {
  it("should have correct configuration", () => {
    expect(mojAgent.name).toBe("moj-agent");
    expect(mojAgent.config.maxTurns).toBe(5);
  });

  it("should generate system prompt with context", () => {
    const ctx = {
      userId: "user-123",
      companyName: "Test Corp",
      // ... other context
    };
    
    const prompt = mojAgent.getSystemPrompt(ctx);
    expect(prompt).toContain("Test Corp");
  });
});
```

### Integration Testing

```typescript
it("should route to correct agent", async () => {
  const message = "Show me overdue invoices";
  const agentName = await routeMessage(message, context);
  
  expect(agentName).toBe("invoices");
});
```

---

## Performance Optimization

### 1. Caching

```typescript
// Cache expensive operations
const cachedContext = await cache.get(`user:${userId}:context`);
if (!cachedContext) {
  const context = await buildUserContext(userId);
  await cache.set(`user:${userId}:context`, context, 300); // 5 min
}
```

### 2. Streaming

Uvek koristite streaming za brže odgovore:

```typescript
return streamText({
  model: openai("gpt-4o-mini"),
  // ... config
});
```

### 3. Parallel Tool Calls

```typescript
instructions: `
Use parallel tool calls when possible:
- Call getInvoices AND getCustomers simultaneously
- Don't wait for one to complete before starting the next
`
```

---

## Troubleshooting

### Common Issues

**Problem**: Agent ne poziva tool  
**Rešenje**: Proverite da li je tool dodat u agent config

**Problem**: Slow responses  
**Rešenje**: Smanjite maxTurns ili koristite gpt-4o-mini

**Problem**: Neprecizni odgovori  
**Rešenje**: Povećajte temperature ili dodajte više primera u instructions

**Problem**: Memory ne radi  
**Rešenje**: Proverite Redis konekciju i TTL settings

---

## Resources

- [Vercel AI SDK Agents](https://sdk.vercel.ai/docs/ai-sdk-core/agents)
- [OpenAI Best Practices](https://platform.openai.com/docs/guides/prompt-engineering)
- [Redis Memory Patterns](https://redis.io/docs/manual/patterns/)

---

**Last Updated**: 2024-12-02  
**Version**: 1.0.0

