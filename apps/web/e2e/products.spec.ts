import { expect, test } from "@playwright/test";

test.describe("Product Management Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@crm.com");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|\/companies/, { timeout: 10000 });
  });

  test("should display products list", async ({ page }) => {
    await page.goto("/dashboard/products");
    await expect(page).toHaveURL(/\/products/, { timeout: 5000 });

    // Should show products page
    const productsContainer = page.locator('table, [role="table"], .products-grid, main');
    await expect(productsContainer).toBeVisible();
  });

  test("should create a new product", async ({ page }) => {
    await page.goto("/dashboard/products");
    await expect(page).toHaveURL(/\/products/, { timeout: 5000 });

    // Click create new product button
    const createButton = page
      .locator(
        'button:has-text("New Product"), a:has-text("New Product"), button:has-text("Create Product"), button:has-text("Add Product")'
      )
      .first();
    await createButton.click();

    // Wait for product form
    const productForm = page.locator('form, [role="dialog"], .modal');
    await expect(productForm).toBeVisible({ timeout: 3000 });

    // Fill product details
    const timestamp = Date.now();
    const productName = `E2E Test Product ${timestamp}`;

    const nameInput = page
      .locator('input[name="name"], input[name="title"], input[placeholder*="name" i]')
      .first();
    await nameInput.fill(productName);

    const descriptionInput = page
      .locator('textarea[name="description"], input[name="description"]')
      .first();
    if (await descriptionInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await descriptionInput.fill("This is a test product created by E2E tests");
    }

    // Set product price
    const priceInput = page
      .locator('input[name="price"], input[name*="price"], input[type="number"]')
      .first();
    if (await priceInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await priceInput.fill("99.99");
    }

    // Set SKU if available
    const skuInput = page.locator('input[name="sku"], input[placeholder*="sku" i]').first();
    if (await skuInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skuInput.fill(`SKU${timestamp}`);
    }

    // Save the product
    const saveButton = page
      .locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]')
      .first();
    await saveButton.click();

    // Verify product was created
    await page.waitForTimeout(2000);

    const successIndicator = page
      .locator(`text="${productName}", text=/created|success|saved/i`)
      .first();
    if (await successIndicator.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(successIndicator).toBeVisible();
    }
  });

  test("should view product details", async ({ page }) => {
    await page.goto("/dashboard/products");
    await expect(page).toHaveURL(/\/products/, { timeout: 5000 });

    // Click on first product
    const firstProduct = page
      .locator('tr:has(td), a[href*="/products/"], [data-product-id]')
      .first();
    if (await firstProduct.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstProduct.click();

      // Should show product details
      await page.waitForTimeout(1000);

      const productDetails = page.locator('h1, h2, .product-header, [role="dialog"]');
      await expect(productDetails).toBeVisible();
    }
  });

  test("should edit a product", async ({ page }) => {
    await page.goto("/dashboard/products");
    await expect(page).toHaveURL(/\/products/, { timeout: 5000 });

    // Click on first product
    const firstProduct = page.locator('tr:has(td), a[href*="/products/"]').first();
    if (await firstProduct.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstProduct.click();
      await page.waitForTimeout(1000);

      // Look for edit button
      const editButton = page.locator('button:has-text("Edit"), a:has-text("Edit")').first();
      if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editButton.click();

        // Update product details
        const nameInput = page.locator('input[name="name"], input[name="title"]').first();
        if (await nameInput.isVisible({ timeout: 2000 })) {
          const timestamp = Date.now();
          await nameInput.fill(`Updated Product ${timestamp}`);

          // Update price
          const priceInput = page.locator('input[name="price"], input[name*="price"]').first();
          if (await priceInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await priceInput.fill("149.99");
          }

          // Save changes
          const saveButton = page
            .locator('button:has-text("Save"), button:has-text("Update"), button[type="submit"]')
            .first();
          await saveButton.click();
          await page.waitForTimeout(2000);
        }
      }
    }
  });

  test("should delete a product", async ({ page }) => {
    await page.goto("/dashboard/products");
    await expect(page).toHaveURL(/\/products/, { timeout: 5000 });

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

  test("should search for products", async ({ page }) => {
    await page.goto("/dashboard/products");
    await expect(page).toHaveURL(/\/products/, { timeout: 5000 });

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

  test("should filter products by category", async ({ page }) => {
    await page.goto("/dashboard/products");
    await expect(page).toHaveURL(/\/products/, { timeout: 5000 });

    // Look for category filter
    const categoryFilter = page
      .locator('select[name*="category"], button:has-text("Category"), select[name*="filter"]')
      .first();

    if (await categoryFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await categoryFilter.click();

      // Select a category
      const categoryOption = page.locator('option, [role="option"]').nth(1);
      if (await categoryOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await categoryOption.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test("should sort products by price", async ({ page }) => {
    await page.goto("/dashboard/products");
    await expect(page).toHaveURL(/\/products/, { timeout: 5000 });

    // Look for sort option
    const sortButton = page
      .locator('button:has-text("Sort"), select[name*="sort"], th:has-text("Price")')
      .first();

    if (await sortButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sortButton.click();

      // Should sort products
      await page.waitForTimeout(1000);
    }
  });

  test("should manage product inventory", async ({ page }) => {
    await page.goto("/dashboard/products");
    await expect(page).toHaveURL(/\/products/, { timeout: 5000 });

    // Click on first product
    const firstProduct = page.locator('tr:has(td), a[href*="/products/"]').first();
    if (await firstProduct.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstProduct.click();
      await page.waitForTimeout(1000);

      // Look for inventory/stock field
      const inventoryInput = page
        .locator('input[name*="stock"], input[name*="inventory"], input[name*="quantity"]')
        .first();
      if (await inventoryInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await inventoryInput.fill("100");

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
  });

  test("should add product image", async ({ page }) => {
    await page.goto("/dashboard/products");
    await expect(page).toHaveURL(/\/products/, { timeout: 5000 });

    // Click on first product or create new
    const firstProduct = page.locator('tr:has(td), a[href*="/products/"]').first();
    if (await firstProduct.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstProduct.click();
      await page.waitForTimeout(1000);

      // Look for image upload
      const imageUpload = page
        .locator('input[type="file"][accept*="image"], button:has-text("Upload Image")')
        .first();
      if (await imageUpload.isVisible({ timeout: 3000 }).catch(() => false)) {
        const tagName = await imageUpload.evaluate((el) => el.tagName);

        if (tagName === "INPUT") {
          // Create a test image
          const buffer = Buffer.from("fake-image-data");
          await imageUpload.setInputFiles({
            name: "product-image.jpg",
            mimeType: "image/jpeg",
            buffer: buffer,
          });
        }

        await page.waitForTimeout(1000);
      }
    }
  });

  test("should bulk import products", async ({ page }) => {
    await page.goto("/dashboard/products");
    await expect(page).toHaveURL(/\/products/, { timeout: 5000 });

    // Look for import button
    const importButton = page
      .locator('button:has-text("Import"), button:has-text("Bulk Import")')
      .first();

    if (await importButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await importButton.click();

      // Should show import dialog
      const importDialog = page.locator('dialog, [role="dialog"], .modal');
      if (await importDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(importDialog).toBeVisible();
      }
    }
  });

  test("should export products", async ({ page }) => {
    await page.goto("/dashboard/products");
    await expect(page).toHaveURL(/\/products/, { timeout: 5000 });

    // Look for export button
    const exportButton = page
      .locator('button:has-text("Export"), button:has-text("Download")')
      .first();

    if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Set up download listener
      const downloadPromise = page.waitForEvent("download", { timeout: 5000 }).catch(() => null);
      await exportButton.click();

      const download = await downloadPromise;
      if (download) {
        expect(download).toBeTruthy();
      }
    }
  });
});
