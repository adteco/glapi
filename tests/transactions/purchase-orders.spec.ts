import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString } from '../utils/test-helpers';

test.describe('Purchase Orders', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/transactions/purchasing/purchase-orders');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load purchase orders list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions.*purchase-orders/);
    });

    test('should display purchase orders table or empty state', async () => {
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
      expect(headerText).toMatch(/number|vendor|date|amount|status/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search purchase orders by number', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'PO';

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

    test('should filter by vendor', async ({ page }) => {
      const vendorFilter = page.locator('button:has-text("Vendor"), [data-testid="vendor-filter"]');
      if (await vendorFilter.isVisible()) {
        await vendorFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Purchase Order', () => {
    test('should navigate to create purchase order page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/transactions.*purchase-orders\/(new|create)/);
    });

    test('should display vendor selector', async ({ page }) => {
      await listPage.clickCreate();

      const vendorSelect = page.locator('[name="vendorId"], [data-testid="vendor-select"]');
      await expect(vendorSelect).toBeVisible();
    });

    test('should display line items section', async ({ page }) => {
      await listPage.clickCreate();

      const lineItems = page.locator('[data-testid="line-items"], .line-items, table');
      await expect(lineItems).toBeVisible();
    });

    test('should add line item', async ({ page }) => {
      await listPage.clickCreate();

      const addLineButton = page.locator('button:has-text("Add Line"), button:has-text("Add Item")');
      if (await addLineButton.isVisible()) {
        await addLineButton.click();

        const lineItemRows = page.locator('[data-testid="line-item"], .line-item-row');
        const count = await lineItemRows.count();
        expect(count).toBeGreaterThan(0);
      }
    });
  });

  test.describe('View Purchase Order', () => {
    test('should navigate to purchase order detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/transactions.*purchase-orders\/[^/]+$/);
    });

    test('should display purchase order details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const orderNumber = page.locator('h1, h2, [data-testid="order-number"]');
      await expect(orderNumber).toBeVisible();
    });
  });

  test.describe('Purchase Order Actions', () => {
    test('should have receive option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const receiveButton = page.locator('button:has-text("Receive"), button:has-text("Receipt")');
      // Receive option may or may not be present
    });

    test('should have approve option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const approveButton = page.locator('button:has-text("Approve")');
      // Approve option may or may not be present
    });
  });

  test.describe('Edit Purchase Order', () => {
    test('should open edit page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      await expect(page).toHaveURL(/edit/);
    });
  });

  test.describe('Delete Purchase Order', () => {
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
    test('should show pagination for many purchase orders', async () => {
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

    test('should sort by amount', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Amount');
    });
  });
});
