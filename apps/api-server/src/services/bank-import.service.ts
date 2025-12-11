/**
 * Bank Import Service
 * Imports bank statements from CSV files
 * Supports multiple bank formats and automatic column detection
 */

import { serviceLogger } from "../lib/logger";
import { sql as db } from "../db/client";
import { generateUUID } from "@crm/utils";

// ==============================================
// TYPES
// ==============================================

export interface BankImportConfig {
  bankName: string;
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;
  referenceColumn?: string;
  balanceColumn?: string;
  currencyColumn?: string;
  defaultCurrency: string;
  dateFormat: string;
  decimalSeparator: "." | ",";
  thousandSeparator?: "." | "," | " " | "";
  skipRows: number;
  hasHeader: boolean;
  negativeIsExpense: boolean;
}

export interface ParsedTransaction {
  date: Date;
  amount: number;
  currency: string;
  description: string;
  reference: string | null;
  balance: number | null;
  isExpense: boolean;
  rawData: Record<string, string>;
}

export interface ImportResult {
  totalRows: number;
  imported: number;
  duplicates: number;
  errors: number;
  errorDetails: string[];
  transactions: ParsedTransaction[];
}

export interface BankPreset {
  id: string;
  name: string;
  country: string;
  config: BankImportConfig;
}

// ==============================================
// BANK PRESETS
// ==============================================

export const BANK_PRESETS: BankPreset[] = [
  {
    id: "generic-csv",
    name: "Generic CSV",
    country: "International",
    config: {
      bankName: "Generic",
      dateColumn: "Date",
      amountColumn: "Amount",
      descriptionColumn: "Description",
      referenceColumn: "Reference",
      currencyColumn: "Currency",
      defaultCurrency: "EUR",
      dateFormat: "YYYY-MM-DD",
      decimalSeparator: ".",
      skipRows: 0,
      hasHeader: true,
      negativeIsExpense: true,
    },
  },
  {
    id: "raiffeisen-rs",
    name: "Raiffeisen Bank",
    country: "Serbia",
    config: {
      bankName: "Raiffeisen Bank RS",
      dateColumn: "Datum",
      amountColumn: "Iznos",
      descriptionColumn: "Opis",
      referenceColumn: "Poziv na broj",
      balanceColumn: "Stanje",
      defaultCurrency: "RSD",
      dateFormat: "DD.MM.YYYY",
      decimalSeparator: ",",
      thousandSeparator: ".",
      skipRows: 0,
      hasHeader: true,
      negativeIsExpense: true,
    },
  },
  {
    id: "intesa-rs",
    name: "Banca Intesa",
    country: "Serbia",
    config: {
      bankName: "Banca Intesa RS",
      dateColumn: "Datum valute",
      amountColumn: "Iznos",
      descriptionColumn: "Opis transakcije",
      referenceColumn: "Referentni broj",
      defaultCurrency: "RSD",
      dateFormat: "DD.MM.YYYY",
      decimalSeparator: ",",
      thousandSeparator: ".",
      skipRows: 0,
      hasHeader: true,
      negativeIsExpense: true,
    },
  },
  {
    id: "unicredit-rs",
    name: "UniCredit Bank",
    country: "Serbia",
    config: {
      bankName: "UniCredit Bank RS",
      dateColumn: "Datum",
      amountColumn: "Iznos",
      descriptionColumn: "Opis plaćanja",
      referenceColumn: "Poziv na broj odobrenja",
      defaultCurrency: "RSD",
      dateFormat: "DD.MM.YYYY",
      decimalSeparator: ",",
      thousandSeparator: ".",
      skipRows: 0,
      hasHeader: true,
      negativeIsExpense: true,
    },
  },
  {
    id: "revolut",
    name: "Revolut",
    country: "International",
    config: {
      bankName: "Revolut",
      dateColumn: "Completed Date",
      amountColumn: "Amount",
      descriptionColumn: "Description",
      referenceColumn: "Reference",
      currencyColumn: "Currency",
      balanceColumn: "Balance",
      defaultCurrency: "EUR",
      dateFormat: "YYYY-MM-DD",
      decimalSeparator: ".",
      skipRows: 0,
      hasHeader: true,
      negativeIsExpense: true,
    },
  },
  {
    id: "wise",
    name: "Wise (TransferWise)",
    country: "International",
    config: {
      bankName: "Wise",
      dateColumn: "Date",
      amountColumn: "Amount",
      descriptionColumn: "Description",
      referenceColumn: "TransferWise ID",
      currencyColumn: "Currency",
      defaultCurrency: "EUR",
      dateFormat: "DD-MM-YYYY",
      decimalSeparator: ".",
      skipRows: 0,
      hasHeader: true,
      negativeIsExpense: true,
    },
  },
  {
    id: "n26",
    name: "N26",
    country: "Germany",
    config: {
      bankName: "N26",
      dateColumn: "Date",
      amountColumn: "Amount (EUR)",
      descriptionColumn: "Payee",
      referenceColumn: "Transaction type",
      defaultCurrency: "EUR",
      dateFormat: "YYYY-MM-DD",
      decimalSeparator: ".",
      skipRows: 0,
      hasHeader: true,
      negativeIsExpense: true,
    },
  },
];

