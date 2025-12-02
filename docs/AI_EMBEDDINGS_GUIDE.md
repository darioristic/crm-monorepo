# Category Embeddings - AI Guide

Vodič za semantic category matching koristeći Google Gemini embeddings.

## 📋 Sadržaj

1. [Pregled](#pregled)
2. [Kako Rade Embeddings](#kako-rade-embeddings)
3. [Usage Examples](#usage-examples)
4. [Category System](#category-system)
5. [Integration Guide](#integration-guide)
6. [Performance](#performance)

---

## Pregled

Category embeddings sistem koristi **Google Gemini** embedding model za automatsku kategorizaciju transakcija, troškova i prihoda pomoću semantic search-a.

### Capabilities

✅ **Semantic Matching** - Razume značenje, ne samo keywords  
✅ **Multi-language** - Radi na srpskom, engleskom, itd.  
✅ **Similarity Search** - Pronalazi najsličnije kategorije  
✅ **Batch Processing** - Procesuje multiple text-ova odjednom  
✅ **Caching** - In-memory cache za performanse  

---

## Kako Rade Embeddings

### Embedding Vectors

Embedding je numerički vektor koji predstavlja semantičko značenje teksta:

```
"Office supplies" → [0.234, -0.567, 0.891, ..., 0.123]  (768 dimensions)
"Kancelarijski materijal" → [0.241, -0.554, 0.887, ..., 0.119]
```

### Cosine Similarity

Računanje sličnosti između dva vektora:

```typescript
function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  // Returns value between -1 and 1
  // 1 = identical
  // 0 = unrelated
  // -1 = opposite
}
```

### Example

```
User input: "Kupovina laptopa"

Embeddings:
- "Office Supplies"     → similarity: 0.62
- "Equipment & Hardware"→ similarity: 0.89  ← BEST MATCH
- "Travel"              → similarity: 0.23
```

---

## Usage Examples

### Example 1: Basic Category Matching

```typescript
import { findBestCategory } from "@crm/categories";

// Find best matching category
const result = await findBestCategory("Kupovina Office 365");

console.log(result);
// {
//   category: { id: "software", name: "Software & Tools", ... },
//   similarity: 0.91
// }
```

### Example 2: Top N Matches

```typescript
import { findTopCategories } from "@crm/categories";

// Get top 3 matches
const matches = await findTopCategories(
  "Dinner with client",
  3  // top N
);

console.log(matches);
// [
//   { category: { name: "Meals & Entertainment" }, similarity: 0.94 },
//   { category: { name: "Marketing & Advertising" }, similarity: 0.67 },
//   { category: { name: "Travel & Transportation" }, similarity: 0.45 }
// ]
```

### Example 3: Using Service Class

```typescript
import { categoryEmbeddings } from "@crm/categories";

// Pre-compute embeddings for better performance
await categoryEmbeddings.precompute();

// Find best match (uses cached embeddings)
const match = await categoryEmbeddings.findBest("Cloud hosting AWS");

console.log(match);
// { category: { name: "Software & Tools" }, similarity: 0.88 }
```

### Example 4: Batch Processing

```typescript
import { generateEmbeddings } from "@crm/categories";

// Generate embeddings for multiple texts at once
const texts = [
  "Office supplies",
  "Taxi to airport",
  "AWS hosting",
];

const result = await generateEmbeddings(texts);

console.log(result.embeddings.length);  // 3
console.log(result.embeddings[0].length); // 768 (dimensions)
```

---

## Category System

### Predefined Categories

#### Expense Categories (13)

```typescript
export const EXPENSE_CATEGORIES = [
  { id: "office", name: "Office Supplies", slug: "office-supplies" },
  { id: "software", name: "Software & Tools", slug: "software-tools" },
  { id: "travel", name: "Travel & Transportation", slug: "travel" },
  { id: "meals", name: "Meals & Entertainment", slug: "meals-entertainment" },
  { id: "utilities", name: "Utilities", slug: "utilities" },
  { id: "rent", name: "Rent & Lease", slug: "rent-lease" },
  { id: "marketing", name: "Marketing & Advertising", slug: "marketing" },
  { id: "professional", name: "Professional Services", slug: "professional-services" },
  { id: "insurance", name: "Insurance", slug: "insurance" },
  { id: "taxes", name: "Taxes & Fees", slug: "taxes-fees" },
  { id: "equipment", name: "Equipment & Hardware", slug: "equipment" },
  { id: "payroll", name: "Payroll & Benefits", slug: "payroll" },
  { id: "other", name: "Other Expenses", slug: "other" },
];
```

#### Income Categories (7)

```typescript
export const INCOME_CATEGORIES = [
  { id: "sales", name: "Product Sales", slug: "product-sales" },
  { id: "services", name: "Service Revenue", slug: "service-revenue" },
  { id: "consulting", name: "Consulting", slug: "consulting" },
  { id: "subscriptions", name: "Subscriptions", slug: "subscriptions" },
  { id: "interest", name: "Interest Income", slug: "interest" },
  { id: "refunds", name: "Refunds & Returns", slug: "refunds" },
  { id: "other_income", name: "Other Income", slug: "other-income" },
];
```

### Category Lookup Helpers

```typescript
import {
  getCategoryById,
  getCategoryBySlug,
  getCategoryByName,
  getExpenseCategories,
  getIncomeCategories,
} from "@crm/categories";

// By ID
const category = getCategoryById("software");

// By slug
const category = getCategoryBySlug("software-tools");

// By name (case-insensitive)
const category = getCategoryByName("Software & Tools");

// All expense categories
const expenses = getExpenseCategories();

// All income categories
const income = getIncomeCategories();
```

---

## Integration Guide

### Auto-categorize Transaction

```typescript
import { findBestCategory } from "@crm/categories";

async function categorizeTransaction(transaction: Transaction) {
  // Use transaction description for matching
  const description = transaction.description || transaction.merchantName;
  
  const match = await findBestCategory(description);

  // Only auto-categorize if confidence is high
  if (match && match.similarity > 0.7) {
    await db`
      UPDATE transactions
      SET category_id = ${match.category.id}
      WHERE id = ${transaction.id}
    `;

    return match.category;
  }

  // Return null if low confidence - let user categorize manually
  return null;
}
```

### Batch Auto-categorization

```typescript
async function categorizePendingTransactions() {
  // Get uncategorized transactions
  const transactions = await db`
    SELECT * FROM transactions
    WHERE category_id IS NULL
    LIMIT 100
  `;

  // Pre-compute category embeddings
  await categoryEmbeddings.precompute();

  const results = await Promise.all(
    transactions.map(async (tx) => {
      const match = await categoryEmbeddings.findBest(
        tx.description || tx.merchant_name
      );

      if (match && match.similarity > 0.7) {
        return {
          transactionId: tx.id,
          categoryId: match.category.id,
          confidence: match.similarity,
        };
      }

      return null;
    })
  );

  // Update in batch
  const validResults = results.filter(Boolean);
  
  for (const result of validResults) {
    await db`
      UPDATE transactions
      SET category_id = ${result.categoryId},
          auto_categorized = true,
          categorization_confidence = ${result.confidence}
      WHERE id = ${result.transactionId}
    `;
  }

  return {
    processed: transactions.length,
    categorized: validResults.length,
    manual: transactions.length - validResults.length,
  };
}
```

### Smart Suggestions

```typescript
async function suggestCategories(description: string, topN = 3) {
  const matches = await findTopCategories(description, topN);

  return matches.map(match => ({
    id: match.category.id,
    name: match.category.name,
    confidence: Math.round(match.similarity * 100),
    recommended: match.similarity > 0.8,
  }));
}

// Usage in UI
const suggestions = await suggestCategories("Monthly Zoom subscription");
// [
//   { name: "Software & Tools", confidence: 92, recommended: true },
//   { name: "Subscriptions", confidence: 87, recommended: true },
//   { name: "Professional Services", confidence: 54, recommended: false }
// ]
```

---

## Performance Optimization

### 1. Pre-compute Embeddings

```typescript
// On application startup
import { categoryEmbeddings, ALL_CATEGORIES } from "@crm/categories";

// Pre-compute and cache all category embeddings
await categoryEmbeddings.precompute(ALL_CATEGORIES);

// Now all similarity searches use cached embeddings
const match = await categoryEmbeddings.findBest("Office chair");
// Fast - no API call needed for category embeddings
```

### 2. Redis Caching

```typescript
// Cache embeddings in Redis
async function getCachedEmbedding(text: string): Promise<number[] | null> {
  const cacheKey = `embedding:${hashText(text)}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }

  const { embedding } = await generateEmbedding(text);
  
  // Cache for 7 days
  await redis.setex(cacheKey, 7 * 24 * 60 * 60, JSON.stringify(embedding));

  return embedding;
}
```

### 3. Batch API Calls

```typescript
// Instead of multiple single calls
const descriptions = transactions.map(t => t.description);

// One batch call
const { embeddings } = await generateEmbeddings(descriptions);

// Match all at once
const matches = embeddings.map((emb, idx) => ({
  transaction: transactions[idx],
  category: findBestMatchFromEmbedding(emb),
}));
```

---

## Cost Considerations

### Google Gemini Pricing

**text-embedding-004**: ~$0.00002 / 1K tokens

Example calculations:
- 100 transactions @ 20 tokens each = 2K tokens = $0.00004
- 1,000 transactions = $0.0004
- 10,000 transactions = $0.004

### Optimization Tips

1. **Cache embeddings** - Don't regenerate for same text
2. **Batch requests** - Use `embedMany` instead of multiple `embed` calls
3. **Pre-compute categories** - Category embeddings rarely change
4. **Rate limiting** - Implement request throttling

---

## Testing

### Unit Tests

```typescript
import { describe, it, expect } from "vitest";
import { cosineSimilarity, findBestCategory } from "@crm/categories";

describe("Embeddings", () => {
  it("should calculate cosine similarity", () => {
    const vectorA = [1, 0, 0];
    const vectorB = [1, 0, 0];
    
    const similarity = cosineSimilarity(vectorA, vectorB);
    expect(similarity).toBe(1); // Identical
  });

  it("should find best category", async () => {
    const match = await findBestCategory("Office printer");
    
    expect(match).not.toBeNull();
    expect(match?.category.id).toBe("office");
    expect(match?.similarity).toBeGreaterThan(0.7);
  });
});
```

---

## Resources

- [Google Generative AI](https://ai.google.dev/)
- [Text Embeddings Guide](https://ai.google.dev/gemini-api/docs/embeddings)
- [Vector Similarity](https://en.wikipedia.org/wiki/Cosine_similarity)

---

**Last Updated**: 2024-12-02  
**Version**: 1.0.0

