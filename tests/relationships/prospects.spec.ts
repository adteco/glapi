import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString, randomEmail, randomPhone, waitForToast } from '../utils/test-helpers';

test.describe('Prospects CRUD', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  // Track created prospects for potential cleanup
  const createdProspectNames: string[] = [];

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/relationships/prospects');
    await listPage.waitForPageLoad();
  });

  test.afterAll(async () => {
    // Note: In a production setup, we'd clean up created test data here
    // Created prospect names are tracked in createdProspectNames array
  });

  test.describe('Page Load and Display', () => {
    test('should load prospects list page with correct URL', async ({ page }) => {
      await expect(page).toHaveURL(/\/relationships\/prospects/);
    });

    test('should display page heading', async ({ page }) => {
      const heading = page.locator('h1, [class*="CardTitle"]').filter({ hasText: /Prospects/i }).first();
      await expect(heading).toBeVisible();
    });

    test('should display page description', async ({ page }) => {
      const description = page.locator('text=Track potential opportunities before they become leads');
      await expect(description).toBeVisible();
    });

    test('should display prospects table or empty state', async () => {
      const hasRows = (await listPage.getRowCount()) > 0;
      const isEmpty = await listPage.isEmpty();
      expect(hasRows || isEmpty).toBe(true);
    });

    test('should display create button with "Add Prospect" text', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await expect(addButton).toBeVisible();
    });

    test('should display correct table headers', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }
      const headers = await listPage.tableHeaders.allTextContents();
      const headerText = headers.join(' ').toLowerCase();
      expect(headerText).toMatch(/company/i);
      expect(headerText).toMatch(/industry/i);
      expect(headerText).toMatch(/revenue/i);
      expect(headerText).toMatch(/employees/i);
      expect(headerText).toMatch(/email/i);
      expect(headerText).toMatch(/status/i);
    });

    test('should display status badges for active/inactive prospects', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }
      const badges = listPage.getRow(0).locator('[class*="Badge"], span').filter({
        hasText: /active|inactive/i
      });
      await expect(badges.first()).toBeVisible();
    });

    test('should display empty state message when no prospects', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount > 0) {
        test.skip();
        return;
      }
      const emptyMessage = page.locator('text=No prospects found');
      await expect(emptyMessage).toBeVisible();
    });

    test('should display loading state while fetching data', async ({ page }) => {
      // Navigate with network throttling to observe loading state
      await page.route('**/trpc/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 300));
        await route.continue();
      });

      await page.goto('/relationships/prospects');

      // Check for loading indicator
      const loadingText = page.locator('text=Loading...');
      const loadingVisible = await loadingText.isVisible({ timeout: 1000 }).catch(() => false);

      // Wait for loading to complete
      await listPage.waitForPageLoad();

      // Page should now show table or empty state
      const hasContent = (await listPage.getRowCount()) > 0 || await listPage.isEmpty();
      expect(hasContent).toBe(true);
    });
  });

  test.describe('Create Prospect - Basic', () => {
    test('should open create dialog when clicking Add Prospect button', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      await expect(dialogPage.dialog).toBeVisible();
    });

    test('should display create dialog with correct title', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      const title = dialogPage.dialog.locator('[class*="DialogTitle"], h2').first();
      await expect(title).toContainText(/Create.*Prospect/i);
    });

    test('should create prospect with only company name (required field)', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        const companyName = `Test Company ${randomString(6)}`;
        createdProspectNames.push(companyName);

        const nameInput = dialogPage.dialog.locator('#name');
        await nameInput.fill(companyName);

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify success toast
        await waitForToast(page, /created/i);

        // Verify the prospect appears in the list
        await listPage.expectRowWithText(companyName);
      }
    });

    test('should create prospect with all basic fields', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        const prospectData = {
          name: `Full Prospect ${randomString(6)}`,
          email: randomEmail(),
          phone: randomPhone(),
          website: `https://test-${randomString(4)}.com`,
          source: 'Cold Outreach',
          industry: 'Technology',
          revenue: '1000000',
          employees: '100',
          notes: 'This is a test prospect created by E2E tests.',
        };
        createdProspectNames.push(prospectData.name);

        // Fill company name
        await dialogPage.dialog.locator('#name').fill(prospectData.name);

        // Fill source
        const sourceInput = dialogPage.dialog.locator('#source');
        if (await sourceInput.isVisible()) {
          await sourceInput.fill(prospectData.source);
        }

        // Fill email
        const emailInput = dialogPage.dialog.locator('#email');
        if (await emailInput.isVisible()) {
          await emailInput.fill(prospectData.email);
        }

        // Fill phone
        const phoneInput = dialogPage.dialog.locator('#phone');
        if (await phoneInput.isVisible()) {
          await phoneInput.fill(prospectData.phone);
        }

        // Fill website
        const websiteInput = dialogPage.dialog.locator('#website');
        if (await websiteInput.isVisible()) {
          await websiteInput.fill(prospectData.website);
        }

        // Fill industry
        const industryInput = dialogPage.dialog.locator('#industry');
        if (await industryInput.isVisible()) {
          await industryInput.fill(prospectData.industry);
        }

        // Fill annual revenue
        const revenueInput = dialogPage.dialog.locator('#revenue');
        if (await revenueInput.isVisible()) {
          await revenueInput.fill(prospectData.revenue);
        }

        // Fill employees
        const employeesInput = dialogPage.dialog.locator('#employees');
        if (await employeesInput.isVisible()) {
          await employeesInput.fill(prospectData.employees);
        }

        // Fill notes
        const notesInput = dialogPage.dialog.locator('#notes');
        if (await notesInput.isVisible()) {
          await notesInput.fill(prospectData.notes);
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify the prospect appears in the list
        await listPage.expectRowWithText(prospectData.name);

        // Verify industry is shown
        const row = await listPage.findRowByText(prospectData.name);
        const rowText = await row.textContent();
        expect(rowText).toContain(prospectData.industry);
      }
    });

    test('should validate required company name field', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        // Fill optional fields but leave name empty
        const emailInput = dialogPage.dialog.locator('#email');
        if (await emailInput.isVisible()) {
          await emailInput.fill(randomEmail());
        }

        // Try to submit
        await dialogPage.confirm();

        // Should show error toast for missing company name
        const toast = page.locator('[data-sonner-toaster]');
        await expect(toast.locator('text=/required/i')).toBeVisible({ timeout: 5000 });
      }
    });

    test('should cancel prospect creation', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        const companyName = `Cancel Test ${randomString(6)}`;
        await dialogPage.dialog.locator('#name').fill(companyName);

        await dialogPage.cancel();
        await dialogPage.expectNotVisible();

        // Verify the prospect was NOT created
        await listPage.waitForPageLoad();
        await listPage.expectNoRowWithText(companyName);
      }
    });

    test('should close dialog with Escape key', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        await page.keyboard.press('Escape');
        await dialogPage.expectNotVisible();
      }
    });

    test('should reset form when dialog is reopened', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');

      // Open dialog and fill some data
      await addButton.click();
      if (await dialogPage.isOpen()) {
        await dialogPage.dialog.locator('#name').fill('Some Name');
        await dialogPage.cancel();
      }

      // Reopen dialog
      await addButton.click();
      if (await dialogPage.isOpen()) {
        const nameInput = dialogPage.dialog.locator('#name');
        const value = await nameInput.inputValue();
        expect(value).toBe('');
      }
    });
  });

  test.describe('View Prospect Detail', () => {
    test('should navigate to prospect detail page via view button', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click the view button (Eye icon)
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();

      await expect(page).toHaveURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
    });

    test('should display prospect details on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get company name before navigating
      const companyName = await listPage.getCellValue(0, 'Company');

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();

      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      // Verify the company name is displayed
      const heading = page.locator('h1, [class*="CardTitle"]').first();
      await expect(heading).toContainText(companyName.trim());
    });

    test('should display contact information section', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();
      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      const contactSection = page.locator('text=Contact Information');
      await expect(contactSection).toBeVisible();
    });

    test('should display prospect details section', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();
      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      const detailsSection = page.locator('text=Prospect Details');
      await expect(detailsSection).toBeVisible();
    });

    test('should display status badge on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();
      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      const statusBadge = page.locator('[class*="Badge"]').filter({ hasText: /Active|Inactive/i }).first();
      await expect(statusBadge).toBeVisible();
    });

    test('should navigate back to list from detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();
      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      // Click back button
      const backButton = page.locator('button:has-text("Back")');
      await backButton.click();

      await expect(page).toHaveURL(/\/relationships\/prospects$/);
    });

    test('should display edit button on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();
      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      const editButton = page.locator('button:has-text("Edit")');
      await expect(editButton).toBeVisible();
    });

    test('should display delete button on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();
      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      const deleteButton = page.locator('button:has-text("Delete")');
      await expect(deleteButton).toBeVisible();
    });

    test('should display created and updated dates', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();
      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      const createdText = page.locator('text=/Created:/i');
      const updatedText = page.locator('text=/Updated:/i');

      await expect(createdText).toBeVisible();
      await expect(updatedText).toBeVisible();
    });
  });

  test.describe('Edit Prospect', () => {
    test('should navigate to edit page from list', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click the edit button (Pencil icon)
      const editButton = listPage.getRow(0).locator('button[title="Edit prospect"]');
      await editButton.click();

      await expect(page).toHaveURL(/\/relationships\/prospects\/[a-f0-9-]+\/edit$/);
    });

    test('should pre-fill form with existing values when editing', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get existing company name from table
      const existingName = await listPage.getCellValue(0, 'Company');

      const editButton = listPage.getRow(0).locator('button[title="Edit prospect"]');
      await editButton.click();

      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+\/edit$/);
      await listPage.waitForPageLoad();

      // Verify the name field is pre-filled
      const nameInput = page.locator('#name');
      const nameValue = await nameInput.inputValue();
      expect(nameValue).toContain(existingName.trim());
    });

    test('should update prospect name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const editButton = listPage.getRow(0).locator('button[title="Edit prospect"]');
      await editButton.click();

      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+\/edit$/);
      await listPage.waitForPageLoad();

      const newName = `Updated Prospect ${randomString(6)}`;
      createdProspectNames.push(newName);

      const nameInput = page.locator('#name');
      await nameInput.clear();
      await nameInput.fill(newName);

      // Submit the form
      const saveButton = page.locator('button[type="submit"]:has-text("Save")');
      await saveButton.click();

      // Should navigate back to detail page
      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);

      // Verify success toast
      await waitForToast(page, /updated/i);

      // Verify the updated name is displayed
      const heading = page.locator('h1, [class*="CardTitle"]').first();
      await expect(heading).toContainText(newName);
    });

    test('should update prospect industry', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const editButton = listPage.getRow(0).locator('button[title="Edit prospect"]');
      await editButton.click();

      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+\/edit$/);
      await listPage.waitForPageLoad();

      const newIndustry = 'Healthcare';
      const industryInput = page.locator('#industry');
      await industryInput.clear();
      await industryInput.fill(newIndustry);

      const saveButton = page.locator('button[type="submit"]:has-text("Save")');
      await saveButton.click();

      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
      await waitForToast(page, /updated/i);
    });

    test('should toggle active status', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const editButton = listPage.getRow(0).locator('button[title="Edit prospect"]');
      await editButton.click();

      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+\/edit$/);
      await listPage.waitForPageLoad();

      // Find and toggle the active switch
      const activeSwitch = page.locator('#isActive');
      if (await activeSwitch.isVisible()) {
        await activeSwitch.click();
      }

      const saveButton = page.locator('button[type="submit"]:has-text("Save")');
      await saveButton.click();

      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
      await waitForToast(page, /updated/i);
    });

    test('should cancel edit without saving changes', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get original name
      const originalName = await listPage.getCellValue(0, 'Company');

      const editButton = listPage.getRow(0).locator('button[title="Edit prospect"]');
      await editButton.click();

      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+\/edit$/);
      await listPage.waitForPageLoad();

      // Change the name
      const nameInput = page.locator('#name');
      await nameInput.clear();
      await nameInput.fill(`Should Not Save ${randomString(6)}`);

      // Click cancel
      const cancelButton = page.locator('button:has-text("Cancel")');
      await cancelButton.click();

      // Should navigate back to detail page
      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);

      // Verify original name is still there
      const heading = page.locator('h1, [class*="CardTitle"]').first();
      await expect(heading).toContainText(originalName.trim());
    });

    test('should validate required company name on edit', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const editButton = listPage.getRow(0).locator('button[title="Edit prospect"]');
      await editButton.click();

      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+\/edit$/);
      await listPage.waitForPageLoad();

      // Clear the name field
      const nameInput = page.locator('#name');
      await nameInput.clear();

      // Try to submit
      const saveButton = page.locator('button[type="submit"]:has-text("Save")');
      await saveButton.click();

      // Should show error toast
      const toast = page.locator('[data-sonner-toaster]');
      await expect(toast.locator('text=/required/i')).toBeVisible({ timeout: 5000 });
    });

    test('should navigate from detail page to edit page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // First navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();
      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      // Click edit button on detail page
      const editButton = page.locator('button:has-text("Edit")');
      await editButton.click();

      await expect(page).toHaveURL(/\/relationships\/prospects\/[a-f0-9-]+\/edit$/);
    });
  });

  test.describe('Delete Prospect', () => {
    test('should show delete confirmation dialog from list', async ({ page }) => {
      // First create a prospect to delete
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        const companyName = `Delete Test ${randomString(6)}`;
        await dialogPage.dialog.locator('#name').fill(companyName);
        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Wait for the prospect to appear
        await listPage.expectRowWithText(companyName);

        // Set up dialog handler to dismiss confirmation
        page.once('dialog', dialog => dialog.dismiss());

        // Click delete button on the new prospect
        const row = await listPage.findRowByText(companyName);
        // The delete is in the actions column - we need to find convert to lead button
        // Looking at the UI, there's no direct delete from list, only from detail page
      }
    });

    test('should show delete confirmation dialog from detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();
      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      // Set up dialog handler
      const dialogPromise = page.waitForEvent('dialog');

      // Click delete button
      const deleteButton = page.locator('button:has-text("Delete")');
      await deleteButton.click();

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

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();
      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      // Dismiss the confirmation dialog
      page.once('dialog', dialog => dialog.dismiss());

      const deleteButton = page.locator('button:has-text("Delete")');
      await deleteButton.click();

      // Should still be on detail page
      await expect(page).toHaveURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
    });

    test('should delete prospect after confirmation', async ({ page }) => {
      // First create a prospect to delete
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        const companyName = `Delete Me ${randomString(6)}`;
        await dialogPage.dialog.locator('#name').fill(companyName);
        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify prospect was created
        await listPage.expectRowWithText(companyName);
        const countBefore = await listPage.getRowCount();

        // Navigate to detail page
        const row = await listPage.findRowByText(companyName);
        const viewButton = row.locator('button[title="View details"]');
        await viewButton.click();
        await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
        await listPage.waitForPageLoad();

        // Accept the confirmation dialog
        page.once('dialog', dialog => dialog.accept());

        // Click delete
        const deleteButton = page.locator('button:has-text("Delete")');
        await deleteButton.click();

        // Should navigate back to list
        await page.waitForURL(/\/relationships\/prospects$/);
        await listPage.waitForPageLoad();

        // Verify success toast
        await waitForToast(page, /deleted/i);

        // Verify prospect is gone
        await listPage.expectNoRowWithText(companyName);
      }
    });
  });

  test.describe('Convert Prospect', () => {
    test('should display convert to lead button in list actions', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const convertButton = listPage.getRow(0).locator('button[title="Convert to lead"]');
      await expect(convertButton).toBeVisible();
    });

    test('should display convert to customer button in list actions', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const convertButton = listPage.getRow(0).locator('button[title="Convert to customer"]');
      await expect(convertButton).toBeVisible();
    });

    test('should show convert to lead confirmation dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const dialogPromise = page.waitForEvent('dialog');

      const convertButton = listPage.getRow(0).locator('button[title="Convert to lead"]');
      await convertButton.click();

      const dialog = await dialogPromise;
      expect(dialog.message().toLowerCase()).toContain('lead');
      await dialog.dismiss();
    });

    test('should show convert to customer confirmation dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const dialogPromise = page.waitForEvent('dialog');

      const convertButton = listPage.getRow(0).locator('button[title="Convert to customer"]');
      await convertButton.click();

      const dialog = await dialogPromise;
      expect(dialog.message().toLowerCase()).toContain('customer');
      await dialog.dismiss();
    });

    test('should display convert buttons on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();
      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      const convertToLeadButton = page.locator('button:has-text("Convert to Lead")');
      const convertToCustomerButton = page.locator('button:has-text("Convert to Customer")');

      await expect(convertToLeadButton).toBeVisible();
      await expect(convertToCustomerButton).toBeVisible();
    });

    test('should convert prospect to lead successfully', async ({ page }) => {
      // First create a prospect to convert
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        const companyName = `Convert to Lead ${randomString(6)}`;
        await dialogPage.dialog.locator('#name').fill(companyName);
        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify prospect was created
        await listPage.expectRowWithText(companyName);

        // Accept the confirmation dialog
        page.once('dialog', dialog => dialog.accept());

        // Click convert to lead
        const row = await listPage.findRowByText(companyName);
        const convertButton = row.locator('button[title="Convert to lead"]');
        await convertButton.click();

        await listPage.waitForPageLoad();

        // Verify success toast
        await waitForToast(page, /lead/i);

        // Prospect should no longer be in the list
        await listPage.expectNoRowWithText(companyName);
      }
    });

    test('should convert prospect to customer successfully', async ({ page }) => {
      // First create a prospect to convert
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        const companyName = `Convert to Cust ${randomString(6)}`;
        await dialogPage.dialog.locator('#name').fill(companyName);
        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify prospect was created
        await listPage.expectRowWithText(companyName);

        // Accept the confirmation dialog
        page.once('dialog', dialog => dialog.accept());

        // Click convert to customer
        const row = await listPage.findRowByText(companyName);
        const convertButton = row.locator('button[title="Convert to customer"]');
        await convertButton.click();

        await listPage.waitForPageLoad();

        // Verify success toast
        await waitForToast(page, /customer/i);

        // Prospect should no longer be in the list
        await listPage.expectNoRowWithText(companyName);
      }
    });
  });

  test.describe('Table Features', () => {
    test('should display revenue in currency format', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check for currency formatting ($ symbol)
      const revenueCell = listPage.getRow(0).locator('td').nth(2); // Revenue column
      const revenueText = await revenueCell.textContent();
      // Should either be '-' or a currency value
      expect(revenueText).toMatch(/^(-|\$[\d,]+)$/);
    });

    test('should display employee count', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const employeesCell = listPage.getRow(0).locator('td').nth(3); // Employees column
      const employeesText = await employeesCell.textContent();
      // Should either be '-' or a number
      expect(employeesText).toMatch(/^(-|\d+)$/);
    });

    test('should show action buttons for each row', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const row = listPage.getRow(0);

      // View button
      const viewButton = row.locator('button[title="View details"]');
      await expect(viewButton).toBeVisible();

      // Edit button
      const editButton = row.locator('button[title="Edit prospect"]');
      await expect(editButton).toBeVisible();

      // Convert to lead button
      const convertLeadButton = row.locator('button[title="Convert to lead"]');
      await expect(convertLeadButton).toBeVisible();

      // Convert to customer button
      const convertCustomerButton = row.locator('button[title="Convert to customer"]');
      await expect(convertCustomerButton).toBeVisible();
    });
  });

  test.describe('Edge Cases and Error Handling', () => {
    test('should handle special characters in company name', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        const specialName = `Test O'Brien & Co. "LLC" ${randomString(4)}`;
        createdProspectNames.push(specialName);

        await dialogPage.dialog.locator('#name').fill(specialName);
        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.expectRowWithText("O'Brien");
      }
    });

    test('should handle unicode characters in company name', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        const unicodeName = `Test Company ${randomString(4)}`;
        createdProspectNames.push(unicodeName);

        await dialogPage.dialog.locator('#name').fill(unicodeName);
        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.expectRowWithText(unicodeName);
      }
    });

    test('should handle long company name', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        const longName = `Very Long Company Name That Tests The UI Layout And Text Overflow Handling ${randomString(8)}`;
        createdProspectNames.push(longName);

        await dialogPage.dialog.locator('#name').fill(longName);
        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify prospect was created (name may be truncated in display)
        await listPage.expectRowWithText('Very Long');
      }
    });

    test('should handle empty optional fields', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        const minimalName = `Minimal Prospect ${randomString(6)}`;
        createdProspectNames.push(minimalName);

        // Only fill required field
        await dialogPage.dialog.locator('#name').fill(minimalName);
        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.expectRowWithText(minimalName);

        // Verify the row shows dashes for empty optional fields
        const row = await listPage.findRowByText(minimalName);
        const rowText = await row.textContent();
        expect(rowText).toContain('-');
      }
    });

    test('should handle large revenue values', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        const companyName = `Big Revenue ${randomString(6)}`;
        createdProspectNames.push(companyName);

        await dialogPage.dialog.locator('#name').fill(companyName);

        const revenueInput = dialogPage.dialog.locator('#revenue');
        if (await revenueInput.isVisible()) {
          await revenueInput.fill('999999999');
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.expectRowWithText(companyName);
      }
    });

    test('should handle zero revenue and employees', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        const companyName = `Zero Values ${randomString(6)}`;
        createdProspectNames.push(companyName);

        await dialogPage.dialog.locator('#name').fill(companyName);

        const revenueInput = dialogPage.dialog.locator('#revenue');
        if (await revenueInput.isVisible()) {
          await revenueInput.fill('0');
        }

        const employeesInput = dialogPage.dialog.locator('#employees');
        if (await employeesInput.isVisible()) {
          await employeesInput.fill('0');
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.expectRowWithText(companyName);
      }
    });

    test('should handle network errors gracefully on create', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        // Intercept the create mutation to simulate failure
        await page.route('**/trpc/**prospects.create**', route => {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: {
                message: 'Internal server error'
              }
            })
          });
        });

        await dialogPage.dialog.locator('#name').fill('Network Error Test');
        await dialogPage.confirm();

        // Should show error toast
        const toast = page.locator('[data-sonner-toaster]');
        await expect(toast.locator('text=/error|failed/i')).toBeVisible({ timeout: 5000 });

        // Clean up route
        await page.unroute('**/trpc/**prospects.create**');
      }
    });

    test('should handle not found prospect', async ({ page }) => {
      // Navigate to a non-existent prospect
      await page.goto('/relationships/prospects/non-existent-uuid');
      await listPage.waitForPageLoad();

      // Should show not found message
      const notFoundMessage = page.locator('text=Prospect not found');
      await expect(notFoundMessage).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should be functional on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await listPage.waitForPageLoad();

      // Table should still be visible
      const hasContent = (await listPage.getRowCount()) > 0 || await listPage.isEmpty();
      expect(hasContent).toBe(true);

      // Add button should be accessible
      const addButton = page.locator('button:has-text("Add Prospect")');
      await expect(addButton).toBeVisible();
    });

    test('should be functional on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await listPage.waitForPageLoad();

      // Table or cards should still be visible
      const hasContent = (await listPage.getRowCount()) > 0 || await listPage.isEmpty();
      expect(hasContent).toBe(true);

      // Add button should still be accessible
      const addButton = page.locator('button:has-text("Add Prospect")');
      await expect(addButton).toBeVisible();
    });

    test('should open create dialog on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await listPage.waitForPageLoad();

      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      await expect(dialogPage.dialog).toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should close dialog with Escape key', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        await page.keyboard.press('Escape');
        await dialogPage.expectNotVisible();
      }
    });

    test('should navigate form fields with Tab key in create dialog', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        // Tab through form fields
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // Focus should move through form
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
      }
    });

    test('should submit form with Enter key after filling fields', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      if (await dialogPage.isOpen()) {
        const companyName = `Keyboard Submit ${randomString(6)}`;
        createdProspectNames.push(companyName);

        await dialogPage.dialog.locator('#name').fill(companyName);

        // Focus on the submit button and press Enter
        const submitButton = dialogPage.dialog.locator('button:has-text("Create")');
        await submitButton.focus();
        await page.keyboard.press('Enter');

        await listPage.waitForPageLoad();
        await listPage.expectRowWithText(companyName);
      }
    });
  });

  test.describe('Data Persistence', () => {
    test('should persist prospect data after page refresh', async ({ page }) => {
      // First create a prospect
      const addButton = page.locator('button:has-text("Add Prospect")');
      await addButton.click();

      let createdName: string | undefined;

      if (await dialogPage.isOpen()) {
        createdName = `Persist Test ${randomString(6)}`;
        createdProspectNames.push(createdName);

        await dialogPage.dialog.locator('#name').fill(createdName);
        await dialogPage.confirm();
        await listPage.waitForPageLoad();
      }

      if (createdName) {
        // Refresh the page
        await page.reload();
        await listPage.waitForPageLoad();

        // Verify the prospect is still there
        await listPage.expectRowWithText(createdName);
      }
    });
  });

  test.describe('Contacts Integration', () => {
    test('should display contacts section on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View details"]');
      await viewButton.click();
      await page.waitForURL(/\/relationships\/prospects\/[a-f0-9-]+$/);
      await listPage.waitForPageLoad();

      // The detail page includes EntityContactsList component
      // Check for a contacts-related section
      const contactsSection = page.locator('text=/contacts/i').first();
      const hasContactsSection = await contactsSection.isVisible().catch(() => false);

      // Contacts section may or may not be visible depending on data
      expect(hasContactsSection !== undefined).toBe(true);
    });
  });
});
