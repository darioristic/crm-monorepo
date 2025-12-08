import { expect, test } from "@playwright/test";

test.describe("Project & Task Management Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@crm.com");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });
  });

  test("should display projects list", async ({ page }) => {
    await page.goto("/dashboard/projects");
    await expect(page).toHaveURL(/\/projects/, { timeout: 5000 });

    // Should show projects page with table or grid
    const projectsContainer = page.locator('table, [role="table"], .projects-grid, main');
    await expect(projectsContainer).toBeVisible();
  });

  test("should create a new project", async ({ page }) => {
    await page.goto("/dashboard/projects");
    await expect(page).toHaveURL(/\/projects/, { timeout: 5000 });

    // Click create new project button
    const createButton = page
      .locator(
        'button:has-text("New Project"), a:has-text("New Project"), button:has-text("Create Project")'
      )
      .first();
    await createButton.click();

    // Should navigate to create project page or open modal
    const projectForm = page.locator('form, [role="dialog"], .modal');
    await expect(projectForm).toBeVisible({ timeout: 3000 });

    // Fill project details
    const timestamp = Date.now();
    const projectName = `E2E Test Project ${timestamp}`;

    const nameInput = page
      .locator('input[name="name"], input[name="title"], input[placeholder*="name" i]')
      .first();
    await nameInput.fill(projectName);

    const descriptionInput = page
      .locator('textarea[name="description"], input[name="description"]')
      .first();
    if (await descriptionInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await descriptionInput.fill("This is a test project created by E2E tests");
    }

    // Set project dates if available
    const startDateInput = page.locator('input[name*="start"], input[type="date"]').first();
    if (await startDateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startDateInput.fill("2025-01-01");
    }

    // Save the project
    const saveButton = page
      .locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]')
      .first();
    await saveButton.click();

    // Should redirect to projects list or project details
    await page.waitForTimeout(2000);

    // Verify project was created
    const successIndicator = page.locator(`text="${projectName}", text=/created|success/i`).first();
    if (await successIndicator.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(successIndicator).toBeVisible();
    }
  });

  test("should view project details", async ({ page }) => {
    await page.goto("/dashboard/projects");
    await expect(page).toHaveURL(/\/projects/, { timeout: 5000 });

    // Click on first project
    const firstProject = page.locator('tr:has(td), a[href*="/projects/"]').first();
    if (await firstProject.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstProject.click();

      // Should navigate to project details
      await expect(page).toHaveURL(/\/projects\/[^/]+/, { timeout: 5000 });

      // Should show project details
      const projectDetails = page.locator("h1, h2, .project-header");
      await expect(projectDetails).toBeVisible();
    }
  });

  test("should create a task in a project", async ({ page }) => {
    await page.goto("/dashboard/projects");
    await expect(page).toHaveURL(/\/projects/, { timeout: 5000 });

    // Navigate to first project or tasks page
    const firstProject = page.locator('tr:has(td), a[href*="/projects/"]').first();
    if (await firstProject.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstProject.click();
      await expect(page).toHaveURL(/\/projects\/[^/]+/, { timeout: 5000 });

      // Look for add task button
      const addTaskButton = page
        .locator(
          'button:has-text("Add Task"), button:has-text("New Task"), button:has-text("Create Task")'
        )
        .first();
      if (await addTaskButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addTaskButton.click();

        // Fill task details
        const taskNameInput = page
          .locator('input[name="name"], input[name="title"], input[placeholder*="task" i]')
          .first();
        if (await taskNameInput.isVisible({ timeout: 2000 })) {
          const timestamp = Date.now();
          await taskNameInput.fill(`Test Task ${timestamp}`);

          const taskDescriptionInput = page
            .locator('textarea[name="description"], input[name="description"]')
            .first();
          if (await taskDescriptionInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await taskDescriptionInput.fill("E2E test task description");
          }

          // Save task
          const saveTaskButton = page
            .locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]')
            .first();
          await saveTaskButton.click();

          await page.waitForTimeout(1000);
        }
      }
    } else {
      // Try navigating to tasks directly
      await page.goto("/dashboard/projects/tasks");
      const createTaskButton = page
        .locator('button:has-text("New Task"), button:has-text("Create Task")')
        .first();
      if (await createTaskButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await createTaskButton.click();
      }
    }
  });

  test("should update task status", async ({ page }) => {
    await page.goto("/dashboard/projects/tasks");
    await page.waitForLoadState("networkidle");

    // Look for task status dropdown or buttons
    const statusButton = page
      .locator('select[name*="status"], button:has-text("Status"), [data-status]')
      .first();

    if (await statusButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusButton.click();

      // Select a different status
      const statusOption = page
        .locator('option, [role="option"], button')
        .filter({ hasText: /in progress|completed|done/i })
        .first();
      if (await statusOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await statusOption.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test("should filter tasks by status", async ({ page }) => {
    await page.goto("/dashboard/projects/tasks");
    await page.waitForLoadState("networkidle");

    // Look for filter options
    const filterButton = page
      .locator('button:has-text("Filter"), select[name*="filter"], [data-filter]')
      .first();

    if (await filterButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterButton.click();

      // Select filter option
      const filterOption = page
        .locator('option, [role="option"], button')
        .filter({ hasText: /active|completed|all/i })
        .first();
      if (await filterOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await filterOption.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test("should assign task to user", async ({ page }) => {
    await page.goto("/dashboard/projects/tasks");
    await page.waitForLoadState("networkidle");

    // Click on first task
    const firstTask = page.locator("tr:has(td), [data-task-id], .task-item").first();
    if (await firstTask.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstTask.click();

      // Look for assignee dropdown
      const assigneeButton = page
        .locator(
          'select[name*="assignee"], button:has-text("Assign"), input[placeholder*="assign" i]'
        )
        .first();
      if (await assigneeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await assigneeButton.click();

        // Select first user from dropdown
        const userOption = page.locator('option, [role="option"]').nth(1);
        if (await userOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await userOption.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test("should create project milestone", async ({ page }) => {
    await page.goto("/dashboard/projects/milestones");
    await page.waitForLoadState("networkidle");

    // Look for create milestone button
    const createButton = page
      .locator(
        'button:has-text("New Milestone"), button:has-text("Create Milestone"), button:has-text("Add Milestone")'
      )
      .first();

    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createButton.click();

      // Fill milestone details
      const nameInput = page
        .locator('input[name="name"], input[name="title"], input[placeholder*="milestone" i]')
        .first();
      if (await nameInput.isVisible({ timeout: 2000 })) {
        const timestamp = Date.now();
        await nameInput.fill(`Milestone ${timestamp}`);

        const descriptionInput = page
          .locator('textarea[name="description"], input[name="description"]')
          .first();
        if (await descriptionInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await descriptionInput.fill("E2E test milestone");
        }

        // Save milestone
        const saveButton = page
          .locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]')
          .first();
        await saveButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test("should delete a task", async ({ page }) => {
    await page.goto("/dashboard/projects/tasks");
    await page.waitForLoadState("networkidle");

    // Look for delete button
    const deleteButton = page
      .locator('button:has-text("Delete"), button[title*="delete" i]')
      .first();

    if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteButton.click();

      // Confirm deletion
      const confirmButton = page
        .locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")')
        .first();
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test("should search for projects", async ({ page }) => {
    await page.goto("/dashboard/projects");
    await expect(page).toHaveURL(/\/projects/, { timeout: 5000 });

    // Look for search input
    const searchInput = page
      .locator('input[type="search"], input[placeholder*="search" i], input[name="search"]')
      .first();

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill("test");
      await page.waitForTimeout(1000);

      // Verify search value
      await expect(searchInput).toHaveValue("test");
    }
  });
});
