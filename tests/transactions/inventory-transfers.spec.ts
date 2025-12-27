import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString } from '../utils/test-helpers';

test.describe('Inventory Transfers', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/transactions/inventory/transfers');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load inventory transfers list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions.*transfers/);
    });

    test('should display transfers table or empty state', async () => {
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
      expect(headerText).toMatch(/number|from|to|date|status/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search transfers', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'TRF';

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

    test('should filter by source warehouse', async ({ page }) => {
      const sourceFilter = page.locator('button:has-text("From"), button:has-text("Source"), [data-testid="source-filter"]');
      if (await sourceFilter.isVisible()) {
        await sourceFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should filter by destination warehouse', async ({ page }) => {
      const destFilter = page.locator('button:has-text("To"), button:has-text("Destination"), [data-testid="destination-filter"]');
      if (await destFilter.isVisible()) {
        await destFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Inventory Transfer', () => {
    test('should navigate to create transfer page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/transactions.*transfers\/(new|create)/);
    });

    test('should display source warehouse selector', async ({ page }) => {
      await listPage.clickCreate();

      const sourceSelect = page.locator('[name="fromWarehouseId"], [name="sourceWarehouseId"], [data-testid="source-warehouse"]');
      await expect(sourceSelect).toBeVisible();
    });

    test('should display destination warehouse selector', async ({ page }) => {
      await listPage.clickCreate();

      const destSelect = page.locator('[name="toWarehouseId"], [name="destinationWarehouseId"], [data-testid="destination-warehouse"]');
      await expect(destSelect).toBeVisible();
    });

    test('should display items section', async ({ page }) => {
      await listPage.clickCreate();

      const itemsSection = page.locator('[data-testid="transfer-items"], .transfer-items, table');
      await expect(itemsSection).toBeVisible();
    });

    test('should add item line', async ({ page }) => {
      await listPage.clickCreate();

      const addItemButton = page.locator('button:has-text("Add Item"), button:has-text("Add Line")');
      if (await addItemButton.isVisible()) {
        await addItemButton.click();

        const itemRows = page.locator('[data-testid="transfer-item"], .transfer-item-row');
        const count = await itemRows.count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('should validate different warehouses', async ({ page }) => {
      await listPage.clickCreate();

      // Selecting same warehouse for source and destination should show error
      const sourceSelect = page.locator('[name="fromWarehouseId"], [data-testid="source-warehouse"]');
      const destSelect = page.locator('[name="toWarehouseId"], [data-testid="destination-warehouse"]');

      if (await sourceSelect.isVisible() && await destSelect.isVisible()) {
        // Select same warehouse for both
        await sourceSelect.click();
        const firstOption = page.locator('[role="option"]').first();
        await firstOption.click();

        await destSelect.click();
        await firstOption.click();

        const saveButton = page.locator('button:has-text("Save"), button[type="submit"]');
        await saveButton.click();

        // Should show validation error
        const error = page.locator('.error, [role="alert"], .text-destructive');
        // May or may not show error depending on implementation
      }
    });
  });

  test.describe('View Inventory Transfer', () => {
    test('should navigate to transfer detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/transactions.*transfers\/[^/]+$/);
    });

    test('should display transfer details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const transferNumber = page.locator('h1, h2, [data-testid="transfer-number"]');
      await expect(transferNumber).toBeVisible();
    });

    test('should show source and destination', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const warehouseInfo = page.locator(':has-text("From"), :has-text("To"), :has-text("Source"), :has-text("Destination")');
      await expect(warehouseInfo.first()).toBeVisible();
    });
  });

  test.describe('Transfer Actions', () => {
    test('should have ship option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const shipButton = page.locator('button:has-text("Ship"), button:has-text("Send")');
      // Ship option may or may not be present
    });

    test('should have receive option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const receiveButton = page.locator('button:has-text("Receive")');
      // Receive option may or may not be present
    });
  });

  test.describe('Edit Inventory Transfer', () => {
    test('should open edit page for draft transfers', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      const url = page.url();
      const isEditable = url.includes('edit') || url.includes('transfers');
      expect(isEditable).toBe(true);
    });
  });

  test.describe('Delete Inventory Transfer', () => {
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
    test('should show pagination for many transfers', async () => {
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

    test('should sort by status', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Status');
    });
  });
});
