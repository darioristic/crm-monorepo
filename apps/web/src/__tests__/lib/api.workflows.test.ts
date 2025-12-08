import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ordersApi, quotesApi, workflowsApi } from "../../lib/api";

const originalFetch = global.fetch;

describe("API workflows", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async (_url: any, init?: any) => {
      return new Response(
        JSON.stringify({ success: true, data: init?.body ? JSON.parse(init.body) : {} }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("quotesApi.convertToOrder sends POST with body", async () => {
    const res = await quotesApi.convertToOrder("quote-1", { orderNumber: "ORD-1" });
    expect(global.fetch as any).toHaveBeenCalledWith(
      "/api/v1/quotes/quote-1/convert-to-order",
      expect.objectContaining({ method: "POST" })
    );
    expect(res.success).toBe(true);
  });

  it("quotesApi.convertToInvoice sends POST with body", async () => {
    const res = await quotesApi.convertToInvoice("quote-2", { notes: "Test" });
    expect(global.fetch as any).toHaveBeenCalledWith(
      "/api/v1/quotes/quote-2/convert-to-invoice",
      expect.objectContaining({ method: "POST" })
    );
    expect(res.success).toBe(true);
  });

  it("ordersApi.convertToInvoice sends POST with body", async () => {
    const res = await ordersApi.convertToInvoice("order-1", { paymentTerms: 15 });
    expect(global.fetch as any).toHaveBeenCalledWith(
      "/api/v1/orders/order-1/convert-to-invoice",
      expect.objectContaining({ method: "POST" })
    );
    expect(res.success).toBe(true);
  });

  it("workflowsApi.getDocumentChain requests correct URL", async () => {
    const res = await workflowsApi.getDocumentChain("quote-3");
    expect(global.fetch as any).toHaveBeenCalledWith(
      "/api/v1/workflows/document-chain/quote-3",
      expect.any(Object)
    );
    expect(res.success).toBe(true);
  });
});
