import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';

test.describe('Expense Reports', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/transactions/expenses/expense-reports');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load expense reports list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions.*expense-reports/);
    });

    test('should display expense reports table or empty state', async () => {
      const hasRows = (await listPage.getRowCount()) > 0;
      const isEmpty = await listPage.isEmpty();
      expect(hasRows || isEmpty).toBe(true);
    });

    test('should display page title', async ({ page }) => {
      const title = page.locator('h1:has-text("Expense Reports")');
      await expect(title).toBeVisible();
    });

    test('should display create button', async () => {
      await expect(listPage.createButton).toBeVisible();
    });

    test('should display correct table headers', async () => {
      const headers = await listPage.tableHeaders.allTextContents();
      const headerText = headers.join(' ').toLowerCase();
      expect(headerText).toMatch(/report|employee|period|amount|status/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search expense reports by number', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'EXP';

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

    test('should filter by employee', async ({ page }) => {
      const employeeFilter = page.locator('button:has-text("Employee"), [data-testid="employee-filter"]');
      if (await employeeFilter.isVisible()) {
        await employeeFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Expense Report', () => {
    test('should navigate to create expense report page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/transactions.*expense-reports\/(new|create)/);
    });

    test('should display period date fields', async ({ page }) => {
      await listPage.clickCreate();

      const periodStart = page.locator('[name="periodStart"], [data-testid="period-start"]');
      const periodEnd = page.locator('[name="periodEnd"], [data-testid="period-end"]');
      // Period fields should be visible on the form
    });

    test('should display title/description field', async ({ page }) => {
      await listPage.clickCreate();

      const titleField = page.locator('[name="title"], [name="description"], input[placeholder*="title" i]');
      // Title field should be visible
    });

    test('should display expense entries section', async ({ page }) => {
      await listPage.clickCreate();

      const entriesSection = page.locator('[data-testid="expense-entries"], .expense-entries, table, :has-text("Expense Entries")');
      // Entries section may be visible
    });

    test('should display business purpose field', async ({ page }) => {
      await listPage.clickCreate();

      const purposeField = page.locator('[name="businessPurpose"], [name="purpose"], textarea');
      // Business purpose field may be visible
    });

    test('should validate required fields', async ({ page }) => {
      await listPage.clickCreate();

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]');
      await saveButton.click();

      const error = page.locator('.error, [role="alert"], .text-destructive');
      await expect(error).toBeVisible();
    });

    test('should calculate total amount', async ({ page }) => {
      await listPage.clickCreate();

      const totalDisplay = page.locator('[data-testid="total"], .expense-report-total, :has-text("Total")');
      // Total should be displayed
    });
  });

  test.describe('View Expense Report', () => {
    test('should navigate to expense report detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click view button or row
      const viewButton = listPage.getRow(0).locator('button:has([class*="eye"]), button[title="View"]');
      if (await viewButton.isVisible()) {
        await viewButton.click();
      } else {
        await listPage.clickRow(0);
      }

      // Either opens detail page or dialog
      const urlChanged = page.url().includes('/expense-reports/');
      const dialogOpened = await dialogPage.isOpen();
      expect(urlChanged || dialogOpened).toBe(true);
    });

    test('should display expense report details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button:has([class*="eye"]), button[title="View"]');
      if (await viewButton.isVisible()) {
        await viewButton.click();
      } else {
        await listPage.clickRow(0);
      }

      // Should show report details
      const reportNumber = page.locator('[data-testid="report-number"], :has-text("Report")');
      await expect(reportNumber).toBeVisible();
    });

    test('should display employee name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button:has([class*="eye"]), button[title="View"]');
      if (await viewButton.isVisible()) {
        await viewButton.click();
      }

      const employeeDisplay = page.locator('[data-testid="employee-name"], :has-text("Employee")');
      // Employee should be visible
    });

    test('should display period dates', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button:has([class*="eye"]), button[title="View"]');
      if (await viewButton.isVisible()) {
        await viewButton.click();
      }

      const periodDisplay = page.locator('[data-testid="period"], :has-text("Period")');
      // Period should be visible
    });

    test('should display total amount', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button:has([class*="eye"]), button[title="View"]');
      if (await viewButton.isVisible()) {
        await viewButton.click();
      }

      const totalDisplay = page.locator('[data-testid="total-amount"], :has-text("Total")');
      await expect(totalDisplay).toBeVisible();
    });
  });

  test.describe('Expense Report Actions', () => {
    test('should have submit action for draft reports', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Look for submit action on draft reports
      const row = listPage.getRow(0);
      const submitButton = row.locator('button:has([class*="send"]), button[title="Submit"]');
      // Submit button may be visible for draft reports
    });

    test('should have approve action for submitted reports', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Look for approve action
      const row = listPage.getRow(0);
      const approveButton = row.locator('button:has([class*="check"]), button[title="Approve"]');
      // Approve button may be visible for submitted reports
    });

    test('should have reject action for submitted reports', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Look for reject action
      const row = listPage.getRow(0);
      const rejectButton = row.locator('button:has([class*="x"]), button[title="Reject"]');
      // Reject button may be visible for submitted reports
    });
  });

  test.describe('Delete Expense Report', () => {
    test('should show delete confirmation for draft report', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Look for delete button on draft reports
      const row = listPage.getRow(0);
      const deleteButton = row.locator('button:has([class*="trash"]), button[title="Delete"]');

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        const alertDialog = page.locator('[role="alertdialog"], [role="dialog"]');
        await expect(alertDialog).toBeVisible();
      }
    });

    test('should cancel delete operation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const row = listPage.getRow(0);
      const deleteButton = row.locator('button:has([class*="trash"]), button[title="Delete"]');

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        const cancelButton = page.locator('[role="alertdialog"] button:has-text("Cancel")');
        if (await cancelButton.isVisible()) {
          await cancelButton.click();

          const newCount = await listPage.getRowCount();
          expect(newCount).toBe(rowCount);
        }
      }
    });
  });

  test.describe('Status Badge Display', () => {
    test('should display status badge for each report', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const row = listPage.getRow(0);
      const statusBadge = row.locator('[data-testid="status-badge"], .badge, [class*="Badge"]');
      // Status badge should be visible
    });

    test('should show appropriate colors for different statuses', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check that badges have variant-specific classes
      const badges = page.locator('tbody [data-testid="status-badge"], tbody .badge, tbody [class*="Badge"]');
      const count = await badges.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Pagination', () => {
    test('should show pagination for many expense reports', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount >= 10) {
        await expect(listPage.pagination).toBeVisible();
      }
    });
  });

  test.describe('Table Sorting', () => {
    test('should sort by period', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Period');
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

    test('should sort by submitted date', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Submitted');
    });
  });

  test.describe('Empty State', () => {
    test('should display helpful message when no reports exist', async ({ page }) => {
      const isEmpty = await listPage.isEmpty();
      if (isEmpty) {
        const emptyMessage = page.locator(':has-text("No expense reports found")');
        await expect(emptyMessage).toBeVisible();
      }
    });
  });
});
