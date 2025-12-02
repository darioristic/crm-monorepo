# AI System - API Reference

Kompletan API reference za AI endpoints u CRM sistemu.

## Base URL

```
Development: http://localhost:3001
Production: https://api.your-domain.com
```

## Authentication

Svi AI endpoints zahtevaju JWT autentifikaciju:

```http
Authorization: Bearer <access_token>
```

---

## Endpoints

### 1. Chat Stream

Glavni chat endpoint sa streaming odgovorima.

**Endpoint**: `POST /api/v1/chat`

**Headers**:
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```typescript
{
  message: string;           // User message (1-10000 chars)
  chatId?: string;          // Optional session ID (auto-generated if omitted)
  timezone?: string;        // User timezone (default: UTC)
}
```

**Request Example**:
```json
{
  "message": "Show me overdue invoices",
  "chatId": "550e8400-e29b-41d4-a716-446655440000",
  "timezone": "Europe/Belgrade"
}
```

**Response**: `text/event-stream`

Stream format je `text/event-stream` sa AI odgovorima:

```
data: {"type":"text","text":"Here "}
data: {"type":"text","text":"are "}
data: {"type":"text","text":"your "}
data: {"type":"text","text":"overdue "}
data: {"type":"text","text":"invoices:\n\n"}
data: {"type":"tool_call","toolName":"getOverdueInvoices","args":{}}
data: {"type":"tool_result","result":{"text":"..."}}
data: {"type":"finish","reason":"stop"}
```

**Response Types**:
- `text` - Text chunk
- `tool_call` - Tool being called
- `tool_result` - Tool execution result
- `finish` - Stream completed

**Status Codes**:
- `200` - Success (streaming starts)
- `400` - Validation error
- `401` - Unauthorized
- `500` - Server error

---

### 2. Get Chat History

Učitavanje istorije chat sesije.

**Endpoint**: `GET /api/v1/chat/history/:chatId`

**Headers**:
```http
Authorization: Bearer <token>
```

**URL Parameters**:
- `chatId` (required) - Chat session ID

**Request Example**:
```http
GET /api/v1/chat/history/550e8400-e29b-41d4-a716-446655440000
```

**Response**:
```typescript
{
  success: boolean;
  data: {
    chatId: string;
    messages: Array<{
      role: "user" | "assistant" | "system";
      content: string;
      createdAt: string;  // ISO 8601
    }>;
  };
}
```

**Response Example**:
```json
{
  "success": true,
  "data": {
    "chatId": "550e8400-e29b-41d4-a716-446655440000",
    "messages": [
      {
        "role": "user",
        "content": "Show me invoices",
        "createdAt": "2024-12-02T10:30:00Z"
      },
      {
        "role": "assistant",
        "content": "Here are your recent invoices...",
        "createdAt": "2024-12-02T10:30:02Z"
      }
    ]
  }
}
```

**Status Codes**:
- `200` - Success
- `401` - Unauthorized
- `404` - Chat not found
- `500` - Server error

---

### 3. List Available Agents

Dobijanje liste dostupnih AI agenata.

**Endpoint**: `GET /api/v1/chat/agents`

**Headers**:
```http
Authorization: Bearer <token>
```

**Response**:
```typescript
{
  success: boolean;
  data: Array<{
    name: string;
    description: string;
  }>;
}
```

**Response Example**:
```json
{
  "success": true,
  "data": [
    {
      "name": "general",
      "description": "General questions, help, and navigation"
    },
    {
      "name": "invoices",
      "description": "Invoice management, payments, and billing"
    },
    {
      "name": "customers",
      "description": "Customer relationships and contact management"
    },
    {
      "name": "sales",
      "description": "Sales pipeline, quotes, and revenue"
    }
  ]
}
```

**Status Codes**:
- `200` - Success
- `401` - Unauthorized
- `500` - Server error

---

## Error Responses

Svi endpoints vraćaju konzistentan error format:

```typescript
{
  success: false;
  error: {
    code: string;          // Error code
    message: string;       // Human readable message
    details?: unknown;     // Optional additional details
  };
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

### Error Examples

**Validation Error**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Message is required and must be between 1-10000 characters"
  }
}
```

**Unauthorized**:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

---

## Rate Limiting

Rate limits su implementirani per user:

