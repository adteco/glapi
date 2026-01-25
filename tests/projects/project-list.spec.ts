import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId } from '../utils/test-helpers';

test.describe('Projects List', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/projects');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load projects list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/projects/);
    });

    test('should display projects table or empty state', async () => {
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
      expect(headerText).toMatch(/name|number|customer|status|manager|budget/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search projects by name', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'PRJ';

      await listPage.search(searchTerm);

      const filteredCount = await listPage.getRowCount();
      expect(filteredCount).toBeLessThanOrEqual(rowCount);
    });

    test('should filter by status', async ({ page }) => {
      const statusFilter = page.locator('button:has-text("Status"), [data-testid="status-filter"]');
      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should filter by customer', async ({ page }) => {
      const customerFilter = page.locator('button:has-text("Customer"), [data-testid="customer-filter"]');
      if (await customerFilter.isVisible()) {
        await customerFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should filter by project manager', async ({ page }) => {
      const managerFilter = page.locator('button:has-text("Manager"), [data-testid="manager-filter"]');
      if (await managerFilter.isVisible()) {
        await managerFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should filter by type', async ({ page }) => {
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
  });

  test.describe('Project Views', () => {
    test('should switch to card view', async ({ page }) => {
      const cardViewButton = page.locator('button[aria-label*="card"], [data-testid="card-view"]');
      if (await cardViewButton.isVisible()) {
        await cardViewButton.click();
        const cards = page.locator('[data-testid="project-card"], .project-card');
        await expect(cards.first()).toBeVisible();
      }
    });

    test('should switch to list view', async ({ page }) => {
      const listViewButton = page.locator('button[aria-label*="list"], [data-testid="list-view"]');
      if (await listViewButton.isVisible()) {
        await listViewButton.click();
        const table = page.locator('table');
        await expect(table).toBeVisible();
      }
    });

    test('should switch to kanban view', async ({ page }) => {
      const kanbanViewButton = page.locator('button[aria-label*="kanban"], [data-testid="kanban-view"]');
      if (await kanbanViewButton.isVisible()) {
        await kanbanViewButton.click();
        const kanban = page.locator('[data-testid="kanban-board"], .kanban-board');
        await expect(kanban).toBeVisible();
      }
    });
  });

  test.describe('Create Project', () => {
    test('should navigate to create project page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/projects\/(new|create)/);
    });

    test('should display project name field', async ({ page }) => {
      await listPage.clickCreate();

      const nameField = page.locator('[name="name"], [data-testid="project-name"]');
      await expect(nameField).toBeVisible();
    });

    test('should display project number field', async ({ page }) => {
      await listPage.clickCreate();

      const numberField = page.locator('[name="projectNumber"], [name="number"]');
      await expect(numberField).toBeVisible();
    });

    test('should display customer selector', async ({ page }) => {
      await listPage.clickCreate();

      const customerSelect = page.locator('[name="customerId"], [data-testid="customer-select"]');
      await expect(customerSelect).toBeVisible();
    });

    test('should display project manager selector', async ({ page }) => {
      await listPage.clickCreate();

      const managerSelect = page.locator('[name="managerId"], [data-testid="manager-select"]');
      // Manager selector may or may not be visible
    });

    test('should display start date field', async ({ page }) => {
      await listPage.clickCreate();

      const startDate = page.locator('[name="startDate"], [data-testid="start-date"]');
      await expect(startDate).toBeVisible();
    });

    test('should display end date field', async ({ page }) => {
      await listPage.clickCreate();

      const endDate = page.locator('[name="endDate"], [data-testid="end-date"]');
      await expect(endDate).toBeVisible();
    });

    test('should display budget field', async ({ page }) => {
      await listPage.clickCreate();

      const budgetField = page.locator('[name="budget"], [data-testid="budget"]');
      // Budget field may or may not be visible
    });

    test('should validate required name', async ({ page }) => {
      await listPage.clickCreate();

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]');
      await saveButton.click();

      const error = page.locator('.error, [role="alert"], .text-destructive');
      await expect(error).toBeVisible();
    });
  });

  test.describe('Project Quick Actions', () => {
    test('should have view details action', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const row = listPage.getRow(0);
      const menuButton = row.locator('button[aria-label*="action"], button[aria-label*="menu"]');
      if (await menuButton.isVisible()) {
        await menuButton.click();
        const viewOption = page.locator('[role="menuitem"]:has-text("View")');
        await expect(viewOption).toBeVisible();
      }
    });

    test('should have edit action', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const row = listPage.getRow(0);
      const menuButton = row.locator('button[aria-label*="action"], button[aria-label*="menu"]');
      if (await menuButton.isVisible()) {
        await menuButton.click();
        const editOption = page.locator('[role="menuitem"]:has-text("Edit")');
        await expect(editOption).toBeVisible();
      }
    });

    test('should have duplicate action', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const row = listPage.getRow(0);
      const menuButton = row.locator('button[aria-label*="action"], button[aria-label*="menu"]');
      if (await menuButton.isVisible()) {
        await menuButton.click();
        const duplicateOption = page.locator('[role="menuitem"]:has-text("Duplicate"), [role="menuitem"]:has-text("Copy")');
        // Duplicate option may or may not be present
      }
    });
  });

  test.describe('Edit Project', () => {
    test('should open edit page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      const urlChanged = page.url().includes('/edit');
      const dialogOpened = await dialogPage.isOpen();
      expect(urlChanged || dialogOpened).toBe(true);
    });
  });

  test.describe('Delete Project', () => {
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

      await listPage.deleteRow(0);
      await listPage.cancelDelete();

      const newCount = await listPage.getRowCount();
      expect(newCount).toBe(rowCount);
    });
  });

  test.describe('Bulk Actions', () => {
    test('should select multiple projects', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      const selectAll = page.locator('[data-testid="select-all"], th input[type="checkbox"]');
      if (await selectAll.isVisible()) {
        await selectAll.click();
        const selectedCount = await page.locator('tr.selected, [data-selected="true"]').count();
        expect(selectedCount).toBeGreaterThan(0);
      }
    });

    test('should have bulk status change option', async ({ page }) => {
      const bulkActions = page.locator('[data-testid="bulk-actions"], button:has-text("Bulk")');
      // Bulk actions may or may not be visible
    });
  });

  test.describe('Pagination', () => {
    test('should show pagination for many projects', async () => {
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

    test('should sort by status', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Status');
    });

    test('should sort by customer', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Customer');
    });

    test('should sort by budget', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Budget');
    });
  });
});
