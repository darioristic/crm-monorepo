/**
 * Transaction Enrichment Service
 * Auto-categorizes transactions, detects merchants, and enriches transaction data
 * Uses pattern matching and AI embeddings for smart categorization
 */

import { serviceLogger } from "../lib/logger";
import { sql as db } from "../db/client";
import { aiService } from "./ai.service";
import * as transactionCategoryQueries from "../db/queries/transaction-categories";

// ==============================================
// TYPES
// ==============================================

export interface EnrichmentResult {
  categorySlug: string | null;
  categoryConfidence: number;
  merchantName: string | null;
  vendorName: string | null;
  isRecurring: boolean;
  frequency: TransactionFrequency | null;
  taxInfo: TaxInfo | null;
  enrichedAt: string;
}

export interface TaxInfo {
  taxAmount: number | null;
  taxRate: number | null;
  taxType: string | null;
}

export type TransactionFrequency = "weekly" | "biweekly" | "monthly" | "annually" | "unknown";

export interface TransactionToEnrich {
  id: string;
  tenantId: string;
  amount: number;
  currency: string;
  description: string | null;
  notes: string | null;
  reference: string | null;
  paymentDate: string;
}

interface MerchantPattern {
  pattern: RegExp;
  merchantName: string | null;
  categorySlug: string;
  isRecurring?: boolean;
  frequency?: TransactionFrequency;
}

interface CategoryKeyword {
  keyword: string;
  categorySlug: string;
  weight: number;
}

// ==============================================
// MERCHANT PATTERNS
// ==============================================

/**
 * Known merchant patterns for auto-detection
 * Order matters - first match wins
 */
