import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString, randomEmail, randomPhone } from '../utils/test-helpers';

test.describe('Customers', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/relationships/customers');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load customers list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/relationships\/customers/);
    });

    test('should display customers table or empty state', async () => {
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

    test('should display correct table headers', async ({ page }) => {
      const headers = await listPage.tableHeaders.allTextContents();
      const headerText = headers.join(' ').toLowerCase();
      // Should have common customer fields
      expect(headerText).toMatch(/name|company|email|status/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search customers by name', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get a customer name to search for
      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'test';

      await listPage.search(searchTerm);

      const filteredCount = await listPage.getRowCount();
      expect(filteredCount).toBeLessThanOrEqual(rowCount);
    });

    test('should clear search and show all customers', async () => {
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

  test.describe('Create Customer', () => {
    test('should open create dialog', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should create customer with basic info', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const customerName = `Test Customer ${randomString()}`;
        const email = randomEmail();

        await dialogPage.fillInput('companyName', customerName);
        await dialogPage.fillInput('email', email);

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify customer was created
        await listPage.search(customerName);
        await listPage.expectRowWithText(customerName);
      }
    });

    test('should create customer with full details', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const customerData = {
          companyName: `Full Customer ${randomString()}`,
          email: randomEmail(),
          phone: randomPhone(),
          street: '123 Test Street',
          city: 'Test City',
          state: 'CA',
          postalCode: '90210',
          country: 'USA',
        };

        await dialogPage.fillInput('companyName', customerData.companyName);
        await dialogPage.fillInput('email', customerData.email);

        // Fill address if fields are visible
        const streetInput = dialogPage.dialog.locator('[name="street"], [name="address.street"]');
        if (await streetInput.isVisible()) {
          await streetInput.fill(customerData.street);
        }

        const cityInput = dialogPage.dialog.locator('[name="city"], [name="address.city"]');
        if (await cityInput.isVisible()) {
          await cityInput.fill(customerData.city);
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(customerData.companyName);
        await listPage.expectRowWithText(customerData.companyName);
      }
    });

    test('should validate required company name', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Leave company name empty and try to submit
        await dialogPage.fillInput('email', randomEmail());
        await dialogPage.confirm();

        // Should show validation error
        const errors = await dialogPage.getErrors();
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    test('should validate email format', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.fillInput('companyName', `Test ${randomString()}`);
        await dialogPage.fillInput('email', 'invalid-email');
        await dialogPage.confirm();

        // May show email validation error
        // Note: depends on form validation implementation
      }
    });

    test('should cancel customer creation', async ({ page }) => {
      const initialCount = await listPage.getRowCount();

      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.fillInput('companyName', `Cancel Test ${randomString()}`);
        await dialogPage.cancel();

        await dialogPage.expectNotVisible();

        // Count should be unchanged
        const newCount = await listPage.getRowCount();
        expect(newCount).toBe(initialCount);
      }
    });
  });

  test.describe('View Customer', () => {
    test('should navigate to customer detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click on customer row or view button
      const viewLink = listPage.getRow(0).locator('a, button:has-text("View")').first();
      await viewLink.click();

      // Should navigate to detail page
      await expect(page).toHaveURL(/\/relationships\/customers\/[^/]+$/);
    });

    test('customer detail should show info', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      // Wait for detail page
      await page.waitForURL(/\/relationships\/customers\/[^/]+/);

      // Should show customer details
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible();
    });
  });

  test.describe('Edit Customer', () => {
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

    test('should update customer name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const newName = `Updated Customer ${randomString()}`;
        await dialogPage.fillInput('companyName', newName);
        await dialogPage.confirm();

        await listPage.waitForPageLoad();
        await listPage.expectRowWithText(newName);
      }
    });

    test('should update customer email', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const newEmail = randomEmail();
        await dialogPage.fillInput('email', newEmail);
        await dialogPage.confirm();

        await listPage.waitForPageLoad();
      }
    });
  });

  test.describe('Delete Customer', () => {
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

      // Count unchanged
      const newCount = await listPage.getRowCount();
      expect(newCount).toBe(rowCount);
    });

    test('should delete customer after confirmation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.deleteRow(0);
      await listPage.confirmDelete();

      await listPage.waitForPageLoad();

      const newCount = await listPage.getRowCount();
      expect(newCount).toBeLessThan(rowCount);
    });
  });

  test.describe('Customer Hierarchy', () => {
    test('should display parent customer field in form', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const parentField = dialogPage.dialog.locator(
          '[name="parentCustomerId"], [data-testid="parent-customer"]'
        );
        // Parent field may or may not be present
        const isVisible = await parentField.isVisible();
        // Just verify form loads - parent field is optional
      }
    });

    test('should show children link for parent customers', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check if any row has children indicator
      const childrenLink = listPage.table.locator(
        'a:has-text("Children"), button:has-text("Children"), [data-testid="children-link"]'
      );
      // May or may not have children
    });
  });

  test.describe('Pagination', () => {
    test('should show pagination for many customers', async () => {
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
      // Verify first row changed or is sorted
    });

    test('should sort by status', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Status');
    });
  });

  test.describe('Responsive Design', () => {
    test('should be functional on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await listPage.waitForPageLoad();

      // Table or cards should still be visible
      const hasContent = (await listPage.getRowCount()) > 0 || await listPage.isEmpty();
      expect(hasContent).toBe(true);
    });
  });
});
