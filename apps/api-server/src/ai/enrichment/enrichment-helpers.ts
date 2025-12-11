/**
 * Transaction Enrichment Helpers
 *
 * Functions for preparing transaction data and generating prompts for AI enrichment.
 * Based on Midday's implementation with legal entity name extraction.
 */

import type {
  EnrichmentResult,
  TransactionData,
  UpdateData,
} from "./enrichment-schema";
import {
  isValidCategory,
  shouldUseCategoryResult,
  shouldUseMerchantResult,
  transactionCategories,
} from "./enrichment-schema";

/**
 * Transaction record from database
 */
export interface TransactionForEnrichment {
  id: string;
  description: string | null;
  notes: string | null;
  reference: string | null;
  amount: number;
  currency: string;
  merchantName: string | null;
  vendorName: string | null;
  categorySlug: string | null;
}

/**
 * Generates the enrichment prompt for the LLM.
 * Uses a sophisticated prompt for legal entity name extraction and categorization.
 */
export function generateEnrichmentPrompt(
  transactionData: TransactionData[],
  batch: TransactionForEnrichment[]
): string {
  const transactionList = transactionData
    .map((tx, index) => {
      const transaction = batch[index];
      const hasExistingMerchant = transaction?.merchantName;
      const hasExistingVendor = transaction?.vendorName;

      let line = `${index + 1}. Description: "${tx.description}", Amount: ${tx.amount}, Currency: ${tx.currency}`;

      if (hasExistingMerchant) {
        line += ` (Current Merchant: ${transaction.merchantName})`;
      } else if (hasExistingVendor) {
        line += ` (Vendor: ${transaction.vendorName})`;
      }

      return line;
    })
    .join("\n");

  const needsCategories = batch.some((tx) => !tx.categorySlug);

  let returnInstructions = "Return:\n";
  if (needsCategories) {
    returnInstructions += "1. Legal entity name: Apply the transformation rules above\n";
    returnInstructions += "2. Category: Select the best-fit category from the allowed list\n";
  } else {
    returnInstructions += "Legal entity name: Apply the transformation rules above\n";
  }

  const categorySection = needsCategories
    ? `
CATEGORIZATION RULES:
Assign categories based on merchant name and business purpose. Only return category if confidence >= 0.7, otherwise return null.

CONFIDENCE EXAMPLES:
• "Slack Technologies" → software (0.95) ✅
• "Delta Air Lines" → travel (0.95) ✅
• "ConEd Electric" → utilities (0.90) ✅
• "ABC Corp payment" → null (0.4) ❌ Too uncertain

COMMON CATEGORIES (only use if confident):
• software: SaaS tools (Slack, Google Workspace, GitHub, AWS, Azure)
• travel: Business trips (airlines, hotels, Uber, Bolt)
• meals: Business dining (restaurants, catering)
• office-supplies: Stationery, consumables
• equipment: Computers, furniture, tools >$500
• utilities: Electric, water, gas, internet bills
• rent: Office space, co-working
• marketing: Marketing services, SEO, agencies
• advertising: Ad platforms (Google Ads, Facebook Ads)
• insurance: Business insurance premiums
• professional-services: Legal, accounting, consulting
• contractors: Freelancer payments
• bank-fees: Bank charges, processing fees
• taxes: Tax payments, VAT/PDV
• salaries: Payroll, wages
• training: Courses, certifications
• shipping: Shipping and delivery costs
• internet-and-telephone: ISP, phone bills
• income: Payment received, revenue
• sales: Product/service sales
• refunds-received: Refunds from vendors
• uncategorized: Use when uncertain
• other: Miscellaneous

RULES:
1. Only categorize if confidence >= 0.7
2. When uncertain, return null for category
3. Focus on merchant name for clues
4. Consider business context and amount
`
    : "";

  return `You are a legal entity identification system for business expense transactions, specializing in global companies including US, EU, and Balkan region (Serbia, Croatia, Slovenia, Bosnia).

TASK: For EVERY transaction, identify the formal legal business entity name with proper entity suffixes.

INPUT HIERARCHY (use in this priority order):
1. "Current Merchant": Existing name from provider → enhance to legal entity
2. "Vendor": Known vendor name → identify legal entity
3. "Raw": Transaction description → extract legal entity

GLOBAL TECH COMPANIES - ALWAYS USE THESE EXACT NAMES:
✓ "Anthropic" / "ANTHROPIC" → "Anthropic Inc"
✓ "Google" / "Google Pay" / "GOOGLE*" → "Google LLC"
✓ "AMZN" / "AMAZON" / "AMZN MKTP" → "Amazon.com Inc"
✓ "AWS" / "Amazon Web Services" → "Amazon Web Services Inc"
✓ "Starbucks" / "STARBUCKS #1234" → "Starbucks Corporation"
✓ "MSFT" / "Microsoft" / "MSFT*Office365" → "Microsoft Corporation"
✓ "Apple" / "APPLE STORE" / "Apple.com" → "Apple Inc"
✓ "GitHub" / "GITHUB" → "GitHub Inc"
✓ "Slack" / "SLACK*" → "Slack Technologies Inc"
✓ "Notion" / "NOTION" → "Notion Labs Inc"
✓ "Figma" / "FIGMA" → "Figma Inc"
✓ "Zoom" / "ZOOM.US" → "Zoom Video Communications Inc"
✓ "Dropbox" / "DROPBOX" → "Dropbox Inc"
✓ "Atlassian" / "JIRA" / "CONFLUENCE" → "Atlassian Corporation"
✓ "Adobe" / "ADOBE*" → "Adobe Inc"
✓ "Spotify" / "SPOTIFY" → "Spotify AB"
✓ "Netflix" / "NETFLIX" → "Netflix Inc"
✓ "Uber" / "UBER*" → "Uber Technologies Inc"
✓ "Bolt" / "BOLT" → "Bolt Technology OÜ"
✓ "OpenAI" / "OPENAI" → "OpenAI Inc"
✓ "Vercel" / "VERCEL" → "Vercel Inc"
✓ "Railway" → "Railway Corporation"
✓ "DigitalOcean" / "DIGITALOCEAN" → "DigitalOcean LLC"
✓ "Cloudflare" / "CLOUDFLARE" → "Cloudflare Inc"
✓ "Stripe" / "STRIPE*" → "Stripe Inc"
✓ "PayPal" / "PAYPAL*" → "PayPal Holdings Inc"
✓ "LinkedIn" / "LINKEDIN" → "LinkedIn Corporation"

BALKAN REGION COMPANIES (Serbia, Croatia, Slovenia, Bosnia):
- Use "d.o.o." for limited liability companies (društvo s ograničenom odgovornošću)
- Use "d.d." for joint stock companies (dioničko društvo)
- Use "s.p." for sole proprietors (samostalni poduzetnik)
✓ "TELEKOM SRBIJA" → "Telekom Srbija a.d."
✓ "HEP" → "Hrvatska elektroprivreda d.d."
✓ "INA" → "INA d.d."
✓ "KONZUM" → "Konzum d.d."
✓ "LIDL HR" / "LIDL RS" → "Lidl Hrvatska d.o.o." / "Lidl Srbija d.o.o."
✓ "DM DROGERIE" → "dm-drogerie markt d.o.o."
✓ "GLOVO" → "Glovoapp Technology d.o.o."
✓ "WOLT" → "Wolt Hrvatska d.o.o." / "Wolt Srbija d.o.o."

EUROPEAN COMPANIES:
- Germany: GmbH (limited), AG (joint stock)
- Austria: GmbH, AG
- France: S.A., S.A.R.L.
- Italy: S.r.l., S.p.A.
- Netherlands: B.V., N.V.

REQUIREMENTS:
- ALWAYS use official legal entity suffixes: Inc, LLC, Corp, Ltd, Co, d.o.o., d.d., GmbH, AG, etc.
- Prefer parent company's legal entity (Google LLC, not Google Pay LLC)
- Remove location codes, store numbers (#1234), transaction IDs, and timestamps
- Clean up ALL CAPS to proper capitalization
- If genuinely unknown, provide best cleaned/capitalized version available

CONFIDENCE SCORING:
- categoryConfidence: Rate your confidence in the category assignment (0-1)
  • 1.0 = Very certain (e.g., "Slack" → software)
  • 0.8 = Quite confident (e.g., "Hotel booking" → travel)
  • 0.5 = Unsure (e.g., ambiguous merchant)
  • 0.2 = Very uncertain
- merchantConfidence: Rate your confidence in the merchant name (0-1)
  • 1.0 = Official company name found
  • 0.8 = Strong match with known entity
  • 0.5 = Best guess from available info
  • 0.2 = Very uncertain
- Only return category if confidence >= 0.7, otherwise return null
${categorySection}

${returnInstructions}

Transactions to process:
${transactionList}

Return exactly ${batch.length} results in order. Apply the transformation rules consistently.`;
}

