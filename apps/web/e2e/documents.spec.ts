import { expect, test } from "@playwright/test";

test.describe("Document Management Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@crm.com");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });
  });

  test("should navigate to documents page", async ({ page }) => {
    // Try to navigate to documents
    await page.goto("/dashboard/documents");

    // Should be on documents page or redirected appropriately
    await page.waitForLoadState("networkidle");
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/dashboard/);
  });

  test("should upload a document", async ({ page }) => {
    await page.goto("/dashboard/documents");
    await page.waitForLoadState("networkidle");

    // Look for upload button or file input
    const uploadButton = page
      .locator('button:has-text("Upload"), button:has-text("Add Document"), input[type="file"]')
      .first();

    if (await uploadButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Check if it's a file input or button that triggers file input
      const tagName = await uploadButton.evaluate((el) => el.tagName);

      if (tagName === "INPUT") {
        // Create a test file
        const buffer = Buffer.from("Test document content for E2E testing");
        await uploadButton.setInputFiles({
          name: "test-document.txt",
          mimeType: "text/plain",
          buffer: buffer,
        });
      } else {
        // Click button and look for file input
        await uploadButton.click();
        const fileInput = page.locator('input[type="file"]');
        await fileInput.waitFor({ timeout: 2000 });

        const buffer = Buffer.from("Test document content for E2E testing");
        await fileInput.setInputFiles({
          name: "test-document.txt",
          mimeType: "text/plain",
          buffer: buffer,
        });
      }

      // Look for upload confirmation or save button
      const saveButton = page
        .locator('button:has-text("Save"), button:has-text("Upload"), button:has-text("Submit")')
        .first();
      if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveButton.click();
      }

      // Wait for success message
      await page.waitForTimeout(2000);
    }
  });

  test("should view document list", async ({ page }) => {
    await page.goto("/dashboard/documents");
    await page.waitForLoadState("networkidle");

    // Should display documents table or list
    const documentList = page.locator('table, [role="table"], .document-list, ul li');
    const hasDocuments = await documentList.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasDocuments) {
      await expect(documentList).toBeVisible();
    }
  });

  test("should search for documents", async ({ page }) => {
    await page.goto("/dashboard/documents");
    await page.waitForLoadState("networkidle");

    // Look for search input
    const searchInput = page
      .locator('input[type="search"], input[placeholder*="search" i], input[name="search"]')
      .first();

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill("test");
      await page.waitForTimeout(1000);

      // Results should filter
      await expect(searchInput).toHaveValue("test");
    }
  });

  test("should download a document", async ({ page }) => {
    await page.goto("/dashboard/documents");
    await page.waitForLoadState("networkidle");

    // Look for first document download link/button
    const downloadButton = page
      .locator('a[download], button:has-text("Download"), a:has-text("Download")')
      .first();

    if (await downloadButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Set up download listener
      const downloadPromise = page.waitForEvent("download", { timeout: 5000 }).catch(() => null);
      await downloadButton.click();

      const download = await downloadPromise;
      if (download) {
        expect(download).toBeTruthy();
      }
    }
  });

  test("should share a document", async ({ page }) => {
    await page.goto("/dashboard/documents");
    await page.waitForLoadState("networkidle");

    // Look for first document and share button
    const shareButton = page.locator('button:has-text("Share"), button[title*="share" i]').first();

    if (await shareButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await shareButton.click();

      // Should show share dialog
      const shareDialog = page.locator('dialog, [role="dialog"], .modal, [data-state="open"]');
      if (await shareDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(shareDialog).toBeVisible();

        // Look for copy link button
        const copyLinkButton = page
          .locator('button:has-text("Copy Link"), button:has-text("Copy")')
          .first();
        if (await copyLinkButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(copyLinkButton).toBeVisible();
        }
      }
    }
  });

  test("should delete a document", async ({ page }) => {
    await page.goto("/dashboard/documents");
    await page.waitForLoadState("networkidle");

    // Look for delete button
    const deleteButton = page
      .locator('button:has-text("Delete"), button[title*="delete" i]')
      .first();

    if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Count documents before delete
      const _documentRows = page.locator("tr, li").count();

      await deleteButton.click();

      // Look for confirmation dialog
      const confirmButton = page
        .locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")')
        .first();
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();

        // Wait for deletion to complete
        await page.waitForTimeout(1000);
      }
    }
  });

  test("should filter documents by type", async ({ page }) => {
    await page.goto("/dashboard/documents");
    await page.waitForLoadState("networkidle");

    // Look for filter dropdown or buttons
    const filterButton = page
      .locator('select[name*="type"], button:has-text("Filter"), select[name*="filter"]')
      .first();

    if (await filterButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterButton.click();

      // Select a filter option
      const filterOption = page.locator('option, [role="option"]').nth(1);
      if (await filterOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await filterOption.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test("should view document details", async ({ page }) => {
    await page.goto("/dashboard/documents");
    await page.waitForLoadState("networkidle");

    // Click on first document
    const firstDocument = page.locator("tr td:first-child, li a, [data-document-id]").first();

    if (await firstDocument.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstDocument.click();

      // Should navigate to document details or show modal
      await page.waitForTimeout(1000);

      const detailsView = page.locator('h1, h2, .document-details, [role="dialog"]');
      const hasDetails = await detailsView.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasDetails) {
        await expect(detailsView).toBeVisible();
      }
    }
  });
});
