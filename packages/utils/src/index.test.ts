import { describe, expect, it } from "vitest";
import {
  AppError,
  addDays,
  capitalize,
  clamp,
  deepClone,
  Errors,
  errorResponse,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercentage,
  formatRelativeTime,
  fromTimestamp,
  fullName,
  generateUUID,
  groupBy,
  isAppError,
  isEmpty,
  isExpired,
  isValidEmail,
  isValidPhone,
  isValidUUID,
  now,
  omit,
  paginatedResponse,
  pick,
  sanitizeString,
  slugify,
  sortBy,
  successResponse,
  toTimestamp,
  truncate,
  uniqueBy,
} from "./index";

describe("UUID Utilities", () => {
  describe("generateUUID", () => {
    it("should generate a valid UUID v4", () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("should generate unique UUIDs", () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });

    it("should generate 1000 unique UUIDs without collisions", () => {
      const uuids = new Set();
      for (let i = 0; i < 1000; i++) {
        uuids.add(generateUUID());
      }
      expect(uuids.size).toBe(1000);
    });
  });

  describe("isValidUUID", () => {
    it("should validate correct UUID", () => {
      const uuid = generateUUID();
      expect(isValidUUID(uuid)).toBe(true);
    });

    it("should reject invalid UUIDs", () => {
      expect(isValidUUID("not-a-uuid")).toBe(false);
      expect(isValidUUID("123")).toBe(false);
      expect(isValidUUID("")).toBe(false);
      expect(isValidUUID("00000000-0000-0000-0000-00000000000")).toBe(false); // Too short
    });

    it("should accept UUID v1-v5", () => {
      expect(isValidUUID("550e8400-e29b-11d4-a716-446655440000")).toBe(true); // v1
      expect(isValidUUID("550e8400-e29b-21d4-a716-446655440000")).toBe(true); // v2
      expect(isValidUUID("550e8400-e29b-31d4-a716-446655440000")).toBe(true); // v3
      expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true); // v4
      expect(isValidUUID("550e8400-e29b-51d4-a716-446655440000")).toBe(true); // v5
    });
  });
});

describe("Date & Time Utilities", () => {
  describe("toTimestamp and fromTimestamp", () => {
    it("should convert Date to ISO timestamp", () => {
      const date = new Date("2024-01-01T12:00:00Z");
      const timestamp = toTimestamp(date);
      expect(timestamp).toBe("2024-01-01T12:00:00.000Z");
    });

    it("should convert timestamp back to Date", () => {
      const timestamp = "2024-01-01T12:00:00.000Z";
      const date = fromTimestamp(timestamp);
      expect(date.toISOString()).toBe(timestamp);
    });

    it("should round-trip correctly", () => {
      const originalDate = new Date();
      const timestamp = toTimestamp(originalDate);
      const parsedDate = fromTimestamp(timestamp);
      expect(parsedDate.getTime()).toBe(originalDate.getTime());
    });
  });

  describe("now", () => {
    it("should return current timestamp", () => {
      const before = Date.now();
      const timestamp = now();
      const after = Date.now();
      const timestampMs = new Date(timestamp).getTime();

      expect(timestampMs).toBeGreaterThanOrEqual(before);
      expect(timestampMs).toBeLessThanOrEqual(after);
    });
  });

  describe("formatDate", () => {
    it("should format date in default locale", () => {
      const timestamp = "2024-01-15T12:00:00.000Z";
      const formatted = formatDate(timestamp);
      expect(formatted).toContain("January");
      expect(formatted).toContain("15");
      expect(formatted).toContain("2024");
    });
  });

  describe("formatRelativeTime", () => {
    it('should return "just now" for recent timestamps', () => {
      const timestamp = now();
      expect(formatRelativeTime(timestamp)).toBe("just now");
    });

    it("should return minutes ago", () => {
      const date = new Date();
      date.setMinutes(date.getMinutes() - 5);
      const timestamp = toTimestamp(date);
      expect(formatRelativeTime(timestamp)).toBe("5m ago");
    });

    it("should return hours ago", () => {
      const date = new Date();
      date.setHours(date.getHours() - 3);
      const timestamp = toTimestamp(date);
      expect(formatRelativeTime(timestamp)).toBe("3h ago");
    });

    it("should return days ago", () => {
      const date = new Date();
      date.setDate(date.getDate() - 2);
      const timestamp = toTimestamp(date);
      expect(formatRelativeTime(timestamp)).toBe("2d ago");
    });
  });

  describe("addDays", () => {
    it("should add days to timestamp", () => {
      const timestamp = "2024-01-01T00:00:00.000Z";
      const newTimestamp = addDays(timestamp, 5);
      const date = fromTimestamp(newTimestamp);
      expect(date.getDate()).toBe(6);
    });

    it("should subtract days with negative number", () => {
      const timestamp = "2024-01-10T00:00:00.000Z";
      const newTimestamp = addDays(timestamp, -5);
      const date = fromTimestamp(newTimestamp);
      expect(date.getDate()).toBe(5);
    });
  });

  describe("isExpired", () => {
    it("should return true for past timestamps", () => {
      const timestamp = "2020-01-01T00:00:00.000Z";
      expect(isExpired(timestamp)).toBe(true);
    });

    it("should return false for future timestamps", () => {
      const date = new Date();
      date.setFullYear(date.getFullYear() + 1);
      const timestamp = toTimestamp(date);
      expect(isExpired(timestamp)).toBe(false);
    });
  });
});

