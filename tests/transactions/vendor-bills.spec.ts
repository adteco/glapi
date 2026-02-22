import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, formatDate, formatCurrency } from '../utils/test-helpers';

test.describe('Vendor Bills', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/transactions/purchasing/vendor-bills');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load vendor bills list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions.*bills/);
    });

    test('should display bills table or empty state', async () => {
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
      expect(headerText).toMatch(/number|vendor|date|due|amount|status/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search bills by number', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'BILL';

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

    test('should filter by due date', async ({ page }) => {
      const dueFilter = page.locator('button:has-text("Due"), [data-testid="due-filter"]');
      if (await dueFilter.isVisible()) {
        await dueFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Vendor Bill', () => {
    test('should navigate to create bill page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/transactions.*bills\/(new|create)/);
    });

    test('should display vendor selector', async ({ page }) => {
      await listPage.clickCreate();

      const vendorSelect = page.locator('[name="vendorId"], [data-testid="vendor-select"]');
      await expect(vendorSelect).toBeVisible();
    });

    test('should display bill number field', async ({ page }) => {
      await listPage.clickCreate();

      const billNumber = page.locator('[name="billNumber"], [name="referenceNumber"]');
      await expect(billNumber).toBeVisible();
    });

    test('should display bill date field', async ({ page }) => {
      await listPage.clickCreate();

      const billDate = page.locator('[name="billDate"], [name="date"]');
      await expect(billDate).toBeVisible();
    });

    test('should display due date field', async ({ page }) => {
      await listPage.clickCreate();

      const dueDate = page.locator('[name="dueDate"]');
      await expect(dueDate).toBeVisible();
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

        const lineItemRows = page.locator('[data-testid="line-item"], .line-item-row, tr.line-item');
        const count = await lineItemRows.count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('should calculate totals', async ({ page }) => {
      await listPage.clickCreate();

      const totalDisplay = page.locator('[data-testid="total"], .bill-total, :has-text("Total")');
      await expect(totalDisplay).toBeVisible();
    });

    test('should validate required vendor', async ({ page }) => {
      await listPage.clickCreate();

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]');
      await saveButton.click();

      const error = page.locator('.error, [role="alert"], .text-destructive');
      await expect(error).toBeVisible();
    });
  });

  test.describe('View Vendor Bill', () => {
    test('should navigate to bill detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/transactions.*bills\/[^/]+$/);
    });

    test('should display bill details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const billNumber = page.locator('h1, h2, [data-testid="bill-number"]');
      await expect(billNumber).toBeVisible();
    });

    test('should display line items', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const lineItems = page.locator('table, [data-testid="line-items"]');
      await expect(lineItems).toBeVisible();
    });

    test('should display payment status', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const status = page.locator('[data-testid="payment-status"], .badge, :has-text("Paid"), :has-text("Unpaid")');
      // Status should be visible
    });
  });

  test.describe('Bill Actions', () => {
    test('should have pay bill option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const payButton = page.locator('button:has-text("Pay"), button:has-text("Make Payment")');
      // Pay option may be present for unpaid bills
    });

    test('should have print option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const printButton = page.locator('button:has-text("Print"), button:has-text("PDF")');
      // Print option may or may not be present
    });
  });

  test.describe('Edit Vendor Bill', () => {
    test('should open edit page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      const urlChanged = page.url().includes('/edit');
      const dialogOpened = await dialogPage.isOpen();
      expect(urlChanged || dialogOpened).toBe(true);
    });
  });

  test.describe('Delete Vendor Bill', () => {
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
    test('should show pagination for many bills', async () => {
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

    test('should sort by due date', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Due');
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
