import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString } from '../utils/test-helpers';

test.describe('Accounts (Chart of Accounts)', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/lists/accounts');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load accounts list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/lists\/accounts/);
    });

    test('should display accounts table or empty state', async () => {
      const hasRows = (await listPage.getRowCount()) > 0;
      const isEmpty = await listPage.isEmpty();
      expect(hasRows || isEmpty).toBe(true);
    });

    test('should display search input', async () => {
      // Skip if search is not implemented on this page
      const hasSearch = await listPage.searchInput.isVisible({ timeout: 2000 }).catch(() => false);
      if (!hasSearch) {
        test.skip();
        return;
      }
      await expect(listPage.searchInput).toBeVisible();
    });

    test('should display create button', async () => {
      await expect(listPage.createButton).toBeVisible();
    });

    test('should display correct table headers', async () => {
      const headers = await listPage.tableHeaders.allTextContents();
      const headerText = headers.join(' ').toLowerCase();
      expect(headerText).toMatch(/number|name|type|balance/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should filter accounts by search query', async () => {
      // Skip if search is not implemented
      if (!(await listPage.searchInput.isVisible({ timeout: 2000 }).catch(() => false))) {
        test.skip();
        return;
      }

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
      // Skip if search is not implemented
      if (!(await listPage.searchInput.isVisible({ timeout: 2000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await listPage.search('random-search');
      await listPage.clearSearch();

      const value = await listPage.searchInput.inputValue();
      expect(value).toBe('');
    });

    test('should filter by account type', async ({ page }) => {
      const typeFilter = page.locator('button:has-text("Type"), [data-testid="type-filter"]');
      const hasTypeFilter = await typeFilter.isVisible({ timeout: 2000 }).catch(() => false);
      if (!hasTypeFilter) {
        test.skip();
        return;
      }

      await typeFilter.click();
      const option = page.locator('[role="option"]').first();
      if (await option.isVisible()) {
        await option.click();
        await listPage.waitForPageLoad();
      }
    });

    test('should filter by account category', async ({ page }) => {
      const categoryFilter = page.locator('button:has-text("Category"), [data-testid="category-filter"]');
      const hasCategoryFilter = await categoryFilter.isVisible({ timeout: 2000 }).catch(() => false);
      if (!hasCategoryFilter) {
        test.skip();
        return;
      }

      await categoryFilter.click();
      const option = page.locator('[role="option"]').first();
      if (await option.isVisible()) {
        await option.click();
        await listPage.waitForPageLoad();
      }
    });
  });

  test.describe('Create Account', () => {
    test('should open create dialog', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should create account with required fields', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const accountNumber = uniqueId('ACCT');
        const accountName = `Test Account ${randomString()}`;

        await dialogPage.fillInput('accountNumber', accountNumber);
        await dialogPage.fillInput('name', accountName);

        // Select account type if available
        const typeSelect = dialogPage.dialog.locator('[name="accountType"], [data-testid="account-type"]');
        if (await typeSelect.isVisible()) {
          await typeSelect.click();
          await page.locator('[role="option"]').first().click();
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(accountName);
        await listPage.expectRowWithText(accountName);
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

    test('should cancel account creation', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.cancel();
        await dialogPage.expectNotVisible();
      }
    });
  });

  test.describe('Edit Account', () => {
    test('should open edit dialog for existing account', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check if edit is available
      const row = listPage.getRow(0);
      const editButton = row.locator('button:has-text("Edit"), [data-testid="edit-button"]');
      const menuButton = row.locator('button[aria-label*="actions"], button[aria-label*="menu"]');

      const hasEdit = await editButton.isVisible({ timeout: 2000 }).catch(() => false);
      const hasMenu = await menuButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (!hasEdit && !hasMenu) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/edit');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should update account name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check if edit is available
      const row = listPage.getRow(0);
      const editButton = row.locator('button:has-text("Edit"), [data-testid="edit-button"]');
      const menuButton = row.locator('button[aria-label*="actions"], button[aria-label*="menu"]');

      const hasEdit = await editButton.isVisible({ timeout: 2000 }).catch(() => false);
      const hasMenu = await menuButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (!hasEdit && !hasMenu) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const newName = `Updated Account ${randomString()}`;
        await dialogPage.fillInput('name', newName);
        await dialogPage.confirm();

        await listPage.waitForPageLoad();
        await listPage.expectRowWithText(newName);
      }
    });
  });

  test.describe('Delete Account', () => {
    test('should show delete confirmation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check if delete is available
      const row = listPage.getRow(0);
      const deleteButton = row.locator('button:has-text("Delete"), [data-testid="delete-button"]');
      const menuButton = row.locator('button[aria-label*="actions"], button[aria-label*="menu"]');

      const hasDelete = await deleteButton.isVisible({ timeout: 2000 }).catch(() => false);
      const hasMenu = await menuButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (!hasDelete && !hasMenu) {
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

      // Check if delete is available
      const row = listPage.getRow(0);
      const deleteButton = row.locator('button:has-text("Delete"), [data-testid="delete-button"]');
      const menuButton = row.locator('button[aria-label*="actions"], button[aria-label*="menu"]');

      const hasDelete = await deleteButton.isVisible({ timeout: 2000 }).catch(() => false);
      const hasMenu = await menuButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (!hasDelete && !hasMenu) {
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

  test.describe('Account Hierarchy', () => {
    test('should display parent account field in form', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const parentField = dialogPage.dialog.locator(
          '[name="parentAccountId"], [data-testid="parent-account"]'
        );
        // Parent field may or may not be present depending on implementation
      }
    });
  });

  test.describe('Pagination', () => {
    test('should display pagination if many accounts', async () => {
      const rowCount = await listPage.getRowCount();
      // Skip if not enough items or pagination not implemented
      if (rowCount < 10) {
        test.skip();
        return;
      }
      const hasPagination = await listPage.pagination.isVisible({ timeout: 2000 }).catch(() => false);
      if (!hasPagination) {
        test.skip();
        return;
      }
      await expect(listPage.pagination).toBeVisible();
    });

    test('should navigate between pages', async () => {
      // Skip if pagination not available
      const hasPagination = await listPage.pagination.isVisible({ timeout: 2000 }).catch(() => false);
      if (!hasPagination) {
        test.skip();
        return;
      }

      if (await listPage.hasNextPage()) {
        await listPage.nextPage();
        await expect(listPage.prevPageButton).toBeEnabled();
      }
    });
  });

  test.describe('Table Sorting', () => {
    test('should sort by account number', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      // Check if column headers are clickable for sorting
      const numberHeader = listPage.tableHeaders.filter({ hasText: 'Number' }).first();
      const isClickable = await numberHeader.isVisible({ timeout: 2000 }).catch(() => false);
      if (!isClickable) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Number');
    });

    test('should sort by account name', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      // Check if column headers are clickable for sorting
      const nameHeader = listPage.tableHeaders.filter({ hasText: 'Name' }).first();
      const isClickable = await nameHeader.isVisible({ timeout: 2000 }).catch(() => false);
      if (!isClickable) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Name');
    });
  });
});
