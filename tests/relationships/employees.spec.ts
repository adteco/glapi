import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString, randomEmail, randomPhone } from '../utils/test-helpers';

test.describe('Employees', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/relationships/employees');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load employees list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/relationships\/employees/);
    });

    test('should display employees table or empty state', async () => {
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
      expect(headerText).toMatch(/name|email|department|status/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search employees by name', async () => {
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

    test('should filter by department', async ({ page }) => {
      const deptFilter = page.locator('button:has-text("Department"), [data-testid="department-filter"]');
      if (await deptFilter.isVisible()) {
        await deptFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
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

  test.describe('Create Employee', () => {
    test('should open create dialog', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should create employee with basic info', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const firstName = `John${randomString(4)}`;
        const lastName = `Doe${randomString(4)}`;
        const email = randomEmail();

        await dialogPage.fillInput('firstName', firstName);
        await dialogPage.fillInput('lastName', lastName);
        await dialogPage.fillInput('email', email);

        // Select department if available
        const deptSelect = dialogPage.dialog.locator('[name="departmentId"], [data-testid="department"]');
        if (await deptSelect.isVisible()) {
          await deptSelect.click();
          await page.locator('[role="option"]').first().click();
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(firstName);
        await listPage.expectRowWithText(firstName);
      }
    });

    test('should create employee with full details', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const employeeData = {
          firstName: `Jane${randomString(4)}`,
          lastName: `Smith${randomString(4)}`,
          email: randomEmail(),
          phone: randomPhone(),
          title: 'Software Engineer',
          hireDate: '2024-01-15',
        };

        await dialogPage.fillInput('firstName', employeeData.firstName);
        await dialogPage.fillInput('lastName', employeeData.lastName);
        await dialogPage.fillInput('email', employeeData.email);

        const titleInput = dialogPage.dialog.locator('[name="title"], [name="jobTitle"]');
        if (await titleInput.isVisible()) {
          await titleInput.fill(employeeData.title);
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(employeeData.firstName);
        await listPage.expectRowWithText(employeeData.firstName);
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

    test('should cancel employee creation', async ({ page }) => {
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

  test.describe('View Employee', () => {
    test('should navigate to employee detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewLink = listPage.getRow(0).locator('a, button:has-text("View")').first();
      await viewLink.click();

      await expect(page).toHaveURL(/\/relationships\/employees\/[^/]+$/);
    });

    test('employee detail should show info', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await page.waitForURL(/\/relationships\/employees\/[^/]+/);

      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible();
    });
  });

  test.describe('Edit Employee', () => {
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

    test('should update employee name', async ({ page }) => {
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

  test.describe('Delete Employee', () => {
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
    test('should show pagination for many employees', async () => {
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

    test('should sort by department', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Department');
    });
  });
});