const MERCHANT_PATTERNS: MerchantPattern[] = [
  // Software & Subscriptions
  { pattern: /github/i, merchantName: "GitHub", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /gitlab/i, merchantName: "GitLab", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /netlify/i, merchantName: "Netlify", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /vercel/i, merchantName: "Vercel", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /heroku/i, merchantName: "Heroku", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /aws|amazon\s*web/i, merchantName: "Amazon Web Services", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /google\s*cloud|gcp/i, merchantName: "Google Cloud Platform", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /azure|microsoft\s*azure/i, merchantName: "Microsoft Azure", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /digitalocean/i, merchantName: "DigitalOcean", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /slack/i, merchantName: "Slack", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /notion/i, merchantName: "Notion", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /figma/i, merchantName: "Figma", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /adobe|creative\s*cloud/i, merchantName: "Adobe", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /jetbrains/i, merchantName: "JetBrains", categorySlug: "software", isRecurring: true, frequency: "annually" },
  { pattern: /zoom/i, merchantName: "Zoom", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /dropbox/i, merchantName: "Dropbox", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /1password/i, merchantName: "1Password", categorySlug: "software", isRecurring: true, frequency: "annually" },
  { pattern: /lastpass/i, merchantName: "LastPass", categorySlug: "software", isRecurring: true, frequency: "annually" },
  { pattern: /mailchimp/i, merchantName: "Mailchimp", categorySlug: "marketing", isRecurring: true, frequency: "monthly" },
  { pattern: /sendgrid/i, merchantName: "SendGrid", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /stripe/i, merchantName: "Stripe", categorySlug: "bank-fees", isRecurring: true, frequency: "monthly" },
  { pattern: /twilio/i, merchantName: "Twilio", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /intercom/i, merchantName: "Intercom", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /zendesk/i, merchantName: "Zendesk", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /hubspot/i, merchantName: "HubSpot", categorySlug: "software", isRecurring: true, frequency: "monthly" },
  { pattern: /salesforce/i, merchantName: "Salesforce", categorySlug: "software", isRecurring: true, frequency: "monthly" },

  // Office Supplies
  { pattern: /amazon(?!\s*web)/i, merchantName: "Amazon", categorySlug: "office-supplies" },
  { pattern: /staples/i, merchantName: "Staples", categorySlug: "office-supplies" },
  { pattern: /office\s*depot/i, merchantName: "Office Depot", categorySlug: "office-supplies" },
  { pattern: /ikea/i, merchantName: "IKEA", categorySlug: "office-supplies" },

  // Travel
  { pattern: /booking\.com/i, merchantName: "Booking.com", categorySlug: "travel" },
  { pattern: /airbnb/i, merchantName: "Airbnb", categorySlug: "travel" },
  { pattern: /expedia/i, merchantName: "Expedia", categorySlug: "travel" },
  { pattern: /uber/i, merchantName: "Uber", categorySlug: "travel" },
  { pattern: /lyft/i, merchantName: "Lyft", categorySlug: "travel" },
  { pattern: /bolt/i, merchantName: "Bolt", categorySlug: "travel" },
  { pattern: /airline|airways|air\s*serbia/i, merchantName: null, categorySlug: "travel" },
  { pattern: /hotel|marriott|hilton|hyatt/i, merchantName: null, categorySlug: "travel" },

  // Utilities
  { pattern: /elektroprivreda|eps/i, merchantName: "EPS", categorySlug: "utilities" },
  { pattern: /telekom|sbb|supernova|a1\s*srbija/i, merchantName: null, categorySlug: "utilities" },
  { pattern: /electric|electricity|power/i, merchantName: null, categorySlug: "utilities" },
  { pattern: /water|vodovod/i, merchantName: null, categorySlug: "utilities" },
  { pattern: /internet|broadband/i, merchantName: null, categorySlug: "utilities" },

  // Marketing
  { pattern: /facebook|meta\s*ads/i, merchantName: "Meta (Facebook)", categorySlug: "marketing" },
  { pattern: /google\s*ads|adwords/i, merchantName: "Google Ads", categorySlug: "marketing" },
  { pattern: /linkedin\s*ads/i, merchantName: "LinkedIn Ads", categorySlug: "marketing" },
  { pattern: /twitter|x\.com\s*ads/i, merchantName: "X (Twitter) Ads", categorySlug: "marketing" },

  // Bank Fees
  { pattern: /bank\s*fee|service\s*charge|monthly\s*fee/i, merchantName: null, categorySlug: "bank-fees" },
  { pattern: /atm\s*fee|withdrawal\s*fee/i, merchantName: null, categorySlug: "bank-fees" },
  { pattern: /wire\s*transfer|swift/i, merchantName: null, categorySlug: "bank-fees" },
  { pattern: /paypal\s*fee/i, merchantName: "PayPal", categorySlug: "bank-fees" },

  // Insurance
  { pattern: /insurance|osiguranje|dunav|generali|ddor|triglav/i, merchantName: null, categorySlug: "insurance" },

  // Professional Services
  { pattern: /legal|law\s*firm|attorney|advokat/i, merchantName: null, categorySlug: "professional-services" },
  { pattern: /accounting|bookkeeping|računovodstvo/i, merchantName: null, categorySlug: "professional-services" },
  { pattern: /consulting|consultant|konsulting/i, merchantName: null, categorySlug: "professional-services" },

  // Taxes
  { pattern: /poreska|tax\s*payment|porez/i, merchantName: "Tax Authority", categorySlug: "taxes" },
  { pattern: /pdv|vat\s*payment/i, merchantName: null, categorySlug: "taxes" },
];

// ==============================================
// CATEGORY KEYWORDS
// ==============================================

/**
 * Keywords for category detection with weights
 */
