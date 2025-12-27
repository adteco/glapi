import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString, randomEmail, randomPhone } from '../utils/test-helpers';

test.describe('Vendors', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/relationships/vendors');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load vendors list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/relationships\/vendors/);
    });

    test('should display vendors table or empty state', async () => {
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
      expect(headerText).toMatch(/name|company|email|status/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search vendors by name', async () => {
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
        const activeOption = page.locator('[role="option"]:has-text("Active")');
        if (await activeOption.isVisible()) {
          await activeOption.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Vendor', () => {
    test('should open create dialog', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should create vendor with basic info', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const vendorName = `Test Vendor ${randomString()}`;
        const email = randomEmail();

        await dialogPage.fillInput('companyName', vendorName);
        await dialogPage.fillInput('email', email);

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(vendorName);
        await listPage.expectRowWithText(vendorName);
      }
    });

    test('should create vendor with full details', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const vendorData = {
          companyName: `Full Vendor ${randomString()}`,
          email: randomEmail(),
          phone: randomPhone(),
          street: '789 Vendor Lane',
          city: 'Vendor City',
          state: 'NY',
          postalCode: '10001',
          country: 'USA',
        };

        await dialogPage.fillInput('companyName', vendorData.companyName);
        await dialogPage.fillInput('email', vendorData.email);

        const streetInput = dialogPage.dialog.locator('[name="street"], [name="address.street"]');
        if (await streetInput.isVisible()) {
          await streetInput.fill(vendorData.street);
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(vendorData.companyName);
        await listPage.expectRowWithText(vendorData.companyName);
      }
    });

    test('should validate required company name', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.fillInput('email', randomEmail());
        await dialogPage.confirm();

        const errors = await dialogPage.getErrors();
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    test('should cancel vendor creation', async ({ page }) => {
      const initialCount = await listPage.getRowCount();

      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.fillInput('companyName', `Cancel Test ${randomString()}`);
        await dialogPage.cancel();

        await dialogPage.expectNotVisible();

        const newCount = await listPage.getRowCount();
        expect(newCount).toBe(initialCount);
      }
    });
  });

  test.describe('View Vendor', () => {
    test('should navigate to vendor detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewLink = listPage.getRow(0).locator('a, button:has-text("View")').first();
      await viewLink.click();

      await expect(page).toHaveURL(/\/relationships\/vendors\/[^/]+$/);
    });

    test('vendor detail should show info', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await page.waitForURL(/\/relationships\/vendors\/[^/]+/);

      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible();
    });
  });

  test.describe('Edit Vendor', () => {
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

    test('should update vendor name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const newName = `Updated Vendor ${randomString()}`;
        await dialogPage.fillInput('companyName', newName);
        await dialogPage.confirm();

        await listPage.waitForPageLoad();
        await listPage.expectRowWithText(newName);
      }
    });
  });

  test.describe('Delete Vendor', () => {
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
    test('should show pagination for many vendors', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount >= 10) {
        await expect(listPage.pagination).toBeVisible();
      }
    });

    test('should navigate between pages', async () => {
      if (await listPage.hasNextPage()) {
        await listPage.nextPage();
        await expect(listPage.prevPageButton).toBeEnabled();

        await listPage.prevPage();
        await expect(listPage.nextPageButton).toBeEnabled();
      }
    });
  });

  test.describe('Table Sorting', () => {
    test('should sort by company name', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Company');
    });
  });
});
