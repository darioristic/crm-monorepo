# Document Processing - AI Guide

Vodič za AI-powered document processing u CRM sistemu.

## 📋 Sadržaj

1. [Pregled](#pregled)
2. [Document Classifier](#document-classifier)
3. [Invoice Processor](#invoice-processor)
4. [Receipt Processor](#receipt-processor)
5. [Integration Examples](#integration-examples)
6. [Best Practices](#best-practices)

---

## Pregled

Document processing sistem koristi **Mistral AI** za automatsku ekstrakciju podataka iz dokumenata (fakture, računi, ugovori).

### Capabilities

✅ **Klasifikacija** - Automatsko prepoznavanje tipa dokumenta  
✅ **Ekstrakcija** - Izvlačenje strukturiranih podataka  
✅ **OCR Fallback** - Za loš kvalitet skenova  
✅ **Multi-language** - Podrška za više jezika  
✅ **Validation** - Zod schema validacija  

### Podržani Formati

- PDF dokumenti
- Slike (PNG, JPG, JPEG)
- Text (fallback)

---

## Document Classifier

### Osnovni Koncept

Classifier analizira dokument i određuje njegov tip sa confidence score-om.

### Usage

```typescript
import { documentClassifier } from "@crm/documents";

// Klasifikacija text sadržaja
const result = await documentClassifier.classifyDocument({
  content: extractedText,
});

console.log(result);
// {
//   type: "invoice",
//   confidence: 0.95,
//   language: "en"
// }

// Klasifikacija slike
const imageResult = await documentClassifier.classifyImage({
  content: "data:image/jpeg;base64,..." // or URL
});
```

### Document Types

| Type | Description | Confidence Threshold |
|------|-------------|---------------------|
| `invoice` | Faktura, račun za plaćanje | > 0.7 |
| `receipt` | Fiskalni račun, proof of payment | > 0.7 |
| `contract` | Ugovor, sporazum | > 0.8 |
| `other` | Nepoznat tip | < 0.7 |

### Classifier API

```typescript
class DocumentClassifier {
  // Klasifikuj text dokument
  async classifyDocument(
    request: DocumentClassifierRequest
  ): Promise<ClassificationResult>;

  // Klasifikuj sliku dokumenta
  async classifyImage(
    request: DocumentClassifierImageRequest
  ): Promise<ClassificationResult>;

  // Universal classifier
  async classify(
    content: string,
    isImage?: boolean
  ): Promise<ClassificationResult>;
}
```

### Response Type

```typescript
interface ClassificationResult {
  type: "invoice" | "receipt" | "contract" | "other";
  confidence: number;    // 0.0 - 1.0
  language?: string;     // ISO 639-1 code (en, sr, de, etc.)
}
```

---

## Invoice Processor

### Osnovni Koncept

Invoice Processor ekstraktuje strukturirane podatke iz faktura koristeći Mistral AI vision capabilities.

### Usage

```typescript
import { invoiceProcessor } from "@crm/documents";

// Process PDF invoice
const invoice = await invoiceProcessor.processDocument({
  documentUrl: "https://storage.com/invoice.pdf",
  companyName: "My Company", // Optional - helps with vendor/customer identification
});

console.log(invoice);
// {
//   type: "invoice",
//   invoiceNumber: "INV-2024-001",
//   totalAmount: 1500.00,
//   currency: "EUR",
//   vendorName: "Vendor Corp",
//   lineItems: [...],
//   ...
// }

// Process extracted text
const invoiceFromText = await invoiceProcessor.processText(
  pdfText,
  "My Company"
);
```

### Extracted Fields

Invoice processor ekstraktuje sledeća polja:

#### Core Fields
```typescript
{
  type: "invoice",
  invoiceNumber: string | null,      // INV-2024-001
  invoiceDate: string | null,        // ISO 8601
  dueDate: string | null,            // ISO 8601
  totalAmount: number | null,        // 1500.00
  currency: string | null,           // EUR, USD, RSD
}
```

#### Vendor Information
```typescript
{
  vendorName: string | null,         // "Vendor Corp"
  vendorAddress: string | null,      // "123 Main St, Belgrade"
  email: string | null,              // "info@vendor.com"
  website: string | null,            // "vendor.com"
}
```

#### Customer Information
```typescript
{
  customerName: string | null,       // "My Company"
  customerAddress: string | null,    // "456 Business Ave"
}
```

#### Tax & Amounts
```typescript
{
  taxAmount: number | null,          // 300.00
  taxRate: number | null,            // 20.0
  taxType: string | null,            // "VAT", "PDV", "GST"
}
```

#### Line Items
```typescript
{
  lineItems: Array<{
    description: string,             // "Web Development Services"
    quantity: number,                // 10
    unitPrice: number,               // 150.00
    total: number,                   // 1500.00
    vatRate?: number,                // 20.0
  }>,
}
```

#### Additional
```typescript
{
  paymentInstructions: string | null,  // Bank account, payment terms
  notes: string | null,                // Additional notes
  language: string | null,             // "en", "sr", "de"
}
```

### Processing Strategies

#### 1. Direct PDF Processing (Primary)

```typescript
// Best quality - uses Mistral's native PDF support
const result = await invoiceProcessor.processDocument({
  documentUrl: "https://storage.com/invoice.pdf",
});
```

**Pros:**
- Najbolji kvalitet
- Direktan pristup PDF strukturi
- Brži od OCR

**Cons:**
- Zahteva javno dostupan URL
- Može falovati za kompleksne layoute

#### 2. OCR + LLM Fallback

```typescript
// Automatically triggered if primary fails or quality is poor
// Uses unpdf library for text extraction
```

**Automatski se aktivira kada:**
- Primary processing faila
- Data quality je loša (nedostaju kritična polja)
- PDF je loš sken

**Pros:**
- Radi sa lošim kvalitetom skenova
- Backup strategy
- Merge sa primary results

**Cons:**
- Sporiji
- Manje precizan
- Ne prepoznaje tabele dobro

### Quality Checks

Procesor proverava kvalitet ekstraktovanih podataka:

```typescript
#isDataQualityPoor(result): boolean {
  const criticalFieldsMissing =
    !result.total_amount ||
    !result.currency ||
    !result.vendor_name ||
    (!result.invoice_date && !result.due_date);

  return criticalFieldsMissing;
}
```

Ako je kvalitet loš, automatski se pokreće OCR fallback i merge rezultata.

---

## Receipt Processor

### Usage

```typescript
import { receiptProcessor } from "@crm/documents";

// Process PDF receipt
const receipt = await receiptProcessor.processDocument({
  documentUrl: "https://storage.com/receipt.pdf",
});

// Process image receipt
const receiptFromImage = await receiptProcessor.processImage(
  "https://storage.com/receipt.jpg"
);

// Process text
const receiptFromText = await receiptProcessor.processText(
  ocrExtractedText
);
```

### Extracted Fields

```typescript
interface ExtractedReceipt {
  type: "receipt";
  merchantName: string | null;       // "Maxi Market"
  merchantAddress: string | null;    // "Bulevar 123, Beograd"
  date: string | null;               // ISO 8601
  totalAmount: number | null;        // 2,450.00
  currency: string | null;           // "RSD"
  taxAmount: number | null;          // 408.33
  paymentMethod: string | null;     // "Card", "Cash"
  items: Array<{
    name: string,                    // "Hleb"
    quantity: number,                // 2
    price: number,                   // 120.00
  }>;
  language: string | null;           // "sr"
}
```

---

## Integration Examples

### Example 1: Invoice Upload & Process

```typescript
// 1. User uploads file
async function handleInvoiceUpload(file: File) {
  // Upload to storage
  const uploadResponse = await uploadFile(file);
  const documentUrl = uploadResponse.url;

  // Classify document
  const classification = await documentClassifier.classify(
    documentUrl,
    false // not an image
  );

  if (classification.type !== "invoice") {
    throw new Error(`Document is ${classification.type}, not an invoice`);
  }

  // Process invoice
  const extractedData = await invoiceProcessor.processDocument({
    documentUrl,
    companyName: user.companyName,
  });

  // Create invoice in database
  const invoice = await createInvoice({
    invoiceNumber: extractedData.invoiceNumber,
    companyName: extractedData.vendorName,
    total: extractedData.totalAmount,
    currency: extractedData.currency,
    dueDate: extractedData.dueDate,
    items: extractedData.lineItems.map(item => ({
      productName: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
  });

  return invoice;
}
```

### Example 2: Batch Processing

```typescript
async function processBatchInvoices(documentUrls: string[]) {
  const results = await Promise.allSettled(
    documentUrls.map(async (url) => {
      // Classify
      const classification = await documentClassifier.classify(url);
      
      if (classification.type !== "invoice") {
        return { url, skipped: true, reason: "Not an invoice" };
      }

      // Process
      const invoice = await invoiceProcessor.processDocument({ 
        documentUrl: url 
      });

      return { url, invoice, success: true };
    })
  );

  return results;
}
```

### Example 3: API Endpoint

```typescript
// apps/api-server/src/routes/documents.ts
import { invoiceProcessor, documentClassifier } from "@crm/documents";

routes.push({
  method: "POST",
  pattern: /^\/api\/v1\/documents\/process$/,
  handler: async (request) => {
    const auth = await verifyAndGetUser(request);
    if (!auth) {
      return json(errorResponse("UNAUTHORIZED"), 401);
    }

    const body = await request.json();
    const { documentUrl, type } = body;

    try {
      // Classify if type not provided
      let docType = type;
      if (!docType) {
        const classification = await documentClassifier.classify(documentUrl);
        docType = classification.type;
      }

      // Process based on type
      let result;
      if (docType === "invoice") {
        result = await invoiceProcessor.processDocument({
          documentUrl,
          companyName: auth.companyName,
        });
      } else if (docType === "receipt") {
        result = await receiptProcessor.processDocument({
          documentUrl,
        });
      } else {
        return json(
          errorResponse("UNSUPPORTED_TYPE", `Type ${docType} is not supported`),
          400
        );
      }

      return json(successResponse(result));
    } catch (error) {
      logger.error({ error }, "Document processing failed");
      return json(
        errorResponse("PROCESSING_ERROR", error.message),
        500
      );
    }
  },
});
```

---

## Best Practices

### 1. Pre-processing

```typescript
// Validate file before processing
function validateDocument(file: File): boolean {
  // Check file size (< 10MB)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File too large");
  }

  // Check file type
  const validTypes = ["application/pdf", "image/jpeg", "image/png"];
  if (!validTypes.includes(file.type)) {
    throw new Error("Invalid file type");
  }

  return true;
}
```

### 2. Error Handling

```typescript
try {
  const invoice = await invoiceProcessor.processDocument(params);
  
  // Validate critical fields
  if (!invoice.totalAmount || !invoice.currency) {
    throw new Error("Missing critical fields in extraction");
  }
  
  return invoice;
} catch (error) {
  if (error.message.includes("timeout")) {
    // Retry with longer timeout
    return retryProcessing(params);
  }
  
  // Log for investigation
  logger.error({ error, params }, "Invoice processing failed");
  throw error;
}
```

### 3. Result Validation

```typescript
function validateInvoiceData(invoice: ExtractedInvoice): boolean {
  const required = [
    invoice.totalAmount,
    invoice.currency,
    invoice.vendorName,
  ];

  if (required.some(field => !field)) {
    logger.warn("Incomplete invoice extraction", { invoice });
    return false;
  }

  // Validate amount is reasonable
  if (invoice.totalAmount < 0 || invoice.totalAmount > 1000000) {
    logger.warn("Suspicious amount", { amount: invoice.totalAmount });
    return false;
  }

  return true;
}
```

### 4. Performance Optimization

```typescript
// Cache processed documents
async function processWithCache(documentUrl: string) {
  const cacheKey = `doc:processed:${hashUrl(documentUrl)}`;
  
  // Check cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Process document
  const result = await invoiceProcessor.processDocument({ documentUrl });

  // Cache for 1 hour
  await cache.set(cacheKey, result, 3600);

  return result;
}
```

### 5. User Feedback Loop

```typescript
// Allow users to correct extraction errors
interface CorrectionFeedback {
  documentUrl: string;
  extractedData: ExtractedInvoice;
  correctedData: Partial<ExtractedInvoice>;
  userId: string;
}

async function submitCorrection(feedback: CorrectionFeedback) {
  // Store corrections for model fine-tuning
  await db`
    INSERT INTO document_corrections (
      document_url, extracted_data, corrected_data, user_id, created_at
    ) VALUES (
      ${feedback.documentUrl},
      ${JSON.stringify(feedback.extractedData)},
      ${JSON.stringify(feedback.correctedData)},
      ${feedback.userId},
      NOW()
    )
  `;

  // Invalidate cache
  await cache.del(`doc:processed:${hashUrl(feedback.documentUrl)}`);
}
```

---

## Retry Logic

Document processing može falovati zbog različitih razloga. Implementiran je retry mehanizam:

```typescript
async function retryCall<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Attempt ${attempt} failed: ${lastError.message}`);

      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, delayMs * attempt)
        );
      }
    }
  }

  throw lastError;
}