/**
 * Prepares transaction data for LLM processing.
 * Combines available information into a comprehensive description.
 */
export function prepareTransactionData(batch: TransactionForEnrichment[]): TransactionData[] {
  return batch.map((tx) => {
    const parts: string[] = [];

    // Add vendor/merchant name if available
    if (tx.vendorName) {
      parts.push(`Vendor: ${tx.vendorName}`);
    }

    // Add description if available and different from vendor
    if (tx.description && tx.description !== tx.vendorName) {
      parts.push(`Raw: ${tx.description}`);
    }

    // Add notes if available and different
    if (tx.notes && tx.notes !== tx.description && tx.notes !== tx.vendorName) {
      parts.push(`Notes: ${tx.notes}`);
    }

    // Add reference if available
    if (tx.reference && tx.reference !== tx.description) {
      parts.push(`Ref: ${tx.reference}`);
    }

    // Fallback to description or notes
    const description =
      parts.length > 0 ? parts.join(" | ") : tx.description || tx.notes || "Unknown transaction";

    return {
      description,
      amount: Math.abs(tx.amount).toString(),
      currency: tx.currency || "EUR",
    };
  });
}

/**
 * Prepares update data from enrichment result.
 * Only includes fields that meet confidence thresholds.
 */
export function prepareUpdateData(
  transaction: Pick<TransactionForEnrichment, "categorySlug" | "merchantName" | "amount">,
  result: EnrichmentResult
): UpdateData {
  const updateData: UpdateData = {};

  // Only update merchantName if confidence is high enough
  if (shouldUseMerchantResult(result) && result.merchant) {
    updateData.merchantName = result.merchant;
  }

  // Category assignment logic (only for expenses - negative amounts)
  if (!transaction.categorySlug && transaction.amount <= 0) {
    if (
      shouldUseCategoryResult(result) &&
      result.category &&
      isValidCategory(result.category)
    ) {
      // High confidence: use the suggested category
      updateData.categorySlug = result.category;
    } else {
      // Low confidence or no category: mark as uncategorized to prevent reprocessing
      updateData.categorySlug = "uncategorized";
    }
  }

  return updateData;
}

/**
 * Splits an array into chunks of specified size
 */
export function chunks<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Process items in batches with a callback
 */
export async function processBatch<T, R>(
  items: T[],
  limit: number,
  fn: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];
  const batches = chunks(items, limit);

  for (const batch of batches) {
    const batchResults = await fn(batch);
    results.push(...batchResults);
  }

  return results;
}
