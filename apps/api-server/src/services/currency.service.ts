/**
 * Multi-Currency Service
 * Handles currency conversion, exchange rates, and multi-currency support
 * Uses exchangerate.host API for rates (free tier available)
 */

import { sql as db } from "../db/client";
import { serviceLogger } from "../lib/logger";

// ==============================================
// TYPES
// ==============================================

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  date: string;
  source: string;
}

export interface ConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  rate: number;
  rateDate: string;
}

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
}

// ==============================================
// CONFIGURATION
// ==============================================

const CURRENCY_CONFIG = {
  // API endpoint (using exchangerate.host - free tier)
  apiUrl: process.env.EXCHANGE_RATE_API_URL || "https://api.exchangerate.host",
  apiKey: process.env.EXCHANGE_RATE_API_KEY || "",

  // Fallback to frankfurter.app (also free, no key needed)
  fallbackApiUrl: "https://api.frankfurter.app",

  // Default base currency
  baseCurrency: process.env.BASE_CURRENCY || "EUR",

  // Cache TTL (in seconds)
  cacheTTL: 3600, // 1 hour

  // Supported currencies
  supportedCurrencies: [
    "EUR",
    "USD",
    "GBP",
    "CHF",
    "RSD",
    "BAM",
    "HRK",
    "JPY",
    "CNY",
    "AUD",
    "CAD",
    "PLN",
    "CZK",
    "HUF",
    "RON",
    "BGN",
    "SEK",
    "NOK",
    "DKK",
    "TRY",
    "RUB",
  ],
};

// In-memory cache for exchange rates
const rateCache: Map<string, { rate: number; timestamp: number; date: string }> = new Map();

// ==============================================
// CURRENCY DATA
// ==============================================

export const CURRENCIES: Record<string, CurrencyInfo> = {
  EUR: { code: "EUR", name: "Euro", symbol: "€", decimalPlaces: 2 },
  USD: { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 },
  GBP: { code: "GBP", name: "British Pound", symbol: "£", decimalPlaces: 2 },
  CHF: { code: "CHF", name: "Swiss Franc", symbol: "Fr", decimalPlaces: 2 },
  RSD: { code: "RSD", name: "Serbian Dinar", symbol: "дин", decimalPlaces: 2 },
  BAM: { code: "BAM", name: "Bosnia Mark", symbol: "KM", decimalPlaces: 2 },
  HRK: { code: "HRK", name: "Croatian Kuna", symbol: "kn", decimalPlaces: 2 },
  JPY: { code: "JPY", name: "Japanese Yen", symbol: "¥", decimalPlaces: 0 },
  CNY: { code: "CNY", name: "Chinese Yuan", symbol: "¥", decimalPlaces: 2 },
  AUD: { code: "AUD", name: "Australian Dollar", symbol: "A$", decimalPlaces: 2 },
  CAD: { code: "CAD", name: "Canadian Dollar", symbol: "C$", decimalPlaces: 2 },
  PLN: { code: "PLN", name: "Polish Zloty", symbol: "zł", decimalPlaces: 2 },
  CZK: { code: "CZK", name: "Czech Koruna", symbol: "Kč", decimalPlaces: 2 },
  HUF: { code: "HUF", name: "Hungarian Forint", symbol: "Ft", decimalPlaces: 0 },
  RON: { code: "RON", name: "Romanian Leu", symbol: "lei", decimalPlaces: 2 },
  BGN: { code: "BGN", name: "Bulgarian Lev", symbol: "лв", decimalPlaces: 2 },
  SEK: { code: "SEK", name: "Swedish Krona", symbol: "kr", decimalPlaces: 2 },
  NOK: { code: "NOK", name: "Norwegian Krone", symbol: "kr", decimalPlaces: 2 },
  DKK: { code: "DKK", name: "Danish Krone", symbol: "kr", decimalPlaces: 2 },
  TRY: { code: "TRY", name: "Turkish Lira", symbol: "₺", decimalPlaces: 2 },
  RUB: { code: "RUB", name: "Russian Ruble", symbol: "₽", decimalPlaces: 2 },
};

// ==============================================
// EXCHANGE RATE FETCHING
// ==============================================

/**
 * Build cache key for exchange rate
 */
function getCacheKey(from: string, to: string, date?: string): string {
  return `${from}_${to}_${date || "latest"}`;
}

/**
 * Fetch exchange rate from primary API
 */
