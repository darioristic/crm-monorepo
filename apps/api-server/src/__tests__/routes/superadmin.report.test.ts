import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db/client";
import { tenants, users } from "../../db/schema/index";
import type { Route } from "../../routes/helpers";

describe("Superadmin Detailed Report Route", () => {
  const mockAuth = {
    userId: "admin-1",
    role: "superadmin" as const,
    sessionId: "sess-1",
  };

  let routes: Route[];

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.doMock("../../middleware/auth", async (importOriginal) => {
      const actual = await importOriginal<any>();
      return {
        ...actual,
        verifyAndGetUser: vi.fn().mockResolvedValue(mockAuth),
        requireAdmin: (h: any) => (req: Request, url: URL, params: any) =>
          h(req, url, params, mockAuth),
      };
    });

    const mod = await import("../../routes/superadmin");
    routes = mod.superadminRoutes;

    // Mock db.select().from(...) for users and tenants
    vi.spyOn(db, "select").mockImplementation((_: any) => {
      return {
        from: vi.fn(async (schema: any) => {
          if (schema === users) {
            return [
              {
                id: "u1",
                firstName: "Ana",
                lastName: "Jovanović",
                email: "ana@example.com",
                role: "crm_user",
              },
              {
                id: "u2",
                firstName: "Marko",
                lastName: "Kovač",
                email: "marko@example.com",
                role: "tenant_admin",
              },
            ];
          }
          if (schema === tenants) {
            return [
              {
                id: "t1",
                name: "Tenant A",
                createdAt: new Date("2024-01-01T00:00:00Z"),
                status: "active",
              },
              {
                id: "t2",
                name: "Tenant B",
                createdAt: new Date("2024-06-01T00:00:00Z"),
                status: "suspended",
              },
            ];
          }
          return [] as any[];
        }),
      } as any;
    });
  });

  const callRoute = async (
    path: string,
    method = "GET",
    options: RequestInit = {}
  ): Promise<Response> => {
    const url = new URL(`http://localhost${path}`);
    const request = new Request(url.toString(), { method, ...options });

    const route = routes.find((r) => r.method === method && r.pattern.test(path));
    if (!route) throw new Error(`No route found for ${method} ${path}`);

    const match = path.match(route.pattern);
    const params: Record<string, string> = {};
    if (match && route.params.length > 0) {
      route.params.forEach((param, index) => {
        params[param] = match[index + 1];
      });
    }

    return route.handler(request, url, params);
  };

  it("vrati listu svih korisnika i svih tenant-a", async () => {
    const resp = await callRoute("/api/superadmin/reports/detailed");
    expect(resp.status).toBe(200);
    const data: any = await resp.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.users)).toBe(true);
    expect(Array.isArray(data.data.tenants)).toBe(true);
    expect(data.data.users[0]).toHaveProperty("id");
    expect(data.data.users[0]).toHaveProperty("name");
    expect(data.data.users[0]).toHaveProperty("email");
    expect(data.data.users[0]).toHaveProperty("role");
    expect(data.data.tenants[0]).toHaveProperty("id");
    expect(data.data.tenants[0]).toHaveProperty("name");
    expect(data.data.tenants[0]).toHaveProperty("createdAt");
    expect(data.data.tenants[0]).toHaveProperty("status");
  });
});
