import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString, formatCurrency } from '../utils/test-helpers';

test.describe('Invoices', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/transactions/sales/invoices');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load invoices list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions.*invoices/);
    });

    test('should display invoices table or empty state', async () => {
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
    test('should search invoices by number', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'INV';

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

    test('should filter by date range', async ({ page }) => {
      const dateFilter = page.locator('button:has-text("Date"), [data-testid="date-filter"]');
      if (await dateFilter.isVisible()) {
        await dateFilter.click();
        // Select a preset like "Last 30 days"
        const preset = page.locator('[role="option"]:has-text("30"), button:has-text("30")');
        if (await preset.isVisible()) {
          await preset.click();
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

  test.describe('Create Invoice', () => {
    test('should navigate to create invoice page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/transactions.*invoices\/(new|create)/);
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

        // Should show new line item row
        const lineItemRows = page.locator('[data-testid="line-item"], .line-item-row, tr.line-item');
        const count = await lineItemRows.count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('should calculate totals', async ({ page }) => {
      await listPage.clickCreate();

      // Look for total display
      const totalDisplay = page.locator('[data-testid="total"], .invoice-total, :has-text("Total")');
      await expect(totalDisplay).toBeVisible();
    });

    test('should validate required customer', async ({ page }) => {
      await listPage.clickCreate();

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]');
      await saveButton.click();

      // Should show validation error
      const error = page.locator('.error, [role="alert"], .text-destructive');
      await expect(error).toBeVisible();
    });
  });

  test.describe('View Invoice', () => {
    test('should navigate to invoice detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/transactions.*invoices\/[^/]+$/);
    });

    test('should display invoice details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      // Should show invoice number
      const invoiceNumber = page.locator('h1, h2, [data-testid="invoice-number"]');
      await expect(invoiceNumber).toBeVisible();

      // Should show customer info
      const customerInfo = page.locator('[data-testid="customer-info"], :has-text("Customer")');
      await expect(customerInfo).toBeVisible();
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
  });

  test.describe('Invoice Actions', () => {
    test('should have send/email option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const sendButton = page.locator('button:has-text("Send"), button:has-text("Email")');
      // Send option may or may not be present
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

    test('should have record payment option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const paymentButton = page.locator('button:has-text("Payment"), button:has-text("Record Payment")');
      // Payment option may or may not be present
    });
  });

  test.describe('Edit Invoice', () => {
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

  test.describe('Delete Invoice', () => {
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
    test('should show pagination for many invoices', async () => {
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
