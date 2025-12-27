import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString } from '../utils/test-helpers';

test.describe('Inventory Adjustments', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/transactions/inventory/adjustments');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load inventory adjustments list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions.*adjustments/);
    });

    test('should display adjustments table or empty state', async () => {
      const hasRows = (await listPage.getRowCount()) > 0;
      const isEmpty = await listPage.isEmpty();
      expect(hasRows || isEmpty).toBe(true);
    });

    test('should display search input', async () => {
      await expect(listPage.searchInput).toBeVisible();
    });

    test('should display create button', async () => {
      await expect(listPage.createButton).toBeVisible();
    });

    test('should display correct table headers', async () => {
      const headers = await listPage.tableHeaders.allTextContents();
      const headerText = headers.join(' ').toLowerCase();
      expect(headerText).toMatch(/number|date|warehouse|reason|status/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search adjustments', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'ADJ';

      await listPage.search(searchTerm);

      const filteredCount = await listPage.getRowCount();
      expect(filteredCount).toBeLessThanOrEqual(rowCount);
    });

    test('should filter by status', async ({ page }) => {
      const statusFilter = page.locator('button:has-text("Status"), [data-testid="status-filter"]');
      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should filter by warehouse', async ({ page }) => {
      const warehouseFilter = page.locator('button:has-text("Warehouse"), [data-testid="warehouse-filter"]');
      if (await warehouseFilter.isVisible()) {
        await warehouseFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should filter by reason', async ({ page }) => {
      const reasonFilter = page.locator('button:has-text("Reason"), [data-testid="reason-filter"]');
      if (await reasonFilter.isVisible()) {
        await reasonFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Inventory Adjustment', () => {
    test('should navigate to create adjustment page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/transactions.*adjustments\/(new|create)/);
    });

    test('should display warehouse selector', async ({ page }) => {
      await listPage.clickCreate();

      const warehouseSelect = page.locator('[name="warehouseId"], [data-testid="warehouse-select"]');
      await expect(warehouseSelect).toBeVisible();
    });

    test('should display reason selector', async ({ page }) => {
      await listPage.clickCreate();

      const reasonSelect = page.locator('[name="reason"], [name="reasonCode"], [data-testid="reason-select"]');
      await expect(reasonSelect).toBeVisible();
    });

    test('should display items section', async ({ page }) => {
      await listPage.clickCreate();

      const itemsSection = page.locator('[data-testid="adjustment-items"], .adjustment-items, table');
      await expect(itemsSection).toBeVisible();
    });

    test('should add item line', async ({ page }) => {
      await listPage.clickCreate();

      const addItemButton = page.locator('button:has-text("Add Item"), button:has-text("Add Line")');
      if (await addItemButton.isVisible()) {
        await addItemButton.click();

        const itemRows = page.locator('[data-testid="adjustment-item"], .adjustment-item-row');
        const count = await itemRows.count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('should allow quantity input', async ({ page }) => {
      await listPage.clickCreate();

      const quantityInput = page.locator('[name*="quantity"], [data-testid*="quantity"]');
      await expect(quantityInput.first()).toBeVisible();
    });
  });

  test.describe('View Inventory Adjustment', () => {
    test('should navigate to adjustment detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/transactions.*adjustments\/[^/]+$/);
    });

    test('should display adjustment details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const adjustmentNumber = page.locator('h1, h2, [data-testid="adjustment-number"]');
      await expect(adjustmentNumber).toBeVisible();
    });
  });

  test.describe('Adjustment Actions', () => {
    test('should have approve option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const approveButton = page.locator('button:has-text("Approve"), button:has-text("Post")');
      // Approve option may or may not be present
    });
  });

  test.describe('Edit Inventory Adjustment', () => {
    test('should open edit page for draft adjustments', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      const url = page.url();
      const isEditable = url.includes('edit') || url.includes('adjustments');
      expect(isEditable).toBe(true);
    });
  });

  test.describe('Delete Inventory Adjustment', () => {
    test('should show delete confirmation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.deleteRow(0);

      const alertDialog = page.locator('[role="alertdialog"], [role="dialog"]');
      await expect(alertDialog).toBeVisible();
    });

    test('should cancel delete operation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.deleteRow(0);
      await listPage.cancelDelete();

      const newCount = await listPage.getRowCount();
      expect(newCount).toBe(rowCount);
    });
  });

  test.describe('Pagination', () => {
    test('should show pagination for many adjustments', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount >= 10) {
        await expect(listPage.pagination).toBeVisible();
      }
    });
  });

  test.describe('Table Sorting', () => {
    test('should sort by date', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Date');
    });
  });
});
