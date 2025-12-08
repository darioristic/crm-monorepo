import { beforeAll, describe, expect, it } from "vitest";
import { createTestSession, createTestUser, getAuthHeaders, integrationEnabled } from "./helpers";

const API_URL = process.env.API_URL || `http://localhost:${process.env.PORT || "3002"}`;
const describeFn = integrationEnabled ? describe : describe.skip;

describeFn("Documents Vault Integration Tests", () => {
  let testUser: { email: string; password: string; id?: string };
  let authHeaders: Record<string, string>;

  beforeAll(async () => {
    testUser = await createTestUser();
    const sessionToken = await createTestSession(testUser.id!);
    authHeaders = await getAuthHeaders(sessionToken);
  });

  it("uploads multiple files with validation and returns per-file report", async () => {
    const form = new FormData();
    const pdfBlob = new Blob(["%PDF-1.4 test"], { type: "application/pdf" });
    const pngBlob = new Blob(["PNG"], { type: "image/png" });
    const badBlob = new Blob(["EXE"], { type: "application/x-msdownload" });

    // File objects with names
    const pdfFile = new File([pdfBlob], "test-document.pdf", {
      type: "application/pdf",
    });
    const pngFile = new File([pngBlob], "image.png", { type: "image/png" });

    form.append("file1", pdfFile);
    form.append("file2", pngFile);
    form.append("file3", badBlob, "bad.exe");

    const _jsonPayload = [
      {
        contentBase64: Buffer.from("%PDF-1.4 test").toString("base64"),
        originalName: "test-document.pdf",
        mimetype: "application/pdf",
      },
      {
        contentBase64: Buffer.from("PNG").toString("base64"),
        originalName: "image.png",
        mimetype: "image/png",
      },
      {
        contentBase64: Buffer.from("EXE").toString("base64"),
        originalName: "bad.exe",
        mimetype: "application/x-msdownload",
      },
    ];

    const response = await fetch(`${API_URL}/api/v1/documents/upload`, {
      method: "POST",
      headers: {
        ...authHeaders,
      },
      body: form,
    });

    expect(response.status).toBe(201);
    const data: any = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.documents)).toBe(true);
    expect(data.data.report.createdCount).toBeGreaterThanOrEqual(2);
    expect(data.data.report.failedCount).toBeGreaterThanOrEqual(1);

    // Process uploaded documents
    const docs = data.data.documents as Array<{ pathTokens: string[] }>;
    const processResponse = await fetch(`${API_URL}/api/v1/documents/process`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        docs.map((d) => ({
          filePath: d.pathTokens,
          mimetype: "application/octet-stream",
          size: 10,
        }))
      ),
    });

    expect(processResponse.status).toBe(200);
    const processData: any = await processResponse.json();
    expect(processData.success).toBe(true);

    // Report endpoint
    const reportResp = await fetch(`${API_URL}/api/v1/documents/creation-report`, {
      method: "GET",
      headers: authHeaders,
    });
    expect(reportResp.status).toBe(200);
    const reportData: any = await reportResp.json();
    expect(reportData.success).toBe(true);
    expect(reportData.data.totalCreated).toBeGreaterThanOrEqual(0);
    expect(reportData.data.totalCompleted).toBeGreaterThanOrEqual(0);
    expect(reportData.data.totalFailed).toBeGreaterThanOrEqual(0);
  });
});
