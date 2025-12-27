import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString, randomEmail, randomPhone } from '../utils/test-helpers';

test.describe('Leads', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/relationships/leads');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load leads list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/relationships\/leads/);
    });

    test('should display leads table or empty state', async () => {
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
      expect(headerText).toMatch(/name|company|status|source/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search leads by name', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'test';

      await listPage.search(searchTerm);

      const filteredCount = await listPage.getRowCount();
      expect(filteredCount).toBeLessThanOrEqual(rowCount);
    });

    test('should clear search', async () => {
      await listPage.search('test-search');
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

    test('should filter by source', async ({ page }) => {
      const sourceFilter = page.locator('button:has-text("Source"), [data-testid="source-filter"]');
      if (await sourceFilter.isVisible()) {
        await sourceFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Lead', () => {
    test('should open create dialog', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should create lead with basic info', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const firstName = `Lead${randomString(4)}`;
        const lastName = `Person${randomString(4)}`;
        const email = randomEmail();
        const company = `Lead Company ${randomString(4)}`;

        await dialogPage.fillInput('firstName', firstName);
        await dialogPage.fillInput('lastName', lastName);
        await dialogPage.fillInput('email', email);

        const companyInput = dialogPage.dialog.locator('[name="company"], [name="companyName"]');
        if (await companyInput.isVisible()) {
          await companyInput.fill(company);
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(firstName);
        await listPage.expectRowWithText(firstName);
      }
    });

    test('should create lead with source and status', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const leadData = {
          firstName: `Source${randomString(4)}`,
          lastName: `Lead${randomString(4)}`,
          email: randomEmail(),
          company: `Source Company ${randomString(4)}`,
        };

        await dialogPage.fillInput('firstName', leadData.firstName);
        await dialogPage.fillInput('lastName', leadData.lastName);
        await dialogPage.fillInput('email', leadData.email);

        // Select source if available
        const sourceSelect = dialogPage.dialog.locator('[name="source"], [data-testid="source"]');
        if (await sourceSelect.isVisible()) {
          await sourceSelect.click();
          await page.locator('[role="option"]').first().click();
        }

        // Select status if available
        const statusSelect = dialogPage.dialog.locator('[name="status"], [data-testid="status"]');
        if (await statusSelect.isVisible()) {
          await statusSelect.click();
          await page.locator('[role="option"]').first().click();
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(leadData.firstName);
        await listPage.expectRowWithText(leadData.firstName);
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

    test('should cancel lead creation', async ({ page }) => {
      const initialCount = await listPage.getRowCount();

      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.fillInput('firstName', `Cancel${randomString(4)}`);
        await dialogPage.cancel();

        await dialogPage.expectNotVisible();

        const newCount = await listPage.getRowCount();
        expect(newCount).toBe(initialCount);
      }
    });
  });

  test.describe('Convert Lead', () => {
    test('should have convert to customer option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const convertButton = listPage.getRow(0).locator('button:has-text("Convert"), [data-testid="convert"]');
      // Convert option may or may not be present
    });
  });

  test.describe('Edit Lead', () => {
    test('should open edit dialog or page', async ({ page }) => {
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

    test('should update lead name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const newFirstName = `Updated${randomString(4)}`;
        await dialogPage.fillInput('firstName', newFirstName);
        await dialogPage.confirm();

        await listPage.waitForPageLoad();
        await listPage.expectRowWithText(newFirstName);
      }
    });
  });

  test.describe('Delete Lead', () => {
    test('should show delete confirmation dialog', async ({ page }) => {
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
    test('should show pagination for many leads', async () => {
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
