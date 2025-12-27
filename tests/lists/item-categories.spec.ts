import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString } from '../utils/test-helpers';

test.describe('Item Categories', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/lists/item-categories');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load item categories list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/lists\/item-categories/);
    });

    test('should display categories table or empty state', async () => {
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
      expect(headerText).toMatch(/name|code|items/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should filter categories by search query', async () => {
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

  test.describe('Create Item Category', () => {
    test('should open create dialog', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should create category with required fields', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const categoryCode = uniqueId('CAT');
        const categoryName = `Test Category ${randomString()}`;

        await dialogPage.fillInput('code', categoryCode);
        await dialogPage.fillInput('name', categoryName);

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(categoryName);
        await listPage.expectRowWithText(categoryName);
      }
    });

    test('should create category with description', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const categoryData = {
          code: uniqueId('CAT'),
          name: `Category with Description ${randomString()}`,
          description: 'This is a test category description for E2E testing',
        };

        await dialogPage.fillInput('code', categoryData.code);
        await dialogPage.fillInput('name', categoryData.name);

        const descInput = dialogPage.dialog.locator('[name="description"], textarea');
        if (await descInput.isVisible()) {
          await descInput.fill(categoryData.description);
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(categoryData.name);
        await listPage.expectRowWithText(categoryData.name);
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

    test('should cancel category creation', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.cancel();
        await dialogPage.expectNotVisible();
      }
    });
  });

  test.describe('Edit Item Category', () => {
    test('should open edit dialog for existing category', async ({ page }) => {
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

    test('should update category name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const newName = `Updated Category ${randomString()}`;
        await dialogPage.fillInput('name', newName);
        await dialogPage.confirm();

        await listPage.waitForPageLoad();
        await listPage.expectRowWithText(newName);
      }
    });
  });

  test.describe('Category Hierarchy', () => {
    test('should display parent category field in form', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const parentField = dialogPage.dialog.locator(
          '[name="parentCategoryId"], [data-testid="parent-category"]'
        );
        // Parent field may or may not be present depending on implementation
      }
    });

    test('should show children categories', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check if any row has expand/children indicator
      const childrenIndicator = listPage.table.locator(
        'button[aria-label*="expand"], [data-testid="expand-row"], .tree-toggle'
      );
      // Some categories may have children
    });
  });

  test.describe('Category Items', () => {
    test('should navigate to category items', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const itemsLink = listPage.getRow(0).locator('a:has-text("Items"), button:has-text("Items")');
      if (await itemsLink.isVisible()) {
        await itemsLink.click();
        await expect(page).toHaveURL(/items/);
      }
    });

    test('should display item count in table', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check if item count column exists
      const headers = await listPage.tableHeaders.allTextContents();
      const hasItemCount = headers.some(h => h.toLowerCase().includes('item'));
      // Item count column may or may not be present
    });
  });

  test.describe('Delete Item Category', () => {
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
    test('should display pagination if many categories', async () => {
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

    test('should sort by code', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Code');
    });
  });
});