describe("API Response Helpers", () => {
  describe("successResponse", () => {
    it("should create success response", () => {
      const data = { id: "123", name: "Test" };
      const response = successResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.error).toBeUndefined();
    });

    it("should include meta if provided", () => {
      const data = [1, 2, 3];
      const meta = { page: 1, totalPages: 5 };
      const response = successResponse(data, meta);

      expect(response.meta).toEqual(meta);
    });
  });

  describe("errorResponse", () => {
    it("should create error response", () => {
      const response = errorResponse("NOT_FOUND", "Resource not found");

      expect(response.success).toBe(false);
      expect(response.error).toEqual({
        code: "NOT_FOUND",
        message: "Resource not found",
      });
      expect(response.data).toBeUndefined();
    });

    it("should include details if provided", () => {
      const details = { field: "email", reason: "invalid format" };
      const response = errorResponse("VALIDATION_ERROR", "Validation failed", details);

      expect(response.error?.details).toEqual(details);
    });
  });

  describe("paginatedResponse", () => {
    it("should create paginated response", () => {
      const data = [1, 2, 3];
      const response = paginatedResponse(data, 100, { page: 1, pageSize: 20 });

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.meta).toEqual({
        page: 1,
        pageSize: 20,
        totalCount: 100,
        totalPages: 5,
      });
    });

    it("should use default values", () => {
      const data = [1, 2, 3];
      const response = paginatedResponse(data, 100, {});

      expect(response.meta?.page).toBe(1);
      expect(response.meta?.pageSize).toBe(20);
    });

    it("should calculate total pages correctly", () => {
      const response = paginatedResponse([], 25, { pageSize: 10 });
      expect(response.meta?.totalPages).toBe(3);
    });
  });
});

