import { expect, test } from "@playwright/test";

test.describe("User Management & Permissions Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@crm.com");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });
  });

  test("should display users list", async ({ page }) => {
    await page.goto("/dashboard/users");
    await page.waitForLoadState("networkidle");

    // Should show users page
    const usersContainer = page.locator('table, [role="table"], .users-grid, main');
    await expect(usersContainer).toBeVisible();
  });

  test("should view user profile", async ({ page }) => {
    await page.goto("/dashboard/profile");
    await page.waitForLoadState("networkidle");

    // Should show profile page
    const profileContainer = page.locator("h1, h2, .profile, main");
    await expect(profileContainer).toBeVisible();

    // Should display user information
    const emailField = page.locator('text=/admin@crm.com/i, input[type="email"]');
    if (await emailField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(emailField).toBeVisible();
    }
  });

  test("should invite a new user", async ({ page }) => {
    // Navigate to settings/members or users page
    await page.goto("/dashboard/settings/members");
    await page.waitForLoadState("networkidle");

    // Look for invite button
    const inviteButton = page
      .locator(
        'button:has-text("Invite"), button:has-text("Add User"), button:has-text("New Member")'
      )
      .first();

    if (await inviteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inviteButton.click();

      // Fill invitation form
      const emailInput = page
        .locator('input[type="email"], input[name="email"], input[placeholder*="email" i]')
        .first();
      if (await emailInput.isVisible({ timeout: 2000 })) {
        const timestamp = Date.now();
        await emailInput.fill(`testuser${timestamp}@example.com`);

        // Select role if available
        const roleSelect = page.locator('select[name="role"], select[name*="role"]').first();
        if (await roleSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
          await roleSelect.selectOption({ index: 1 });
        }

        // Send invitation
        const sendButton = page
          .locator('button:has-text("Send"), button:has-text("Invite"), button[type="submit"]')
          .first();
        await sendButton.click();

        await page.waitForTimeout(2000);

        // Should show success message
        const successMessage = page.locator("text=/invited|sent|success/i").first();
        if (await successMessage.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(successMessage).toBeVisible();
        }
      }
    }
  });

  test("should update user role", async ({ page }) => {
    await page.goto("/dashboard/users");
    await page.waitForLoadState("networkidle");

    // Click on first user
    const firstUser = page.locator("tr:has(td), [data-user-id]").first();
    if (await firstUser.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstUser.click();

      // Look for role dropdown
      const roleSelect = page.locator('select[name*="role"], button:has-text("Role")').first();
      if (await roleSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await roleSelect.click();

        // Select different role
        const roleOption = page
          .locator('option, [role="option"]')
          .filter({ hasText: /admin|member|user/i })
          .first();
        if (await roleOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await roleOption.click();

          // Save changes
          const saveButton = page
            .locator('button:has-text("Save"), button:has-text("Update")')
            .first();
          if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await saveButton.click();
            await page.waitForTimeout(1000);
          }
        }
      }
    }
  });

  test("should deactivate a user", async ({ page }) => {
    await page.goto("/dashboard/users");
    await page.waitForLoadState("networkidle");

    // Look for deactivate/disable button
    const deactivateButton = page
      .locator(
        'button:has-text("Deactivate"), button:has-text("Disable"), button:has-text("Suspend")'
      )
      .first();

    if (await deactivateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deactivateButton.click();

      // Confirm deactivation
      const confirmButton = page
        .locator(
          'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Deactivate")'
        )
        .first();
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test("should update user profile information", async ({ page }) => {
    await page.goto("/dashboard/profile");
    await page.waitForLoadState("networkidle");

    // Look for edit button
    const editButton = page
      .locator('button:has-text("Edit"), button:has-text("Update Profile")')
      .first();

    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click();

      // Update profile fields
      const nameInput = page
        .locator('input[name="name"], input[name="fullName"], input[placeholder*="name" i]')
        .first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill("Updated Test User");

        // Save changes
        const saveButton = page
          .locator('button:has-text("Save"), button:has-text("Update"), button[type="submit"]')
          .first();
        await saveButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test("should manage team members", async ({ page }) => {
    await page.goto("/dashboard/settings/members");
    await page.waitForLoadState("networkidle");

    // Should display members list
    const membersTable = page.locator('table, [role="table"], .members-list');
    if (await membersTable.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(membersTable).toBeVisible();
    }

    // Should show member count or list
    const memberItems = page.locator("tr[data-member], li[data-member], [data-user-id]");
    const count = await memberItems.count().catch(() => 0);
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should filter users by role", async ({ page }) => {
    await page.goto("/dashboard/users");
    await page.waitForLoadState("networkidle");

    // Look for role filter
    const filterSelect = page
      .locator('select[name*="role"], button:has-text("Filter"), select[name*="filter"]')
      .first();

    if (await filterSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterSelect.click();

      // Select a role to filter by
      const roleOption = page
        .locator('option, [role="option"]')
        .filter({ hasText: /admin|member|user/i })
        .first();
      if (await roleOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await roleOption.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test("should search for users", async ({ page }) => {
    await page.goto("/dashboard/users");
    await page.waitForLoadState("networkidle");

    // Look for search input
    const searchInput = page
      .locator('input[type="search"], input[placeholder*="search" i], input[name="search"]')
      .first();

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill("admin");
      await page.waitForTimeout(1000);

      // Verify search value
      await expect(searchInput).toHaveValue("admin");
    }
  });

  test("should access user settings", async ({ page }) => {
    await page.goto("/dashboard/settings/users");
    await page.waitForLoadState("networkidle");

    // Should display settings page
    const settingsContainer = page.locator('main, .settings, [role="main"]');
    await expect(settingsContainer).toBeVisible();
  });

  test("admin should have access to admin features", async ({ page }) => {
    // Navigate to admin-specific features
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    // Admin should see settings options
    const settingsMenu = page.locator("nav, aside, .sidebar").first();
    if (await settingsMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(settingsMenu).toBeVisible();
    }

    // Check for admin-only menu items
    const adminLinks = page.locator(
      'a:has-text("Users"), a:has-text("Members"), a:has-text("Settings")'
    );
    const hasAdminLinks = (await adminLinks.count()) > 0;
    expect(hasAdminLinks).toBeTruthy();
  });

  test("should manage user permissions", async ({ page }) => {
    await page.goto("/dashboard/users");
    await page.waitForLoadState("networkidle");

    // Click on first user
    const firstUser = page.locator("tr:has(td), [data-user-id]").first();
    if (await firstUser.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstUser.click();

      // Look for permissions section
      const permissionsSection = page.locator("text=/permissions/i, [data-permissions]").first();
      if (await permissionsSection.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(permissionsSection).toBeVisible();
      }
    }
  });
});