async function fetchRateFromPrimary(
  from: string,
  to: string,
  date?: string
): Promise<{ rate: number; date: string } | null> {
  try {
    const endpoint = date
      ? `${CURRENCY_CONFIG.apiUrl}/${date}`
      : `${CURRENCY_CONFIG.apiUrl}/latest`;

    const params = new URLSearchParams({
      base: from,
      symbols: to,
    });

    if (CURRENCY_CONFIG.apiKey) {
      params.set("access_key", CURRENCY_CONFIG.apiKey);
    }

    const response = await fetch(`${endpoint}?${params}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      success?: boolean;
      rates?: Record<string, number>;
      date?: string;
    };

    if (data.rates?.[to]) {
      return {
        rate: data.rates[to],
        date: data.date || new Date().toISOString().split("T")[0],
      };
    }

    return null;
  } catch (error) {
    serviceLogger.warn({ error, from, to }, "Primary API failed, trying fallback");
    return null;
  }
}

/**
 * Fetch exchange rate from fallback API (frankfurter.app)
 */
async function fetchRateFromFallback(
  from: string,
  to: string,
  date?: string
): Promise<{ rate: number; date: string } | null> {
  try {
    const endpoint = date
      ? `${CURRENCY_CONFIG.fallbackApiUrl}/${date}`
      : `${CURRENCY_CONFIG.fallbackApiUrl}/latest`;

    const params = new URLSearchParams({
      from,
      to,
    });

    const response = await fetch(`${endpoint}?${params}`);

    if (!response.ok) {
      throw new Error(`Fallback API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      rates?: Record<string, number>;
      date?: string;
    };

    if (data.rates?.[to]) {
      return {
        rate: data.rates[to],
        date: data.date || new Date().toISOString().split("T")[0],
      };
    }

    return null;
  } catch (error) {
    serviceLogger.error({ error, from, to }, "Fallback API also failed");
    return null;
  }
}

// ==============================================
// MAIN SERVICE FUNCTIONS
// ==============================================

/**
 * Get exchange rate between two currencies
 */
export async function getExchangeRate(
  from: string,
  to: string,
  date?: string
): Promise<ExchangeRate | null> {
  from = from.toUpperCase();
  to = to.toUpperCase();

  // Same currency
  if (from === to) {
    return {
      from,
      to,
      rate: 1,
      date: date || new Date().toISOString().split("T")[0],
      source: "identity",
    };
  }

  // Check cache
  const cacheKey = getCacheKey(from, to, date);
  const cached = rateCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CURRENCY_CONFIG.cacheTTL * 1000) {
    return {
      from,
      to,
      rate: cached.rate,
      date: cached.date,
      source: "cache",
    };
  }

  // Fetch from API
  let result = await fetchRateFromPrimary(from, to, date);

  if (!result) {
    result = await fetchRateFromFallback(from, to, date);
  }

  if (!result) {
    // Try reverse rate
    const reverseResult =
      (await fetchRateFromPrimary(to, from, date)) || (await fetchRateFromFallback(to, from, date));

    if (reverseResult) {
      result = {
        rate: 1 / reverseResult.rate,
        date: reverseResult.date,
      };
    }
  }

  if (!result) {
    serviceLogger.error({ from, to, date }, "Could not fetch exchange rate");
    return null;
  }

  // Update cache
  rateCache.set(cacheKey, {
    rate: result.rate,
    timestamp: Date.now(),
    date: result.date,
  });

  return {
    from,
    to,
    rate: result.rate,
    date: result.date,
    source: "api",
  };
}

/**
 * Convert amount from one currency to another
 */
export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  date?: string
): Promise<ConversionResult | null> {
  const rate = await getExchangeRate(fromCurrency, toCurrency, date);

  if (!rate) {
    return null;
  }

  const targetInfo = CURRENCIES[toCurrency.toUpperCase()];
  const decimalPlaces = targetInfo?.decimalPlaces ?? 2;

  const convertedAmount =
    Math.round(amount * rate.rate * 10 ** decimalPlaces) / 10 ** decimalPlaces;

  return {
    originalAmount: amount,
    originalCurrency: fromCurrency.toUpperCase(),
    convertedAmount,
    targetCurrency: toCurrency.toUpperCase(),
    rate: rate.rate,
    rateDate: rate.date,
  };
}

/**
 * Convert amount to base currency
 */
export async function convertToBase(
  amount: number,
  fromCurrency: string,
  date?: string
): Promise<ConversionResult | null> {
  return convertAmount(amount, fromCurrency, CURRENCY_CONFIG.baseCurrency, date);
}

