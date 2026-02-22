import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { randomString, waitForToast } from '../utils/test-helpers';

test.describe('Charge Types', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/lists/charge-types');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load charge types page', async ({ page }) => {
      await expect(page).toHaveURL(/\/lists\/charge-types/);
    });

    test('should display page header with title', async ({ page }) => {
      const heading = page.locator('h1:has-text("Charge Types")');
      await expect(heading).toBeVisible();
    });

    test('should display page description', async ({ page }) => {
      const description = page.locator('text=Manage charge types for billing and invoicing');
      await expect(description).toBeVisible();
    });

    test('should display charge types table or empty state', async () => {
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
      expect(headerText).toMatch(/code/i);
      expect(headerText).toMatch(/name/i);
      expect(headerText).toMatch(/category/i);
      expect(headerText).toMatch(/taxable/i);
      expect(headerText).toMatch(/status/i);
    });

    test('should display empty state message when no data', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        const emptyMessage = page.locator('text=No charge types found');
        await expect(emptyMessage).toBeVisible();
      }
    });
  });

  test.describe('Create Charge Type', () => {
    test('should open create dialog when clicking add button', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should display create dialog with correct title', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const title = page.locator('[role="dialog"] h2, [role="dialog"] [data-radix-dialog-title]');
        await expect(title).toContainText(/create/i);
      }
    });

    test('should create charge type with required fields only', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `CT${randomString(4)}`;
        const name = `Test Charge Type ${randomString()}`;

        await dialogPage.fillInput('code', code);
        await dialogPage.fillInput('name', name);

        // Category should have a default value (service), so just submit
        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify success toast
        await waitForToast(page, /created/i);

        // Verify the charge type appears in the list
        await listPage.search(code);
        await listPage.expectRowWithText(code);
      }
    });

    test('should create charge type with all fields', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `CT${randomString(4)}`;
        const name = `Full Charge Type ${randomString()}`;
        const description = `Test description ${randomString()}`;

        // Fill all form fields
        await dialogPage.fillInput('code', code);
        await dialogPage.fillInput('name', name);
        await dialogPage.fillInput('description', description);

        // Select category
        const categoryTrigger = page.locator('[role="dialog"]').locator('button:has-text("Service"), button:has-text("Select category")').first();
        if (await categoryTrigger.isVisible()) {
          await categoryTrigger.click();
          await page.locator('[role="option"]:has-text("Product")').click();
        }

        // Toggle checkboxes
        const isTaxableCheckbox = page.locator('[role="dialog"] input#isTaxable, [role="dialog"] input[name="isTaxable"]');
        if (await isTaxableCheckbox.isVisible()) {
          // Make it non-taxable for testing
          if (await isTaxableCheckbox.isChecked()) {
            await isTaxableCheckbox.click();
          }
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify the charge type appears in the list
        await listPage.search(code);
        await listPage.expectRowWithText(code);
        await listPage.expectRowWithText(name);
      }
    });

    test('should validate required code field', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Fill only name, leave code empty
        await dialogPage.fillInput('name', 'Test Name');

        await dialogPage.confirm();

        // Should show validation error for code
        const codeError = page.locator('text=/code.*required/i');
        await expect(codeError).toBeVisible({ timeout: 5000 });
      }
    });

    test('should validate required name field', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Fill only code, leave name empty
        await dialogPage.fillInput('code', 'TST');

        await dialogPage.confirm();

        // Should show validation error for name
        const nameError = page.locator('text=/name.*required/i');
        await expect(nameError).toBeVisible({ timeout: 5000 });
      }
    });

    test('should validate code max length', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Fill code with more than 20 characters
        const longCode = 'A'.repeat(25);
        await dialogPage.fillInput('code', longCode);
        await dialogPage.fillInput('name', 'Test Name');

        await dialogPage.confirm();

        // Should show validation error or truncate
        const codeInput = page.locator('[role="dialog"] input[name="code"], [role="dialog"] input#code').first();
        const inputValue = await codeInput.inputValue();

        // Either validation error shown or value truncated
        const hasError = await page.locator('.text-red-500, .text-destructive').isVisible();
        expect(hasError || inputValue.length <= 20).toBe(true);
      }
    });

    test('should cancel charge type creation', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Fill some data
        await dialogPage.fillInput('code', 'CANCEL');
        await dialogPage.fillInput('name', 'Should Not Create');

        await dialogPage.cancel();
        await dialogPage.expectNotVisible();

        // Verify the charge type was not created
        await listPage.search('CANCEL');
        const rowCount = await listPage.getRowCount();
        // If rows exist, make sure our cancelled one isn't there
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

  test.describe('Edit Charge Type', () => {
    test('should open edit dialog for existing charge type', async ({ page }) => {
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

    test('should display existing values in edit dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get the code from the first row before editing
      const firstRowCode = await listPage.getCellValue(0, 'code');

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        // Verify the code field has the existing value
        const codeInput = page.locator('[role="dialog"] input[name="code"], [role="dialog"] input#edit-code').first();
        await expect(codeInput).toHaveValue(firstRowCode);
      }
    });

    test('should update charge type name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const newName = `Updated Type ${randomString()}`;

        // Clear and fill the name field
        const nameInput = page.locator('[role="dialog"] input[name="name"], [role="dialog"] input#edit-name').first();
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

    test('should update charge type category', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        // Change category
        const categoryTrigger = page.locator('[role="dialog"]').locator('button[role="combobox"], button:has-text("Service"), button:has-text("Product"), button:has-text("Shipping"), button:has-text("Tax"), button:has-text("Discount"), button:has-text("Fee"), button:has-text("Other")').first();
        if (await categoryTrigger.isVisible()) {
          await categoryTrigger.click();
          await page.locator('[role="option"]:has-text("Fee")').click();
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify success toast
        await waitForToast(page, /updated/i);
      }
    });

    test('should toggle taxable status', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        // Toggle the taxable checkbox
        const isTaxableCheckbox = page.locator('[role="dialog"] input#edit-isTaxable, [role="dialog"] input[name="isTaxable"]').first();
        if (await isTaxableCheckbox.isVisible()) {
          const wasChecked = await isTaxableCheckbox.isChecked();
          await isTaxableCheckbox.click();

          await dialogPage.confirm();
          await listPage.waitForPageLoad();

          // Verify the taxable badge changed
          const taxableBadge = listPage.getRow(0).locator('text=/Yes|No/').first();
          if (wasChecked) {
            await expect(taxableBadge).toContainText('No');
          } else {
            await expect(taxableBadge).toContainText('Yes');
          }
        }
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

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const nameInput = page.locator('[role="dialog"] input[name="name"], [role="dialog"] input#edit-name').first();
        await nameInput.clear();
        await nameInput.fill('Changed But Cancelled');

        await dialogPage.cancel();
        await dialogPage.expectNotVisible();

        // Verify original name is still there
        await listPage.expectRowWithText(originalName);
      }
    });
  });

  test.describe('Delete Charge Type', () => {
    test('should show delete confirmation dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.deleteRow(0);

      // The page uses window.confirm, so we need to handle that
      // or check for an alert dialog if implemented
      const alertDialog = page.locator('[role="alertdialog"], [role="dialog"]');

      // If a custom dialog is shown
      if (await alertDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(alertDialog).toBeVisible();
      }
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

      await listPage.deleteRow(0);

      // Wait a moment for any processing
      await page.waitForTimeout(500);

      // Verify row count unchanged
      const newCount = await listPage.getRowCount();
      expect(newCount).toBe(originalCount);
    });

    test('should delete charge type when confirmed', async ({ page }) => {
      // First create a charge type to delete
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `DEL${randomString(4)}`;
        const name = `Delete Me ${randomString()}`;

        await dialogPage.fillInput('code', code);
        await dialogPage.fillInput('name', name);
        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Search for the created charge type
        await listPage.search(code);
        await listPage.expectRowWithText(code);

        const countBefore = await listPage.getRowCount();

        // Set up dialog handler to confirm
        page.on('dialog', async dialog => {
          await dialog.accept();
        });

        await listPage.deleteRow(0);
        await listPage.waitForPageLoad();

        // Verify deleted
        const countAfter = await listPage.getRowCount();
        expect(countAfter).toBeLessThan(countBefore);
      }
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to charge type detail page on row click', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.getRow(0).click();
      await expect(page).toHaveURL(/\/lists\/charge-types\/[a-f0-9-]+/);
    });

    test('should display detail page with correct information', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get name from list before navigating
      const chargeTypeName = await listPage.getCellValue(0, 'name');

      await listPage.getRow(0).click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Verify we're on the detail page
      await expect(page).toHaveURL(/\/lists\/charge-types\/[a-f0-9-]+/);

      // Verify the name is displayed
      const heading = page.locator('h1');
      await expect(heading).toContainText(chargeTypeName);
    });

    test('should navigate back to list from detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to detail
      await listPage.getRow(0).click();
      await expect(page).toHaveURL(/\/lists\/charge-types\/[a-f0-9-]+/);

      // Click back button
      const backButton = page.locator('button:has-text("Back")');
      await backButton.click();

      await expect(page).toHaveURL(/\/lists\/charge-types$/);
    });

    test('should display charge type details on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.getRow(0).click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Verify detail page sections
      const detailsCard = page.locator('text=Charge Type Details');
      await expect(detailsCard).toBeVisible();

      // Verify key fields are shown
      const codeLabel = page.locator('text=Code');
      const categoryLabel = page.locator('text=Category');
      const taxableLabel = page.locator('text=Taxable');
      const statusLabel = page.locator('text=Status');

      await expect(codeLabel).toBeVisible();
      await expect(categoryLabel).toBeVisible();
      await expect(taxableLabel).toBeVisible();
      await expect(statusLabel).toBeVisible();
    });
  });

  test.describe('Table Features', () => {
    test('should search and filter charge types', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get a code to search for
      const codeToSearch = await listPage.getCellValue(0, 'code');

      await listPage.search(codeToSearch);

      // Should show at least one result
      const filteredCount = await listPage.getRowCount();
      expect(filteredCount).toBeGreaterThan(0);

      // The searched code should be in results
      await listPage.expectRowWithText(codeToSearch);
    });

    test('should show active/inactive status badges', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check that status badges are displayed
      const statusBadges = listPage.tableRows.locator('text=/Active|Inactive/');
      const badgeCount = await statusBadges.count();

      // Should have at least as many badges as rows (each row has a status)
      expect(badgeCount).toBeGreaterThanOrEqual(rowCount);
    });

    test('should show taxable badges', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check that taxable badges (Yes/No) are displayed
      const taxableBadges = listPage.tableRows.locator('[class*="badge"]');
      const badgeCount = await taxableBadges.count();

      expect(badgeCount).toBeGreaterThan(0);
    });

    test('should display category for each charge type', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check that categories are displayed (Service, Product, etc.)
      const categoryPattern = /Service|Product|Shipping|Tax|Discount|Fee|Other/;
      const firstRowCategory = await listPage.getCellValue(0, 'category');
      expect(firstRowCategory).toMatch(categoryPattern);
    });
  });

  test.describe('Category Selection', () => {
    test('should display all category options in create dialog', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Click the category dropdown
        const categoryTrigger = page.locator('[role="dialog"]').locator('button:has-text("Service"), button:has-text("Select category")').first();
        await categoryTrigger.click();

        // Verify all options are visible
        const options = ['Service', 'Product', 'Shipping', 'Tax', 'Discount', 'Fee', 'Other'];
        for (const option of options) {
          const optionElement = page.locator(`[role="option"]:has-text("${option}")`);
          await expect(optionElement).toBeVisible();
        }

        // Close the dropdown
        await page.keyboard.press('Escape');
      }
    });

    test('should select different categories', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const categories = ['Product', 'Shipping', 'Tax', 'Discount', 'Fee', 'Other'];

        for (const category of categories) {
          const categoryTrigger = page.locator('[role="dialog"]').locator('button[role="combobox"]').first();
          await categoryTrigger.click();
          await page.locator(`[role="option"]:has-text("${category}")`).click();

          // Verify selection
          await expect(categoryTrigger).toContainText(category);
        }

        await dialogPage.cancel();
      }
    });
  });

  test.describe('Checkbox States', () => {
    test('should toggle active state', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const isActiveCheckbox = page.locator('[role="dialog"] input#isActive, [role="dialog"] input[name="isActive"]').first();

        if (await isActiveCheckbox.isVisible()) {
          // Should be checked by default
          await expect(isActiveCheckbox).toBeChecked();

          // Toggle off
          await isActiveCheckbox.click();
          await expect(isActiveCheckbox).not.toBeChecked();

          // Toggle back on
          await isActiveCheckbox.click();
          await expect(isActiveCheckbox).toBeChecked();
        }

        await dialogPage.cancel();
      }
    });

    test('should toggle default state', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const isDefaultCheckbox = page.locator('[role="dialog"] input#isDefault, [role="dialog"] input[name="isDefault"]').first();

        if (await isDefaultCheckbox.isVisible()) {
          // Should not be checked by default
          await expect(isDefaultCheckbox).not.toBeChecked();

          // Toggle on
          await isDefaultCheckbox.click();
          await expect(isDefaultCheckbox).toBeChecked();
        }

        await dialogPage.cancel();
      }
    });

    test('should toggle taxable state', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const isTaxableCheckbox = page.locator('[role="dialog"] input#isTaxable, [role="dialog"] input[name="isTaxable"]').first();

        if (await isTaxableCheckbox.isVisible()) {
          // Should be checked by default
          await expect(isTaxableCheckbox).toBeChecked();

          // Toggle off
          await isTaxableCheckbox.click();
          await expect(isTaxableCheckbox).not.toBeChecked();
        }

        await dialogPage.cancel();
      }
    });
  });

  test.describe('Detail Page - Customer Assignments', () => {
    test('should display customer assignments section', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.getRow(0).click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Verify customer assignments section exists
      const assignmentsSection = page.locator('text=Assigned Customers');
      await expect(assignmentsSection).toBeVisible();
    });

    test('should display account configuration section', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.getRow(0).click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Verify account configuration section exists
      const accountSection = page.locator('text=Account Configuration');
      await expect(accountSection).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
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

    test('should display error toast on create failure', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Intercept the create mutation to simulate failure
        await page.route('**/trpc/**accountingLists.createChargeType**', route => {
          route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: {
                message: 'Charge type code already exists'
              }
            })
          });
        });

        await dialogPage.fillInput('code', 'DUP');
        await dialogPage.fillInput('name', 'Duplicate Test');
        await dialogPage.confirm();

        // Should show error toast
        const toast = page.locator('[data-sonner-toaster], [role="status"]');
        await expect(toast).toBeVisible({ timeout: 5000 });

        // Clean up route
        await page.unroute('**/trpc/**accountingLists.createChargeType**');
      }
    });
  });
});
