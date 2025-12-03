import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to login page before each test
		await page.goto('/login');
	});

	test('should display login form', async ({ page }) => {
		await expect(page.locator('input[type="email"]')).toBeVisible();
		await expect(page.locator('input[type="password"]')).toBeVisible();
		await expect(page.locator('button[type="submit"]')).toBeVisible();
	});

	test('should show error for invalid credentials', async ({ page }) => {
		await page.fill('input[type="email"]', 'invalid@example.com');
		await page.fill('input[type="password"]', 'wrongpassword');
		await page.click('button[type="submit"]');

		// Wait for error message
		await expect(page.locator('text=/invalid|error|incorrect/i')).toBeVisible({
			timeout: 5000,
		});
	});

	test('should successfully login with valid credentials', async ({ page }) => {
		// Use test credentials from README
		await page.fill('input[type="email"]', 'admin@crm.com');
		await page.fill('input[type="password"]', 'Admin123!');
		await page.click('button[type="submit"]');

		// Should redirect to dashboard after successful login
		await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });
	});

	test('should logout successfully', async ({ page }) => {
		// Login first
		await page.fill('input[type="email"]', 'admin@crm.com');
		await page.fill('input[type="password"]', 'Admin123!');
		await page.click('button[type="submit"]');

		// Wait for dashboard
		await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });

		// Find and click logout button
		const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout")');
		if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
			await logoutButton.click();
		} else {
			// Try to find user menu and logout
			const userMenu = page.locator('[data-testid="user-menu"], button[aria-label*="user"]');
			if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
				await userMenu.click();
				await page.locator('text=/logout|sign out/i').click();
			}
		}

		// Should redirect to login page
		await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
	});
});

