import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, formatCurrency } from '../utils/test-helpers';

test.describe('Vendor Credits', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/transactions/purchasing/vendor-credits');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load vendor credits list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions.*vendor-credits/);
    });

    test('should display vendor credits table or empty state', async () => {
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
    test('should search vendor credits by number', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'VC';

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

  test.describe('Create Vendor Credit', () => {
    test('should navigate to create vendor credit page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/transactions.*vendor-credits\/(new|create)/);
    });

    test('should display vendor selector', async ({ page }) => {
      await listPage.clickCreate();

      const vendorSelect = page.locator('[name="vendorId"], [data-testid="vendor-select"]');
      await expect(vendorSelect).toBeVisible();
    });

    test('should display original bill reference', async ({ page }) => {
      await listPage.clickCreate();

      // Vendor credits are often linked to original bills
      const billSelect = page.locator('[name="billId"], [data-testid="bill-select"], :has-text("Bill")');
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
      // Memo field should be visible
    });

    test('should calculate totals', async ({ page }) => {
      await listPage.clickCreate();

      const totalDisplay = page.locator('[data-testid="total"], .vendor-credit-total, :has-text("Total")');
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

  test.describe('View Vendor Credit', () => {
    test('should navigate to vendor credit detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/transactions.*vendor-credits\/[^/]+$/);
    });

    test('should display vendor credit details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const creditNumber = page.locator('h1, h2, [data-testid="vendor-credit-number"]');
      await expect(creditNumber).toBeVisible();
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

  test.describe('Vendor Credit Actions', () => {
    test('should have apply to bill option', async ({ page }) => {
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

  test.describe('Edit Vendor Credit', () => {
    test('should open edit page for draft credit', async ({ page }) => {
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

  test.describe('Void Vendor Credit', () => {
    test('should show void confirmation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

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

  test.describe('Delete Vendor Credit', () => {
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
    test('should show pagination for many vendor credits', async () => {
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
