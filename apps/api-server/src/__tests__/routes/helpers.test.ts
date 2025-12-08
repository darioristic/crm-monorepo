import { describe, expect, it } from "vitest";
import { applyCompanyIdFromHeader } from "../../routes/helpers";

describe("applyCompanyIdFromHeader", () => {
  it("does not override existing companyId in query", () => {
    const url = new URL(
      "http://localhost/api/v1/quotes?companyId=11111111-1111-1111-1111-111111111111"
    );
    const headers = new Headers({
      "x-company-id": "22222222-2222-2222-2222-222222222222",
    });
    const request = new Request(url.toString(), { headers });
    const effective = applyCompanyIdFromHeader(request, url);
    expect(effective.searchParams.get("companyId")).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("applies header companyId when query lacks it", () => {
    const url = new URL("http://localhost/api/v1/quotes");
    const headers = new Headers({
      "x-company-id": "550e8400-e29b-41d4-a716-446655440000",
    });
    const request = new Request(url.toString(), { headers });
    const effective = applyCompanyIdFromHeader(request, url);
    expect(effective.searchParams.get("companyId")).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});