// Usage
const result = await retryCall(
  () => generateObject({ /* ... */ }),
  3,  // max 3 attempts
  1000 // 1 second initial delay
);
```

---

## Cost Optimization

### 1. Batch Processing

```typescript
async function processBatch(urls: string[], batchSize = 5) {
  const results = [];

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    
    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(url => invoiceProcessor.processDocument({ documentUrl: url }))
    );

    results.push(...batchResults);

    // Small delay between batches to avoid rate limits
    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}
```

### 2. Model Selection

```typescript
// Use smaller model for simple receipts
model: mistral("mistral-small-latest")  // Cheaper

// Use medium model for complex invoices
model: mistral("mistral-medium-latest")  // More accurate
```

### 3. Caching Strategy

```typescript
// Cache processed documents for 24 hours
const CACHE_TTL = 24 * 60 * 60;

// Don't reprocess same document multiple times
const hash = hashDocumentUrl(url);
const cached = await redis.get(`doc:${hash}`);

if (cached) {
  return JSON.parse(cached);
}
```

---

## Monitoring

### Track Processing Success Rate

```typescript
async function processWithMetrics(documentUrl: string) {
  const startTime = Date.now();

  try {
    const result = await invoiceProcessor.processDocument({ documentUrl });
    
    const duration = Date.now() - startTime;
    
    // Track success
    await metrics.track("document_processing_success", {
      type: "invoice",
      duration,
      fields_extracted: Object.keys(result).filter(k => result[k] !== null).length,
    });

    return result;
  } catch (error) {
    // Track failure
    await metrics.track("document_processing_failure", {
      type: "invoice",
      error: error.message,
      duration: Date.now() - startTime,
    });

    throw error;
  }
}
```

---

## Troubleshooting

### Common Issues

**Problem**: "Missing critical fields"  
**Rešenje**: 
- Proveri kvalitet PDF-a
- OCR fallback će se automatski aktivirati
- Koristi `companyName` param za bolju identifikaciju

**Problem**: Timeout errors  
**Rešenje**:
- Smanji `documentPageLimit` u Mistral options
- Povećaj `abortSignal` timeout
- Split large PDFs

**Problem**: Incorrect amounts  
**Rešenje**:
- Proveri da li PDF ima machine-readable text
- OCR može pogresno pročitati brojeve
- Implementiraj user correction flow

**Problem**: Wrong vendor/customer  
**Rešenje**:
- Prosleđuj `companyName` u request
- Mistral će koristiti to za razlikovanje

---

## Advanced Usage

### Custom Prompt Engineering

```typescript
import { createInvoicePrompt } from "@crm/documents";