- **Chat**: 60 requests / minut
- **History**: 120 requests / minut
- **Agents List**: 30 requests / minut

**Rate Limit Headers**:
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1701518400
```

Kada se prekorači limit:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT",
    "message": "Too many requests. Try again in 30 seconds.",
    "details": {
      "retryAfter": 30
    }
  }
}
```

---

## Client Libraries

### JavaScript/TypeScript

```typescript
import { useChat } from "ai/react";

function ChatComponent() {
  const {
    messages,
    input,
    handleSubmit,
    isLoading,
  } = useChat({
    api: `${API_URL}/api/v1/chat`,
    id: chatId,
    body: {
      chatId,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return (
    <form onSubmit={handleSubmit}>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      <input value={input} onChange={handleInputChange} />
      <button type="submit" disabled={isLoading}>
        Send
      </button>
    </form>
  );
}
```

### Fetch API

```typescript
async function sendChatMessage(message: string, chatId: string) {
  const response = await fetch(`${API_URL}/api/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      message,
      chatId,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  // Handle streaming response
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));
        console.log(data);
      }
    }
  }
}
```

### cURL Examples

**Chat Request**:
```bash
curl -X POST http://localhost:3001/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "Show me recent invoices",
    "chatId": "550e8400-e29b-41d4-a716-446655440000",
    "timezone": "Europe/Belgrade"
  }' \
  --no-buffer
```

**Get History**:
```bash
curl -X GET http://localhost:3001/api/v1/chat/history/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**List Agents**:
```bash
curl -X GET http://localhost:3001/api/v1/chat/agents \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## WebSocket Alternative (Future)

_Planirana implementacija za real-time bidirectional communication_

```typescript
const ws = new WebSocket(`ws://localhost:3001/api/v1/chat/ws`);

ws.on("open", () => {
  ws.send(JSON.stringify({
    type: "authenticate",
    token: "YOUR_TOKEN",
  }));
});

ws.on("message", (data) => {
  const message = JSON.parse(data);
  console.log(message);
});

ws.send(JSON.stringify({
  type: "chat",
  message: "Show me invoices",
  chatId: "uuid",
}));
```

---

## Best Practices

### 1. Error Handling

```typescript
try {
  const response = await fetch("/api/v1/chat", {
    method: "POST",
    // ... options
  });

  if (!response.ok) {
    const error = await response.json();
    
    switch (error.error.code) {
      case "UNAUTHORIZED":
        // Redirect to login
        break;
      case "RATE_LIMIT":
        // Show "too many requests" message
        break;
      case "VALIDATION_ERROR":
        // Show validation error
        break;
      default:
        // Generic error
        break;
    }
  }
} catch (error) {
  // Network error
}
```

### 2. Streaming Handling

```typescript
async function handleStream(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          handleStreamChunk(data);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

### 3. Session Management

```typescript
// Generate consistent chatId per session
const chatId = crypto.randomUUID();

// Store in session storage
sessionStorage.setItem("currentChatId", chatId);

// Retrieve for subsequent requests
const chatId = sessionStorage.getItem("currentChatId");
```

### 4. Retry Logic

```typescript
async function chatWithRetry(
  message: string,
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sendChatMessage(message);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
}
```

---

## Monitoring & Analytics

### Response Time Metrics

Track client-side performance:

```typescript
const startTime = performance.now();

await sendChatMessage(message);

const duration = performance.now() - startTime;
analytics.track("chat_response_time", {
  duration,
  message_length: message.length,
});
```

### Error Tracking

```typescript
try {
  await sendChatMessage(message);
} catch (error) {
  errorTracker.captureException(error, {
    context: {
      chatId,
      message_length: message.length,
      user_id: userId,
    },
  });
}
```

---

## Security Considerations

1. **Always use HTTPS** u produkciji
2. **Validate token** na svakom requestu
3. **Sanitize inputs** pre slanja na API
4. **Implement CSRF protection** za web aplikacije
5. **Rate limit** na client-side takođe
6. **Log out users** nakon token expiration

---

## Changelog

### v1.0.0 (2024-12-02)
- Initial release
- Chat streaming endpoint
- History retrieval
- Agent listing

---

**Last Updated**: 2024-12-02  
**Version**: 1.0.0

