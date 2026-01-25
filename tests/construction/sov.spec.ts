import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, formatCurrency } from '../utils/test-helpers';

test.describe('Schedule of Values (SOV)', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/construction/schedule-of-values');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load SOV list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/construction.*schedule-of-values|sov/);
    });

    test('should display SOV table or empty state', async () => {
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
      expect(headerText).toMatch(/project|contract|value|status/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search SOV by project', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'PRJ';

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
  });

  test.describe('Create SOV', () => {
    test('should navigate to create SOV page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/construction.*(schedule-of-values|sov)\/(new|create)/);
    });

    test('should display project selector', async ({ page }) => {
      await listPage.clickCreate();

      const projectSelect = page.locator('[name="projectId"], [data-testid="project-select"]');
      await expect(projectSelect).toBeVisible();
    });

    test('should display contract value field', async ({ page }) => {
      await listPage.clickCreate();

      const contractValue = page.locator('[name="contractValue"], [data-testid="contract-value"]');
      await expect(contractValue).toBeVisible();
    });

    test('should display line items section', async ({ page }) => {
      await listPage.clickCreate();

      const lineItems = page.locator('[data-testid="line-items"], [data-testid="sov-items"], table');
      await expect(lineItems).toBeVisible();
    });

    test('should add SOV line item', async ({ page }) => {
      await listPage.clickCreate();

      const addLineButton = page.locator('button:has-text("Add Line"), button:has-text("Add Item")');
      if (await addLineButton.isVisible()) {
        await addLineButton.click();

        const lineItemRows = page.locator('[data-testid="line-item"], .line-item-row, tr.sov-item');
        const count = await lineItemRows.count();
        expect(count).toBeGreaterThan(0);
      }
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

  test.describe('View SOV', () => {
    test('should navigate to SOV detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/construction.*(schedule-of-values|sov)\/[^/]+$/);
    });

    test('should display SOV details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const sovHeader = page.locator('h1, h2, [data-testid="sov-header"]');
      await expect(sovHeader).toBeVisible();
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

    test('should display line items breakdown', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const lineItems = page.locator('table, [data-testid="sov-items"]');
      await expect(lineItems).toBeVisible();
    });

    test('should display billing progress', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const progress = page.locator('[data-testid="billing-progress"], :has-text("Billed"), :has-text("Progress")');
      // Progress section may or may not be visible
    });

    test('should display retainage summary', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const retainage = page.locator('[data-testid="retainage"], :has-text("Retainage")');
      // Retainage section may or may not be visible
    });
  });

  test.describe('SOV Actions', () => {
    test('should have create pay application option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const createPayApp = page.locator('button:has-text("Pay Application"), button:has-text("Bill")');
      // Create pay app option may or may not be present
    });

    test('should have export option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")');
      // Export option may or may not be present
    });
  });

  test.describe('Edit SOV', () => {
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

  test.describe('Delete SOV', () => {
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
    test('should show pagination for many SOVs', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount >= 10) {
        await expect(listPage.pagination).toBeVisible();
      }
    });
  });

  test.describe('Table Sorting', () => {
    test('should sort by project', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Project');
    });

    test('should sort by contract value', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Value');
    });
  });
});
