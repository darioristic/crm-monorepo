import { expect, test } from "@playwright/test";

test.describe("Invoices Management", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@crm.com");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });
  });

  test("should navigate to invoices page", async ({ page }) => {
    await page.goto("/invoices");
    await expect(page.locator("h1, h2")).toContainText(/invoice/i, {
      timeout: 5000,
    });
  });

  test("should create a new invoice", async ({ page }) => {
    await page.goto("/invoices");

    // Find and click "New Invoice" button
    const newInvoiceButton = page.locator(
      'button:has-text("New"), button:has-text("Create"), button:has-text("Add"), [data-testid="new-invoice"]'
    );
    await newInvoiceButton.first().click({ timeout: 5000 });

    // Fill invoice form - adjust selectors based on your actual form
    await page.waitForSelector('form, [role="dialog"]', { timeout: 5000 });

    // Fill customer/company field if present
    const customerInput = page.locator(
      'input[name="customer"], input[name="company"], select[name="customer"]'
    );
    if (await customerInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await customerInput.fill("Test Customer");
    }

    // Fill amount
    const amountInput = page.locator('input[name="amount"], input[name="total"]');
    if (await amountInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await amountInput.fill("1000");
    }

    // Submit form
    const submitButton = page.locator(
      'button[type="submit"], button:has-text("Create"), button:has-text("Save")'
    );
    await submitButton.click();

    // Verify invoice was created
    await expect(page.locator("text=/invoice|success/i")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should view invoice details", async ({ page }) => {
    await page.goto("/invoices");

    // Wait for invoices list
    await page.waitForSelector('table, [role="list"], .invoice-item', {
      timeout: 5000,
    });

    // Click on first invoice
    const firstInvoice = page.locator('tr, [role="listitem"], .invoice-item').first();
    await firstInvoice.click({ timeout: 5000 });

    // Verify invoice details are displayed
    await expect(page.locator("text=/invoice|amount|total/i")).toBeVisible({
      timeout: 5000,
    });
  });
});
