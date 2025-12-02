# AI System - Troubleshooting Guide

Rešavanje čestih problema sa AI sistemom.

## 📋 Quick Diagnostics

```bash
# 1. Check API server
curl http://localhost:3001/health

# 2. Check AI health
curl http://localhost:3001/health/ai

# 3. Check Redis
redis-cli ping

# 4. Check environment
cd apps/api-server && bun run typecheck

# 5. Check logs
tail -f apps/api-server/logs/ai.log
```

---

## Česti Problemi

### 1. "AI endpoints not responding"

**Simptomi**:
- 500 errors na `/api/v1/chat`
- Timeout errors
- No response

**Dijagnoza**:
```bash
# Check if server is running
curl http://localhost:3001/health

# Check AI configuration
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/v1/chat/agents

# Check logs
grep "ERROR" apps/api-server/logs/*.log
```

**Rešenja**:

```typescript
// 1. Verify API keys
console.log("OpenAI key:", process.env.OPENAI_API_KEY?.slice(0, 10));
console.log("Mistral key:", process.env.MISTRAL_API_KEY?.slice(0, 10));

// 2. Test OpenAI connection
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const result = await generateText({
  model: openai("gpt-4o-mini"),
  prompt: "Hello",
});
console.log(result.text); // Should respond

// 3. Check Redis
import { redis } from "./cache/redis";
const pong = await redis.ping();
console.log("Redis:", pong); // Should be "PONG"
```

---

### 2. "Agent not routing correctly"

**Simptomi**:
- Wrong agent handles request
- General agent handles everything
- No tool calls

**Dijagnoza**:
```typescript
// Add debug logging in main agent
logger.info({
  message: userMessage,
  routedTo: agentName,
  confidence: routingConfidence,
}, "Agent routing decision");
```

**Rešenja**:

```typescript
// 1. Improve routing instructions
instructions: (ctx) => `
<agent-capabilities>
invoices: invoice management, billing, payments, overdue, invoice creation
  KEYWORDS: invoice, bill, payment, overdue, paid, unpaid, INV-
  
customers: customer management, CRM, contacts, companies
  KEYWORDS: customer, client, company, contact, CRM
  
sales: sales pipeline, deals, quotes, revenue, forecasts
  KEYWORDS: quote, deal, pipeline, revenue, sales, forecast, QUO-
</agent-capabilities>

Route based on PRIMARY intent:
- "Show invoice for customer X" → invoices (primary: invoice)
- "Which customers have quotes?" → sales (primary: quotes)
`

// 2. Lower temperature for routing
temperature: 0.1,  // More deterministic

// 3. Force tool choice
modelSettings: {
  toolChoice: {
    type: "tool",
    toolName: "handoff_to_agent",
  },
}
```

---

### 3. "Tools not being called"

**Simptomi**:
- Agent responds without calling tools
- "I don't have access to that data"
- Generic responses

**Dijagnoza**:
```typescript
// Check if tools are registered
console.log("Available tools:", Object.keys(agent.config.tools || {}));

// Check tool descriptions
for (const [name, tool] of Object.entries(tools)) {
  console.log(name, ":", tool.description);
}
```

**Rešenja**:

```typescript
// 1. Improve tool descriptions
export const getInvoicesTool = tool({
  description: "Search and retrieve invoices. Use this when user asks about invoices, bills, payments, or wants to see invoice data.",
  // ...
});

// 2. Add examples in agent instructions
instructions: `
When user asks "show me invoices", use getInvoices tool
When user asks "overdue invoices", use getOverdueInvoices tool
When user asks "invoice INV-123", use getInvoices with search parameter
`

// 3. Check tool parameters match agent's understanding
// Tool schema should match what agent expects
```

---

### 4. "Streaming not working"

**Simptomi**:
- Response arrives all at once
- No progressive updates
- Frontend doesn't update incrementally

**Dijagnoza**:
```bash
# Test streaming with curl
curl -N http://localhost:3001/api/v1/chat \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}' \
  | head -20
```

**Rešenja**:

```typescript
// 1. Ensure streaming response
return result.toDataStreamResponse();  // ✅ Correct

// Not
return json(result);  // ❌ Wrong

// 2. Frontend - use useChat hook
const { messages, isLoading } = useChat({
  api: "/api/v1/chat",
  streamProtocol: "data",  // Important
});

// 3. Check nginx/proxy buffering
// nginx.conf:
proxy_buffering off;  # Disable buffering for streaming
```

---

### 5. "High memory usage"

**Simptomi**:
- API server crashes
- OOM errors
- Slow responses

**Dijagnoza**:
```bash
# Check memory
top -p $(pgrep -f "bun.*api-server")

# Check Redis memory
redis-cli INFO memory

# Check for memory leaks
node --expose-gc --inspect=9229 src/index.ts
```

**Rešenja**:

```typescript
// 1. Limit chat history
const history = await getChatHistory(chatId, 20);  // Not 100

// 2. Clear old Redis keys
await redis.del(...oldKeys);

// 3. Implement memory limits
const maxMemoryMB = 512;
if (process.memoryUsage().heapUsed > maxMemoryMB * 1024 * 1024) {
  // Clear caches
  categoryEmbeddings.clearCache();
  // Force GC
  global.gc?.();
}

// 4. Use streaming for large responses
// Don't load everything into memory at once
```

---

### 6. "Document processing fails"

**Simptomi**:
- Timeout errors
- "Failed to extract data"
- Empty results

**Dijagnoza**:
```typescript
// Test document directly
const result = await invoiceProcessor.processDocument({
  documentUrl: "YOUR_URL",
});
console.log("Extracted:", result);
```

**Rešenja**:

