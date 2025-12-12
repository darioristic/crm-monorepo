import { describe, expect, it } from "vitest";
import { extractDataFromText } from "./document-ocr";

describe("document-ocr extractDataFromText", () => {
  it("extracts Serbian vendor name, amount, currency and website", () => {
    const sampleText = `
Cloud Native d.o.o.
PIB: 109876543
Faktura br: 2025-00014
Datum: 07.10.2025
Ukupno: 86.964,06 RSD
Email: office@cloudnative.rs
Web: www.cloudnative.rs
    `;

    const data = extractDataFromText(sampleText);

    expect(data.vendorName).toBe("Cloud Native d.o.o.");
    expect(data.totalAmount).toBe(86964.06);
    expect(data.currency).toBe("RSD");
    expect(data.vendorWebsite).toBe("cloudnative.rs");
    expect(data.invoiceNumber).toBe("2025-00014");
    expect(data.invoiceDate).toBe("07.10.2025");
  });

  it("handles amount with EUR symbol and thousand separators", () => {
    const text = `
Red Hat Inc.
Invoice: INV-1234
Date: 01.09.2025
Total: € 1.234,56
    `;
    const data = extractDataFromText(text);
    expect(data.totalAmount).toBe(1234.56);
    expect(data.currency).toBe("EUR");
  });

  it("detects RSD via 'dinara' and parses 'Faktura broj' + 'Ukupno za plaćanje'", () => {
    const text = `
    Spark Analytics DOO
    Faktura broj: 2025/033
    Datum fakture: 15.10.2025
    Ukupno za plaćanje: 120.500,00 dinara
    E-mail: billing@spark.rs
    `;
    const data = extractDataFromText(text);
    expect(data.invoiceNumber).toBe("2025/033");
    expect(data.totalAmount).toBe(120500.0);
    expect(data.currency).toBe("RSD");
    expect(data.vendorWebsite).toBe("spark.rs");
  });
});