const CATEGORY_KEYWORDS: CategoryKeyword[] = [
  // Income
  { keyword: "payment received", categorySlug: "income", weight: 0.9 },
  { keyword: "invoice payment", categorySlug: "income", weight: 0.9 },
  { keyword: "customer payment", categorySlug: "income", weight: 0.9 },
  { keyword: "sale", categorySlug: "sales", weight: 0.8 },
  { keyword: "refund received", categorySlug: "refunds-received", weight: 0.9 },

  // Office
  { keyword: "office", categorySlug: "office-supplies", weight: 0.6 },
  { keyword: "supplies", categorySlug: "office-supplies", weight: 0.5 },
  { keyword: "equipment", categorySlug: "office-supplies", weight: 0.6 },
  { keyword: "furniture", categorySlug: "office-supplies", weight: 0.7 },

  // Software
  { keyword: "subscription", categorySlug: "software", weight: 0.7 },
  { keyword: "license", categorySlug: "software", weight: 0.7 },
  { keyword: "saas", categorySlug: "software", weight: 0.8 },
  { keyword: "hosting", categorySlug: "software", weight: 0.7 },
  { keyword: "domain", categorySlug: "software", weight: 0.6 },

  // Travel
  { keyword: "flight", categorySlug: "travel", weight: 0.9 },
  { keyword: "hotel", categorySlug: "travel", weight: 0.9 },
  { keyword: "accommodation", categorySlug: "travel", weight: 0.9 },
  { keyword: "taxi", categorySlug: "travel", weight: 0.8 },
  { keyword: "transport", categorySlug: "travel", weight: 0.6 },
  { keyword: "parking", categorySlug: "travel", weight: 0.7 },
  { keyword: "fuel", categorySlug: "travel", weight: 0.7 },
  { keyword: "gas station", categorySlug: "travel", weight: 0.8 },

  // Meals
  { keyword: "restaurant", categorySlug: "meals", weight: 0.9 },
  { keyword: "cafe", categorySlug: "meals", weight: 0.8 },
  { keyword: "lunch", categorySlug: "meals", weight: 0.8 },
  { keyword: "dinner", categorySlug: "meals", weight: 0.8 },
  { keyword: "catering", categorySlug: "meals", weight: 0.8 },

  // Rent
  { keyword: "rent", categorySlug: "rent", weight: 0.9 },
  { keyword: "lease", categorySlug: "rent", weight: 0.8 },
  { keyword: "zakup", categorySlug: "rent", weight: 0.9 },

  // Salaries
  { keyword: "salary", categorySlug: "salaries", weight: 0.9 },
  { keyword: "payroll", categorySlug: "salaries", weight: 0.9 },
  { keyword: "wage", categorySlug: "salaries", weight: 0.9 },
  { keyword: "bonus", categorySlug: "salaries", weight: 0.7 },
  { keyword: "plata", categorySlug: "salaries", weight: 0.9 },

  // Marketing
  { keyword: "advertising", categorySlug: "marketing", weight: 0.9 },
  { keyword: "ads", categorySlug: "marketing", weight: 0.7 },
  { keyword: "campaign", categorySlug: "marketing", weight: 0.6 },
  { keyword: "promotion", categorySlug: "marketing", weight: 0.7 },
  { keyword: "reklama", categorySlug: "marketing", weight: 0.9 },

  // Insurance
  { keyword: "insurance", categorySlug: "insurance", weight: 0.9 },
  { keyword: "premium", categorySlug: "insurance", weight: 0.5 },
  { keyword: "osiguranje", categorySlug: "insurance", weight: 0.9 },

  // Taxes
  { keyword: "tax", categorySlug: "taxes", weight: 0.7 },
  { keyword: "porez", categorySlug: "taxes", weight: 0.9 },
  { keyword: "pdv", categorySlug: "taxes", weight: 0.9 },
  { keyword: "vat", categorySlug: "taxes", weight: 0.8 },
];

// ==============================================
// ENRICHMENT FUNCTIONS
// ==============================================

/**
 * Detect merchant from transaction text
 */
