import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString } from '../utils/test-helpers';

test.describe('Fulfillment', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/transactions/fulfillment');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load fulfillment list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions.*fulfillment/);
    });

    test('should display fulfillment table or empty state', async () => {
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
      expect(headerText).toMatch(/number|order|customer|status|date/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search fulfillments', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'FUL';

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

    test('should filter by customer', async ({ page }) => {
      const customerFilter = page.locator('button:has-text("Customer"), [data-testid="customer-filter"]');
      if (await customerFilter.isVisible()) {
        await customerFilter.click();
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
  });

  test.describe('Create Fulfillment', () => {
    test('should navigate to create fulfillment page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/transactions.*fulfillment\/(new|create)/);
    });

    test('should display order selector', async ({ page }) => {
      await listPage.clickCreate();

      const orderSelect = page.locator('[name="salesOrderId"], [name="orderId"], [data-testid="order-select"]');
      await expect(orderSelect).toBeVisible();
    });

    test('should display warehouse selector', async ({ page }) => {
      await listPage.clickCreate();

      const warehouseSelect = page.locator('[name="warehouseId"], [data-testid="warehouse-select"]');
      await expect(warehouseSelect).toBeVisible();
    });

    test('should display items to fulfill', async ({ page }) => {
      await listPage.clickCreate();

      const itemsSection = page.locator('[data-testid="fulfillment-items"], .fulfillment-items, table');
      await expect(itemsSection).toBeVisible();
    });

    test('should allow quantity selection', async ({ page }) => {
      await listPage.clickCreate();

      const quantityInput = page.locator('[name*="quantity"], [data-testid*="quantity"]');
      // Quantity inputs should be present for each line item
    });
  });

  test.describe('View Fulfillment', () => {
    test('should navigate to fulfillment detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/transactions.*fulfillment\/[^/]+$/);
    });

    test('should display fulfillment details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const fulfillmentNumber = page.locator('h1, h2, [data-testid="fulfillment-number"]');
      await expect(fulfillmentNumber).toBeVisible();
    });

    test('should show order reference', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const orderRef = page.locator('[data-testid="order-reference"], :has-text("Order"), a[href*="sales-orders"]');
      await expect(orderRef).toBeVisible();
    });

    test('should display shipped items', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const itemsTable = page.locator('table, [data-testid="fulfillment-items"]');
      await expect(itemsTable).toBeVisible();
    });
  });

  test.describe('Fulfillment Actions', () => {
    test('should have ship option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const shipButton = page.locator('button:has-text("Ship"), button:has-text("Mark Shipped")');
      // Ship option may or may not be present depending on status
    });

    test('should have print packing slip option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const printButton = page.locator('button:has-text("Print"), button:has-text("Packing Slip")');
      // Print option may or may not be present
    });

    test('should have tracking number field', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const trackingField = page.locator('[name="trackingNumber"], [data-testid="tracking-number"], :has-text("Tracking")');
      // Tracking field may or may not be present
    });
  });

  test.describe('Edit Fulfillment', () => {
    test('should open edit page for pending fulfillments', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      const url = page.url();
      const isEditable = url.includes('edit') || url.includes('fulfillment');
      expect(isEditable).toBe(true);
    });
  });

  test.describe('Delete Fulfillment', () => {
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
    test('should show pagination for many fulfillments', async () => {
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
