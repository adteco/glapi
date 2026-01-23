import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { randomString } from '../utils/test-helpers';

test.describe('Payment Methods', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/lists/payment-methods');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load payment methods page', async ({ page }) => {
      await expect(page).toHaveURL(/\/lists\/payment-methods/);
    });

    test('should display payment methods table or empty state', async () => {
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
      expect(headerText).toMatch(/code|name|type|status/i);
    });
  });

  test.describe('Create Payment Method', () => {
    test('should open create dialog', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should create payment method with required fields', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `PM${randomString(4)}`;
        const name = `Test Payment Method ${randomString()}`;

        await dialogPage.fillInput('code', code);
        await dialogPage.fillInput('name', name);

        // Select method type if available
        const methodTypeSelect = dialogPage.dialog.locator('[name="methodType"], [data-testid="methodType"]');
        if (await methodTypeSelect.isVisible()) {
          await methodTypeSelect.click();
          await page.locator('[role="option"]').first().click();
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(code);
        await listPage.expectRowWithText(code);
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

    test('should cancel payment method creation', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.cancel();
        await dialogPage.expectNotVisible();
      }
    });
  });

  test.describe('Edit Payment Method', () => {
    test('should open edit dialog for existing payment method', async ({ page }) => {
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
  });

  test.describe('Delete Payment Method', () => {
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
  });

  test.describe('Navigation', () => {
    test('should navigate to payment method detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.getRow(0).click();
      await expect(page).toHaveURL(/\/lists\/payment-methods\/[a-f0-9-]+/);
    });
  });
});