describe("Validation Utilities", () => {
  describe("isValidEmail", () => {
    it("should validate correct emails", () => {
      expect(isValidEmail("test@example.com")).toBe(true);
      expect(isValidEmail("user.name@domain.co.uk")).toBe(true);
      expect(isValidEmail("user+tag@example.com")).toBe(true);
    });

    it("should reject invalid emails", () => {
      expect(isValidEmail("notanemail")).toBe(false);
      expect(isValidEmail("missing@domain")).toBe(false);
      expect(isValidEmail("@example.com")).toBe(false);
      expect(isValidEmail("user@")).toBe(false);
      expect(isValidEmail("")).toBe(false);
    });
  });

  describe("isValidPhone", () => {
    it("should validate correct phone numbers", () => {
      expect(isValidPhone("+1234567890")).toBe(true);
      expect(isValidPhone("+12 345 678 90")).toBe(true);
      expect(isValidPhone("+1-234-567-890")).toBe(true);
      expect(isValidPhone("+1 (234) 567-890")).toBe(true);
    });

    it("should reject invalid phone numbers", () => {
      expect(isValidPhone("1")).toBe(false); // Too short (< 2 digits)
      expect(isValidPhone("abc")).toBe(false);
      expect(isValidPhone("")).toBe(false);
      expect(isValidPhone("0123456789012345")).toBe(false); // Too long (> 15 digits)
      expect(isValidPhone("01234567890")).toBe(false); // Starts with 0
    });
  });

  describe("sanitizeString", () => {
    it("should remove dangerous characters", () => {
      expect(sanitizeString("  hello world  ")).toBe("hello world");
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
    });

    it("should trim whitespace", () => {
      expect(sanitizeString("  test  ")).toBe("test");
    });
  });

  describe("isEmpty", () => {
    it("should detect empty values", () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
      expect(isEmpty("")).toBe(true);
      expect(isEmpty("   ")).toBe(true);
      expect(isEmpty([])).toBe(true);
      expect(isEmpty({})).toBe(true);
    });

    it("should detect non-empty values", () => {
      expect(isEmpty("text")).toBe(false);
      expect(isEmpty([1, 2, 3])).toBe(false);
      expect(isEmpty({ key: "value" })).toBe(false);
      expect(isEmpty(0)).toBe(false);
      expect(isEmpty(false)).toBe(false);
    });
  });
});

describe("String Utilities", () => {
  describe("slugify", () => {
    it("should create URL-friendly slugs", () => {
      expect(slugify("Hello World")).toBe("hello-world");
      expect(slugify("My Awesome Post!")).toBe("my-awesome-post");
      expect(slugify("Special @#$ Characters")).toBe("special-characters");
    });

    it("should handle edge cases", () => {
      expect(slugify("---test---")).toBe("test");
      expect(slugify("multiple   spaces")).toBe("multiple-spaces");
    });
  });

  describe("truncate", () => {
    it("should truncate long text", () => {
      const text = "This is a very long text that needs truncation";
      expect(truncate(text, 20)).toBe("This is a very lo...");
    });

    it("should not truncate short text", () => {
      const text = "Short";
      expect(truncate(text, 20)).toBe("Short");
    });

    it("should handle exact length", () => {
      const text = "Exact";
      expect(truncate(text, 5)).toBe("Exact");
    });
  });

  describe("capitalize", () => {
    it("should capitalize first letter", () => {
      expect(capitalize("hello")).toBe("Hello");
      expect(capitalize("WORLD")).toBe("World");
      expect(capitalize("tESt")).toBe("Test");
    });
  });

  describe("fullName", () => {
    it("should combine first and last name", () => {
      expect(fullName("John", "Doe")).toBe("John Doe");
    });

    it("should handle extra whitespace", () => {
      expect(fullName("  John  ", "  Doe  ")).toBe("John     Doe");
    });
  });
});

