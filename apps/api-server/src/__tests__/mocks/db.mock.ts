import { vi } from "vitest";

// Mock database client
export const createMockDb = (): Record<string, unknown> => {
  const mockQuery = vi.fn();

  return {
    query: mockQuery,
    execute: vi.fn(),
    transaction: vi.fn(),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(),
        })),
        leftJoin: vi.fn(),
        innerJoin: vi.fn(),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
  };
};

export const mockDb: Record<string, unknown> = createMockDb();
