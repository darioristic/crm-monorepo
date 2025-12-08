import { calculateTotal } from "@/utils/invoice-calculate";

describe("calculateTotal", () => {
  it("should handle NaN values in line items", () => {
    const lineItems = [
      {
        name: "Item 1",
        quantity: 1,
        price: 100,
        discount: NaN, // Invalid input
        vat: 20,
      },
      {
        name: "Item 2",
        quantity: NaN, // Invalid input
        price: 50,
        discount: 0,
        vat: 20,
      },
      {
        name: "Item 3",
        quantity: 1,
        price: NaN, // Invalid input
        discount: 0,
        vat: 20,
      },
    ];

    const result = calculateTotal({
      lineItems: lineItems as any,
      taxRate: 0,
      vatRate: 20,
      includeVat: true,
      includeTax: false,
    });

    expect(result.grossTotal).toBe(100); // Only Item 1 has valid price*qty (100*1). Item 2 has NaN qty. Item 3 has NaN price.
    // Item 1: price 100, qty 1 -> lineTotal 100. discount NaN -> 0. lineNet 100.
    // Item 2: price 50, qty 0 (NaN->0) -> lineTotal 0.
    // Item 3: price 0 (NaN->0), qty 1 -> lineTotal 0.

    expect(result.subTotal).toBe(100);
    expect(result.discountAmount).toBe(0);
    expect(result.vat).toBe(20); // 20% of 100
    expect(result.total).toBe(120);

    expect(Number.isNaN(result.grossTotal)).toBe(false);
    expect(Number.isNaN(result.subTotal)).toBe(false);
    expect(Number.isNaN(result.total)).toBe(false);
    expect(Number.isNaN(result.vat)).toBe(false);
  });
});