describe("Number & Currency Utilities", () => {
  describe("formatCurrency", () => {
    it("should format currency in USD", () => {
      const formatted = formatCurrency(1234.56);
      expect(formatted).toContain("1,234.56");
      expect(formatted).toContain("$");
    });

    it("should format currency in EUR", () => {
      const formatted = formatCurrency(1234.56, "EUR", "de-DE");
      expect(formatted).toContain("1.234,56");
      expect(formatted).toContain("€");
    });
  });

  describe("formatNumber", () => {
    it("should format numbers with separators", () => {
      expect(formatNumber(1234567)).toContain("1,234,567");
    });
  });

  describe("formatPercentage", () => {
    it("should format percentage", () => {
      expect(formatPercentage(45.678, 2)).toBe("45.68%");
      expect(formatPercentage(100)).toBe("100%");
    });
  });

  describe("clamp", () => {
    it("should clamp values within range", () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });
});

describe("Object Utilities", () => {
  describe("pick", () => {
    it("should pick specified keys", () => {
      const obj = { a: 1, b: 2, c: 3 };
      const picked = pick(obj, ["a", "c"]);
      expect(picked).toEqual({ a: 1, c: 3 });
    });
  });

  describe("omit", () => {
    it("should omit specified keys", () => {
      const obj = { a: 1, b: 2, c: 3 };
      const omitted = omit(obj, ["b"]);
      expect(omitted).toEqual({ a: 1, c: 3 });
    });
  });

  describe("deepClone", () => {
    it("should deep clone objects", () => {
      const obj = { a: 1, b: { c: 2 } };
      const cloned = deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
    });
  });
});

describe("Array Utilities", () => {
  describe("groupBy", () => {
    it("should group array by key function", () => {
      const items = [
        { type: "fruit", name: "apple" },
        { type: "fruit", name: "banana" },
        { type: "veggie", name: "carrot" },
      ];
      const grouped = groupBy(items, (item) => item.type);

      expect(grouped.fruit).toHaveLength(2);
      expect(grouped.veggie).toHaveLength(1);
    });
  });

  describe("uniqueBy", () => {
    it("should remove duplicates by key function", () => {
      const items = [
        { id: "1", name: "a" },
        { id: "2", name: "b" },
        { id: "1", name: "c" },
      ];
      const unique = uniqueBy(items, (item) => item.id);

      expect(unique).toHaveLength(2);
      expect(unique[0].id).toBe("1");
      expect(unique[1].id).toBe("2");
    });
  });

  describe("sortBy", () => {
    it("should sort ascending by default", () => {
      const items = [{ age: 30 }, { age: 20 }, { age: 25 }];
      const sorted = sortBy(items, (item) => item.age);

      expect(sorted[0].age).toBe(20);
      expect(sorted[1].age).toBe(25);
      expect(sorted[2].age).toBe(30);
    });

    it("should sort descending", () => {
      const items = [{ age: 20 }, { age: 30 }, { age: 25 }];
      const sorted = sortBy(items, (item) => item.age, "desc");

      expect(sorted[0].age).toBe(30);
      expect(sorted[1].age).toBe(25);
      expect(sorted[2].age).toBe(20);
    });
  });
});

describe("Error Handling", () => {
  describe("AppError", () => {
    it("should create AppError with all properties", () => {
      const error = new AppError("TEST_ERROR", "Test message", 400, { field: "test" });

      expect(error.code).toBe("TEST_ERROR");
      expect(error.message).toBe("Test message");
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: "test" });
      expect(error.name).toBe("AppError");
    });

    it("should convert to API response", () => {
      const error = new AppError("TEST_ERROR", "Test message", 400);
      const response = error.toResponse();

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("TEST_ERROR");
      expect(response.error?.message).toBe("Test message");
    });
  });

  describe("isAppError", () => {
    it("should identify AppError instances", () => {
      const appError = new AppError("TEST", "Test");
      const regularError = new Error("Test");

      expect(isAppError(appError)).toBe(true);
      expect(isAppError(regularError)).toBe(false);
      expect(isAppError("not an error")).toBe(false);
    });
  });

  describe("Errors factory", () => {
    it("should create NotFound error", () => {
      const error = Errors.NotFound("User");
      expect(error.code).toBe("NOT_FOUND");
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain("User");
    });

    it("should create Unauthorized error", () => {
      const error = Errors.Unauthorized();
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.statusCode).toBe(401);
    });

    it("should create Forbidden error", () => {
      const error = Errors.Forbidden();
      expect(error.code).toBe("FORBIDDEN");
      expect(error.statusCode).toBe(403);
    });

    it("should create BadRequest error", () => {
      const error = Errors.BadRequest("Invalid input");
      expect(error.code).toBe("BAD_REQUEST");
      expect(error.statusCode).toBe(400);
    });

    it("should create Conflict error", () => {
      const error = Errors.Conflict("Already exists");
      expect(error.code).toBe("CONFLICT");
      expect(error.statusCode).toBe(409);
    });

    it("should create Internal error", () => {
      const error = Errors.Internal();
      expect(error.code).toBe("INTERNAL_ERROR");
      expect(error.statusCode).toBe(500);
    });
  });
});
