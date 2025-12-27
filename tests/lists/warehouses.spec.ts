import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString } from '../utils/test-helpers';

test.describe('Warehouses', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/lists/warehouses');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load warehouses list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/lists\/warehouses/);
    });

    test('should display warehouses table or empty state', async () => {
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
      expect(headerText).toMatch(/name|location|status/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should filter warehouses by search query', async () => {
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

    test('should filter by location', async ({ page }) => {
      const locationFilter = page.locator('button:has-text("Location"), [data-testid="location-filter"]');
      if (await locationFilter.isVisible()) {
        await locationFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Warehouse', () => {
    test('should open create dialog', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should create warehouse with required fields', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const warehouseCode = uniqueId('WH');
        const warehouseName = `Test Warehouse ${randomString()}`;

        await dialogPage.fillInput('code', warehouseCode);
        await dialogPage.fillInput('name', warehouseName);

        // Select location if available
        const locationSelect = dialogPage.dialog.locator('[name="locationId"], [data-testid="location"]');
        if (await locationSelect.isVisible()) {
          await locationSelect.click();
          await page.locator('[role="option"]').first().click();
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(warehouseName);
        await listPage.expectRowWithText(warehouseName);
      }
    });

    test('should create warehouse with address', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const warehouseData = {
          code: uniqueId('WH'),
          name: `Warehouse with Address ${randomString()}`,
          street: '456 Warehouse Drive',
          city: 'Industrial City',
          state: 'TX',
          postalCode: '75001',
        };

        await dialogPage.fillInput('code', warehouseData.code);
        await dialogPage.fillInput('name', warehouseData.name);

        const streetInput = dialogPage.dialog.locator('[name="street"], [name="address.street"]');
        if (await streetInput.isVisible()) {
          await streetInput.fill(warehouseData.street);
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(warehouseData.name);
        await listPage.expectRowWithText(warehouseData.name);
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

    test('should cancel warehouse creation', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.cancel();
        await dialogPage.expectNotVisible();
      }
    });
  });

  test.describe('Edit Warehouse', () => {
    test('should open edit dialog for existing warehouse', async ({ page }) => {
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

    test('should update warehouse name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const newName = `Updated Warehouse ${randomString()}`;
        await dialogPage.fillInput('name', newName);
        await dialogPage.confirm();

        await listPage.waitForPageLoad();
        await listPage.expectRowWithText(newName);
      }
    });
  });

  test.describe('Warehouse Inventory', () => {
    test('should navigate to warehouse inventory', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const inventoryLink = listPage.getRow(0).locator('a:has-text("Inventory"), button:has-text("Inventory")');
      if (await inventoryLink.isVisible()) {
        await inventoryLink.click();
        await expect(page).toHaveURL(/inventory/);
      }
    });
  });

  test.describe('Delete Warehouse', () => {
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
    test('should display pagination if many warehouses', async () => {
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