// ==============================================
// CSV PARSING
// ==============================================

/**
 * Parse CSV content into rows
 */
function parseCSV(content: string, delimiter: string = ","): string[][] {
  const rows: string[][] = [];
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        row.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Auto-detect CSV delimiter
 */
function detectDelimiter(content: string): string {
  const firstLine = content.split(/\r?\n/)[0] || "";
  const delimiters = [",", ";", "\t", "|"];

  let bestDelimiter = ",";
  let maxCount = 0;

  for (const delimiter of delimiters) {
    const count = (firstLine.match(new RegExp(delimiter === "\t" ? "\\t" : delimiter, "g")) || []).length;
    if (count > maxCount) {
      maxCount = count;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

/**
 * Parse date string according to format
 */
function parseDate(dateStr: string, format: string): Date | null {
  if (!dateStr) return null;

  const cleanDate = dateStr.trim();

  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(cleanDate)) {
    const parsed = new Date(cleanDate);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // Parse according to format
  let day: number, month: number, year: number;

  switch (format) {
    case "DD.MM.YYYY":
    case "DD/MM/YYYY": {
      const parts = cleanDate.split(/[./]/);
      if (parts.length >= 3) {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
      } else return null;
      break;
    }

    case "MM/DD/YYYY": {
      const parts = cleanDate.split("/");
      if (parts.length >= 3) {
        month = parseInt(parts[0], 10) - 1;
        day = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      } else return null;
      break;
    }

    case "YYYY-MM-DD":
    default: {
      const parts = cleanDate.split("-");
      if (parts.length >= 3) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else return null;
      break;
    }

    case "DD-MM-YYYY": {
      const parts = cleanDate.split("-");
      if (parts.length >= 3) {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
      } else return null;
      break;
    }
  }

  if (year < 100) year += 2000;

  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Parse amount string to number
 */
function parseAmount(
  amountStr: string,
  decimalSeparator: "." | ",",
  thousandSeparator?: "." | "," | " " | ""
): number | null {
  if (!amountStr) return null;

  let cleanAmount = amountStr.trim();

  // Remove currency symbols
  cleanAmount = cleanAmount.replace(/[€$£¥₽RSD\s]/gi, "");

  // Handle thousand separator
  if (thousandSeparator) {
    const thousandRegex = new RegExp("\\" + thousandSeparator, "g");
    cleanAmount = cleanAmount.replace(thousandRegex, "");
  }

  // Handle decimal separator
  if (decimalSeparator === ",") {
    cleanAmount = cleanAmount.replace(",", ".");
  }

  // Handle negative in parentheses
  if (cleanAmount.startsWith("(") && cleanAmount.endsWith(")")) {
    cleanAmount = "-" + cleanAmount.slice(1, -1);
  }

  const amount = parseFloat(cleanAmount);
  return isNaN(amount) ? null : amount;
}

// ==============================================
// IMPORT FUNCTIONS
// ==============================================

/**
 * Parse bank statement CSV
 */
export function parseBankStatement(
  csvContent: string,
  config: BankImportConfig
): ImportResult {
  const result: ImportResult = {
    totalRows: 0,
    imported: 0,
    duplicates: 0,
    errors: 0,
    errorDetails: [],
    transactions: [],
  };

  try {
    const delimiter = detectDelimiter(csvContent);
    const rows = parseCSV(csvContent, delimiter);

    if (rows.length === 0) {
      result.errorDetails.push("Empty CSV file");
      return result;
    }

    // Get header row
    let headers: string[] = [];
    let dataStartIndex = config.skipRows;

    if (config.hasHeader) {
      headers = rows[config.skipRows].map((h) => h.toLowerCase().trim());
      dataStartIndex++;
    }

    // Find column indices
    const findColumn = (name: string): number => {
      if (!name) return -1;
      const lowerName = name.toLowerCase();
      return headers.findIndex((h) => h.includes(lowerName) || lowerName.includes(h));
    };

    const dateCol = findColumn(config.dateColumn);
    const amountCol = findColumn(config.amountColumn);
    const descCol = findColumn(config.descriptionColumn);
    const refCol = config.referenceColumn ? findColumn(config.referenceColumn) : -1;
    const balanceCol = config.balanceColumn ? findColumn(config.balanceColumn) : -1;
    const currencyCol = config.currencyColumn ? findColumn(config.currencyColumn) : -1;

    if (dateCol === -1 || amountCol === -1 || descCol === -1) {
      result.errorDetails.push(
        `Required columns not found. Looking for: date=${config.dateColumn}, amount=${config.amountColumn}, description=${config.descriptionColumn}. Found headers: ${headers.join(", ")}`
      );
      return result;
    }

    // Parse data rows
    for (let i = dataStartIndex; i < rows.length; i++) {
      const row = rows[i];
      result.totalRows++;

      try {
        const dateStr = row[dateCol];
        const amountStr = row[amountCol];
        const description = row[descCol];

        if (!dateStr || !amountStr) {
          result.errors++;
          result.errorDetails.push(`Row ${i + 1}: Missing date or amount`);
          continue;
        }

        const date = parseDate(dateStr, config.dateFormat);
        const amount = parseAmount(
          amountStr,
          config.decimalSeparator,
          config.thousandSeparator
        );

        if (!date) {
          result.errors++;
          result.errorDetails.push(`Row ${i + 1}: Invalid date format: ${dateStr}`);
          continue;
        }

        if (amount === null) {
          result.errors++;
          result.errorDetails.push(`Row ${i + 1}: Invalid amount format: ${amountStr}`);
          continue;
        }

        const currency =
          currencyCol >= 0 ? row[currencyCol] || config.defaultCurrency : config.defaultCurrency;

        const balance =
          balanceCol >= 0
            ? parseAmount(row[balanceCol], config.decimalSeparator, config.thousandSeparator)
            : null;

        const reference = refCol >= 0 ? row[refCol] || null : null;

        const isExpense = config.negativeIsExpense ? amount < 0 : amount > 0;

        // Build raw data object
        const rawData: Record<string, string> = {};
        headers.forEach((header, idx) => {
          if (row[idx]) rawData[header] = row[idx];
        });

        result.transactions.push({
          date,
          amount: Math.abs(amount),
          currency: currency.toUpperCase(),
          description: description || "",
          reference,
          balance,
          isExpense,
          rawData,
        });

        result.imported++;
      } catch (error) {
        result.errors++;
        result.errorDetails.push(
          `Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    // Limit error details to first 20
    if (result.errorDetails.length > 20) {
      const remaining = result.errorDetails.length - 20;
      result.errorDetails = result.errorDetails.slice(0, 20);
      result.errorDetails.push(`... and ${remaining} more errors`);
    }

    serviceLogger.info(
      {
        totalRows: result.totalRows,
        imported: result.imported,
        errors: result.errors,
      },
      "Bank statement parsed"
    );

    return result;
  } catch (error) {
    result.errorDetails.push(
      `Parse error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return result;
  }
}

/**
 * Import parsed transactions to database
 */
export async function importTransactions(
  tenantId: string,
  bankAccountId: string | null,
  transactions: ParsedTransaction[],
  options?: {
    skipDuplicates?: boolean;
    enrichOnImport?: boolean;
    defaultInvoiceId?: string;
  }
): Promise<{
  imported: number;
  duplicates: number;
  errors: number;
}> {
  const skipDuplicates = options?.skipDuplicates !== false;

  let imported = 0;
  let duplicates = 0;
  let errors = 0;

  for (const tx of transactions) {
    try {
      // Check for duplicates based on date, amount, and description
      if (skipDuplicates) {
        const existing = await db`
          SELECT id FROM payments p
          LEFT JOIN invoices i ON p.invoice_id = i.id
          WHERE i.tenant_id = ${tenantId}
            AND p.payment_date::date = ${tx.date.toISOString().split("T")[0]}::date
            AND p.amount::numeric = ${tx.amount}
            AND (p.notes = ${tx.description} OR p.reference = ${tx.reference})
          LIMIT 1
        `;

        if (existing.length > 0) {
          duplicates++;
          continue;
        }
      }

      // Create payment record
      const paymentId = generateUUID();
      const now = new Date().toISOString();

      // If no default invoice, we need to create a placeholder or skip
      // For now, we'll require a default invoice ID
      if (!options?.defaultInvoiceId) {
        errors++;
        continue;
      }

      await db`
        INSERT INTO payments (
          id,
          invoice_id,
          amount,
          currency,
          payment_method,
          status,
          payment_date,
          reference,
          notes,
          metadata,
          bank_account_id,
          recorded_by,
          created_at,
          updated_at
        ) VALUES (
          ${paymentId},
          ${options.defaultInvoiceId},
          ${tx.amount.toString()},
          ${tx.currency},
          'bank_transfer'::payment_method,
          'completed'::payment_status,
          ${tx.date.toISOString()},
          ${tx.reference},
          ${tx.description},
          ${JSON.stringify({ importedFrom: "bank-csv", rawData: tx.rawData })}::jsonb,
          ${bankAccountId},
          ${tenantId},
          ${now},
          ${now}
        )
      `;

      imported++;
    } catch (error) {
      serviceLogger.error({ error, transaction: tx }, "Failed to import transaction");
      errors++;
    }
  }

  serviceLogger.info(
    { tenantId, imported, duplicates, errors },
    "Bank transactions imported"
  );

  return { imported, duplicates, errors };
}

/**
 * Auto-detect bank from CSV content
 */
export function detectBank(csvContent: string): BankPreset | null {
  const delimiter = detectDelimiter(csvContent);
  const rows = parseCSV(csvContent, delimiter);

  if (rows.length === 0) return null;

  const headers = rows[0].map((h) => h.toLowerCase());
  const headerStr = headers.join(" ");

  // Check for known bank patterns
  for (const preset of BANK_PRESETS) {
    const config = preset.config;

    // Check if key columns exist
    const hasDate = headers.some((h) => h.includes(config.dateColumn.toLowerCase()));
    const hasAmount = headers.some((h) => h.includes(config.amountColumn.toLowerCase()));
    const hasDesc = headers.some((h) => h.includes(config.descriptionColumn.toLowerCase()));

    if (hasDate && hasAmount && hasDesc) {
      // Check for bank-specific markers
      if (preset.id === "revolut" && headerStr.includes("revolut")) return preset;
      if (preset.id === "wise" && headerStr.includes("transferwise")) return preset;
      if (preset.id === "n26" && headerStr.includes("n26")) return preset;

      // Check Serbian banks
      if (preset.id.includes("-rs")) {
        if (headerStr.includes("datum") && headerStr.includes("iznos")) {
          return preset;
        }
      }

      // Return generic match if specific not found
      if (preset.id === "generic-csv" && hasDate && hasAmount && hasDesc) {
        return preset;
      }
    }
  }

  return BANK_PRESETS.find((p) => p.id === "generic-csv") || null;
}

/**
 * Get available bank presets
 */
export function getBankPresets(): BankPreset[] {
  return BANK_PRESETS;
}

/**
 * Get preset by ID
 */
export function getPresetById(id: string): BankPreset | null {
  return BANK_PRESETS.find((p) => p.id === id) || null;
}

export default {
  parseBankStatement,
  importTransactions,
  detectBank,
  getBankPresets,
  getPresetById,
  BANK_PRESETS,
};
