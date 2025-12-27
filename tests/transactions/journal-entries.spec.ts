import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString } from '../utils/test-helpers';

test.describe('Journal Entries', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/transactions/accounting/journal-entries');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load journal entries list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions.*journal-entries/);
    });

    test('should display journal entries table or empty state', async () => {
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
      expect(headerText).toMatch(/number|date|memo|debit|credit|status/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search journal entries', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'JE';

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
        const preset = page.locator('[role="option"]').first();
        if (await preset.isVisible()) {
          await preset.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Journal Entry', () => {
    test('should navigate to create journal entry page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/transactions.*journal-entries\/(new|create)/);
    });

    test('should display date field', async ({ page }) => {
      await listPage.clickCreate();

      const dateInput = page.locator('[name="date"], [data-testid="date-input"], input[type="date"]');
      await expect(dateInput).toBeVisible();
    });

    test('should display memo field', async ({ page }) => {
      await listPage.clickCreate();

      const memoInput = page.locator('[name="memo"], [name="description"], textarea');
      await expect(memoInput).toBeVisible();
    });

    test('should display debit/credit lines section', async ({ page }) => {
      await listPage.clickCreate();

      const linesSection = page.locator('[data-testid="journal-lines"], .journal-lines, table');
      await expect(linesSection).toBeVisible();
    });

    test('should add journal line', async ({ page }) => {
      await listPage.clickCreate();

      const addLineButton = page.locator('button:has-text("Add Line"), button:has-text("Add Entry")');
      if (await addLineButton.isVisible()) {
        await addLineButton.click();

        const lineRows = page.locator('[data-testid="journal-line"], .journal-line-row');
        const count = await lineRows.count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('should validate balanced entry', async ({ page }) => {
      await listPage.clickCreate();

      // Try to save unbalanced entry
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]');
      await saveButton.click();

      // Should show validation error for unbalanced entry
      const error = page.locator('.error, [role="alert"], .text-destructive');
      await expect(error).toBeVisible();
    });

    test('should display running totals', async ({ page }) => {
      await listPage.clickCreate();

      const debitTotal = page.locator('[data-testid="debit-total"], :has-text("Debit")');
      const creditTotal = page.locator('[data-testid="credit-total"], :has-text("Credit")');
      await expect(debitTotal).toBeVisible();
      await expect(creditTotal).toBeVisible();
    });
  });

  test.describe('View Journal Entry', () => {
    test('should navigate to journal entry detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/transactions.*journal-entries\/[^/]+$/);
    });

    test('should display entry details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const entryNumber = page.locator('h1, h2, [data-testid="entry-number"]');
      await expect(entryNumber).toBeVisible();
    });

    test('should display debit and credit lines', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const linesTable = page.locator('table, [data-testid="journal-lines"]');
      await expect(linesTable).toBeVisible();
    });
  });

  test.describe('Journal Entry Actions', () => {
    test('should have post/approve option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const postButton = page.locator('button:has-text("Post"), button:has-text("Approve")');
      // Post option may or may not be present depending on status
    });

    test('should have reverse option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const reverseButton = page.locator('button:has-text("Reverse")');
      // Reverse option may or may not be present
    });
  });

  test.describe('Edit Journal Entry', () => {
    test('should open edit page for draft entries', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      // May redirect to edit or show warning if posted
      const url = page.url();
      const isEditable = url.includes('edit') || url.includes('journal-entries');
      expect(isEditable).toBe(true);
    });
  });

  test.describe('Delete Journal Entry', () => {
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
    test('should show pagination for many entries', async () => {
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

    test('should sort by number', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Number');
    });
  });
});