function detectMerchant(text: string): { merchantName: string | null; categorySlug: string | null; isRecurring: boolean; frequency: TransactionFrequency | null } {
  for (const pattern of MERCHANT_PATTERNS) {
    if (pattern.pattern.test(text)) {
      return {
        merchantName: pattern.merchantName,
        categorySlug: pattern.categorySlug,
        isRecurring: pattern.isRecurring || false,
        frequency: pattern.frequency || null,
      };
    }
  }

  return {
    merchantName: null,
    categorySlug: null,
    isRecurring: false,
    frequency: null,
  };
}

/**
 * Detect category from keywords
 */
function detectCategoryFromKeywords(text: string): { categorySlug: string | null; confidence: number } {
  const lowerText = text.toLowerCase();
  const scores: Record<string, number> = {};

  for (const { keyword, categorySlug, weight } of CATEGORY_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      scores[categorySlug] = (scores[categorySlug] || 0) + weight;
    }
  }

  // Find best match
  let bestCategory: string | null = null;
  let bestScore = 0;

  for (const [category, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  // Normalize confidence to 0-1 range
  const confidence = Math.min(bestScore / 2, 1);

  return {
    categorySlug: bestCategory,
    confidence,
  };
}

/**
 * Extract vendor name from transaction text
 */
function extractVendorName(text: string): string | null {
  if (!text) return null;

  // Common patterns for vendor extraction
  const patterns = [
    /(?:from|od|za|payee|beneficiary)[:\s]+([A-Za-z0-9\s&.,'-]+?)(?:\s+(?:d\.?o\.?o\.?|ltd|inc|gmbh|llc|corp))?(?:\s|$|,)/i,
    /(?:payment\s+to|transfer\s+to|uplata\s+za)[:\s]+([A-Za-z0-9\s&.,'-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Filter out generic/too short names
      if (name.length > 2 && !["the", "and", "for"].includes(name.toLowerCase())) {
        return name;
      }
    }
  }

  return null;
}

/**
 * Extract tax information from amount and text
 */
function extractTaxInfo(amount: number, text: string): TaxInfo | null {
  const lowerText = text.toLowerCase();

  // Check for VAT/PDV mentions
  const vatMatch = lowerText.match(/(\d+)\s*%\s*(?:pdv|vat|tax)/i)
    || lowerText.match(/(?:pdv|vat|tax)\s*(\d+)\s*%/i);

  if (vatMatch) {
    const taxRate = parseInt(vatMatch[1], 10);
    if (taxRate > 0 && taxRate <= 100) {
      const taxAmount = amount * (taxRate / (100 + taxRate));
      return {
        taxRate,
        taxAmount: Math.round(taxAmount * 100) / 100,
        taxType: "VAT",
      };
    }
  }

  // Default VAT rate check (20% is common)
  if (lowerText.includes("pdv") || lowerText.includes("vat")) {
    const taxRate = 20;
    const taxAmount = amount * (taxRate / (100 + taxRate));
    return {
      taxRate,
      taxAmount: Math.round(taxAmount * 100) / 100,
      taxType: "VAT",
    };
  }

  return null;
}

// ==============================================
// MAIN ENRICHMENT SERVICE
// ==============================================

/**
 * Enrich a single transaction
 */
export async function enrichTransaction(
  transaction: TransactionToEnrich,
  options?: {
    useAI?: boolean;
  }
): Promise<EnrichmentResult> {
  const startTime = Date.now();
  const text = [
    transaction.description,
    transaction.notes,
    transaction.reference,
  ].filter(Boolean).join(" ");

  serviceLogger.info({ transactionId: transaction.id }, "Enriching transaction");

  // Step 1: Try merchant pattern detection
  const merchantResult = detectMerchant(text);

  // Step 2: Try keyword-based category detection
  const keywordResult = detectCategoryFromKeywords(text);

  // Step 3: Extract vendor name if not from merchant
  const vendorName = merchantResult.merchantName
    ? null
    : extractVendorName(text);

  // Step 4: Extract tax info
  const taxInfo = extractTaxInfo(transaction.amount, text);

  // Determine best category
  let finalCategory: string | null = null;
  let confidence = 0;

  if (merchantResult.categorySlug) {
    finalCategory = merchantResult.categorySlug;
    confidence = 0.9; // High confidence for known merchants
  } else if (keywordResult.categorySlug && keywordResult.confidence > 0.5) {
    finalCategory = keywordResult.categorySlug;
    confidence = keywordResult.confidence;
  }

  // Step 5: AI categorization as fallback (if enabled and no good match)
  if (options?.useAI && !finalCategory && text.length > 10) {
    try {
      const categories = await transactionCategoryQueries.getCategories(transaction.tenantId);
      const aiResult = await categorizeWithAI(text, categories);
      if (aiResult && aiResult.confidence > 0.6) {
        finalCategory = aiResult.categorySlug;
        confidence = aiResult.confidence;
      }
    } catch (error) {
      serviceLogger.warn({ error }, "AI categorization failed, using fallback");
    }
  }

  // Default to "other" if no category found
  if (!finalCategory) {
    finalCategory = "other";
    confidence = 0.3;
  }

  const result: EnrichmentResult = {
    categorySlug: finalCategory,
    categoryConfidence: confidence,
    merchantName: merchantResult.merchantName,
    vendorName: vendorName || merchantResult.merchantName,
    isRecurring: merchantResult.isRecurring,
    frequency: merchantResult.frequency,
    taxInfo,
    enrichedAt: new Date().toISOString(),
  };

  serviceLogger.info(
    {
      transactionId: transaction.id,
      category: finalCategory,
      confidence,
      processingTimeMs: Date.now() - startTime,
    },
    "Transaction enriched"
  );

  return result;
}

/**
 * Use AI to categorize transaction
 */
async function categorizeWithAI(
  text: string,
  categories: transactionCategoryQueries.TransactionCategory[]
): Promise<{ categorySlug: string; confidence: number } | null> {
  try {
    const categoryList = categories
      .map(c => `${c.slug}: ${c.name}${c.description ? ` - ${c.description}` : ""}`)
      .join("\n");

    const result = await aiService.generateText({
      prompt: `Categorize this transaction into one of the categories below. Return ONLY the category slug.

Transaction: ${text}

Categories:
${categoryList}

Category slug:`,
      maxTokens: 50,
    });

    const suggestedSlug = result.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    const matchedCategory = categories.find(c => c.slug === suggestedSlug);

    if (matchedCategory) {
      return {
        categorySlug: matchedCategory.slug,
        confidence: 0.7,
      };
    }

    return null;
  } catch (error) {
    serviceLogger.error({ error }, "AI categorization error");
    return null;
  }
}

/**
 * Enrich and update a payment in the database
 */
export async function enrichAndUpdatePayment(
  paymentId: string,
  tenantId: string,
  options?: { useAI?: boolean }
): Promise<EnrichmentResult | null> {
  try {
    // Fetch payment data
    const paymentResult = await db`
      SELECT
        p.id,
        p.amount,
        p.currency,
        p.notes as description,
        p.notes,
        p.reference,
        p.payment_date as "paymentDate",
        i.tenant_id as "tenantId"
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      WHERE p.id = ${paymentId} AND i.tenant_id = ${tenantId}
    `;

    if (paymentResult.length === 0) {
      serviceLogger.warn({ paymentId }, "Payment not found for enrichment");
      return null;
    }

    const payment = paymentResult[0];
    const transaction: TransactionToEnrich = {
      id: payment.id as string,
      tenantId: tenantId,
      amount: parseFloat(payment.amount as string) || 0,
      currency: payment.currency as string,
      description: payment.description as string | null,
      notes: payment.notes as string | null,
      reference: payment.reference as string | null,
      paymentDate: (payment.paymentDate as Date).toISOString(),
    };

    // Enrich the transaction
    const enrichment = await enrichTransaction(transaction, options);

    // Update payment with enrichment data
    await db`
      UPDATE payments SET
        category_slug = ${enrichment.categorySlug},
        merchant_name = ${enrichment.merchantName},
        vendor_name = ${enrichment.vendorName},
        is_recurring = ${enrichment.isRecurring},
        frequency = ${enrichment.frequency}::transaction_frequency,
        tax_amount = ${enrichment.taxInfo?.taxAmount ?? null},
        tax_rate = ${enrichment.taxInfo?.taxRate ?? null},
        tax_type = ${enrichment.taxInfo?.taxType ?? null},
        enrichment_completed = true,
        updated_at = NOW()
      WHERE id = ${paymentId}
    `;

    serviceLogger.info({ paymentId, enrichment }, "Payment enriched and updated");
    return enrichment;
  } catch (error) {
    serviceLogger.error({ error, paymentId }, "Failed to enrich payment");
    throw error;
  }
}

/**
 * Batch enrich multiple payments
 */
export async function batchEnrichPayments(
  tenantId: string,
  options?: {
    useAI?: boolean;
    limit?: number;
    onlyUnenriched?: boolean;
  }
): Promise<{ processed: number; enriched: number; errors: number }> {
  const limit = options?.limit || 100;
  const onlyUnenriched = options?.onlyUnenriched !== false;

  const whereClause = onlyUnenriched
    ? db`AND (p.enrichment_completed = false OR p.enrichment_completed IS NULL)`
    : db``;

  const payments = await db`
    SELECT p.id
    FROM payments p
    LEFT JOIN invoices i ON p.invoice_id = i.id
    WHERE i.tenant_id = ${tenantId} ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `;

  let processed = 0;
  let enriched = 0;
  let errors = 0;

  for (const payment of payments) {
    try {
      await enrichAndUpdatePayment(payment.id as string, tenantId, options);
      enriched++;
    } catch (error) {
      serviceLogger.error({ error, paymentId: payment.id }, "Batch enrichment error");
      errors++;
    }
    processed++;
  }

  serviceLogger.info(
    { tenantId, processed, enriched, errors },
    "Batch enrichment completed"
  );

  return { processed, enriched, errors };
}

/**
 * Get enrichment suggestions for a transaction text
 */
export async function getEnrichmentSuggestions(
  text: string,
  tenantId: string
): Promise<{
  categories: Array<{ slug: string; name: string; confidence: number }>;
  merchant: string | null;
  isRecurring: boolean;
}> {
  const merchantResult = detectMerchant(text);
  const keywordResult = detectCategoryFromKeywords(text);

  // Get all categories for tenant
  const allCategories = await transactionCategoryQueries.getCategories(tenantId);

  // Build suggestions list
  const suggestions: Array<{ slug: string; name: string; confidence: number }> = [];

  if (merchantResult.categorySlug) {
    const cat = allCategories.find(c => c.slug === merchantResult.categorySlug);
    if (cat) {
      suggestions.push({ slug: cat.slug, name: cat.name, confidence: 0.9 });
    }
  }

  if (keywordResult.categorySlug && keywordResult.confidence > 0.3) {
    const cat = allCategories.find(c => c.slug === keywordResult.categorySlug);
    if (cat && !suggestions.find(s => s.slug === cat.slug)) {
      suggestions.push({ slug: cat.slug, name: cat.name, confidence: keywordResult.confidence });
    }
  }

  // Add "other" as fallback
  if (suggestions.length === 0) {
    const other = allCategories.find(c => c.slug === "other");
    if (other) {
      suggestions.push({ slug: other.slug, name: other.name, confidence: 0.3 });
    }
  }

  return {
    categories: suggestions.sort((a, b) => b.confidence - a.confidence),
    merchant: merchantResult.merchantName,
    isRecurring: merchantResult.isRecurring,
  };
}

export default {
  enrichTransaction,
  enrichAndUpdatePayment,
  batchEnrichPayments,
  getEnrichmentSuggestions,
  detectMerchant,
  detectCategoryFromKeywords,
};
