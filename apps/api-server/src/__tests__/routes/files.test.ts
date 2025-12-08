import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleRequest } from "../../routes/index";
import { generateJWT } from "../../services/auth.service";

const hoisted = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));
vi.mock("../../cache/redis", () => ({
  cache: {
    getSession: hoisted.mockGetSession,
  },
}));

vi.mock("../../db/queries/companies-members", () => ({
  hasCompanyAccess: vi.fn(async () => true),
  getCompanyById: vi.fn(async (id: string) => ({ id })),
}));

const sampleBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
vi.mock("../../services/file-storage.service", () => ({
  readFileAsBuffer: vi.fn(async () => sampleBuffer),
  getFullPath: vi.fn((tokens: string[]) => tokens.join("/")),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => true),
}));

describe("Files Route - Binary Response", () => {
  const mockUserId = "550e8400-e29b-41d4-a716-446655440000";
  const mockSessionId = "660e8400-e29b-41d4-a716-446655440001";
  const mockCompanyId = "3c95616a-f94e-4faf-abb4-2241e2c742fd";

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockGetSession.mockResolvedValue({
      userId: mockUserId,
      userRole: "user",
      companyId: mockCompanyId,
      email: "user@example.com",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  });

  it("serves image bytes with correct headers and is allowed by wrapper", async () => {
    const token = await generateJWT(mockUserId, "user", mockCompanyId, mockSessionId);
    const filename = "1765121368245-e4e60df6-30b8-48d7-95a0-58e9a32bdae1.jpeg";
    const url = new URL(`http://localhost/api/v1/files/vault/${mockCompanyId}/${filename}`);
    const request = new Request(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      method: "GET",
    });

    const response = await handleRequest(request, url);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.length).toBe(sampleBuffer.length);
    expect(buffer[0]).toBe(sampleBuffer[0]);
  });
});
