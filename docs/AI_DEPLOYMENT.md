# AI System - Deployment Guide

Production deployment vodič za AI sistem.

## 📋 Pre-Deployment Checklist

### 1. Environment Variables

Konfigurisanje AI provajdera:

```env
# apps/api-server/.env

# OpenAI (Required za chat)
OPENAI_API_KEY=sk-proj-...

# Mistral AI (Required za document processing)
MISTRAL_API_KEY=...

# Google AI (Required za embeddings)
GOOGLE_GENERATIVE_AI_API_KEY=...

# Redis (Already configured)
REDIS_URL=redis://user:pass@host:6379

# Database (Already configured)
DATABASE_URL=postgresql://...
```

### 2. API Keys Setup

#### OpenAI API Key

1. Idi na https://platform.openai.com/api-keys
2. Create new secret key
3. Dodaj u environment variables
4. **Preporučeni limit**: $50/month za development

#### Mistral AI Key

1. Idi na https://console.mistral.ai/
2. Create API key
3. Dodaj u environment variables
4. **Preporučeni limit**: $20/month

#### Google Generative AI Key

1. Idi na https://makersuite.google.com/app/apikey
2. Create API key
3. Enable Generative Language API
4. Dodaj u environment variables
5. **Free tier**: 1,500 requests/day

### 3. Dependencies Verification

```bash
cd apps/api-server
bun install

# Verify installation
bun run typecheck
bun test
```

---

## Deployment Options

### Option 1: Traditional VPS/VM

```bash
# 1. Clone repository
git clone <repo-url>
cd crm-monorepo

# 2. Install dependencies
bun install

# 3. Build
cd apps/api-server
bun run build

# 4. Set environment variables
cp .env.example .env
# Edit .env with your keys

# 5. Run migrations
bun run db:migrate

# 6. Start server
NODE_ENV=production bun run start
```

### Option 2: Docker

```dockerfile
# Dockerfile.api-ai
FROM oven/bun:1.3.1

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api-server/package.json ./apps/api-server/
COPY packages ./packages

RUN bun install --frozen-lockfile

COPY apps/api-server ./apps/api-server

WORKDIR /app/apps/api-server

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["bun", "run", "start"]
```

```bash
# Build
docker build -f Dockerfile.api-ai -t crm-api-ai .

# Run
docker run -d \
  -p 3001:3001 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e MISTRAL_API_KEY=$MISTRAL_API_KEY \
  -e GOOGLE_GENERATIVE_AI_API_KEY=$GOOGLE_KEY \
  -e DATABASE_URL=$DATABASE_URL \
  -e REDIS_URL=$REDIS_URL \
  --name crm-api \
  crm-api-ai
```

### Option 3: Kubernetes

```yaml
# k8s/ai-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crm-api-ai
spec:
  replicas: 3
  selector:
    matchLabels:
      app: crm-api-ai
  template:
    metadata:
      labels:
        app: crm-api-ai
    spec:
      containers:
        - name: api
          image: your-registry/crm-api-ai:latest
          ports:
            - containerPort: 3001
          env:
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: ai-secrets
                  key: openai-key
            - name: MISTRAL_API_KEY
              valueFrom:
                secretKeyRef:
                  name: ai-secrets
                  key: mistral-key
            - name: GOOGLE_GENERATIVE_AI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: ai-secrets
                  key: google-key
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 5
```

```yaml
# k8s/ai-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: ai-secrets
type: Opaque
stringData:
  openai-key: "sk-proj-..."
  mistral-key: "..."
  google-key: "..."
```

---

## Scaling Considerations

### Horizontal Scaling

AI endpoints su **stateless** i mogu scale horizontalno:

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: crm-api-ai-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: crm-api-ai
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Redis Cluster

Za high-availability:

```yaml
# Redis Sentinel configuration
sentinel monitor crm-redis redis-master 6379 2
sentinel down-after-milliseconds crm-redis 5000
sentinel parallel-syncs crm-redis 1
sentinel failover-timeout crm-redis 10000
```

