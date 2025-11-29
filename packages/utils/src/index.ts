import type { ApiResponse, ApiError, PaginationParams, Timestamp, UUID } from "@crm/types";

// ============================================
// UUID Generation
// ============================================

export function generateUUID(): UUID {
  return crypto.randomUUID();
}

export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// ============================================
// Date & Time Utilities
// ============================================

export function toTimestamp(date: Date): Timestamp {
  return date.toISOString();
}

export function fromTimestamp(timestamp: Timestamp): Date {
  return new Date(timestamp);
}

export function now(): Timestamp {
  return toTimestamp(new Date());
}

export function formatDate(timestamp: Timestamp, locale: string = "en-US"): string {
  return fromTimestamp(timestamp).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTime(timestamp: Timestamp, locale: string = "en-US"): string {
  return fromTimestamp(timestamp).toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(timestamp: Timestamp): string {
  const date = fromTimestamp(timestamp);
  const nowDate = new Date();
  const diffMs = nowDate.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(timestamp);
}

export function addDays(timestamp: Timestamp, days: number): Timestamp {
  const date = fromTimestamp(timestamp);
  date.setDate(date.getDate() + days);
  return toTimestamp(date);
}

export function isExpired(timestamp: Timestamp): boolean {
  return fromTimestamp(timestamp) < new Date();
}

// ============================================
// API Response Helpers
// ============================================

export function successResponse<T>(data: T, meta?: ApiResponse<T>["meta"]): ApiResponse<T> {
  return {
    success: true,
    data,
    meta,
  };
}

export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ApiResponse<never> {
  const error: ApiError = { code, message };
  if (details) error.details = details;
  return {
    success: false,
    error,
  };
}

export function paginatedResponse<T>(
  data: T[],
  totalCount: number,
  params: PaginationParams
): ApiResponse<T[]> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return successResponse(data, {
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
  });
}

// ============================================
// Validation Utilities
// ============================================

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s\-()]/g, ""));
}

export function sanitizeString(str: string): string {
  return str.trim().replace(/[<>]/g, "");
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

// ============================================
// String Utilities
// ============================================

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

// ============================================
// Number & Currency Utilities
// ============================================

export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatNumber(num: number, locale: string = "en-US"): string {
  return new Intl.NumberFormat(locale).format(num);
}

export function formatPercentage(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ============================================
// Object Utilities
// ============================================

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ============================================
// Array Utilities
// ============================================

export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce(
    (groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    },
    {} as Record<string, T[]>
  );
}

export function uniqueBy<T>(array: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return array.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sortBy<T>(
  array: T[],
  keyFn: (item: T) => string | number,
  order: "asc" | "desc" = "asc"
): T[] {
  const sorted = [...array].sort((a, b) => {
    const aVal = keyFn(a);
    const bVal = keyFn(b);
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  });
  return order === "desc" ? sorted.reverse() : sorted;
}

// ============================================
// Error Handling
// ============================================

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }

  toResponse(): ApiResponse<never> {
    return errorResponse(this.code, this.message, this.details);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

// Common errors
export const Errors = {
  NotFound: (resource: string) => new AppError("NOT_FOUND", `${resource} not found`, 404),
  Unauthorized: () => new AppError("UNAUTHORIZED", "Authentication required", 401),
  Forbidden: () => new AppError("FORBIDDEN", "Access denied", 403),
  BadRequest: (message: string) => new AppError("BAD_REQUEST", message, 400),
  Conflict: (message: string) => new AppError("CONFLICT", message, 409),
  Internal: (message: string = "Internal server error") =>
    new AppError("INTERNAL_ERROR", message, 500),
} as const;
