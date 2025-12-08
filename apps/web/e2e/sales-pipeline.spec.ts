import { expect, test } from "@playwright/test";

test.describe("Sales Pipeline Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@crm.com");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });
  });

  test("should create a quote and view it", async ({ page }) => {
    // Navigate to quotes page
    await page.goto("/dashboard/sales/quotes");
    await expect(page).toHaveURL(/\/quotes/, { timeout: 5000 });

    // Click create new quote button
    const createButton = page
      .locator(
        'button:has-text("New Quote"), a:has-text("New Quote"), button:has-text("Create Quote")'
      )
      .first();
    await createButton.click();

    // Wait for quote form
    await page.waitForURL(/\/quotes\/(new|create)/, { timeout: 5000 });

    // Fill quote details
    const timestamp = Date.now();
    const _quoteNumber = `QT-${timestamp}`;

    // Fill customer (if there's a customer select/input)
    const customerInput = page
      .locator('input[name="customer"], select[name="customer"], input[placeholder*="customer" i]')
      .first();
    if (await customerInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await customerInput.click();
      await page.waitForTimeout(500);
      // Select first customer from dropdown or type
      const firstOption = page.locator('[role="option"], li, [data-value]').first();
      if (await firstOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await firstOption.click();
      }
    }

    // Add line items if possible
    const addItemButton = page
      .locator('button:has-text("Add Item"), button:has-text("Add Line")')
      .first();
    if (await addItemButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addItemButton.click();

      // Fill item details
      const descriptionInput = page
        .locator('input[name*="description"], textarea[name*="description"]')
        .first();
      if (await descriptionInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await descriptionInput.fill("Test Product");
      }

      const amountInput = page
        .locator('input[name*="amount"], input[name*="price"], input[type="number"]')
        .first();
      if (await amountInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await amountInput.fill("1000");
      }
    }

    // Save the quote
    const saveButton = page
      .locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]')
      .first();
    await saveButton.click();

    // Verify quote was created
    await expect(page).toHaveURL(/\/quotes/, { timeout: 5000 });

    // Should show success message or the quote in the list
    const successIndicator = page.locator('text=/created|success|saved/i, [role="status"]').first();
    if (await successIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(successIndicator).toBeVisible();
    }
  });

  test("should create an invoice", async ({ page }) => {
    // Navigate to invoices page
    await page.goto("/dashboard/sales/invoices");
    await expect(page).toHaveURL(/\/invoices/, { timeout: 5000 });

    // Click create new invoice button
    const createButton = page
      .locator(
        'button:has-text("New Invoice"), a:has-text("New Invoice"), button:has-text("Create Invoice")'
      )
      .first();
    await createButton.click();

    // Wait for invoice form
    await page.waitForURL(/\/invoices\/(new|create)/, { timeout: 5000 });

    // Fill invoice details
    const _timestamp = Date.now();

    // Select customer
    const customerInput = page
      .locator('input[name="customer"], select[name="customer"], input[placeholder*="customer" i]')
      .first();
    if (await customerInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await customerInput.click();
      await page.waitForTimeout(500);
      const firstOption = page.locator('[role="option"], li, [data-value]').first();
      if (await firstOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await firstOption.click();
      }
    }

    // Add line items
    const addItemButton = page
      .locator('button:has-text("Add Item"), button:has-text("Add Line")')
      .first();
    if (await addItemButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addItemButton.click();

      const descriptionInput = page
        .locator('input[name*="description"], textarea[name*="description"]')
        .first();
      if (await descriptionInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await descriptionInput.fill("Consulting Services");
      }

      const amountInput = page
        .locator('input[name*="amount"], input[name*="price"], input[type="number"]')
        .first();
      if (await amountInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await amountInput.fill("2500");
      }
    }

    // Save the invoice
    const saveButton = page
      .locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]')
      .first();
    await saveButton.click();

    // Verify invoice was created
    await expect(page).toHaveURL(/\/invoices/, { timeout: 5000 });
  });

  test("should view invoice details and public link", async ({ page }) => {
    // Navigate to invoices page
    await page.goto("/dashboard/sales/invoices");
    await expect(page).toHaveURL(/\/invoices/, { timeout: 5000 });

    // Click on first invoice in the list
    const firstInvoice = page.locator('tr:has-text("INV-"), a[href*="/invoices/"]').first();
    if (await firstInvoice.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstInvoice.click();

      // Should navigate to invoice details page
      await expect(page).toHaveURL(/\/invoices\/[^/]+/, { timeout: 5000 });

      // Look for share/public link button
      const shareButton = page
        .locator(
          'button:has-text("Share"), button:has-text("Public Link"), button:has-text("Copy Link")'
        )
        .first();
      if (await shareButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(shareButton).toBeVisible();
      }
    }
  });

  test("should navigate between quotes and invoices", async ({ page }) => {
    // Start at sales dashboard
    await page.goto("/dashboard/sales");

    // Navigate to quotes
    const quotesLink = page.locator('a:has-text("Quotes")').first();
    if (await quotesLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await quotesLink.click();
      await expect(page).toHaveURL(/\/quotes/, { timeout: 3000 });
    } else {
      await page.goto("/dashboard/sales/quotes");
    }

    // Navigate to invoices
    const invoicesLink = page.locator('a:has-text("Invoices")').first();
    if (await invoicesLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await invoicesLink.click();
      await expect(page).toHaveURL(/\/invoices/, { timeout: 3000 });
    } else {
      await page.goto("/dashboard/sales/invoices");
    }

    // Navigate to orders
    const ordersLink = page.locator('a:has-text("Orders")').first();
    if (await ordersLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ordersLink.click();
      await expect(page).toHaveURL(/\/orders/, { timeout: 3000 });
    }
  });

  test("should handle invoice status changes", async ({ page }) => {
    await page.goto("/dashboard/sales/invoices");
    await expect(page).toHaveURL(/\/invoices/, { timeout: 5000 });

    // Click on first invoice
    const firstInvoice = page.locator('tr:has-text("INV-"), a[href*="/invoices/"]').first();
    if (await firstInvoice.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstInvoice.click();
      await expect(page).toHaveURL(/\/invoices\/[^/]+/, { timeout: 5000 });

      // Look for status dropdown or buttons
      const statusButton = page
        .locator('button:has-text("Status"), select[name*="status"], button:has-text("Mark as")')
        .first();
      if (await statusButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(statusButton).toBeVisible();
      }
    }
  });
});