### Load Balancing

```nginx
# nginx.conf
upstream crm_api {
    least_conn;  # Route to least busy server
    server api-1:3001 max_fails=3 fail_timeout=30s;
    server api-2:3001 max_fails=3 fail_timeout=30s;
    server api-3:3001 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name api.crm.com;

    location /api/v1/chat {
        proxy_pass http://crm_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Important for streaming
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```

---

## Monitoring

### Health Checks

Dodaj AI-specific health check:

```typescript
// apps/api-server/src/routes/health.ts
routes.push({
  method: "GET",
  pattern: /^\/health\/ai$/,
  handler: async () => {
    try {
      // Test OpenAI
      const openaiOk = !!process.env.OPENAI_API_KEY;

      // Test Redis
      const redisOk = await cache.ping();

      // Test Mistral (optional)
      const mistralOk = !!process.env.MISTRAL_API_KEY;

      // Test Google (optional)
      const googleOk = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      const status = {
        healthy: openaiOk && redisOk,
        services: {
          openai: openaiOk,
          mistral: mistralOk,
          google: googleOk,
          redis: redisOk,
        },
      };

      return json(status, status.healthy ? 200 : 503);
    } catch (error) {
      return json({ healthy: false, error: error.message }, 503);
    }
  },
});
```

### Metrics Collection

```typescript
// Track AI usage
interface AIMetrics {
  endpoint: string;
  agent: string;
  model: string;
  tokensUsed: number;
  duration: number;
  success: boolean;
  error?: string;
}

async function trackAIMetrics(metrics: AIMetrics) {
  await db`
    INSERT INTO ai_metrics (
      endpoint, agent, model, tokens_used,
      duration, success, error, created_at
    ) VALUES (
      ${metrics.endpoint},
      ${metrics.agent},
      ${metrics.model},
      ${metrics.tokensUsed},
      ${metrics.duration},
      ${metrics.success},
      ${metrics.error || null},
      NOW()
    )
  `;
}
```

### Logging

```typescript
import { logger } from "./lib/logger";

// AI-specific logger
export const aiLogger = logger.child({ module: "ai" });

// Usage
aiLogger.info(
  {
    agent: "invoices",
    tool: "getInvoices",
    duration: 234,
    tokensUsed: 450,
  },
  "AI request completed"
);
```

---

## Security

### 1. API Key Rotation

```bash
# Rotate API keys monthly
# Use secret management service (AWS Secrets Manager, Vault, etc.)

# Example with AWS Secrets Manager
aws secretsmanager create-secret \
  --name crm/ai/openai-key \
  --secret-string "sk-proj-..."

# In application
const secret = await secretsManager.getSecretValue({
  SecretId: "crm/ai/openai-key"
}).promise();

process.env.OPENAI_API_KEY = secret.SecretString;
```

### 2. Rate Limiting

Implementiraj rate limiting per user:

```typescript
// Check before processing
const rateLimitKey = `ai:ratelimit:${userId}`;
const count = await redis.incr(rateLimitKey);

if (count === 1) {
  await redis.expire(rateLimitKey, 60); // 1 minute window
}

if (count > 60) {
  throw new Error("Rate limit exceeded");
}
```

### 3. Input Sanitization

```typescript
function sanitizeInput(message: string): string {
  // Remove potential injection attempts
  return message
    .replace(/<script>/gi, "")
    .replace(/javascript:/gi, "")
    .slice(0, 10000); // Max length
}
```

### 4. Audit Logging

```typescript
await db`
  INSERT INTO ai_audit_log (
    user_id, chat_id, message, agent, tools_used, created_at
  ) VALUES (
    ${userId}, ${chatId}, ${message}, ${agentName}, 
    ${JSON.stringify(toolsCalled)}, NOW()
  )
`;
```

---

## Cost Management

### 1. Model Selection Strategy