```typescript
// 1. Check document accessibility
const response = await fetch(documentUrl);
console.log("Status:", response.status);
console.log("Content-Type:", response.headers.get("content-type"));

// 2. Increase timeout
generateObject({
  // ...
  abortSignal: AbortSignal.timeout(30000), // 30 seconds
});

// 3. Try OCR fallback manually
import { extractText, getDocumentProxy } from "unpdf";

const response = await fetch(documentUrl);
const buffer = await response.arrayBuffer();
const pdf = await getDocumentProxy(buffer);
const { text } = await extractText(pdf);

console.log("Extracted text:", text);

// 4. Check PDF page count
// Mistral has documentPageLimit
providerOptions: {
  mistral: {
    documentPageLimit: 10,  // Increase if needed
  },
}
```

---

### 7. "Embeddings not accurate"

**Simptomi**:
- Wrong categories matched
- Low similarity scores
- Inconsistent results

**Dijagnoza**:
```typescript
// Test embedding generation
import { generateEmbedding } from "@crm/categories";

const result = await generateEmbedding("test");
console.log("Embedding length:", result.embedding.length);
console.log("Model:", result.model);
```

**Rešenja**:

```typescript
// 1. Use more descriptive text
// ❌ BAD
await findBestCategory("AWS");

// ✅ GOOD
await findBestCategory("AWS cloud hosting services");

// 2. Combine transaction fields
const description = [
  transaction.merchantName,
  transaction.description,
  transaction.notes,
].filter(Boolean).join(" ");

const match = await findBestCategory(description);

// 3. Set minimum similarity threshold
if (match.similarity < 0.7) {
  // Don't auto-categorize if confidence is low
  return null;
}

// 4. Provide user feedback
// Let users correct and learn from corrections
```

---

### 8. "Rate limit exceeded"

**Simptomi**:
- 429 errors
- "Too many requests"
- Blocked API calls

**Dijagnoza**:
```bash
# Check rate limit status
redis-cli GET "ratelimit:user:USER_ID"

# Check provider limits
curl https://api.openai.com/v1/usage \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Rešenja**:

```typescript
// 1. Implement exponential backoff
async function callWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

// 2. Increase user rate limit
const rateLimitKey = `ai:ratelimit:${userId}`;
const limit = 100;  // Increase from 60
const window = 60;  // seconds

// 3. Use batch operations
// Process multiple items in one API call instead of many single calls

// 4. Implement queue system
// For non-urgent operations, use BullMQ queue
await addAIJob({
  type: "categorize_transactions",
  data: { transactionIds },
});
```

---

## Performance Issues

### Slow Chat Responses

**Checklist**:

- [ ] Check Redis latency: `redis-cli --latency`
- [ ] Check database query times: Enable query logging
- [ ] Review tool execution times: Add timing logs
- [ ] Check network latency to AI providers
- [ ] Review agent's maxSteps setting (lower = faster)

**Optimization**:

```typescript
// 1. Optimize database queries
// Add indices
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_created_at ON invoices(created_at DESC);

// 2. Use pagination effectively
pageSize: 10,  // Don't fetch 1000 rows

// 3. Parallel tool calls
// Agent should call multiple tools simultaneously when possible

// 4. Reduce context size
const history = await getChatHistory(chatId, 10);  // Not 50
```

---

## Debugging Tools

### 1. Chat Debug Panel

```typescript
// Enable debug info in development
if (process.env.NODE_ENV === "development") {
  return {
    response: aiResponse,
    debug: {
      agent: selectedAgent.name,
      tools: toolsCalled,
      duration: responseTime,
      tokens: tokensUsed,
      model: modelUsed,
    },
  };
}
```

### 2. Tool Execution Tracer

```typescript
// Wrap tools with tracing
function createTracedTool(tool: Tool) {
  return {
    ...tool,
    execute: async (params) => {
      const start = Date.now();
      console.log(`[TOOL START] ${tool.description}`, params);

      try {
        const result = await tool.execute(params);
        console.log(`[TOOL SUCCESS] ${Date.now() - start}ms`, result);
        return result;
      } catch (error) {
        console.error(`[TOOL ERROR] ${Date.now() - start}ms`, error);
        throw error;
      }
    },
  };
}
```

### 3. Request/Response Logger

```typescript
// Log all AI requests
app.use("/api/v1/chat", async (req, res, next) => {
  const body = await req.clone().json();
  
  logger.info({
    type: "ai_request",
    chatId: body.chatId,
    messageLength: body.message.length,
    userId: req.auth?.userId,
  }, "AI request received");

  next();
});
```

---

## Emergency Procedures

### Complete AI System Shutdown

```bash
# 1. Set feature flag
export AI_ENABLED=false

# 2. Restart API server
pm2 restart crm-api

# 3. Update frontend
# Show maintenance message instead of chat interface

# 4. Notify users
# Send notification about temporary unavailability
```

### Rollback to Previous Version

```bash
# 1. Git rollback
git checkout main
git log --oneline -10  # Find last stable version
git checkout <commit-hash>

# 2. Rebuild
cd apps/api-server
bun install
bun run build

# 3. Restart
pm2 restart crm-api

# 4. Verify
curl http://localhost:3001/health/ai
```

---

## Support

### Getting Help

1. **Check logs**: `apps/api-server/logs/`
2. **Review metrics**: AI dashboard in monitoring
3. **Test endpoints**: Use Postman/curl
4. **Check status pages**:
   - https://status.openai.com
   - https://status.mistral.ai

### Contact

- **Internal**: #dev-ai Slack channel
- **OpenAI Support**: https://help.openai.com
- **Mistral Support**: support@mistral.ai

---

**Last Updated**: 2024-12-02  
**Version**: 1.0.0

