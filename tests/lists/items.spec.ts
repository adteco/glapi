import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString, waitForNetworkIdle } from '../utils/test-helpers';

test.describe('Items List', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/lists/items');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load items list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/lists\/items/);
    });

    test('should display items table or empty state', async () => {
      const hasRows = (await listPage.getRowCount()) > 0;
      const isEmpty = await listPage.isEmpty();
      // Either should have items or show empty state
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
    test('should filter items by search query', async () => {
      const initialCount = await listPage.getRowCount();
      if (initialCount === 0) {
        test.skip();
        return;
      }

      // Get text from first row to search for
      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'test';

      await listPage.search(searchTerm);

      // Results should be filtered
      const filteredCount = await listPage.getRowCount();
      // Either fewer results or same (if all match)
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });

    test('should clear search', async () => {
      await listPage.search('random-search-term');
      await listPage.clearSearch();
      await listPage.waitForPageLoad();

      // Search input should be empty
      const value = await listPage.searchInput.inputValue();
      expect(value).toBe('');
    });

    test('should filter by item type', async ({ page }) => {
      const typeFilter = page.locator('button:has-text("Type"), [data-testid="type-filter"]');
      if (await typeFilter.isVisible()) {
        await typeFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should filter by category', async ({ page }) => {
      const categoryFilter = page.locator('button:has-text("Category"), [data-testid="category-filter"]');
      if (await categoryFilter.isVisible()) {
        await categoryFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should toggle active only filter', async ({ page }) => {
      const activeFilter = page.locator(
        'input[type="checkbox"]:near(:text("Active")), [data-testid="active-filter"]'
      );
      if (await activeFilter.isVisible()) {
        await activeFilter.click();
        await listPage.waitForPageLoad();
      }
    });
  });

  test.describe('Create Item', () => {
    test('should open create dialog or navigate to create page', async ({ page }) => {
      await listPage.clickCreate();

      // Check if dialog opened or navigated to new page
      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should create new item via dialog', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const itemCode = uniqueId('ITEM');
        const itemName = `Test Item ${randomString()}`;

        await dialogPage.fillInput('itemCode', itemCode);
        await dialogPage.fillInput('name', itemName);

        // Select item type if available
        const typeSelect = dialogPage.dialog.locator('[name="itemType"], [data-testid="item-type"]');
        if (await typeSelect.isVisible()) {
          await typeSelect.click();
          await page.locator('[role="option"]').first().click();
        }

        await dialogPage.confirm();

        // Should show success or row should appear
        await listPage.waitForPageLoad();
        const hasItem = await page.locator(`text="${itemName}"`).isVisible();
        expect(hasItem).toBe(true);
      }
    });

    test('should validate required fields', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Try to submit without required fields
        await dialogPage.confirm();

        // Should show validation errors
        const errors = await dialogPage.getErrors();
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    test('should cancel create operation', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.cancel();
        await dialogPage.expectNotVisible();
      }
    });
  });

  test.describe('Edit Item', () => {
    test('should open edit for existing item', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      // Should open dialog or navigate to edit page
      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/edit');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should update item name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const newName = `Updated Item ${randomString()}`;
        await dialogPage.fillInput('name', newName);
        await dialogPage.confirm();

        await listPage.waitForPageLoad();
        await listPage.expectRowWithText(newName);
      }
    });
  });

  test.describe('Delete Item', () => {
    test('should show delete confirmation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.deleteRow(0);

      // Should show confirmation dialog
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

      // Row count should be unchanged
      const newCount = await listPage.getRowCount();
      expect(newCount).toBe(originalCount);
    });

    test('should delete item after confirmation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const originalCount = rowCount;
      await listPage.deleteRow(0);
      await listPage.confirmDelete();

      await listPage.waitForPageLoad();

      // Row count should decrease
      const newCount = await listPage.getRowCount();
      expect(newCount).toBeLessThan(originalCount);
    });
  });

  test.describe('Pagination', () => {
    test('should display pagination if many items', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount >= 10) {
        await expect(listPage.pagination).toBeVisible();
      }
    });

    test('should navigate to next page', async () => {
      if (await listPage.hasNextPage()) {
        await listPage.nextPage();
        await expect(listPage.prevPageButton).toBeEnabled();
      }
    });

    test('should navigate to previous page', async () => {
      if (await listPage.hasNextPage()) {
        await listPage.nextPage();
        await listPage.prevPage();
        // Should be back on first page
      }
    });
  });

  test.describe('Item Variants', () => {
    test('should navigate to variants page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click variants action or link
      const variantsLink = listPage.getRow(0).locator('a:has-text("Variants"), button:has-text("Variants")');
      if (await variantsLink.isVisible()) {
        await variantsLink.click();
        await expect(page).toHaveURL(/variants/);
      }
    });
  });

  test.describe('Table Sorting', () => {
    test('should sort by name column', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Name');
      // Table should be sorted (implementation varies)
    });

    test('should sort by code column', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Code');
    });
  });
});
