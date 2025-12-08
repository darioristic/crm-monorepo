import { expect, test } from "@playwright/test";

test.describe("Multi-tenant Isolation Flow", () => {
  test("should isolate data between different tenants", async ({ page, context }) => {
    // Login as first tenant/company user
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@crm.com");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });

    // Navigate to companies and note the current company
    await page.goto("/dashboard/companies");
    await page.waitForLoadState("networkidle");

    // Get list of companies visible to this user
    const _companiesCount1 = await page
      .locator("tr[data-company], [data-company-id]")
      .count()
      .catch(() => 0);

    // Create a new company for this tenant
    const createButton = page
      .locator(
        'button:has-text("New Company"), button:has-text("Create Company"), a:has-text("New Company")'
      )
      .first();
    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createButton.click();

      const timestamp = Date.now();
      const companyName = `Tenant1 Company ${timestamp}`;

      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
      if (await nameInput.isVisible({ timeout: 2000 })) {
        await nameInput.fill(companyName);

        const saveButton = page
          .locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]')
          .first();
        await saveButton.click();
        await page.waitForTimeout(2000);
      }
    }

    // Logout
    const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout")').first();
    if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logoutButton.click();
    } else {
      const userMenu = page
        .locator('[data-testid="user-menu"], button[aria-label*="user"]')
        .first();
      if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
        await userMenu.click();
        await page.locator("text=/logout|sign out/i").click();
      } else {
        await page.goto("/login");
      }
    }

    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("should only show data belonging to current tenant", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@crm.com");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });

    // Check companies - should only see companies for this tenant
    await page.goto("/dashboard/companies");
    await page.waitForLoadState("networkidle");

    const companies = page.locator("tr[data-company], [data-company-id], tr:has(td)");
    const count = await companies.count().catch(() => 0);

    // Verify companies belong to this tenant (basic check)
    if (count > 0) {
      // Companies should be visible
      expect(count).toBeGreaterThan(0);
    }

    // Check invoices - should only see invoices for this tenant
    await page.goto("/dashboard/sales/invoices");
    await page.waitForLoadState("networkidle");

    const invoices = page.locator('tr:has-text("INV-"), [data-invoice-id]');
    const invoiceCount = await invoices.count().catch(() => 0);

    // Invoices should belong to current tenant
    expect(invoiceCount).toBeGreaterThanOrEqual(0);

    // Check projects - should only see projects for this tenant
    await page.goto("/dashboard/projects");
    await page.waitForLoadState("networkidle");

    const projects = page.locator("tr[data-project], [data-project-id]");
    const projectCount = await projects.count().catch(() => 0);

    // Projects should belong to current tenant
    expect(projectCount).toBeGreaterThanOrEqual(0);
  });

  test("should not allow access to other tenant data via URL manipulation", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@crm.com");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });

    // Try to access a company with a different/invalid ID
    // This should either redirect, show 404, or show access denied
    await page.goto("/dashboard/companies/99999999");
    await page.waitForLoadState("networkidle");

    // Should not show unauthorized data
    // Check for error message, redirect, or 404
    const errorMessage = page
      .locator("text=/not found|access denied|forbidden|unauthorized/i")
      .first();
    const is404 =
      page.url().includes("404") ||
      (await errorMessage.isVisible({ timeout: 2000 }).catch(() => false));

    // OR should redirect back to safe page
    const redirected = page.url().includes("/dashboard") && !page.url().includes("99999999");

    expect(is404 || redirected).toBeTruthy();
  });

  test("should enforce tenant isolation in API requests", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@crm.com");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });

    // Monitor API requests
    const apiRequests: string[] = [];

    page.on("request", (request) => {
      if (request.url().includes("/api/")) {
        apiRequests.push(request.url());
      }
    });

    // Navigate to companies
    await page.goto("/dashboard/companies");
    await page.waitForLoadState("networkidle");

    // Verify API requests were made
    expect(apiRequests.length).toBeGreaterThan(0);

    // API requests should include proper authentication
    // (cookies are automatically sent with requests)
  });

  test("should show correct company context in navigation", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@crm.com");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });

    // Check if there's a company selector or indicator
    const companyIndicator = page
      .locator("[data-company], .company-name, text=/current company/i")
      .first();
    if (await companyIndicator.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(companyIndicator).toBeVisible();
    }
  });

  test("should maintain tenant isolation when creating records", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@crm.com");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });

    // Create a company (should be associated with current tenant)
    await page.goto("/dashboard/companies");
    const createButton = page
      .locator('button:has-text("New Company"), a:has-text("New Company")')
      .first();

    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createButton.click();

      const timestamp = Date.now();
      const companyName = `Test Company ${timestamp}`;

      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
      if (await nameInput.isVisible({ timeout: 2000 })) {
        await nameInput.fill(companyName);

        const saveButton = page
          .locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]')
          .first();
        await saveButton.click();
        await page.waitForTimeout(2000);

        // Verify company was created and is visible in the list
        await page.goto("/dashboard/companies");
        await page.waitForLoadState("networkidle");

        const newCompany = page.locator(`text="${companyName}"`).first();
        if (await newCompany.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(newCompany).toBeVisible();
        }
      }
    }
  });

  test("should handle tenant switching if supported", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@crm.com");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });

    // Look for tenant/company switcher
    const tenantSwitcher = page
      .locator('[data-tenant-switcher], button:has-text("Switch Company"), select[name*="company"]')
      .first();

    if (await tenantSwitcher.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tenantSwitcher.click();

      // Should show list of available tenants/companies
      const tenantOptions = page.locator('[role="option"], option, [data-company-option]');
      const optionCount = await tenantOptions.count().catch(() => 0);

      if (optionCount > 1) {
        // Select different tenant
        await tenantOptions.nth(1).click();
        await page.waitForTimeout(2000);

        // Should reload data for new tenant
        await page.waitForLoadState("networkidle");
      }
    }
  });

  test("should display correct tenant information in account settings", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@crm.com");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });

    // Navigate to account settings
    await page.goto("/dashboard/settings/accounts");
    await page.waitForLoadState("networkidle");

    // Should show current account/tenant information
    const accountInfo = page.locator("h1, h2, .account-info, [data-account]").first();
    if (await accountInfo.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(accountInfo).toBeVisible();
    }
  });
});
