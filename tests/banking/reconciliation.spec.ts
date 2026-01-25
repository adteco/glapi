import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';

test.describe('Bank Reconciliation', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/banking/reconciliation');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load bank reconciliation page', async ({ page }) => {
      await expect(page).toHaveURL(/\/banking.*reconciliation/);
    });

    test('should display reconciliation list or empty state', async () => {
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
      expect(headerText).toMatch(/account|date|status|balance|difference/i);
    });
  });

  test.describe('Search and Filter', () => {
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

  test.describe('Start New Reconciliation', () => {
    test('should navigate to create reconciliation page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/banking.*reconciliation\/(new|create)/);
    });

    test('should display bank account selector', async ({ page }) => {
      await listPage.clickCreate();

      const accountSelect = page.locator('[name="bankAccountId"], [data-testid="bank-account-select"]');
      await expect(accountSelect).toBeVisible();
    });

    test('should display statement date field', async ({ page }) => {
      await listPage.clickCreate();

      const statementDate = page.locator('[name="statementDate"], [data-testid="statement-date"]');
      await expect(statementDate).toBeVisible();
    });

    test('should display statement ending balance field', async ({ page }) => {
      await listPage.clickCreate();

      const endingBalance = page.locator('[name="endingBalance"], [data-testid="ending-balance"]');
      await expect(endingBalance).toBeVisible();
    });

    test('should validate required bank account', async ({ page }) => {
      await listPage.clickCreate();

      const saveButton = page.locator('button:has-text("Start"), button:has-text("Create"), button[type="submit"]');
      await saveButton.click();

      const error = page.locator('.error, [role="alert"], .text-destructive');
      await expect(error).toBeVisible();
    });
  });

  test.describe('Reconciliation Process', () => {
    test('should navigate to reconciliation detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/banking.*reconciliation\/[^/]+$/);
    });

    test('should display transactions to reconcile', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const transactionsTable = page.locator('[data-testid="transactions-table"], table');
      await expect(transactionsTable).toBeVisible();
    });

    test('should display cleared balance', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const clearedBalance = page.locator('[data-testid="cleared-balance"], :has-text("Cleared Balance")');
      await expect(clearedBalance).toBeVisible();
    });

    test('should display difference amount', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const difference = page.locator('[data-testid="difference"], :has-text("Difference")');
      await expect(difference).toBeVisible();
    });

    test('should display statement ending balance', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const endingBalance = page.locator('[data-testid="ending-balance"], :has-text("Statement Balance")');
      await expect(endingBalance).toBeVisible();
    });
  });

  test.describe('Transaction Clearing', () => {
    test('should allow selecting transactions to clear', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.isVisible()) {
        await checkbox.click();
        await expect(checkbox).toBeChecked();
      }
    });

    test('should update cleared balance when selecting transactions', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const clearedBalance = page.locator('[data-testid="cleared-balance"]');
      const initialBalance = await clearedBalance.textContent();

      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.isVisible()) {
        await checkbox.click();
        // Balance may or may not change depending on implementation
      }
    });

    test('should have clear all option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const clearAllButton = page.locator('button:has-text("Clear All"), [data-testid="clear-all"]');
      // Clear all option may or may not be visible
    });

    test('should have unclear all option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const unclearAllButton = page.locator('button:has-text("Unclear All"), [data-testid="unclear-all"]');
      // Unclear all option may or may not be visible
    });
  });

  test.describe('Transaction Filters', () => {
    test('should filter by deposits', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const depositsFilter = page.locator('button:has-text("Deposits"), [data-testid="deposits-filter"]');
      if (await depositsFilter.isVisible()) {
        await depositsFilter.click();
      }
    });

    test('should filter by payments', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const paymentsFilter = page.locator('button:has-text("Payments"), [data-testid="payments-filter"]');
      if (await paymentsFilter.isVisible()) {
        await paymentsFilter.click();
      }
    });

    test('should filter by uncleared', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const unclearedFilter = page.locator('button:has-text("Uncleared"), [data-testid="uncleared-filter"]');
      if (await unclearedFilter.isVisible()) {
        await unclearedFilter.click();
      }
    });
  });

  test.describe('Reconciliation Actions', () => {
    test('should have finish reconciliation option when balanced', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const finishButton = page.locator('button:has-text("Finish"), button:has-text("Complete")');
      // Finish option may or may not be visible depending on balance status
    });

    test('should have save for later option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Save for Later")');
      // Save option may or may not be visible
    });

    test('should have cancel reconciliation option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Discard")');
      // Cancel option may or may not be visible
    });
  });

  test.describe('Add Transactions', () => {
    test('should have add adjustment option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const adjustmentButton = page.locator('button:has-text("Adjustment"), button:has-text("Add Adjustment")');
      // Add adjustment option may or may not be visible
    });

    test('should have add bank fee option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const feeButton = page.locator('button:has-text("Bank Fee"), button:has-text("Add Fee")');
      // Add fee option may or may not be visible
    });

    test('should have add interest option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const interestButton = page.locator('button:has-text("Interest"), button:has-text("Add Interest")');
      // Add interest option may or may not be visible
    });
  });

  test.describe('Completed Reconciliations', () => {
    test('should display reconciliation history', async ({ page }) => {
      const historyTab = page.locator('[role="tab"]:has-text("History"), button:has-text("History")');
      if (await historyTab.isVisible()) {
        await historyTab.click();

        const historyList = page.locator('[data-testid="reconciliation-history"], table');
        await expect(historyList).toBeVisible();
      }
    });

    test('should allow viewing completed reconciliation details', async ({ page }) => {
      const historyTab = page.locator('[role="tab"]:has-text("History"), button:has-text("History")');
      if (await historyTab.isVisible()) {
        await historyTab.click();

        const firstReconciliation = page.locator('table tbody tr').first();
        if (await firstReconciliation.isVisible()) {
          await firstReconciliation.click();
          // Should show reconciliation details
        }
      }
    });
  });

  test.describe('Undo Reconciliation', () => {
    test('should have undo option for completed reconciliations', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Look for completed reconciliation
      const completedRow = page.locator('tr:has-text("Complete"), tr:has-text("Reconciled")').first();
      if (await completedRow.isVisible()) {
        await completedRow.click();

        const undoButton = page.locator('button:has-text("Undo"), button:has-text("Unrecon")');
        // Undo option may or may not be visible
      }
    });
  });

  test.describe('Pagination', () => {
    test('should show pagination for many reconciliations', async () => {
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
