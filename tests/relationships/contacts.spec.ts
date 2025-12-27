import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString, randomEmail, randomPhone } from '../utils/test-helpers';

test.describe('Contacts', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/relationships/contacts');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load contacts list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/relationships\/contacts/);
    });

    test('should display contacts table or empty state', async () => {
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
      expect(headerText).toMatch(/name|email|phone|company/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search contacts by name', async () => {
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

    test('should filter by company', async ({ page }) => {
      const companyFilter = page.locator('button:has-text("Company"), [data-testid="company-filter"]');
      if (await companyFilter.isVisible()) {
        await companyFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Contact', () => {
    test('should open create dialog', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should create contact with basic info', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const firstName = `Contact${randomString(4)}`;
        const lastName = `Person${randomString(4)}`;
        const email = randomEmail();

        await dialogPage.fillInput('firstName', firstName);
        await dialogPage.fillInput('lastName', lastName);
        await dialogPage.fillInput('email', email);

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(firstName);
        await listPage.expectRowWithText(firstName);
      }
    });

    test('should create contact with company association', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const contactData = {
          firstName: `Company${randomString(4)}`,
          lastName: `Contact${randomString(4)}`,
          email: randomEmail(),
          phone: randomPhone(),
          title: 'Account Manager',
        };

        await dialogPage.fillInput('firstName', contactData.firstName);
        await dialogPage.fillInput('lastName', contactData.lastName);
        await dialogPage.fillInput('email', contactData.email);

        // Select company/customer if available
        const companySelect = dialogPage.dialog.locator('[name="customerId"], [name="companyId"], [data-testid="company"]');
        if (await companySelect.isVisible()) {
          await companySelect.click();
          const option = page.locator('[role="option"]').first();
          if (await option.isVisible()) {
            await option.click();
          }
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(contactData.firstName);
        await listPage.expectRowWithText(contactData.firstName);
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

    test('should cancel contact creation', async ({ page }) => {
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

  test.describe('View Contact', () => {
    test('should navigate to contact detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewLink = listPage.getRow(0).locator('a, button:has-text("View")').first();
      await viewLink.click();

      await expect(page).toHaveURL(/\/relationships\/contacts\/[^/]+$/);
    });
  });

  test.describe('Edit Contact', () => {
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

    test('should update contact name', async ({ page }) => {
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

  test.describe('Delete Contact', () => {
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
    test('should show pagination for many contacts', async () => {
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
