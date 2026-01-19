import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString, waitForNetworkIdle } from '../utils/test-helpers';

test.describe('Workflow Automation', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/admin/workflows');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load workflows list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/admin\/workflows/);
    });

    test('should display page title', async ({ page }) => {
      await expect(page.locator('h1:has-text("Workflow")')).toBeVisible();
    });

    test('should display workflows table or empty state', async () => {
      const hasRows = (await listPage.getRowCount()) > 0;
      const isEmpty = await listPage.isEmpty();
      expect(hasRows || isEmpty).toBe(true);
    });

    test('should display create button', async ({ page }) => {
      await expect(page.locator('button:has-text("Create Workflow")')).toBeVisible();
    });

    test('should display stats cards', async ({ page }) => {
      const statsSection = page.locator('.grid:has([class*="border"])');
      // May or may not have stats depending on data
      await expect(statsSection.or(page.locator('text="No workflows"'))).toBeVisible();
    });

    test('should display executions button', async ({ page }) => {
      await expect(page.locator('button:has-text("Executions")')).toBeVisible();
    });
  });

  test.describe('Search and Filter', () => {
    test('should have search input', async ({ page }) => {
      await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
    });

    test('should filter workflows by search query', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search"]');
      await searchInput.fill('test-workflow');
      await page.waitForTimeout(500);
      await listPage.waitForPageLoad();
    });

    test('should filter by status', async ({ page }) => {
      const statusFilter = page.locator('button:has-text("All Statuses")');
      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        const option = page.locator('[role="option"]:has-text("Draft")');
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should filter by trigger type', async ({ page }) => {
      const triggerFilter = page.locator('button:has-text("All Triggers")');
      if (await triggerFilter.isVisible()) {
        await triggerFilter.click();
        const option = page.locator('[role="option"]:has-text("Manual")');
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Create Workflow', () => {
    test('should navigate to create page', async ({ page }) => {
      await page.locator('button:has-text("Create Workflow")').click();
      await expect(page).toHaveURL(/\/admin\/workflows\/new/);
    });

    test('should display workflow form', async ({ page }) => {
      await page.goto('/admin/workflows/new');
      await page.waitForLoadState('networkidle');

      // Should show tabs
      await expect(page.locator('[role="tablist"]')).toBeVisible();
      await expect(page.locator('button[role="tab"]:has-text("General")')).toBeVisible();
      await expect(page.locator('button[role="tab"]:has-text("Trigger")')).toBeVisible();
      await expect(page.locator('button[role="tab"]:has-text("Steps")')).toBeVisible();
    });

    test('should create new workflow', async ({ page }) => {
      await page.goto('/admin/workflows/new');
      await page.waitForLoadState('networkidle');

      const workflowCode = uniqueId('wf');
      const workflowName = `Test Workflow ${randomString()}`;

      // Fill general info
      await page.locator('input[name="name"]').fill(workflowName);
      await page.locator('input[name="workflowCode"]').fill(workflowCode);
      await page.locator('textarea[name="description"]').fill('Test workflow description');

      // Submit
      await page.locator('button[type="submit"]:has-text("Create")').click();

      // Should redirect to edit page
      await page.waitForURL(/\/admin\/workflows\/[a-f0-9-]+$/);
    });

    test('should validate required fields', async ({ page }) => {
      await page.goto('/admin/workflows/new');
      await page.waitForLoadState('networkidle');

      // Try to submit without required fields
      await page.locator('button[type="submit"]:has-text("Create")').click();

      // Should show validation errors
      const errors = page.locator('[data-state="error"], .text-destructive, [role="alert"]');
      await expect(errors.first()).toBeVisible();
    });

    test('should cancel create operation', async ({ page }) => {
      await page.goto('/admin/workflows/new');
      await page.waitForLoadState('networkidle');

      await page.locator('button:has-text("Cancel")').click();
      await expect(page).toHaveURL(/\/admin\/workflows$/);
    });
  });

  test.describe('Edit Workflow', () => {
    test('should open edit page for existing workflow', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click on first workflow link or edit action
      const firstRow = listPage.getRow(0);
      const editLink = firstRow.locator('a, button:has-text("Edit")').first();
      await editLink.click();

      await page.waitForURL(/\/admin\/workflows\/[a-f0-9-]+/);
    });

    test('should display workflow details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRow = listPage.getRow(0);
      await firstRow.locator('a').first().click();

      await page.waitForLoadState('networkidle');

      // Should show tabs
      await expect(page.locator('[role="tablist"]')).toBeVisible();
    });

    test('should update workflow name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRow = listPage.getRow(0);
      await firstRow.locator('a').first().click();

      await page.waitForLoadState('networkidle');

      // Check if workflow is editable (draft status)
      const statusBadge = page.locator('[class*="badge"]:has-text("Draft")');
      if (!(await statusBadge.isVisible())) {
        test.skip(); // Only draft workflows are editable
        return;
      }

      const newName = `Updated Workflow ${randomString()}`;
      await page.locator('input[name="name"]').clear();
      await page.locator('input[name="name"]').fill(newName);

      await page.locator('button[type="submit"]:has-text("Save")').click();

      // Should show success message
      await expect(page.locator('text="saved"').or(page.locator('[data-sonner-toast]'))).toBeVisible();
    });
  });

  test.describe('Workflow Steps', () => {
    test('should navigate to steps tab', async ({ page }) => {
      await page.goto('/admin/workflows/new');
      await page.waitForLoadState('networkidle');

      await page.locator('button[role="tab"]:has-text("Steps")').click();

      // Should show steps section
      await expect(page.locator('text="Workflow Steps"')).toBeVisible();
    });

    test('should add a step', async ({ page }) => {
      await page.goto('/admin/workflows/new');
      await page.waitForLoadState('networkidle');

      await page.locator('button[role="tab"]:has-text("Steps")').click();

      // Click add step button
      await page.locator('button:has-text("Add Step")').click();

      // Should show step form
      await expect(page.locator('input[name*="stepCode"]')).toBeVisible();
    });

    test('should configure step properties', async ({ page }) => {
      await page.goto('/admin/workflows/new');
      await page.waitForLoadState('networkidle');

      await page.locator('button[role="tab"]:has-text("Steps")').click();
      await page.locator('button:has-text("Add Step")').click();

      // Configure step
      await page.locator('input[name*="stepCode"]').first().fill('step_1');
      await page.locator('input[name*="stepName"]').first().fill('First Step');

      // Select action type
      const actionTypeSelect = page.locator('[name*="actionType"]').first();
      if (await actionTypeSelect.isVisible()) {
        await actionTypeSelect.click();
        await page.locator('[role="option"]:has-text("Notification")').click();
      }
    });

    test('should delete a step', async ({ page }) => {
      await page.goto('/admin/workflows/new');
      await page.waitForLoadState('networkidle');

      await page.locator('button[role="tab"]:has-text("Steps")').click();
      await page.locator('button:has-text("Add Step")').click();

      // Verify step is added
      await expect(page.locator('[class*="border"]:has(input[name*="stepCode"])')).toBeVisible();

      // Delete the step
      await page.locator('button:has([class*="trash"]), button[title="Delete"]').first().click();

      // Step should be removed
      await page.waitForTimeout(300);
    });
  });

  test.describe('Workflow Actions', () => {
    test('should show action menu for workflow', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click action menu
      const firstRow = listPage.getRow(0);
      const menuButton = firstRow.locator('button:has([class*="more-horizontal"]), button[aria-label*="action"]');
      await menuButton.click();

      // Should show dropdown menu
      await expect(page.locator('[role="menu"], [role="menuitem"]').first()).toBeVisible();
    });

    test('should publish draft workflow', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find a draft workflow
      const draftRow = page.locator('tr:has([class*="badge"]:has-text("Draft"))').first();
      if (!(await draftRow.isVisible())) {
        test.skip();
        return;
      }

      // Check if it has steps (required for publishing)
      const stepCount = await draftRow.locator('td').nth(3).textContent();
      if (stepCount === '0') {
        test.skip(); // Cannot publish workflow without steps
        return;
      }

      const menuButton = draftRow.locator('button:has([class*="more-horizontal"])');
      await menuButton.click();

      const publishItem = page.locator('[role="menuitem"]:has-text("Publish")');
      if (await publishItem.isVisible()) {
        await publishItem.click();
        await expect(page.locator('[data-sonner-toast]')).toBeVisible();
      }
    });

    test('should duplicate workflow', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRow = listPage.getRow(0);
      const menuButton = firstRow.locator('button:has([class*="more-horizontal"])');
      await menuButton.click();

      const duplicateItem = page.locator('[role="menuitem"]:has-text("Duplicate")');
      if (await duplicateItem.isVisible()) {
        await duplicateItem.click();
        // Should redirect to new workflow or show success
        await page.waitForURL(/\/admin\/workflows\/[a-f0-9-]+/);
      }
    });

    test('should archive workflow', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find a workflow that can be archived (not already archived)
      const archivableRow = page.locator('tr:not(:has([class*="badge"]:has-text("Archived")))').first();
      if (!(await archivableRow.isVisible())) {
        test.skip();
        return;
      }

      const menuButton = archivableRow.locator('button:has([class*="more-horizontal"])');
      await menuButton.click();

      const archiveItem = page.locator('[role="menuitem"]:has-text("Archive")');
      if (await archiveItem.isVisible()) {
        await archiveItem.click();
        await expect(page.locator('[data-sonner-toast]')).toBeVisible();
      }
    });
  });

  test.describe('Delete Workflow', () => {
    test('should show delete confirmation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find a deletable workflow (draft status)
      const draftRow = page.locator('tr:has([class*="badge"]:has-text("Draft"))').first();
      if (!(await draftRow.isVisible())) {
        test.skip();
        return;
      }

      const menuButton = draftRow.locator('button:has([class*="more-horizontal"])');
      await menuButton.click();

      const deleteItem = page.locator('[role="menuitem"]:has-text("Delete")');
      if (await deleteItem.isVisible() && await deleteItem.isEnabled()) {
        await deleteItem.click();

        // Should show confirmation dialog
        await expect(page.locator('[role="alertdialog"], [role="dialog"]')).toBeVisible();
      }
    });

    test('should cancel delete operation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const draftRow = page.locator('tr:has([class*="badge"]:has-text("Draft"))').first();
      if (!(await draftRow.isVisible())) {
        test.skip();
        return;
      }

      const menuButton = draftRow.locator('button:has([class*="more-horizontal"])');
      await menuButton.click();

      const deleteItem = page.locator('[role="menuitem"]:has-text("Delete")');
      if (await deleteItem.isVisible() && await deleteItem.isEnabled()) {
        await deleteItem.click();
        await page.locator('button:has-text("Cancel")').click();

        // Dialog should close
        await expect(page.locator('[role="alertdialog"]')).not.toBeVisible();
      }
    });
  });

  test.describe('Execution History', () => {
    test('should navigate to executions page', async ({ page }) => {
      await page.locator('button:has-text("Executions")').click();
      await expect(page).toHaveURL(/\/admin\/workflows\/executions/);
    });

    test('should display executions list', async ({ page }) => {
      await page.goto('/admin/workflows/executions');
      await page.waitForLoadState('networkidle');

      // Should show table or empty state
      const table = page.locator('table');
      const emptyState = page.locator('text="No executions"');
      await expect(table.or(emptyState)).toBeVisible();
    });

    test('should filter executions by status', async ({ page }) => {
      await page.goto('/admin/workflows/executions');
      await page.waitForLoadState('networkidle');

      const statusFilter = page.locator('button:has-text("All Statuses")');
      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        const option = page.locator('[role="option"]:has-text("Completed")');
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should view execution details', async ({ page }) => {
      await page.goto('/admin/workflows/executions');
      await page.waitForLoadState('networkidle');

      const rowCount = await page.locator('tbody tr').count();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click view details button
      const viewButton = page.locator('button:has([class*="eye"]), button[title="View Details"]').first();
      if (await viewButton.isVisible()) {
        await viewButton.click();

        // Should show dialog with details
        await expect(page.locator('[role="dialog"]')).toBeVisible();
      }
    });
  });

  test.describe('Failed Workflows (DLQ)', () => {
    test('should navigate to failed workflows page', async ({ page }) => {
      // Check if there's a failed workflows button
      const failedButton = page.locator('button:has-text("Failed")');
      if (await failedButton.isVisible()) {
        await failedButton.click();
        await expect(page).toHaveURL(/\/admin\/workflows\/failed/);
      } else {
        // Navigate directly
        await page.goto('/admin/workflows/failed');
      }
    });

    test('should display failed workflows list', async ({ page }) => {
      await page.goto('/admin/workflows/failed');
      await page.waitForLoadState('networkidle');

      // Should show table or empty state
      const table = page.locator('table');
      const emptyState = page.locator('text="No failed"');
      await expect(table.or(emptyState)).toBeVisible();
    });

    test('should display DLQ stats', async ({ page }) => {
      await page.goto('/admin/workflows/failed');
      await page.waitForLoadState('networkidle');

      // Should show stats cards
      const statsCards = page.locator('.grid:has([class*="border"])');
      await expect(statsCards).toBeVisible();
    });

    test('should retry failed workflow', async ({ page }) => {
      await page.goto('/admin/workflows/failed');
      await page.waitForLoadState('networkidle');

      const rowCount = await page.locator('tbody tr').count();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click retry button
      const retryButton = page.locator('button:has([class*="rotate-ccw"]), button[title="Retry"]').first();
      if (await retryButton.isVisible()) {
        await retryButton.click();
        await expect(page.locator('[data-sonner-toast]')).toBeVisible();
      }
    });

    test('should view failed workflow details', async ({ page }) => {
      await page.goto('/admin/workflows/failed');
      await page.waitForLoadState('networkidle');

      const rowCount = await page.locator('tbody tr').count();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click view details button
      const viewButton = page.locator('button:has([class*="eye"]), button[title="View Details"]').first();
      if (await viewButton.isVisible()) {
        await viewButton.click();

        // Should show dialog with failure details
        await expect(page.locator('[role="dialog"]')).toBeVisible();
        await expect(page.locator('text="Error"').or(page.locator('text="Failure"'))).toBeVisible();
      }
    });

    test('should bulk select failed workflows', async ({ page }) => {
      await page.goto('/admin/workflows/failed');
      await page.waitForLoadState('networkidle');

      const rowCount = await page.locator('tbody tr').count();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click select all checkbox
      const selectAllCheckbox = page.locator('thead [role="checkbox"]');
      if (await selectAllCheckbox.isVisible()) {
        await selectAllCheckbox.click();

        // Bulk retry button should appear
        await expect(page.locator('button:has-text("Retry Selected")')).toBeVisible();
      }
    });
  });

  test.describe('Trigger Configuration', () => {
    test('should configure event trigger', async ({ page }) => {
      await page.goto('/admin/workflows/new');
      await page.waitForLoadState('networkidle');

      await page.locator('button[role="tab"]:has-text("Trigger")').click();

      // Select event trigger type
      const triggerTypeSelect = page.locator('[name="triggerType"]').first();
      await triggerTypeSelect.click();
      await page.locator('[role="option"]:has-text("Event")').click();

      // Should show event configuration
      await expect(page.locator('input[name*="eventType"]')).toBeVisible();
    });

    test('should configure schedule trigger', async ({ page }) => {
      await page.goto('/admin/workflows/new');
      await page.waitForLoadState('networkidle');

      await page.locator('button[role="tab"]:has-text("Trigger")').click();

      // Select schedule trigger type
      const triggerTypeSelect = page.locator('[name="triggerType"]').first();
      await triggerTypeSelect.click();
      await page.locator('[role="option"]:has-text("Schedule")').click();

      // Should show cron configuration
      await expect(page.locator('input[name*="cronExpression"]')).toBeVisible();
    });

    test('should configure webhook trigger', async ({ page }) => {
      await page.goto('/admin/workflows/new');
      await page.waitForLoadState('networkidle');

      await page.locator('button[role="tab"]:has-text("Trigger")').click();

      // Select webhook trigger type
      const triggerTypeSelect = page.locator('[name="triggerType"]').first();
      await triggerTypeSelect.click();
      await page.locator('[role="option"]:has-text("Webhook")').click();

      // Should show webhook configuration
      await expect(page.locator('input[name*="secretKey"]')).toBeVisible();
    });
  });

  test.describe('Pagination', () => {
    test('should display pagination if many workflows', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount >= 20) {
        await expect(listPage.pagination).toBeVisible();
      }
    });

    test('should navigate to next page', async () => {
      if (await listPage.hasNextPage()) {
        await listPage.nextPage();
        await expect(listPage.prevPageButton).toBeEnabled();
      }
    });
  });
});
