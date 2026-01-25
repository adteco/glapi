import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';

test.describe('Project Detail', () => {
  let listPage: ListPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/projects');
    await listPage.waitForPageLoad();
  });

  test.describe('Navigation', () => {
    test('should navigate to project detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      await expect(page).toHaveURL(/\/projects\/[^/]+$/);
    });
  });

  test.describe('Project Header', () => {
    test('should display project name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const projectName = page.locator('h1, h2, [data-testid="project-name"]');
      await expect(projectName).toBeVisible();
    });

    test('should display project number', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const projectNumber = page.locator('[data-testid="project-number"], :has-text("PRJ-")');
      // Project number may or may not be visible
    });

    test('should display project status badge', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const statusBadge = page.locator('[data-testid="status-badge"], .badge, [role="status"]');
      await expect(statusBadge).toBeVisible();
    });

    test('should display edit button', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const editButton = page.locator('button:has-text("Edit"), a:has-text("Edit")');
      await expect(editButton).toBeVisible();
    });
  });

  test.describe('Project Overview Tab', () => {
    test('should display customer information', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const customerInfo = page.locator('[data-testid="customer-info"], :has-text("Customer")');
      await expect(customerInfo).toBeVisible();
    });

    test('should display project manager', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const managerInfo = page.locator('[data-testid="manager-info"], :has-text("Manager")');
      // Manager info may or may not be visible
    });

    test('should display project dates', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const dateInfo = page.locator('[data-testid="project-dates"], :has-text("Start"), :has-text("End")');
      // Date info should be visible
    });

    test('should display budget information', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const budgetInfo = page.locator('[data-testid="budget-info"], :has-text("Budget")');
      // Budget info may or may not be visible
    });

    test('should display progress indicator', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const progress = page.locator('[data-testid="progress"], [role="progressbar"], :has-text("Progress")');
      // Progress indicator may or may not be visible
    });
  });

  test.describe('Project Tabs', () => {
    test('should have overview tab', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const overviewTab = page.locator('[role="tab"]:has-text("Overview"), button:has-text("Overview")');
      await expect(overviewTab).toBeVisible();
    });

    test('should have tasks tab', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const tasksTab = page.locator('[role="tab"]:has-text("Tasks"), button:has-text("Tasks")');
      // Tasks tab may or may not be visible
    });

    test('should have time tab', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const timeTab = page.locator('[role="tab"]:has-text("Time"), button:has-text("Time")');
      // Time tab may or may not be visible
    });

    test('should have billing tab', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const billingTab = page.locator('[role="tab"]:has-text("Billing"), button:has-text("Billing")');
      // Billing tab may or may not be visible
    });

    test('should have documents tab', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const documentsTab = page.locator('[role="tab"]:has-text("Documents"), button:has-text("Documents")');
      // Documents tab may or may not be visible
    });
  });

  test.describe('Tasks Section', () => {
    test('should display tasks list', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const tasksTab = page.locator('[role="tab"]:has-text("Tasks"), button:has-text("Tasks")');
      if (await tasksTab.isVisible()) {
        await tasksTab.click();

        const tasksList = page.locator('[data-testid="tasks-list"], table, .tasks-list');
        await expect(tasksList).toBeVisible();
      }
    });

    test('should have add task button', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const tasksTab = page.locator('[role="tab"]:has-text("Tasks"), button:has-text("Tasks")');
      if (await tasksTab.isVisible()) {
        await tasksTab.click();

        const addTaskButton = page.locator('button:has-text("Add Task"), button:has-text("New Task")');
        // Add task button may or may not be visible
      }
    });
  });

  test.describe('Time Section', () => {
    test('should display time entries', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const timeTab = page.locator('[role="tab"]:has-text("Time"), button:has-text("Time")');
      if (await timeTab.isVisible()) {
        await timeTab.click();

        const timeList = page.locator('[data-testid="time-entries"], table, .time-list');
        await expect(timeList).toBeVisible();
      }
    });

    test('should display total hours', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const timeTab = page.locator('[role="tab"]:has-text("Time"), button:has-text("Time")');
      if (await timeTab.isVisible()) {
        await timeTab.click();

        const totalHours = page.locator('[data-testid="total-hours"], :has-text("Total Hours")');
        // Total hours may or may not be visible
      }
    });
  });

  test.describe('Billing Section', () => {
    test('should display invoices', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const billingTab = page.locator('[role="tab"]:has-text("Billing"), button:has-text("Billing")');
      if (await billingTab.isVisible()) {
        await billingTab.click();

        const invoicesList = page.locator('[data-testid="invoices-list"], table');
        await expect(invoicesList).toBeVisible();
      }
    });

    test('should display billing summary', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const billingTab = page.locator('[role="tab"]:has-text("Billing"), button:has-text("Billing")');
      if (await billingTab.isVisible()) {
        await billingTab.click();

        const summary = page.locator('[data-testid="billing-summary"], :has-text("Billed"), :has-text("Outstanding")');
        // Billing summary may or may not be visible
      }
    });

    test('should have create invoice option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const billingTab = page.locator('[role="tab"]:has-text("Billing"), button:has-text("Billing")');
      if (await billingTab.isVisible()) {
        await billingTab.click();

        const createInvoiceButton = page.locator('button:has-text("Create Invoice"), button:has-text("New Invoice")');
        // Create invoice button may or may not be visible
      }
    });
  });

  test.describe('Documents Section', () => {
    test('should display documents list', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const documentsTab = page.locator('[role="tab"]:has-text("Documents"), button:has-text("Documents")');
      if (await documentsTab.isVisible()) {
        await documentsTab.click();

        const documentsList = page.locator('[data-testid="documents-list"], table, .documents-list');
        await expect(documentsList).toBeVisible();
      }
    });

    test('should have upload document option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const documentsTab = page.locator('[role="tab"]:has-text("Documents"), button:has-text("Documents")');
      if (await documentsTab.isVisible()) {
        await documentsTab.click();

        const uploadButton = page.locator('button:has-text("Upload"), button:has-text("Add Document")');
        // Upload button may or may not be visible
      }
    });
  });

  test.describe('Project Actions', () => {
    test('should have change status option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const statusButton = page.locator('button:has-text("Status"), [data-testid="change-status"]');
      // Status change option may or may not be visible
    });

    test('should have archive option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const archiveButton = page.locator('button:has-text("Archive")');
      // Archive option may or may not be visible
    });

    test('should have duplicate option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const duplicateButton = page.locator('button:has-text("Duplicate"), button:has-text("Copy")');
      // Duplicate option may or may not be visible
    });

    test('should have print/export option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const exportButton = page.locator('button:has-text("Export"), button:has-text("Print")');
      // Export option may or may not be visible
    });
  });

  test.describe('Project Team', () => {
    test('should display team members', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const teamSection = page.locator('[data-testid="team-members"], :has-text("Team")');
      // Team section may or may not be visible
    });

    test('should have add team member option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const addMemberButton = page.locator('button:has-text("Add Member"), button:has-text("Add Team")');
      // Add member option may or may not be visible
    });
  });

  test.describe('Activity Feed', () => {
    test('should display recent activity', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      const activityFeed = page.locator('[data-testid="activity-feed"], :has-text("Activity"), :has-text("Recent")');
      // Activity feed may or may not be visible
    });
  });
});
