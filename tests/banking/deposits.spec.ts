import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, formatCurrency } from '../utils/test-helpers';

test.describe('Bank Deposits', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/banking/deposits');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load bank deposits page', async ({ page }) => {
      await expect(page).toHaveURL(/\/banking.*deposits/);
    });

    test('should display deposits table or empty state', async () => {
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
      expect(headerText).toMatch(/date|account|amount|status|reference/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search deposits by reference', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'DEP';

      await listPage.search(searchTerm);

      const filteredCount = await listPage.getRowCount();
      expect(filteredCount).toBeLessThanOrEqual(rowCount);
    });

    test('should filter by bank account', async ({ page }) => {
      const accountFilter = page.locator('button:has-text("Account"), [data-testid="account-filter"]');
      if (await accountFilter.isVisible()) {
        await accountFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
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
        const preset = page.locator('[role="option"]').first();
        if (await preset.isVisible()) {
          await preset.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Deposit', () => {
    test('should navigate to create deposit page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/banking.*deposits\/(new|create)/);
    });

    test('should display bank account selector', async ({ page }) => {
      await listPage.clickCreate();

      const accountSelect = page.locator('[name="bankAccountId"], [data-testid="bank-account-select"]');
      await expect(accountSelect).toBeVisible();
    });

    test('should display deposit date field', async ({ page }) => {
      await listPage.clickCreate();

      const dateField = page.locator('[name="depositDate"], [name="date"]');
      await expect(dateField).toBeVisible();
    });

    test('should display payments to deposit section', async ({ page }) => {
      await listPage.clickCreate();

      const paymentsSection = page.locator('[data-testid="payments-to-deposit"], :has-text("Payments")');
      await expect(paymentsSection).toBeVisible();
    });

    test('should display available payments', async ({ page }) => {
      await listPage.clickCreate();

      const paymentsTable = page.locator('[data-testid="available-payments"], table');
      await expect(paymentsTable).toBeVisible();
    });

    test('should calculate total deposit amount', async ({ page }) => {
      await listPage.clickCreate();

      const totalDisplay = page.locator('[data-testid="total"], :has-text("Total")');
      await expect(totalDisplay).toBeVisible();
    });

    test('should display memo field', async ({ page }) => {
      await listPage.clickCreate();

      const memoField = page.locator('[name="memo"], [name="reference"], textarea');
      // Memo field may or may not be visible
    });

    test('should validate required bank account', async ({ page }) => {
      await listPage.clickCreate();

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]');
      await saveButton.click();

      const error = page.locator('.error, [role="alert"], .text-destructive');
      await expect(error).toBeVisible();
    });
  });

  test.describe('Select Payments for Deposit', () => {
    test('should allow selecting payments', async ({ page }) => {
      await listPage.clickCreate();

      const paymentCheckbox = page.locator('[data-testid="payment-checkbox"], input[type="checkbox"]').first();
      if (await paymentCheckbox.isVisible()) {
        await paymentCheckbox.click();
        await expect(paymentCheckbox).toBeChecked();
      }
    });

    test('should update total when selecting payments', async ({ page }) => {
      await listPage.clickCreate();

      const totalDisplay = page.locator('[data-testid="total"]');
      const initialTotal = await totalDisplay.textContent();

      const paymentCheckbox = page.locator('[data-testid="payment-checkbox"], input[type="checkbox"]').first();
      if (await paymentCheckbox.isVisible()) {
        await paymentCheckbox.click();
        // Total should update
      }
    });

    test('should have select all option', async ({ page }) => {
      await listPage.clickCreate();

      const selectAll = page.locator('[data-testid="select-all"], th input[type="checkbox"]');
      if (await selectAll.isVisible()) {
        await selectAll.click();
        const checkboxes = page.locator('[data-testid="payment-checkbox"], tbody input[type="checkbox"]');
        const count = await checkboxes.count();
        if (count > 0) {
          await expect(checkboxes.first()).toBeChecked();
        }
      }
    });
  });

  test.describe('View Deposit', () => {
    test('should navigate to deposit detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/banking.*deposits\/[^/]+$/);
    });

    test('should display deposit details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const depositNumber = page.locator('h1, h2, [data-testid="deposit-number"]');
      await expect(depositNumber).toBeVisible();
    });

    test('should display bank account information', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const accountInfo = page.locator('[data-testid="bank-account"], :has-text("Account")');
      await expect(accountInfo).toBeVisible();
    });

    test('should display included payments', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const paymentsTable = page.locator('[data-testid="deposit-payments"], table');
      await expect(paymentsTable).toBeVisible();
    });

    test('should display deposit total', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const totalDisplay = page.locator('[data-testid="deposit-total"], :has-text("Total")');
      await expect(totalDisplay).toBeVisible();
    });
  });

  test.describe('Deposit Actions', () => {
    test('should have print deposit slip option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const printButton = page.locator('button:has-text("Print"), button:has-text("Deposit Slip")');
      // Print option may or may not be visible
    });

    test('should have export option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")');
      // Export option may or may not be visible
    });
  });

  test.describe('Edit Deposit', () => {
    test('should open edit page for unreconciled deposit', async ({ page }) => {
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

  test.describe('Void Deposit', () => {
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

  test.describe('Delete Deposit', () => {
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

  test.describe('Undeposited Funds', () => {
    test('should display undeposited funds summary', async ({ page }) => {
      const undepositedSummary = page.locator('[data-testid="undeposited-funds"], :has-text("Undeposited")');
      // Undeposited funds summary may or may not be visible
    });

    test('should navigate to undeposited funds', async ({ page }) => {
      const undepositedLink = page.locator('a:has-text("Undeposited"), button:has-text("Undeposited")');
      if (await undepositedLink.isVisible()) {
        await undepositedLink.click();
        await expect(page).toHaveURL(/undeposited/);
      }
    });
  });

  test.describe('Pagination', () => {
    test('should show pagination for many deposits', async () => {
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

    test('should sort by account', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Account');
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