// Customize extraction prompt
const customPrompt = `${createInvoicePrompt("My Company")}

Additional instructions:
- Focus on line items accuracy
- Extract all tax breakdowns
- Include payment method if available
`;

const result = await generateObject({
  model: mistral("mistral-small-latest"),
  schema: invoiceSchema,
  messages: [
    { role: "system", content: customPrompt },
    { role: "user", content: [{ type: "file", data: url }] },
  ],
});
```

### Structured Output Validation

```typescript
import { invoiceSchema } from "@crm/documents";

// Validate extraction result
const validationResult = invoiceSchema.safeParse(extractedData);

if (!validationResult.success) {
  logger.error("Invalid extraction result", {
    errors: validationResult.error.errors,
    data: extractedData,
  });
  
  // Handle validation errors
  throw new Error("Extraction validation failed");
}

const validatedInvoice = validationResult.data;
```

---

## Production Checklist

- [ ] Configure `MISTRAL_API_KEY` environment variable
- [ ] Set up file upload storage (S3, local, etc.)
- [ ] Implement URL signing for secure document access
- [ ] Enable Redis caching for processed documents
- [ ] Set up monitoring for success/failure rates
- [ ] Implement user correction feedback loop
- [ ] Add rate limiting for batch processing
- [ ] Configure timeout limits based on PDF complexity
- [ ] Test with various document formats and qualities
- [ ] Set up alerts for high failure rates

---

## Resources

- [Mistral AI Documentation](https://docs.mistral.ai/)
- [unpdf Library](https://github.com/unjs/unpdf)
- [PDF Processing Best Practices](https://docs.mistral.ai/capabilities/vision/)

---

**Last Updated**: 2024-12-02  
**Version**: 1.0.0

