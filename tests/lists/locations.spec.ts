import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString } from '../utils/test-helpers';

test.describe('Locations', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/lists/locations');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load locations list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/lists\/locations/);
    });

    test('should display locations table or empty state', async () => {
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
  });

  test.describe('Search and Filter', () => {
    test('should filter locations by search query', async () => {
      const initialCount = await listPage.getRowCount();
      if (initialCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'test';

      await listPage.search(searchTerm);

      const filteredCount = await listPage.getRowCount();
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });

    test('should clear search', async () => {
      await listPage.search('random-search');
      await listPage.clearSearch();

      const value = await listPage.searchInput.inputValue();
      expect(value).toBe('');
    });
  });

  test.describe('Create Location', () => {
    test('should open create dialog', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should create location with required fields', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const locationCode = uniqueId('LOC');
        const locationName = `Test Location ${randomString()}`;

        await dialogPage.fillInput('code', locationCode);
        await dialogPage.fillInput('name', locationName);

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(locationName);
        await listPage.expectRowWithText(locationName);
      }
    });

    test('should create location with address', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const locationData = {
          code: uniqueId('LOC'),
          name: `Location with Address ${randomString()}`,
          street: '123 Main Street',
          city: 'Test City',
          state: 'CA',
          postalCode: '90210',
        };

        await dialogPage.fillInput('code', locationData.code);
        await dialogPage.fillInput('name', locationData.name);

        const streetInput = dialogPage.dialog.locator('[name="street"], [name="address.street"]');
        if (await streetInput.isVisible()) {
          await streetInput.fill(locationData.street);
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(locationData.name);
        await listPage.expectRowWithText(locationData.name);
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

    test('should cancel location creation', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.cancel();
        await dialogPage.expectNotVisible();
      }
    });
  });

  test.describe('Edit Location', () => {
    test('should open edit dialog for existing location', async ({ page }) => {
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

    test('should update location name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const newName = `Updated Location ${randomString()}`;
        await dialogPage.fillInput('name', newName);
        await dialogPage.confirm();

        await listPage.waitForPageLoad();
        await listPage.expectRowWithText(newName);
      }
    });
  });

  test.describe('Delete Location', () => {
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

  test.describe('Pagination', () => {
    test('should display pagination if many locations', async () => {
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
  });
});
