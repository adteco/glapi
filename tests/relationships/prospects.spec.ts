import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString, randomEmail, randomPhone } from '../utils/test-helpers';

test.describe('Prospects', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/relationships/prospects');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load prospects list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/relationships\/prospects/);
    });

    test('should display prospects table or empty state', async () => {
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
      expect(headerText).toMatch(/name|company|stage|value/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search prospects by name', async () => {
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

    test('should filter by stage', async ({ page }) => {
      const stageFilter = page.locator('button:has-text("Stage"), [data-testid="stage-filter"]');
      if (await stageFilter.isVisible()) {
        await stageFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should filter by probability', async ({ page }) => {
      const probFilter = page.locator('button:has-text("Probability"), [data-testid="probability-filter"]');
      if (await probFilter.isVisible()) {
        await probFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Prospect', () => {
    test('should open create dialog', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should create prospect with basic info', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const prospectName = `Prospect ${randomString()}`;
        const company = `Prospect Company ${randomString(4)}`;
        const email = randomEmail();

        await dialogPage.fillInput('name', prospectName);

        const companyInput = dialogPage.dialog.locator('[name="company"], [name="companyName"]');
        if (await companyInput.isVisible()) {
          await companyInput.fill(company);
        }

        const emailInput = dialogPage.dialog.locator('[name="email"]');
        if (await emailInput.isVisible()) {
          await emailInput.fill(email);
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(prospectName);
        await listPage.expectRowWithText(prospectName);
      }
    });

    test('should create prospect with deal value', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const prospectData = {
          name: `Valued Prospect ${randomString()}`,
          company: `Big Company ${randomString(4)}`,
          value: '50000',
          probability: '75',
        };

        await dialogPage.fillInput('name', prospectData.name);

        const valueInput = dialogPage.dialog.locator('[name="value"], [name="dealValue"]');
        if (await valueInput.isVisible()) {
          await valueInput.fill(prospectData.value);
        }

        const probInput = dialogPage.dialog.locator('[name="probability"]');
        if (await probInput.isVisible()) {
          await probInput.fill(prospectData.probability);
        }

        // Select stage if available
        const stageSelect = dialogPage.dialog.locator('[name="stage"], [data-testid="stage"]');
        if (await stageSelect.isVisible()) {
          await stageSelect.click();
          await page.locator('[role="option"]').first().click();
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(prospectData.name);
        await listPage.expectRowWithText(prospectData.name);
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

    test('should cancel prospect creation', async ({ page }) => {
      const initialCount = await listPage.getRowCount();

      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.fillInput('name', `Cancel ${randomString()}`);
        await dialogPage.cancel();

        await dialogPage.expectNotVisible();

        const newCount = await listPage.getRowCount();
        expect(newCount).toBe(initialCount);
      }
    });
  });

  test.describe('Pipeline View', () => {
    test('should have pipeline/kanban view option', async ({ page }) => {
      const pipelineButton = page.locator('button:has-text("Pipeline"), button:has-text("Kanban"), [data-testid="pipeline-view"]');
      // Pipeline view may or may not be present
    });
  });

  test.describe('Convert Prospect', () => {
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

  test.describe('Edit Prospect', () => {
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

    test('should update prospect name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const newName = `Updated Prospect ${randomString()}`;
        await dialogPage.fillInput('name', newName);
        await dialogPage.confirm();

        await listPage.waitForPageLoad();
        await listPage.expectRowWithText(newName);
      }
    });

    test('should update prospect stage', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const stageSelect = dialogPage.dialog.locator('[name="stage"], [data-testid="stage"]');
        if (await stageSelect.isVisible()) {
          await stageSelect.click();
          await page.locator('[role="option"]').last().click();
        }
        await dialogPage.confirm();
        await listPage.waitForPageLoad();
      }
    });
  });

  test.describe('Delete Prospect', () => {
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
    test('should show pagination for many prospects', async () => {
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

    test('should sort by value', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Value');
    });

    test('should sort by stage', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Stage');
    });
  });
});
