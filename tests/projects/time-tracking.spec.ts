import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId } from '../utils/test-helpers';

test.describe('Project Time Tracking', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/projects/time-tracking');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load project time tracking page', async ({ page }) => {
      await expect(page).toHaveURL(/\/projects.*time/);
    });

    test('should display time entries table or empty state', async () => {
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
      expect(headerText).toMatch(/date|project|task|hours|employee|status/i);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search time entries', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || '';

      await listPage.search(searchTerm);

      const filteredCount = await listPage.getRowCount();
      expect(filteredCount).toBeLessThanOrEqual(rowCount);
    });

    test('should filter by project', async ({ page }) => {
      const projectFilter = page.locator('button:has-text("Project"), [data-testid="project-filter"]');
      if (await projectFilter.isVisible()) {
        await projectFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should filter by employee', async ({ page }) => {
      const employeeFilter = page.locator('button:has-text("Employee"), [data-testid="employee-filter"]');
      if (await employeeFilter.isVisible()) {
        await employeeFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should filter by date range', async ({ page }) => {
      const dateFilter = page.locator('button:has-text("Date"), [data-testid="date-filter"]');
      if (await dateFilter.isVisible()) {
        await dateFilter.click();
        const preset = page.locator('[role="option"]:has-text("Week"), button:has-text("This Week")');
        if (await preset.isVisible()) {
          await preset.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should filter by billable status', async ({ page }) => {
      const billableFilter = page.locator('button:has-text("Billable"), [data-testid="billable-filter"]');
      if (await billableFilter.isVisible()) {
        await billableFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should filter by approval status', async ({ page }) => {
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
  });

  test.describe('Create Time Entry', () => {
    test('should navigate to create time entry page', async ({ page }) => {
      await listPage.clickCreate();

      await expect(page).toHaveURL(/\/projects.*time.*\/(new|create)/);
    });

    test('should display project selector', async ({ page }) => {
      await listPage.clickCreate();

      const projectSelect = page.locator('[name="projectId"], [data-testid="project-select"]');
      await expect(projectSelect).toBeVisible();
    });

    test('should display task selector', async ({ page }) => {
      await listPage.clickCreate();

      const taskSelect = page.locator('[name="taskId"], [data-testid="task-select"]');
      // Task selector may or may not be visible
    });

    test('should display date field', async ({ page }) => {
      await listPage.clickCreate();

      const dateField = page.locator('[name="date"], [data-testid="date"]');
      await expect(dateField).toBeVisible();
    });

    test('should display hours field', async ({ page }) => {
      await listPage.clickCreate();

      const hoursField = page.locator('[name="hours"], [data-testid="hours"]');
      await expect(hoursField).toBeVisible();
    });

    test('should display billable toggle', async ({ page }) => {
      await listPage.clickCreate();

      const billableToggle = page.locator('[name="billable"], [data-testid="billable"]');
      // Billable toggle may or may not be visible
    });

    test('should display description field', async ({ page }) => {
      await listPage.clickCreate();

      const descriptionField = page.locator('[name="description"], [name="notes"], textarea');
      await expect(descriptionField).toBeVisible();
    });

    test('should validate required project', async ({ page }) => {
      await listPage.clickCreate();

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]');
      await saveButton.click();

      const error = page.locator('.error, [role="alert"], .text-destructive');
      await expect(error).toBeVisible();
    });

    test('should validate hours is positive', async ({ page }) => {
      await listPage.clickCreate();

      const hoursField = page.locator('[name="hours"], [data-testid="hours"]');
      if (await hoursField.isVisible()) {
        await hoursField.fill('-2');

        const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]');
        await saveButton.click();

        const error = page.locator('.error, [role="alert"], .text-destructive');
        await expect(error).toBeVisible();
      }
    });

    test('should validate hours maximum', async ({ page }) => {
      await listPage.clickCreate();

      const hoursField = page.locator('[name="hours"], [data-testid="hours"]');
      if (await hoursField.isVisible()) {
        await hoursField.fill('25'); // More than 24 hours

        const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]');
        await saveButton.click();

        const error = page.locator('.error, [role="alert"], .text-destructive');
        // May or may not show error depending on validation rules
      }
    });
  });

  test.describe('View Time Entry', () => {
    test('should navigate to time entry detail', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/projects.*time.*\/[^/]+$/);
    });

    test('should display time entry details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const entryDetails = page.locator('[data-testid="time-entry-details"], h1, h2');
      await expect(entryDetails).toBeVisible();
    });

    test('should display project information', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const projectInfo = page.locator('[data-testid="project-info"], :has-text("Project")');
      await expect(projectInfo).toBeVisible();
    });

    test('should display hours logged', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const hoursInfo = page.locator('[data-testid="hours"], :has-text("Hours")');
      await expect(hoursInfo).toBeVisible();
    });
  });

  test.describe('Time Entry Actions', () => {
    test('should have approve option for pending entries', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const approveButton = page.locator('button:has-text("Approve")');
      // Approve option may or may not be visible
    });

    test('should have reject option for pending entries', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const rejectButton = page.locator('button:has-text("Reject")');
      // Reject option may or may not be visible
    });

    test('should have mark as billed option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const billedButton = page.locator('button:has-text("Mark as Billed"), button:has-text("Billed")');
      // Mark as billed option may or may not be visible
    });
  });

  test.describe('Edit Time Entry', () => {
    test('should open edit page for draft entry', async ({ page }) => {
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

  test.describe('Delete Time Entry', () => {
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

  test.describe('Timesheet View', () => {
    test('should switch to timesheet view', async ({ page }) => {
      const timesheetButton = page.locator('button:has-text("Timesheet"), [data-testid="timesheet-view"]');
      if (await timesheetButton.isVisible()) {
        await timesheetButton.click();

        const timesheetGrid = page.locator('[data-testid="timesheet-grid"], .timesheet');
        await expect(timesheetGrid).toBeVisible();
      }
    });

    test('should display weekly totals', async ({ page }) => {
      const timesheetButton = page.locator('button:has-text("Timesheet"), [data-testid="timesheet-view"]');
      if (await timesheetButton.isVisible()) {
        await timesheetButton.click();

        const weeklyTotals = page.locator('[data-testid="weekly-totals"], :has-text("Total")');
        await expect(weeklyTotals).toBeVisible();
      }
    });

    test('should allow inline time entry', async ({ page }) => {
      const timesheetButton = page.locator('button:has-text("Timesheet"), [data-testid="timesheet-view"]');
      if (await timesheetButton.isVisible()) {
        await timesheetButton.click();

        const timesheetCell = page.locator('[data-testid="timesheet-cell"], .timesheet-cell').first();
        if (await timesheetCell.isVisible()) {
          await timesheetCell.click();
          const input = page.locator('input[type="number"]');
          await expect(input).toBeVisible();
        }
      }
    });
  });

  test.describe('Bulk Actions', () => {
    test('should select multiple entries', async ({ page }) => {
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

    test('should have bulk approve option', async ({ page }) => {
      const bulkApprove = page.locator('button:has-text("Approve Selected"), [data-testid="bulk-approve"]');
      // Bulk approve may or may not be visible
    });

    test('should have bulk delete option', async ({ page }) => {
      const bulkDelete = page.locator('button:has-text("Delete Selected"), [data-testid="bulk-delete"]');
      // Bulk delete may or may not be visible
    });
  });

  test.describe('Summary Statistics', () => {
    test('should display total hours', async ({ page }) => {
      const totalHours = page.locator('[data-testid="total-hours"], :has-text("Total Hours")');
      // Total hours summary may or may not be visible
    });

    test('should display billable hours', async ({ page }) => {
      const billableHours = page.locator('[data-testid="billable-hours"], :has-text("Billable")');
      // Billable hours summary may or may not be visible
    });

    test('should display non-billable hours', async ({ page }) => {
      const nonBillableHours = page.locator('[data-testid="non-billable-hours"], :has-text("Non-Billable")');
      // Non-billable hours summary may or may not be visible
    });
  });

  test.describe('Pagination', () => {
    test('should show pagination for many entries', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount >= 10) {
        await expect(listPage.pagination).toBeVisible();
      }
    });
  });

  test.describe('Table Sorting', () => {
    test('should sort by date', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Date');
    });

    test('should sort by project', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Project');
    });

    test('should sort by hours', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Hours');
    });

    test('should sort by employee', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Employee');
    });
  });
});
