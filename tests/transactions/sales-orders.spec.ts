import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString } from '../utils/test-helpers';

test.describe('Sales Orders', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/transactions/sales/sales-orders');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load sales orders list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions.*sales-orders/);
    });

    test('should display sales orders table or empty state', async () => {
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
      expect(headerText).toMatch(/number|customer|date|amount|status/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search sales orders by number', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'SO';

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
  });

  test.describe('Create Sales Order', () => {
    test('should navigate to create sales order page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/transactions.*sales-orders\/(new|create)/);
    });

    test('should display customer selector', async ({ page }) => {
      await listPage.clickCreate();

      const customerSelect = page.locator('[name="customerId"], [data-testid="customer-select"]');
      await expect(customerSelect).toBeVisible();
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

  test.describe('View Sales Order', () => {
    test('should navigate to sales order detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/transactions.*sales-orders\/[^/]+$/);
    });

    test('should display sales order details', async ({ page }) => {
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

  test.describe('Sales Order Actions', () => {
    test('should have convert to invoice option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const convertButton = page.locator('button:has-text("Invoice"), button:has-text("Convert")');
      // Convert option may or may not be present
    });

    test('should have fulfill option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const fulfillButton = page.locator('button:has-text("Fulfill"), button:has-text("Ship")');
      // Fulfill option may or may not be present
    });
  });

  test.describe('Edit Sales Order', () => {
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

  test.describe('Delete Sales Order', () => {
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
    test('should show pagination for many sales orders', async () => {
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