```typescript
// Cost-optimized routing
function selectModel(complexity: "low" | "medium" | "high") {
  switch (complexity) {
    case "low":
      return openai("gpt-4o-mini"); // $0.150 / 1M tokens
    case "medium":
      return openai("gpt-4o-mini"); // Same, reliable
    case "high":
      return openai("gpt-4o"); // $5.00 / 1M tokens
  }
}
```

### 2. Usage Monitoring

```typescript
// Track monthly costs
async function getMonthlyAICosts() {
  const costs = await db`
    SELECT 
      DATE(created_at) as date,
      agent,
      SUM(tokens_used) as total_tokens,
      COUNT(*) as requests
    FROM ai_metrics
    WHERE created_at >= DATE_TRUNC('month', NOW())
    GROUP BY DATE(created_at), agent
    ORDER BY date DESC
  `;

  // Estimate cost (approximate)
  const estimatedCost = costs.reduce((sum, row) => {
    const tokensInMillions = row.total_tokens / 1_000_000;
    return sum + tokensInMillions * 0.15; // gpt-4o-mini price
  }, 0);

  return { costs, estimatedCost };
}
```

### 3. Budget Alerts

```typescript
// Check daily budget
const dailyLimit = 10; // $10/day

const todayCost = await estimateTodaysCost();

if (todayCost > dailyLimit) {
  // Send alert
  await sendAlert({
    type: "budget_exceeded",
    message: `AI costs exceeded daily limit: $${todayCost}`,
  });

  // Optional: Disable AI temporarily
  process.env.AI_ENABLED = "false";
}
```

---

## Backup Strategy

### 1. Chat History Backup

```bash
# Redis backup script
redis-cli --rdb /backup/redis-$(date +%Y%m%d).rdb

# Or use Redis persistence
# In redis.conf:
save 900 1      # Save if 1 key changed in 15 min
save 300 10     # Save if 10 keys changed in 5 min
save 60 10000   # Save if 10000 keys changed in 1 min
```

### 2. Postgres Backup

```bash
# Backup AI-related tables
pg_dump -h localhost -U user -d crm \
  -t ai_metrics \
  -t ai_audit_log \
  -t document_corrections \
  > ai_backup_$(date +%Y%m%d).sql
```

---

## Rollback Plan

### If AI System Fails

1. **Disable AI endpoints**:

```typescript
// Feature flag
if (process.env.AI_ENABLED !== "true") {
  return json({ error: "AI temporarily unavailable" }, 503);
}
```

2. **Fallback to manual operations**:

- Manual document data entry
- Manual categorization
- Disable chat interface

3. **Monitor & Fix**:

```bash
# Check logs
tail -f logs/ai-errors.log

# Check API status
curl https://status.openai.com/api/v2/status.json
```

---

## Performance Tuning

### 1. Redis Configuration

```conf
# redis.conf for AI workload
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Network
timeout 0
tcp-keepalive 300
```

### 2. Database Optimization

```sql
-- Indices for AI queries
CREATE INDEX idx_ai_metrics_created_at ON ai_metrics(created_at);
CREATE INDEX idx_ai_metrics_agent ON ai_metrics(agent);
CREATE INDEX idx_ai_audit_user_created ON ai_audit_log(user_id, created_at);

-- Partitioning for large tables
CREATE TABLE ai_metrics_2024_12 PARTITION OF ai_metrics
  FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
```

### 3. Caching Strategy

```typescript
// Cache hot data
const CACHE_STRATEGY = {
  chatHistory: 600, // 10 minutes
  userContext: 300, // 5 minutes
  agentConfig: 3600, // 1 hour
  documentProcessing: 86400, // 24 hours
  categoryEmbeddings: 604800, // 7 days
};
```

---

## Monitoring Dashboards

### Key Metrics to Track

1. **Request Volume**

   - Total chat requests/day
   - Requests per agent
   - Peak hours

