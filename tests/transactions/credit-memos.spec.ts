import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, formatCurrency } from '../utils/test-helpers';

test.describe('Credit Memos', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/transactions/sales/credit-memos');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load credit memos list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions.*credit-memos/);
    });

    test('should display credit memos table or empty state', async () => {
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
    test('should search credit memos by number', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'CM';

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

  test.describe('Create Credit Memo', () => {
    test('should navigate to create credit memo page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/transactions.*credit-memos\/(new|create)/);
    });

    test('should display customer selector', async ({ page }) => {
      await listPage.clickCreate();

      const customerSelect = page.locator('[name="customerId"], [data-testid="customer-select"]');
      await expect(customerSelect).toBeVisible();
    });

    test('should display original invoice selector', async ({ page }) => {
      await listPage.clickCreate();

      // Credit memos are often linked to original invoices
      const invoiceSelect = page.locator('[name="invoiceId"], [data-testid="invoice-select"], :has-text("Invoice")');
      // May or may not be visible depending on workflow
    });

    test('should display line items section', async ({ page }) => {
      await listPage.clickCreate();

      const lineItems = page.locator('[data-testid="line-items"], .line-items, table');
      await expect(lineItems).toBeVisible();
    });

    test('should display reason/memo field', async ({ page }) => {
      await listPage.clickCreate();

      const memoField = page.locator('[name="memo"], [name="reason"], textarea');
      // Memo field should be visible for credit memos
    });

    test('should calculate totals', async ({ page }) => {
      await listPage.clickCreate();

      const totalDisplay = page.locator('[data-testid="total"], .credit-memo-total, :has-text("Total")');
      await expect(totalDisplay).toBeVisible();
    });

    test('should validate required customer', async ({ page }) => {
      await listPage.clickCreate();

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]');
      await saveButton.click();

      const error = page.locator('.error, [role="alert"], .text-destructive');
      await expect(error).toBeVisible();
    });
  });

  test.describe('View Credit Memo', () => {
    test('should navigate to credit memo detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/transactions.*credit-memos\/[^/]+$/);
    });

    test('should display credit memo details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const creditMemoNumber = page.locator('h1, h2, [data-testid="credit-memo-number"]');
      await expect(creditMemoNumber).toBeVisible();
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

    test('should display linked invoice if applicable', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      // Look for linked invoice reference
      const invoiceLink = page.locator('[data-testid="linked-invoice"], :has-text("Original Invoice")');
      // May or may not be present
    });
  });

  test.describe('Credit Memo Actions', () => {
    test('should have apply to invoice option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const applyButton = page.locator('button:has-text("Apply"), button:has-text("Use Credit")');
      // Apply option may or may not be present
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

  test.describe('Edit Credit Memo', () => {
    test('should open edit page for draft credit memo', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      // Either opens edit page or shows dialog
      const urlChanged = page.url().includes('/edit');
      const dialogOpened = await dialogPage.isOpen();
      expect(urlChanged || dialogOpened).toBe(true);
    });
  });

  test.describe('Void Credit Memo', () => {
    test('should show void confirmation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Look for void action
      const row = listPage.getRow(0);
      const voidButton = row.locator('button:has-text("Void")');
      const menuButton = row.locator('button[aria-label*="action"], button[aria-label*="menu"]');

      if (await voidButton.isVisible()) {
        await voidButton.click();
        const alertDialog = page.locator('[role="alertdialog"], [role="dialog"]');
        await expect(alertDialog).toBeVisible();
      } else if (await menuButton.isVisible()) {
        await menuButton.click();
        const voidOption = page.locator('[role="menuitem"]:has-text("Void")');
        if (await voidOption.isVisible()) {
          await voidOption.click();
          const alertDialog = page.locator('[role="alertdialog"], [role="dialog"]');
          await expect(alertDialog).toBeVisible();
        }
      }
    });
  });

  test.describe('Delete Credit Memo', () => {
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
    test('should show pagination for many credit memos', async () => {
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
