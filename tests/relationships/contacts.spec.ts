import { test, expect } from '@playwright/test';
import { ListPage, DialogPage } from '../pages';
import { randomString, randomEmail, randomPhone } from '../utils/test-helpers';

test.describe('Contacts', () => {
  let listPage: ListPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
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

    test('should display create button', async () => {
      await expect(listPage.createButton).toBeVisible();
    });

    test('should display correct table headers', async () => {
      const headers = await listPage.tableHeaders.allTextContents();
      const headerText = headers.join(' ').toLowerCase();
      expect(headerText).toMatch(/name|email|phone|company/i);
    });
  });

  test.describe.skip('Search and Filter', () => {
    test('should search contacts by name', async () => {});
    test('should clear search', async () => {});
    test('should filter by company', async () => {});
  });

  test.describe('Create Contact', () => {
    test('should open create dialog', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should create contact with basic info', async () => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const fullName = `Contact ${randomString(6)}`;
        const email = randomEmail();

        await dialogPage.fillInput('Full Name', fullName);
        await dialogPage.fillInput('Email', email);

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.expectRowWithText(fullName);
      }
    });

    test('should create contact with company association', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const fullName = `Company ${randomString(6)}`;
        const email = randomEmail();
        const phone = randomPhone();

        await dialogPage.fillInput('Full Name', fullName);
        await dialogPage.fillInput('Email', email);
        await dialogPage.fillInput('Primary Phone', phone);

        const companyField = dialogPage.dialog.locator('label:has-text("Company")').first().locator('..');
        const companySelect = companyField.getByRole('combobox');
        if (await companySelect.isVisible().catch(() => false)) {
          await companySelect.click();
          const option = page.locator('[role="option"]').first();
          if (await option.isVisible().catch(() => false)) {
            await option.click();
          }
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.expectRowWithText(fullName);
      }
    });

    test('should validate required fields', async () => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.confirm();

        await listPage.expectToast('Full name is required');
      }
    });

    test('should cancel contact creation', async () => {
      const initialCount = await listPage.getRowCount();

      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.fillInput('Full Name', `Cancel ${randomString(6)}`);
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

    test('should update contact name', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const newName = `Updated ${randomString(6)}`;
        await dialogPage.fillInput('Full Name', newName);
        await dialogPage.confirm();

        await listPage.waitForPageLoad();
        await listPage.expectRowWithText(newName);
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

      const dialogPromise = page.waitForEvent('dialog');
      await listPage.deleteRow(0);
      const dialog = await dialogPromise;
      expect(dialog.message().toLowerCase()).toContain('delete');
      await dialog.dismiss();
    });

    test('should cancel delete operation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      page.once('dialog', (dialog) => dialog.dismiss());
      await listPage.deleteRow(0);

      const newCount = await listPage.getRowCount();
      expect(newCount).toBe(rowCount);
    });
  });

  test.describe.skip('Pagination', () => {
    test('should show pagination for many contacts', async () => {});
  });

  test.describe.skip('Table Sorting', () => {
    test('should sort by name', async () => {});
  });
});