2. **Response Times**

   - Average response time
   - P95, P99 latencies
   - Streaming start time

3. **Error Rates**

   - Failed requests %
   - Timeout errors
   - API errors by provider

4. **Cost Metrics**

   - Daily token usage
   - Cost per request
   - Monthly burn rate

5. **Quality Metrics**
   - User satisfaction (thumbs up/down)
   - Retry rate
   - Conversation abandonment

### Grafana Dashboard Example

```json
{
  "dashboard": {
    "title": "AI System Monitoring",
    "panels": [
      {
        "title": "Chat Requests/min",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(ai_chat_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Response Time P95",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, ai_response_duration_seconds)"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(ai_errors_total[5m])"
          }
        ]
      },
      {
        "title": "Daily Token Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(ai_tokens_used_total)"
          }
        ]
      }
    ]
  }
}
```

---

## Incident Response

### Common Incidents

#### 1. OpenAI API Down

**Symptoms**: 502/503 errors, timeouts

**Response**:

```bash
# Check OpenAI status
curl https://status.openai.com/api/v2/status.json

# Temporary fallback
export AI_FALLBACK_MODE=true

# Notify users
echo "AI temporarily unavailable" > /app/status.txt
```

#### 2. High Costs

**Symptoms**: Budget alerts, unexpected billing

**Response**:

```bash
# Check usage
bun run scripts/check-ai-usage.ts

# Temporary throttle
export AI_RATE_LIMIT=10  # requests/min

# Analyze expensive queries
SELECT agent, tool, AVG(tokens_used)
FROM ai_metrics
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY agent, tool
ORDER BY AVG(tokens_used) DESC;
```

#### 3. Memory Leak

**Symptoms**: Increasing memory usage, OOM errors

**Response**:

```bash
# Clear Redis cache
redis-cli FLUSHDB

# Restart pods
kubectl rollout restart deployment/crm-api-ai

# Monitor
kubectl top pods
```

---

## Compliance & Privacy

### GDPR Compliance

```typescript
// Implement data deletion
async function deleteUserAIData(userId: string) {
  // Delete chat history
  const chatKeys = await redis.keys(`chat:history:*${userId}*`);
  if (chatKeys.length > 0) {
    await redis.del(...chatKeys);
  }

  // Delete working memory
  await redis.del(`chat:memory:${userId}`);

  // Delete audit logs (archive first)
  await db`
    INSERT INTO ai_audit_archive SELECT * FROM ai_audit_log 
    WHERE user_id = ${userId}
  `;

  await db`
    DELETE FROM ai_audit_log WHERE user_id = ${userId}
  `;
}
```

### Data Retention

```typescript
// Cleanup old data
async function cleanupOldAIData() {
  const retentionDays = 90;

  // Delete old metrics
  await db`
    DELETE FROM ai_metrics
    WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
  `;

  // Delete old audit logs
  await db`
    DELETE FROM ai_audit_log
    WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
  `;

  // Cleanup Redis (automatic via TTL)
}

// Run daily
schedule.daily("cleanup-ai-data", cleanupOldAIData);
```

---

## Troubleshooting

### Debug Mode

```typescript
// Enable verbose logging
export AI_DEBUG=true

// In code
if (process.env.AI_DEBUG === "true") {
  console.log("Agent selected:", agentName);
  console.log("Tools called:", toolsCalled);
  console.log("Response time:", duration);
}
```

### Common Issues

**Slow responses**

- Check Redis latency
- Review tool query performance
- Consider caching strategy

**High error rate**

- Check API key validity
- Review rate limits
- Check network connectivity

**Memory issues**

- Clear Redis cache
- Review embedding cache size
- Check for memory leaks

---

## Resources

- [OpenAI Production Best Practices](https://platform.openai.com/docs/guides/production-best-practices)
- [Redis Production Checklist](https://redis.io/docs/management/optimization/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)

---

**Last Updated**: 2024-12-02  
**Version**: 1.0.0