/**
 * Update payment with base currency conversion
 */
export async function updatePaymentBaseCurrency(
  paymentId: string,
  tenantId: string
): Promise<boolean> {
  try {
    // Get payment data
    const paymentResult = await db`
      SELECT
        p.id,
        p.amount::numeric as amount,
        p.currency,
        p.payment_date as "paymentDate"
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      WHERE p.id = ${paymentId} AND i.tenant_id = ${tenantId}
    `;

    if (paymentResult.length === 0) {
      return false;
    }

    const payment = paymentResult[0];
    const amount = parseFloat(payment.amount as string);
    const currency = payment.currency as string;
    const paymentDate = new Date(payment.paymentDate as string);

    // Skip if already in base currency
    if (currency.toUpperCase() === CURRENCY_CONFIG.baseCurrency) {
      await db`
        UPDATE payments SET
          base_amount = ${amount},
          base_currency = ${CURRENCY_CONFIG.baseCurrency},
          updated_at = NOW()
        WHERE id = ${paymentId}
      `;
      return true;
    }

    // Convert to base currency
    const dateStr = paymentDate.toISOString().split("T")[0];
    const conversion = await convertToBase(amount, currency, dateStr);

    if (!conversion) {
      serviceLogger.warn({ paymentId, currency }, "Could not convert to base currency");
      return false;
    }

    await db`
      UPDATE payments SET
        base_amount = ${conversion.convertedAmount},
        base_currency = ${CURRENCY_CONFIG.baseCurrency},
        updated_at = NOW()
      WHERE id = ${paymentId}
    `;

    serviceLogger.info(
      { paymentId, from: currency, to: CURRENCY_CONFIG.baseCurrency, rate: conversion.rate },
      "Payment converted to base currency"
    );

    return true;
  } catch (error) {
    serviceLogger.error({ error, paymentId }, "Failed to update base currency");
    return false;
  }
}

/**
 * Batch update base currency for all payments
 */
export async function batchUpdateBaseCurrency(
  tenantId: string,
  options?: { limit?: number }
): Promise<{ updated: number; errors: number }> {
  const limit = options?.limit || 100;

  const payments = await db`
    SELECT p.id
    FROM payments p
    LEFT JOIN invoices i ON p.invoice_id = i.id
    WHERE i.tenant_id = ${tenantId}
      AND (p.base_amount IS NULL OR p.base_currency IS NULL)
    LIMIT ${limit}
  `;

  let updated = 0;
  let errors = 0;

  for (const payment of payments) {
    const success = await updatePaymentBaseCurrency(payment.id as string, tenantId);
    if (success) {
      updated++;
    } else {
      errors++;
    }
  }

  serviceLogger.info({ tenantId, updated, errors }, "Batch base currency update completed");

  return { updated, errors };
}

/**
 * Get all supported currencies
 */
export function getSupportedCurrencies(): CurrencyInfo[] {
  return CURRENCY_CONFIG.supportedCurrencies.map((code) => CURRENCIES[code]).filter(Boolean);
}

/**
 * Get currency info by code
 */
export function getCurrencyInfo(code: string): CurrencyInfo | null {
  return CURRENCIES[code.toUpperCase()] || null;
}

/**
 * Format amount with currency symbol
 */
export function formatCurrency(amount: number, currencyCode: string): string {
  const currency = CURRENCIES[currencyCode.toUpperCase()];

  if (!currency) {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }

  const formatted = amount.toFixed(currency.decimalPlaces);

  // Symbol placement varies by currency
  const symbolBefore = ["USD", "GBP", "EUR", "JPY", "CNY"].includes(currency.code);

  return symbolBefore ? `${currency.symbol}${formatted}` : `${formatted} ${currency.symbol}`;
}

/**
 * Get base currency setting
 */
export function getBaseCurrency(): string {
  return CURRENCY_CONFIG.baseCurrency;
}

/**
 * Clear exchange rate cache
 */
export function clearRateCache(): void {
  rateCache.clear();
  serviceLogger.info("Exchange rate cache cleared");
}

export default {
  getExchangeRate,
  convertAmount,
  convertToBase,
  updatePaymentBaseCurrency,
  batchUpdateBaseCurrency,
  getSupportedCurrencies,
  getCurrencyInfo,
  formatCurrency,
  getBaseCurrency,
  clearRateCache,
  CURRENCIES,
};
