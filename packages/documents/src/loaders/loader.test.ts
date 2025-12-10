/**
 * Document Loader Tests
 */

import { describe, expect, it } from "bun:test";
import {
  documentLoader,
  getSupportedExtensions,
  isFileTypeSupported,
  loadDocument,
} from "./loader";

describe("Document Loader", () => {
  describe("isFileTypeSupported", () => {
    it("should return true for PDF files", () => {
      expect(isFileTypeSupported("application/pdf")).toBe(true);
    });

    it("should return true for DOCX files", () => {
      expect(
        isFileTypeSupported(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
      ).toBe(true);
    });

    it("should return true for XLSX files", () => {
      expect(
        isFileTypeSupported("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      ).toBe(true);
    });

    it("should return true for plain text files", () => {
      expect(isFileTypeSupported("text/plain")).toBe(true);
    });

    it("should return true for CSV files", () => {
      expect(isFileTypeSupported("text/csv")).toBe(true);
    });

    it("should return false for unsupported types", () => {
      expect(isFileTypeSupported("application/unknown")).toBe(false);
    });
  });

  describe("getSupportedExtensions", () => {
    it("should return an array of supported extensions", () => {
      const extensions = getSupportedExtensions();
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions).toContain("pdf");
      expect(extensions).toContain("docx");
      expect(extensions).toContain("xlsx");
      expect(extensions).toContain("csv");
      expect(extensions).toContain("txt");
    });
  });

  describe("loadDocument", () => {
    it("should load plain text content", async () => {
      const content = new Blob(["Hello, World! This is a test document."], {
        type: "text/plain",
      });

      const result = await loadDocument({
        content,
        metadata: { mimetype: "text/plain", filename: "test.txt" },
      });

      expect(result.text).toBe("Hello, World! This is a test document.");
    });

    it("should load CSV content", async () => {
      const csvContent = `Name,Age,City
John,30,New York
Jane,25,Los Angeles`;

      const content = new Blob([csvContent], { type: "text/csv" });

      const result = await loadDocument({
        content,
        metadata: { mimetype: "text/csv", filename: "test.csv" },
      });

      expect(result.text).toContain("Name | Age | City");
      expect(result.text).toContain("John | 30 | New York");
    });

    it("should return null for unsupported file types", async () => {
      const content = new Blob(["binary data"], {
        type: "application/octet-stream",
      });

      const result = await loadDocument({
        content,
        metadata: { mimetype: "application/unknown-type", filename: "test.bin" },
      });

      expect(result.text).toBeNull();
    });
  });

  describe("DocumentLoader class", () => {
    it("should expose isSupported method", () => {
      expect(documentLoader.isSupported("application/pdf")).toBe(true);
      expect(documentLoader.isSupported("application/unknown")).toBe(false);
    });

    it("should expose getSupportedExtensions method", () => {
      const extensions = documentLoader.getSupportedExtensions();
      expect(extensions).toContain("pdf");
    });
  });
});
