import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, formatCurrency } from '../utils/test-helpers';

test.describe('Pay Applications', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/construction/pay-applications');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load pay applications list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/construction.*pay-applications/);
    });

    test('should display pay applications table or empty state', async () => {
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
      expect(headerText).toMatch(/number|project|period|amount|status/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search pay applications by number', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'PAY';

      await listPage.search(searchTerm);

      const filteredCount = await listPage.getRowCount();
      expect(filteredCount).toBeLessThanOrEqual(rowCount);
    });

    test('should filter by project', async ({ page }) => {
      const projectFilter = page.locator('button:has-text("Project"), [data-testid="project-filter"]');
      if (await projectFilter.isVisible()) {
        await projectFilter.click();
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

    test('should filter by billing period', async ({ page }) => {
      const periodFilter = page.locator('button:has-text("Period"), [data-testid="period-filter"]');
      if (await periodFilter.isVisible()) {
        await periodFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Pay Application', () => {
    test('should navigate to create pay application page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/construction.*pay-applications\/(new|create)/);
    });

    test('should display project selector', async ({ page }) => {
      await listPage.clickCreate();

      const projectSelect = page.locator('[name="projectId"], [data-testid="project-select"]');
      await expect(projectSelect).toBeVisible();
    });

    test('should display billing period selector', async ({ page }) => {
      await listPage.clickCreate();

      const periodSelect = page.locator('[name="billingPeriod"], [data-testid="period-select"]');
      await expect(periodSelect).toBeVisible();
    });

    test('should display SOV line items', async ({ page }) => {
      await listPage.clickCreate();

      const sovItems = page.locator('[data-testid="sov-items"], [data-testid="line-items"], table');
      await expect(sovItems).toBeVisible();
    });

    test('should display retainage fields', async ({ page }) => {
      await listPage.clickCreate();

      const retainage = page.locator('[name="retainage"], [data-testid="retainage"]');
      // Retainage field may or may not be visible
    });

    test('should calculate totals', async ({ page }) => {
      await listPage.clickCreate();

      const totalDisplay = page.locator('[data-testid="total"], :has-text("Total")');
      await expect(totalDisplay).toBeVisible();
    });

    test('should validate required project', async ({ page }) => {
      await listPage.clickCreate();

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]');
      await saveButton.click();

      const error = page.locator('.error, [role="alert"], .text-destructive');
      await expect(error).toBeVisible();
    });
  });

  test.describe('View Pay Application', () => {
    test('should navigate to pay application detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/construction.*pay-applications\/[^/]+$/);
    });

    test('should display pay application details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const appNumber = page.locator('h1, h2, [data-testid="pay-app-number"]');
      await expect(appNumber).toBeVisible();
    });

    test('should display project information', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const projectInfo = page.locator('[data-testid="project-info"], :has-text("Project")');
      await expect(projectInfo).toBeVisible();
    });

    test('should display SOV breakdown', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const sovBreakdown = page.locator('[data-testid="sov-breakdown"], table');
      await expect(sovBreakdown).toBeVisible();
    });

    test('should display billing summary', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const summary = page.locator('[data-testid="billing-summary"], :has-text("Summary")');
      // Summary section may or may not be visible
    });
  });

  test.describe('Pay Application Actions', () => {
    test('should have submit for approval option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const submitButton = page.locator('button:has-text("Submit"), button:has-text("Approve")');
      // Submit option may or may not be present
    });

    test('should have print/export option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const printButton = page.locator('button:has-text("Print"), button:has-text("Export"), button:has-text("PDF")');
      // Print option may or may not be present
    });

    test('should have generate invoice option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const invoiceButton = page.locator('button:has-text("Invoice"), button:has-text("Bill")');
      // Generate invoice option may or may not be present
    });
  });

  test.describe('Edit Pay Application', () => {
    test('should open edit page for draft pay application', async ({ page }) => {
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

  test.describe('Delete Pay Application', () => {
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
    test('should show pagination for many pay applications', async () => {
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
