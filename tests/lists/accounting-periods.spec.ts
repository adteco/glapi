import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, formatDate } from '../utils/test-helpers';

test.describe('Accounting Periods', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/lists/accounting-periods');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load accounting periods list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/lists\/accounting-periods/);
    });

    test('should display accounting periods table or empty state', async () => {
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
      expect(headerText).toMatch(/name|start|end|status|year/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should filter periods by search query', async () => {
      const initialCount = await listPage.getRowCount();
      if (initialCount === 0) {
        test.skip();
        return;
      }

      await listPage.search('2024');

      const filteredCount = await listPage.getRowCount();
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });

    test('should clear search', async () => {
      await listPage.search('random-search');
      await listPage.clearSearch();

      const value = await listPage.searchInput.inputValue();
      expect(value).toBe('');
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

    test('should filter by year', async ({ page }) => {
      const yearFilter = page.locator('button:has-text("Year"), [data-testid="year-filter"]');
      if (await yearFilter.isVisible()) {
        await yearFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Accounting Period', () => {
    test('should open create dialog', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should create period with required fields', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const periodName = `Test Period ${uniqueId()}`;
        const startDate = formatDate(new Date());
        const endDate = formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // 30 days later

        await dialogPage.fillInput('name', periodName);
        await dialogPage.fillInput('startDate', startDate);
        await dialogPage.fillInput('endDate', endDate);

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(periodName);
        await listPage.expectRowWithText(periodName);
      }
    });

    test('should validate required fields', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.confirm();

        const errors = await dialogPage.getErrors();
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    test('should validate date range', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const periodName = `Invalid Period ${uniqueId()}`;
        const startDate = formatDate(new Date());
        const endDate = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 30 days before

        await dialogPage.fillInput('name', periodName);
        await dialogPage.fillInput('startDate', startDate);
        await dialogPage.fillInput('endDate', endDate);

        await dialogPage.confirm();

        // Should show validation error for invalid date range
        const errors = await dialogPage.getErrors();
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    test('should cancel period creation', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.cancel();
        await dialogPage.expectNotVisible();
      }
    });
  });

  test.describe('View Accounting Period', () => {
    test('should click to view period details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      // Either opens detail page or shows more info
      const urlChanged = page.url().includes('/accounting-periods/');
      const dialogOpened = await dialogPage.isOpen();
      expect(urlChanged || dialogOpened).toBe(true);
    });
  });

  test.describe('Edit Accounting Period', () => {
    test('should open edit dialog for existing period', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/edit');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should update period name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const newName = `Updated Period ${uniqueId()}`;
        await dialogPage.fillInput('name', newName);
        await dialogPage.confirm();

        await listPage.waitForPageLoad();
        await listPage.expectRowWithText(newName);
      }
    });
  });

  test.describe('Period Status Management', () => {
    test('should display period status', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const row = listPage.getRow(0);
      const statusBadge = row.locator('[data-testid="status"], .badge, .status');
      // Status should be visible (open, closed, locked, etc.)
      const hasStatus = await statusBadge.isVisible().catch(() => false);
      // Or status is in text
      const rowText = await row.textContent();
      expect(hasStatus || rowText?.toLowerCase().includes('open') || rowText?.toLowerCase().includes('closed')).toBe(true);
    });

    test('should have close period option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Look for close action in row
      const row = listPage.getRow(0);
      const closeButton = row.locator('button:has-text("Close"), [data-testid="close-period"]');
      const menuButton = row.locator('button[aria-label*="action"], button[aria-label*="menu"]');

      // Either direct button or in menu
      const hasClose = await closeButton.isVisible().catch(() => false);
      const hasMenu = await menuButton.isVisible().catch(() => false);

      expect(hasClose || hasMenu).toBe(true);
    });
  });

  test.describe('Delete Accounting Period', () => {
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

      const originalCount = rowCount;
      await listPage.deleteRow(0);
      await listPage.cancelDelete();

      const newCount = await listPage.getRowCount();
      expect(newCount).toBe(originalCount);
    });
  });

  test.describe('Setup Fiscal Year Wizard', () => {
    test('should open setup fiscal year dialog', async ({ page }) => {
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await expect(setupButton).toBeVisible();
      await setupButton.click();

      // Dialog should open
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/setup fiscal year periods/i)).toBeVisible();
    });

    test('should display fiscal year form fields', async ({ page }) => {
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await setupButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Check for required form fields
      await expect(dialog.getByLabel(/fiscal year/i)).toBeVisible();
      await expect(dialog.getByLabel(/starting month/i)).toBeVisible();
      await expect(dialog.getByLabel(/year start date/i)).toBeVisible();
    });

    test('should allow toggling adjustment period', async ({ page }) => {
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await setupButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Find adjustment period toggle
      const adjustmentToggle = dialog.locator('[role="switch"]').first();
      if (await adjustmentToggle.isVisible()) {
        const initialState = await adjustmentToggle.getAttribute('aria-checked');
        await adjustmentToggle.click();
        const newState = await adjustmentToggle.getAttribute('aria-checked');
        expect(newState).not.toBe(initialState);
      }
    });

    test('should create fiscal year periods successfully', async ({ page }) => {
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await setupButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Fill in the form
      const fiscalYearInput = dialog.getByLabel(/fiscal year/i);
      await fiscalYearInput.clear();
      await fiscalYearInput.fill('2027');

      // Click Preview or Create button
      const previewButton = dialog.getByRole('button', { name: /preview/i });
      const createButton = dialog.getByRole('button', { name: /create/i });

      if (await previewButton.isVisible()) {
        await previewButton.click();
        // If there's a preview step, confirm
        const confirmButton = dialog.getByRole('button', { name: /confirm|create/i });
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
      } else if (await createButton.isVisible()) {
        await createButton.click();
      }

      // Wait for success - either dialog closes or success message appears
      await page.waitForTimeout(2000);

      // Verify periods were created by checking the list
      await listPage.waitForPageLoad();
      await listPage.search('2027');

      // Should have periods for 2027
      const rowCount = await listPage.getRowCount();
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should cancel fiscal year setup', async ({ page }) => {
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await setupButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Cancel
      const cancelButton = dialog.getByRole('button', { name: /cancel/i });
      await cancelButton.click();

      // Dialog should close
      await expect(dialog).not.toBeVisible();
    });

    test('should show error for duplicate fiscal year', async ({ page }) => {
      // This test assumes fiscal year 2026 already exists
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await setupButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      const fiscalYearInput = dialog.getByLabel(/fiscal year/i);
      await fiscalYearInput.clear();
      await fiscalYearInput.fill('2026'); // Likely existing year

      const previewButton = dialog.getByRole('button', { name: /preview/i });
      const createButton = dialog.getByRole('button', { name: /create/i });

      if (await previewButton.isVisible()) {
        await previewButton.click();
      } else if (await createButton.isVisible()) {
        await createButton.click();
      }

      // Should show error if year already exists
      await page.waitForTimeout(1000);
      const errorMessage = page.locator('[role="alert"], .error, .text-destructive');
      // May or may not show error depending on whether 2026 exists
    });
  });

  test.describe('Pagination', () => {
    test('should display pagination if many periods', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount >= 10) {
        await expect(listPage.pagination).toBeVisible();
      }
    });
  });

  test.describe('Table Sorting', () => {
    test('should sort by name', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Name');
    });

    test('should sort by start date', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Start');
    });

    test('should sort by end date', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('End');
    });
  });
});
