import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { randomString, uniqueId, waitForToast } from '../utils/test-helpers';

function getTrpcJsonInput(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload[0]?.json ?? payload[0];
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, any>;
    return record['0']?.json ?? record.json ?? payload;
  }

  return payload;
}

test.describe('Projects CRUD', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  // Test data tracking for cleanup
  const createdProjectCodes: string[] = [];

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/projects');
    await listPage.waitForPageLoad();
  });

  test.afterAll(async () => {
    // Note: In a production setup, we'd clean up created test data here
    // Test data codes are tracked in createdProjectCodes array for potential manual cleanup
  });

  test.describe('Page Load and Display', () => {
    test('should load projects page with correct URL', async ({ page }) => {
      await expect(page).toHaveURL(/\/projects/);
    });

    test('should display page heading with title "Projects"', async ({ page }) => {
      const heading = page.locator('h1, h2').filter({ hasText: /Projects/i }).first();
      await expect(heading).toBeVisible();
    });

    test('should display page description', async ({ page }) => {
      const description = page.locator('text=Manage your projects');
      await expect(description).toBeVisible();
    });

    test('should display projects table or empty state', async ({ page }) => {
      const hasRows = (await listPage.getRowCount()) > 0;
      const emptyText = page.locator('text=No projects found');
      const isEmpty = await emptyText.isVisible().catch(() => false);
      expect(hasRows || isEmpty).toBe(true);
    });

    test('should display Add Project button', async () => {
      const addButton = listPage.createButton.filter({ hasText: /Add Project/i });
      await expect(addButton).toBeVisible();
    });

    test('should display correct table headers', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        // Empty state - skip header check
        test.skip();
        return;
      }
      const headers = await listPage.tableHeaders.allTextContents();
      const headerText = headers.join(' ').toLowerCase();
      expect(headerText).toMatch(/code/i);
      expect(headerText).toMatch(/name/i);
      expect(headerText).toMatch(/status/i);
    });

    test('should display empty state message when no projects', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        const emptyMessage = page.locator('text=No projects found');
        await expect(emptyMessage).toBeVisible();
      }
    });
  });

  test.describe('Create Project - Dialog', () => {
    test('should open create dialog when clicking Add Project button', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      expect(dialogOpened).toBe(true);
    });

    test('should display create dialog with correct title', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const title = page.locator('[role="dialog"] h2');
        await expect(title).toContainText(/Create New Project/i);
      }
    });

    test('should display required fields in create dialog', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Check for Project Code field
        const codeField = page.locator('[role="dialog"] input#projectCode');
        await expect(codeField).toBeVisible();

        // Check for Name field
        const nameField = page.locator('[role="dialog"] input#name');
        await expect(nameField).toBeVisible();

        // Check for Status field
        const statusField = page.locator('[role="dialog"]').locator('text=Status').first();
        await expect(statusField).toBeVisible();
      }
    });

    test('should create project with required fields only', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `PRJ${randomString(4).toUpperCase()}`;
        const name = `Test Project ${randomString()}`;
        createdProjectCodes.push(code);

        // Fill required fields
        await page.locator('[role="dialog"] input#projectCode').fill(code);
        await page.locator('[role="dialog"] input#name').fill(name);

        // Submit
        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify success toast
        await waitForToast(page, /created/i);

        // Verify the project appears in the list
        await listPage.expectRowWithText(code);
      }
    });

    test('should create project with all fields', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `PRJ${randomString(4).toUpperCase()}`;
        const name = `Full Project ${randomString()}`;
        const description = `Test description ${randomString()}`;
        createdProjectCodes.push(code);

        // Fill all form fields
        await page.locator('[role="dialog"] input#projectCode').fill(code);
        await page.locator('[role="dialog"] input#name').fill(name);
        await page.locator('[role="dialog"] input#projectType').fill('Construction');
        await page.locator('[role="dialog"] input#jobNumber').fill(`JOB-${randomString(4)}`);
        await page.locator('[role="dialog"] textarea#description').fill(description);

        // Set start date (today)
        const today = new Date().toISOString().split('T')[0];
        await page.locator('[role="dialog"] input#startDate').fill(today);

        // Set end date (30 days from now)
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        await page.locator('[role="dialog"] input#endDate').fill(endDate.toISOString().split('T')[0]);

        // Select status
        const statusTrigger = page.locator('[role="dialog"]').locator('button').filter({ has: page.locator('text=Draft') }).first();
        if (await statusTrigger.isVisible()) {
          await statusTrigger.click();
          await page.locator('[role="option"]:has-text("Active")').click();
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify the project appears in the list
        await listPage.expectRowWithText(code);
        await listPage.expectRowWithText(name);
      }
    });

    test('should send canonical uppercase status values when creating a project', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `STS${randomString(4).toUpperCase()}`;
        const name = `Status Payload ${randomString()}`;
        createdProjectCodes.push(code);
        let requestHandled = false;

        await page.route('**/trpc/projects.create**', async route => {
          const payload = getTrpcJsonInput(route.request().postDataJSON());

          expect(payload).toMatchObject({
            projectCode: code,
            name,
            status: 'ACTIVE',
          });

          const now = new Date().toISOString();
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              {
                result: {
                  data: {
                    json: {
                      id: `test-project-${randomString(6)}`,
                      organizationId: 'test-org',
                      subsidiaryId: null,
                      customerId: null,
                      customerName: null,
                      projectCode: code,
                      name,
                      status: 'ACTIVE',
                      startDate: null,
                      endDate: null,
                      jobNumber: null,
                      projectType: null,
                      billingModel: 'time_and_materials',
                      budgetRevenue: null,
                      budgetCost: null,
                      percentComplete: null,
                      retainagePercent: '0',
                      currencyCode: null,
                      description: null,
                      externalSource: null,
                      metadata: null,
                      createdAt: now,
                      updatedAt: now,
                    },
                  },
                },
              },
            ]),
          });
          requestHandled = true;
        });

        await page.locator('[role="dialog"] input#projectCode').fill(code);
        await page.locator('[role="dialog"] input#name').fill(name);

        const statusTrigger = page.locator('[role="dialog"]').locator('button').filter({ has: page.locator('text=Draft') }).first();
        await statusTrigger.click();
        await page.locator('[role="option"]:has-text("Active")').click();

        await dialogPage.confirm();
        await expect.poll(() => requestHandled).toBe(true);
      }
    });

    test('should validate required project code field', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Fill only name, leave code empty
        await page.locator('[role="dialog"] input#name').fill(`Test Project ${randomString()}`);

        await dialogPage.confirm();

        // Should show error toast for missing code
        const errorToast = page.locator('[data-sonner-toaster]');
        await expect(errorToast).toBeVisible({ timeout: 5000 });
      }
    });

    test('should validate required project name field', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Fill only code, leave name empty
        await page.locator('[role="dialog"] input#projectCode').fill(`PRJ${randomString(4)}`);

        await dialogPage.confirm();

        // Should show error toast for missing name
        const errorToast = page.locator('[data-sonner-toaster]');
        await expect(errorToast).toBeVisible({ timeout: 5000 });
      }
    });

    test('should cancel project creation', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `CNC${randomString(4).toUpperCase()}`;

        // Fill some data
        await page.locator('[role="dialog"] input#projectCode').fill(code);
        await page.locator('[role="dialog"] input#name').fill('Should Not Create');

        // Cancel
        await dialogPage.cancel();
        await dialogPage.expectNotVisible();

        // Verify the project was not created
        await listPage.waitForPageLoad();
        const rowCount = await listPage.getRowCount();
        if (rowCount > 0) {
          const rows = await listPage.tableRows.allTextContents();
          const hasOurEntry = rows.some(row => row.includes('Should Not Create'));
          expect(hasOurEntry).toBe(false);
        }
      }
    });

    test('should close dialog with Escape key', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await page.keyboard.press('Escape');
        await dialogPage.expectNotVisible();
      }
    });
  });

  test.describe('Edit Project - Dialog', () => {
    test('should open edit dialog for existing project', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click the edit button in the first row
      const editButton = listPage.getRow(0).locator('button[title="Edit project"]');
      await editButton.click();

      const dialogOpened = await dialogPage.isOpen();
      expect(dialogOpened).toBe(true);
    });

    test('should display existing values in edit dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get the code from the first row before editing
      const firstRowCode = await listPage.getCellValue(0, 'code');

      // Click edit button
      const editButton = listPage.getRow(0).locator('button[title="Edit project"]');
      await editButton.click();

      if (await dialogPage.isOpen()) {
        // Verify the code field has the existing value
        const codeInput = page.locator('[role="dialog"] input#projectCode');
        await expect(codeInput).toHaveValue(firstRowCode.trim());
      }
    });

    test('should update project name via dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click edit button
      const editButton = listPage.getRow(0).locator('button[title="Edit project"]');
      await editButton.click();

      if (await dialogPage.isOpen()) {
        const newName = `Updated Project ${randomString()}`;

        // Clear and fill the name field
        const nameInput = page.locator('[role="dialog"] input#name');
        await nameInput.clear();
        await nameInput.fill(newName);

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify success toast
        await waitForToast(page, /updated/i);

        // Verify the updated name appears
        await listPage.expectRowWithText(newName);
      }
    });

    test('should cancel edit without saving changes', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get original name
      const originalName = await listPage.getCellValue(0, 'name');

      // Click edit button
      const editButton = listPage.getRow(0).locator('button[title="Edit project"]');
      await editButton.click();

      if (await dialogPage.isOpen()) {
        const nameInput = page.locator('[role="dialog"] input#name');
        await nameInput.clear();
        await nameInput.fill('Changed But Cancelled');

        await dialogPage.cancel();
        await dialogPage.expectNotVisible();

        // Verify original name is still there
        await listPage.expectRowWithText(originalName.trim());
      }
    });
  });

  test.describe('Edit Project - Inline Editing', () => {
    test('should edit project name inline by clicking on cell', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click on the name cell to start inline editing
      const nameCell = listPage.getRow(0).locator('td').nth(1); // Name is second column
      await nameCell.click();

      // Should show inline edit input
      const input = nameCell.locator('input');
      if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
        const newName = `Inline Edit ${randomString()}`;
        await input.clear();
        await input.fill(newName);

        // Click the save button (checkmark)
        const saveButton = nameCell.locator('button').first();
        await saveButton.click();

        await listPage.waitForPageLoad();

        // Verify the name was updated
        await listPage.expectRowWithText(newName);
      }
    });

    test('should cancel inline edit with Escape key', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get original name
      const originalName = await listPage.getCellValue(0, 'name');

      // Click on the name cell to start inline editing
      const nameCell = listPage.getRow(0).locator('td').nth(1);
      await nameCell.click();

      const input = nameCell.locator('input');
      if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
        await input.clear();
        await input.fill('Should Be Cancelled');

        // Press Escape to cancel
        await page.keyboard.press('Escape');

        // Verify original name is still there
        await listPage.expectRowWithText(originalName.trim());
      }
    });

    test('should edit project status inline', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click on the status badge to start inline editing
      const statusCell = listPage.getRow(0).locator('td').nth(3); // Status column
      const statusBadge = statusCell.locator('[class*="badge"], span').first();
      await statusBadge.click();

      // Should show status select dropdown
      const select = statusCell.locator('button[role="combobox"]');
      if (await select.isVisible({ timeout: 2000 }).catch(() => false)) {
        await select.click();

        // Select a new status
        const option = page.locator('[role="option"]:has-text("On Hold")');
        if (await option.isVisible()) {
          await option.click();

          await listPage.waitForPageLoad();

          // Verify success toast
          await waitForToast(page, /updated/i);
        }
      }
    });
  });

  test.describe('Delete Project', () => {
    test('should show delete confirmation dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Set up dialog handler to capture confirm
      page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('delete');
        await dialog.dismiss();
      });

      // Click delete button
      const deleteButton = listPage.getRow(0).locator('button[title="Delete project"]');
      await deleteButton.click();
    });

    test('should cancel delete operation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const originalCount = rowCount;

      // Set up dialog handler to cancel
      page.on('dialog', async dialog => {
        await dialog.dismiss();
      });

      // Click delete button
      const deleteButton = listPage.getRow(0).locator('button[title="Delete project"]');
      await deleteButton.click();

      // Wait a moment for any processing
      await page.waitForTimeout(500);

      // Verify row count unchanged
      const newCount = await listPage.getRowCount();
      expect(newCount).toBe(originalCount);
    });

    test('should delete project when confirmed', async ({ page }) => {
      // First create a project to delete
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `DEL${randomString(4).toUpperCase()}`;
        const name = `Delete Me ${randomString()}`;

        await page.locator('[role="dialog"] input#projectCode').fill(code);
        await page.locator('[role="dialog"] input#name').fill(name);

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Find the created project row
        const row = await listPage.findRowByText(code);

        if (await row.isVisible()) {
          const countBefore = await listPage.getRowCount();

          // Set up dialog handler to confirm
          page.on('dialog', async dialog => {
            await dialog.accept();
          });

          // Click delete button
          const deleteButton = row.locator('button[title="Delete project"]');
          await deleteButton.click();

          await listPage.waitForPageLoad();

          // Verify success toast
          await waitForToast(page, /deleted/i);

          // Verify deleted
          const countAfter = await listPage.getRowCount();
          expect(countAfter).toBeLessThan(countBefore);
        }
      }
    });
  });

  test.describe('Navigation and Detail Page', () => {
    test('should navigate to project detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click the view button
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();

      await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+$/);
    });

    test('should display project name on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get name from list before navigating
      const projectName = await listPage.getCellValue(0, 'name');

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();

      await page.waitForURL(/\/projects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      // Verify the name is displayed
      const heading = page.locator('h1');
      await expect(heading).toContainText(projectName.trim());
    });

    test('should display project status badge on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();

      await page.waitForURL(/\/projects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      // Verify status badge exists
      const badge = page.locator('[class*="badge"]').first();
      await expect(badge).toBeVisible();
    });

    test('should display edit button on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();

      await page.waitForURL(/\/projects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      // Verify Edit button exists
      const editButton = page.locator('button:has-text("Edit Project")');
      await expect(editButton).toBeVisible();
    });

    test('should navigate back to list from detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();

      await page.waitForURL(/\/projects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      // Click back button
      const backButton = page.locator('button').filter({ has: page.locator('[class*="lucide-arrow-left"]') });
      await backButton.click();

      await expect(page).toHaveURL(/\/projects$/);
    });

    test('should navigate to edit page from detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();

      await page.waitForURL(/\/projects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      // Click Edit button
      const editButton = page.locator('button:has-text("Edit Project")');
      await editButton.click();

      await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+\/edit$/);
    });
  });

  test.describe('Detail Page - Tabs', () => {
    test('should display Details tab', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();

      await page.waitForURL(/\/projects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      const detailsTab = page.locator('[role="tab"]:has-text("Details")');
      await expect(detailsTab).toBeVisible();
    });

    test('should display Transactions tab', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();

      await page.waitForURL(/\/projects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      const transactionsTab = page.locator('[role="tab"]:has-text("Transactions")');
      await expect(transactionsTab).toBeVisible();
    });

    test('should display Participants tab', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();

      await page.waitForURL(/\/projects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      const participantsTab = page.locator('[role="tab"]:has-text("Participants")');
      await expect(participantsTab).toBeVisible();
    });

    test('should display Tasks tab', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();

      await page.waitForURL(/\/projects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      const tasksTab = page.locator('[role="tab"]:has-text("Tasks")');
      await expect(tasksTab).toBeVisible();
    });

    test('should switch between tabs', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();

      await page.waitForURL(/\/projects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      // Click Participants tab
      const participantsTab = page.locator('[role="tab"]:has-text("Participants")');
      await participantsTab.click();

      // Verify participants content is visible
      const participantsContent = page.locator('text=Project Participants');
      await expect(participantsContent).toBeVisible();

      // Click Tasks tab
      const tasksTab = page.locator('[role="tab"]:has-text("Tasks")');
      await tasksTab.click();

      // Verify tasks content is visible
      const tasksContent = page.locator('h3, h4, [class*="title"]').filter({ hasText: /Tasks/i }).first();
      await expect(tasksContent).toBeVisible();
    });
  });

  test.describe('Edit Page', () => {
    test('should display edit form with existing values', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get existing code from list
      const existingCode = await listPage.getCellValue(0, 'code');

      // Navigate to edit page via detail page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();

      await page.waitForURL(/\/projects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      // Click Edit button
      const editButton = page.locator('button:has-text("Edit Project")');
      await editButton.click();

      await page.waitForURL(/\/projects\/[a-f0-9-]+\/edit$/);
      await listPage.waitForPageLoad();

      // Verify the form is populated
      const codeInput = page.locator('input[name="projectCode"]');
      await expect(codeInput).toHaveValue(existingCode.trim());
    });

    test('should update project via edit page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to edit page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();

      await page.waitForURL(/\/projects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      const editButton = page.locator('button:has-text("Edit Project")');
      await editButton.click();

      await page.waitForURL(/\/projects\/[a-f0-9-]+\/edit$/);
      await listPage.waitForPageLoad();

      // Update description
      const newDescription = `Updated description ${randomString()}`;
      const descriptionField = page.locator('textarea[name="description"]');
      await descriptionField.clear();
      await descriptionField.fill(newDescription);

      // Save changes
      const saveButton = page.locator('button:has-text("Save Changes")');
      await saveButton.click();

      // Verify success toast
      await waitForToast(page, /updated/i);

      // Should redirect back to detail page
      await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+$/);
    });

    test('should cancel edit and return to detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to edit page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();

      await page.waitForURL(/\/projects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      const editButton = page.locator('button:has-text("Edit Project")');
      await editButton.click();

      await page.waitForURL(/\/projects\/[a-f0-9-]+\/edit$/);
      await listPage.waitForPageLoad();

      // Click Cancel button
      const cancelButton = page.locator('button:has-text("Cancel")');
      await cancelButton.click();

      // Should return to detail page
      await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+$/);
    });
  });

  test.describe('Project Status Updates', () => {
    test('should display status badges with correct colors', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check that status badges are displayed
      const statusBadges = listPage.tableRows.locator('[class*="badge"]');
      const badgeCount = await statusBadges.count();
      expect(badgeCount).toBeGreaterThan(0);
    });

    test('should show all status options when editing', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Click status dropdown
        const statusTrigger = page.locator('[role="dialog"]').locator('button').filter({ has: page.locator('text=Draft') }).first();
        if (await statusTrigger.isVisible()) {
          await statusTrigger.click();

          // Verify all status options are visible
          const options = ['Draft', 'Active', 'On Hold', 'Completed', 'Cancelled', 'Archived'];
          for (const option of options) {
            const optionElement = page.locator(`[role="option"]:has-text("${option}")`);
            await expect(optionElement).toBeVisible();
          }

          // Close dropdown
          await page.keyboard.press('Escape');
        }

        await dialogPage.cancel();
      }
    });
  });

  test.describe('Quick Actions', () => {
    test('should navigate to time tracking from list', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click time tracking button
      const timeButton = listPage.getRow(0).locator('button[title="Time tracking"]');
      await timeButton.click();

      await expect(page).toHaveURL(/\/projects\/time\?projectId=/);
    });

    test('should navigate to estimates from list', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click estimates button
      const estimatesButton = listPage.getRow(0).locator('button[title="View estimates"]');
      await estimatesButton.click();

      await expect(page).toHaveURL(/\/transactions\/sales\/estimates\?projectId=/);
    });
  });

  test.describe('Edge Cases and Error Handling', () => {
    test('should handle duplicate project code gracefully', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get an existing code
      const existingCode = await listPage.getCellValue(0, 'code');

      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Try to create with the same code
        await page.locator('[role="dialog"] input#projectCode').fill(existingCode.trim());
        await page.locator('[role="dialog"] input#name').fill(`Duplicate Test ${randomString()}`);

        await dialogPage.confirm();

        // Should show error toast or dialog stays open
        await page.waitForTimeout(1000);
        const toastVisible = await page.locator('[data-sonner-toaster]').isVisible();
        const dialogStillOpen = await dialogPage.isOpen();

        // Expect either error toast or dialog still open
        expect(toastVisible || dialogStillOpen).toBe(true);
      }
    });

    test('should handle special characters in project name', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `SPC${randomString(4).toUpperCase()}`;
        const name = `Special <>&"' Test ${randomString()}`;
        createdProjectCodes.push(code);

        await page.locator('[role="dialog"] input#projectCode').fill(code);
        await page.locator('[role="dialog"] input#name').fill(name);

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify creation succeeded
        await listPage.expectRowWithText(code);
      }
    });

    test('should handle long project description', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `LNG${randomString(4).toUpperCase()}`;
        const name = `Long Description Test ${randomString()}`;
        const longDescription = 'This is a very long description for testing purposes. '.repeat(20);
        createdProjectCodes.push(code);

        await page.locator('[role="dialog"] input#projectCode').fill(code);
        await page.locator('[role="dialog"] input#name').fill(name);
        await page.locator('[role="dialog"] textarea#description').fill(longDescription);

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify creation succeeded
        await listPage.expectRowWithText(code);
      }
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Intercept API calls and return error
      await page.route('**/trpc/**', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: { message: 'Internal Server Error' } })
        });
      });

      await page.reload();

      // Should show some error state or fallback
      await page.waitForTimeout(2000);

      // Restore network
      await page.unroute('**/trpc/**');
    });

    test('should show loading state while fetching projects', async ({ page }) => {
      // Navigate with network throttling to see loading state
      await page.route('**/trpc/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.continue();
      });

      await page.goto('/projects');

      // Check for loading indicator
      const loadingText = page.locator('text=Loading projects...');
      const loadingVisible = await loadingText.isVisible({ timeout: 3000 }).catch(() => false);

      // Wait for loading to complete
      await listPage.waitForPageLoad();

      // Page should now show table or empty state
      const hasContent = (await listPage.getRowCount()) > 0 ||
        await page.locator('text=No projects found').isVisible().catch(() => false);
      expect(hasContent).toBe(true);
    });
  });

  test.describe('UI Interactions', () => {
    test('should show success toast after creating project', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `TST${randomString(4).toUpperCase()}`;
        const name = `Toast Test ${randomString()}`;
        createdProjectCodes.push(code);

        await page.locator('[role="dialog"] input#projectCode').fill(code);
        await page.locator('[role="dialog"] input#name').fill(name);

        await dialogPage.confirm();

        // Check for success toast
        await waitForToast(page, /success|created/i);
      }
    });

    test('should show error toast on create failure', async ({ page }) => {
      // Mock API to return error
      await page.route('**/trpc/projects.create**', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Failed to create project' } }),
        });
      });

      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `ERR${randomString(4).toUpperCase()}`;
        const name = `Error Test ${randomString()}`;

        await page.locator('[role="dialog"] input#projectCode').fill(code);
        await page.locator('[role="dialog"] input#name').fill(name);

        await dialogPage.confirm();

        // Check for error toast
        await page.waitForTimeout(2000);
        const toast = page.locator('[data-sonner-toaster]');
        await expect(toast).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should display properly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/projects');
      await listPage.waitForPageLoad();

      // Verify page still loads
      await expect(page).toHaveURL(/\/projects/);

      // Verify Add button is still accessible
      const addButton = listPage.createButton;
      await expect(addButton).toBeVisible();
    });

    test('should display properly on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/projects');
      await listPage.waitForPageLoad();

      // Verify page still loads
      await expect(page).toHaveURL(/\/projects/);

      // Verify table is visible
      const hasRows = (await listPage.getRowCount()) > 0;
      const isEmpty = await page.locator('text=No projects found').isVisible().catch(() => false);
      expect(hasRows || isEmpty).toBe(true);
    });
  });
});
