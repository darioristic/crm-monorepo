import { test, expect } from '@playwright/test';

test.describe('Companies Management', () => {
	test.beforeEach(async ({ page }) => {
		// Login before each test
		await page.goto('/login');
		await page.fill('input[type="email"]', 'admin@crm.com');
		await page.fill('input[type="password"]', 'Admin123!');
		await page.click('button[type="submit"]');
		await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });
	});

	test('should display companies list', async ({ page }) => {
		// Navigate to companies page
		await page.goto('/companies');
		await expect(page.locator('h1, h2')).toContainText(/companies/i, {
			timeout: 5000,
		});
	});

	test('should create a new company', async ({ page }) => {
		await page.goto('/companies');

		// Find and click "Add Company" or "New Company" button
		const addButton = page.locator(
			'button:has-text("Add"), button:has-text("New"), button:has-text("Create"), [data-testid="add-company"]',
		);
		await addButton.first().click({ timeout: 5000 });

		// Fill company form
		const companyName = `Test Company ${Date.now()}`;
		await page.fill('input[name="name"], input[placeholder*="name" i]', companyName);

		// Submit form
		const submitButton = page.locator(
			'button[type="submit"], button:has-text("Create"), button:has-text("Save")',
		);
		await submitButton.click();

		// Verify company was created
		await expect(page.locator(`text=${companyName}`)).toBeVisible({
			timeout: 10000,
		});
	});

	test('should edit company details', async ({ page }) => {
		await page.goto('/companies');

		// Wait for companies list to load
		await page.waitForSelector('table, [role="list"], .company-item', {
			timeout: 5000,
		});

		// Click on first company or edit button
		const editButton = page
			.locator('button[aria-label*="edit"], button:has-text("Edit"), [data-testid="edit-company"]')
			.first();
		await editButton.click({ timeout: 5000 });

		// Update company name
		const updatedName = `Updated Company ${Date.now()}`;
		await page.fill('input[name="name"]', updatedName);

		// Save changes
		await page.click('button[type="submit"], button:has-text("Save")');

		// Verify update
		await expect(page.locator(`text=${updatedName}`)).toBeVisible({
			timeout: 10000,
		});
	});
});

