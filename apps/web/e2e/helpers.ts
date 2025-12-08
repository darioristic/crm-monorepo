import { expect, type Page } from "@playwright/test";

/**
 * Common test credentials
 */
export const TEST_CREDENTIALS = {
  admin: {
    email: "admin@crm.com",
    password: "Admin123!",
  },
};

/**
 * Login helper function
 */
export async function login(
  page: Page,
  email: string = TEST_CREDENTIALS.admin.email,
  password: string = TEST_CREDENTIALS.admin.password
) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });
}

/**
 * Logout helper function
 */
export async function logout(page: Page) {
  const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout")').first();

  if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutButton.click();
  } else {
    // Try to find user menu and logout
    const userMenu = page.locator('[data-testid="user-menu"], button[aria-label*="user"]').first();
    if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      await userMenu.click();
      await page.locator("text=/logout|sign out/i").click();
    }
  }

  await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
}

/**
 * Generate unique test data
 */
export function generateTestData(prefix: string) {
  const timestamp = Date.now();
  return {
    timestamp,
    name: `${prefix} ${timestamp}`,
    email: `test${timestamp}@example.com`,
    id: `TEST-${timestamp}`,
  };
}

/**
 * Wait for form submission to complete
 */
export async function waitForFormSubmission(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
}

/**
 * Fill and submit a form with common patterns
 */
export async function fillAndSubmitForm(page: Page, formData: Record<string, string>) {
  for (const [name, value] of Object.entries(formData)) {
    const input = page
      .locator(`input[name="${name}"], textarea[name="${name}"], select[name="${name}"]`)
      .first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.fill(value);
    }
  }

  const submitButton = page
    .locator(
      'button:has-text("Save"), button:has-text("Create"), button:has-text("Submit"), button[type="submit"]'
    )
    .first();
  await submitButton.click();
  await waitForFormSubmission(page);
}

/**
 * Check if element is visible with fallback
 */
export async function isVisibleWithFallback(
  page: Page,
  selector: string,
  timeout: number = 3000
): Promise<boolean> {
  const element = page.locator(selector).first();
  return await element.isVisible({ timeout }).catch(() => false);
}

/**
 * Click first visible element from multiple selectors
 */
export async function clickFirstVisible(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const element = page.locator(selector).first();
    if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
      await element.click();
      return true;
    }
  }
  return false;
}

/**
 * Confirm dialog action (for delete, etc.)
 */
export async function confirmDialog(page: Page) {
  const confirmButton = page
    .locator(
      'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete"), button:has-text("OK")'
    )
    .first();
  if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmButton.click();
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

/**
 * Create a test file for upload
 */
export function createTestFile(filename: string, content: string = "Test file content") {
  return {
    name: filename,
    mimeType: getMimeType(filename),
    buffer: Buffer.from(content),
  };
}

/**
 * Get MIME type from filename
 */
function getMimeType(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    txt: "text/plain",
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    csv: "text/csv",
    json: "application/json",
  };
  return mimeTypes[extension || ""] || "application/octet-stream";
}

/**
 * Navigate to a dashboard section safely
 */
export async function navigateTo(page: Page, path: string) {
  const fullPath = path.startsWith("/") ? path : `/dashboard/${path}`;
  await page.goto(fullPath);
  await page.waitForLoadState("networkidle");
}

/**
 * Search in a list/table
 */
export async function searchFor(page: Page, searchTerm: string) {
  const searchInput = page
    .locator('input[type="search"], input[placeholder*="search" i], input[name="search"]')
    .first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill(searchTerm);
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

/**
 * Get count of items in a table or list
 */
export async function getItemCount(
  page: Page,
  selector: string = "tr:has(td), li, [data-item]"
): Promise<number> {
  return await page
    .locator(selector)
    .count()
    .catch(() => 0);
}

/**
 * Wait for success message
 */
export async function waitForSuccess(page: Page) {
  const successIndicator = page
    .locator('text=/created|success|saved|updated|deleted/i, [role="status"]')
    .first();
  if (await successIndicator.isVisible({ timeout: 3000 }).catch(() => false)) {
    await expect(successIndicator).toBeVisible();
    return true;
  }
  return false;
}

/**
 * Check for error message
 */
export async function hasError(page: Page): Promise<boolean> {
  const errorIndicator = page.locator('text=/error|failed|invalid/i, [role="alert"]').first();
  return await errorIndicator.isVisible({ timeout: 2000 }).catch(() => false);
}
