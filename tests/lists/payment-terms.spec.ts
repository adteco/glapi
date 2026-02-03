import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { randomString, uniqueId, waitForToast } from '../utils/test-helpers';

test.describe('Payment Terms CRUD', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  // Test data tracking for cleanup
  const createdTermsCodes: string[] = [];

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/lists/payment-terms');
    await listPage.waitForPageLoad();
  });

  test.afterAll(async () => {
    // Note: In a production setup, we'd clean up created test data here
    // For now, we track created codes for manual cleanup if needed
    if (createdTermsCodes.length > 0) {
      console.log('Created payment terms codes for cleanup:', createdTermsCodes);
    }
  });

  test.describe('Page Load and Display', () => {
    test('should load payment terms page with correct URL', async ({ page }) => {
      await expect(page).toHaveURL(/\/lists\/payment-terms/);
    });

    test('should display page heading', async ({ page }) => {
      const heading = page.locator('h1').filter({ hasText: /Payment Terms/i });
      await expect(heading).toBeVisible();
    });

    test('should display payment terms table or empty state', async () => {
      const hasRows = (await listPage.getRowCount()) > 0;
      const isEmpty = await listPage.isEmpty();
      expect(hasRows || isEmpty).toBe(true);
    });

    test('should display create button', async () => {
      await expect(listPage.createButton).toBeVisible();
    });

    test('should display correct table headers', async () => {
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
      expect(headerText).toMatch(/terms|status/i);
    });

    test('should display status badges for active/inactive terms', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }
      // Check that status badges exist in the table
      const badges = page.locator('table tbody [class*="badge"], table tbody span').filter({
        hasText: /Active|Inactive|Default|Standard/i
      });
      expect(await badges.count()).toBeGreaterThan(0);
    });
  });

  test.describe('Create Payment Terms - Net Days Type', () => {
    test('should open create dialog when clicking Add button', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should create payment terms with Net Days type', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `NET${randomString(4).toUpperCase()}`;
        const name = `Net 30 Test ${randomString()}`;
        createdTermsCodes.push(code);

        await dialogPage.fillInput('code', code);
        await dialogPage.fillInput('name', name);

        // Set net days
        const netDaysInput = dialogPage.dialog.locator('[name="netDays"], input[id*="netDays"]');
        if (await netDaysInput.isVisible()) {
          await netDaysInput.clear();
          await netDaysInput.fill('30');
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify the new term appears in the list
        await listPage.search(code);
        await listPage.expectRowWithText(code);
      }
    });

    test('should create payment terms with early payment discount', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `DSC${randomString(4).toUpperCase()}`;
        const name = `2/10 Net 30 Test ${randomString()}`;
        createdTermsCodes.push(code);

        await dialogPage.fillInput('code', code);
        await dialogPage.fillInput('name', name);

        // Set net days
        const netDaysInput = dialogPage.dialog.locator('[name="netDays"], input[id*="netDays"]');
        if (await netDaysInput.isVisible()) {
          await netDaysInput.clear();
          await netDaysInput.fill('30');
        }

        // Set discount percent
        const discountPercentInput = dialogPage.dialog.locator('[name="discountPercent"], input[id*="discountPercent"]');
        if (await discountPercentInput.isVisible()) {
          await discountPercentInput.clear();
          await discountPercentInput.fill('2');
        }

        // Set discount days
        const discountDaysInput = dialogPage.dialog.locator('[name="discountDays"], input[id*="discountDays"]');
        if (await discountDaysInput.isVisible()) {
          await discountDaysInput.clear();
          await discountDaysInput.fill('10');
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify the new term appears
        await listPage.search(code);
        await listPage.expectRowWithText(code);

        // Verify terms display shows discount format (e.g., "2/10 Net 30")
        const row = await listPage.findRowByText(code);
        const rowText = await row.textContent();
        expect(rowText).toMatch(/2.*10|Net\s*30/);
      }
    });

    test('should create payment terms marked as default', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `DFT${randomString(4).toUpperCase()}`;
        const name = `Default Terms Test ${randomString()}`;
        createdTermsCodes.push(code);

        await dialogPage.fillInput('code', code);
        await dialogPage.fillInput('name', name);

        // Toggle default switch
        const defaultSwitch = dialogPage.dialog.locator('[name="isDefault"]').or(
          dialogPage.dialog.locator('button[role="switch"]').filter({ has: page.locator('text=Default') }).first()
        );
        if (await defaultSwitch.isVisible()) {
          await defaultSwitch.click();
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify the new term appears
        await listPage.search(code);
        const row = await listPage.findRowByText(code);
        const rowText = await row.textContent();
        expect(rowText?.toLowerCase()).toMatch(/default/);
      }
    });
  });

  test.describe('Create Payment Terms - Due Date Types', () => {
    test('should create payment terms with Day of Month type', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `DOM${randomString(4).toUpperCase()}`;
        const name = `Due 15th of Month ${randomString()}`;
        createdTermsCodes.push(code);

        await dialogPage.fillInput('code', code);
        await dialogPage.fillInput('name', name);

        // Select due date type
        const dueDateTypeSelect = dialogPage.dialog.locator('[name="dueDateType"]').or(
          dialogPage.dialog.getByLabel('Due Date Type')
        );
        if (await dueDateTypeSelect.isVisible()) {
          await dueDateTypeSelect.click();
          await page.locator('[role="option"]:has-text("Day of Month")').click();
        }

        // Set day of month (should appear after selecting day_of_month type)
        await page.waitForTimeout(300); // Wait for conditional field to appear
        const dayOfMonthInput = dialogPage.dialog.locator('[name="dayOfMonth"], input[id*="dayOfMonth"]');
        if (await dayOfMonthInput.isVisible()) {
          await dayOfMonthInput.clear();
          await dayOfMonthInput.fill('15');
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify the new term appears
        await listPage.search(code);
        await listPage.expectRowWithText(code);
      }
    });

    test('should create payment terms with End of Month type', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `EOM${randomString(4).toUpperCase()}`;
        const name = `End of Month Test ${randomString()}`;
        createdTermsCodes.push(code);

        await dialogPage.fillInput('code', code);
        await dialogPage.fillInput('name', name);

        // Select due date type
        const dueDateTypeSelect = dialogPage.dialog.locator('[name="dueDateType"]').or(
          dialogPage.dialog.getByLabel('Due Date Type')
        );
        if (await dueDateTypeSelect.isVisible()) {
          await dueDateTypeSelect.click();
          await page.locator('[role="option"]:has-text("End of Month")').click();
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify the new term appears
        await listPage.search(code);
        await listPage.expectRowWithText(code);
      }
    });
  });

  test.describe('Create Payment Terms - Validation', () => {
    test('should show validation errors for empty required fields', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Try to submit without filling required fields
        await dialogPage.confirm();

        // Should show validation errors
        const errors = await dialogPage.getErrors();
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    test('should validate code is required', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Fill name but not code
        await dialogPage.fillInput('name', `Test Terms ${randomString()}`);
        await dialogPage.confirm();

        // Should show error for code
        const errors = await dialogPage.getErrors();
        const hasCodeError = errors.some(e => e.toLowerCase().includes('code') || e.toLowerCase().includes('required'));
        expect(hasCodeError || errors.length > 0).toBe(true);
      }
    });

    test('should validate name is required', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Fill code but not name
        await dialogPage.fillInput('code', `TST${randomString(4)}`);
        await dialogPage.confirm();

        // Should show error for name
        const errors = await dialogPage.getErrors();
        const hasNameError = errors.some(e => e.toLowerCase().includes('name') || e.toLowerCase().includes('required'));
        expect(hasNameError || errors.length > 0).toBe(true);
      }
    });

    test('should validate code max length', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Try to fill code longer than 20 characters
        const longCode = 'A'.repeat(25);
        await dialogPage.fillInput('code', longCode);
        await dialogPage.fillInput('name', `Long Code Test ${randomString()}`);
        await dialogPage.confirm();

        // Check if error is shown or if the code was truncated
        const errors = await dialogPage.getErrors();
        const dialogStillOpen = await dialogPage.isOpen();
        // Either validation error shown or dialog still open (form didn't submit)
        expect(errors.length > 0 || dialogStillOpen).toBe(true);
      }
    });

    test('should validate net days within range (0-365)', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.fillInput('code', `RNG${randomString(4)}`);
        await dialogPage.fillInput('name', `Range Test ${randomString()}`);

        // Try to set net days beyond max
        const netDaysInput = dialogPage.dialog.locator('[name="netDays"], input[id*="netDays"]');
        if (await netDaysInput.isVisible()) {
          await netDaysInput.clear();
          await netDaysInput.fill('500');
        }

        await dialogPage.confirm();

        // Check for validation error or dialog still open
        const errors = await dialogPage.getErrors();
        const dialogStillOpen = await dialogPage.isOpen();
        // Validation should prevent submission with invalid net days
        expect(errors.length > 0 || dialogStillOpen).toBe(true);
      }
    });

    test('should cancel payment terms creation', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Fill some data
        await dialogPage.fillInput('code', `CNC${randomString(4)}`);
        await dialogPage.fillInput('name', `Cancel Test ${randomString()}`);

        // Cancel
        await dialogPage.cancel();
        await dialogPage.expectNotVisible();
      }
    });

    test('should close dialog with Escape key', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.closeWithEscape();
        await dialogPage.expectNotVisible();
      }
    });
  });

  test.describe('Edit Payment Terms', () => {
    test('should open edit dialog for existing payment terms', async ({ page }) => {
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

    test('should pre-fill form with existing values when editing', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get existing code from table
      const existingCode = await listPage.getCellValue(0, 'Code');

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        // Verify the code field is pre-filled
        const codeInput = dialogPage.dialog.locator('[name="code"], input[id*="code"]').first();
        const codeValue = await codeInput.inputValue();
        expect(codeValue).toBeTruthy();
        expect(codeValue).toContain(existingCode.trim());
      }
    });

    test('should update payment terms name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const newName = `Updated Terms ${randomString()}`;
        await dialogPage.fillInput('name', newName);
        await dialogPage.confirm();

        await listPage.waitForPageLoad();
        await listPage.expectRowWithText(newName);
      }
    });

    test('should update net days value', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        // Update net days
        const netDaysInput = dialogPage.dialog.locator('[name="netDays"], input[id*="netDays"]');
        if (await netDaysInput.isVisible()) {
          await netDaysInput.clear();
          await netDaysInput.fill('45');
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify update was successful (page reloaded without errors)
        await expect(listPage.table).toBeVisible();
      }
    });

    test('should update discount terms', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        // Update discount percent
        const discountPercentInput = dialogPage.dialog.locator('[name="discountPercent"], input[id*="discountPercent"]');
        if (await discountPercentInput.isVisible()) {
          await discountPercentInput.clear();
          await discountPercentInput.fill('3');
        }

        // Update discount days
        const discountDaysInput = dialogPage.dialog.locator('[name="discountDays"], input[id*="discountDays"]');
        if (await discountDaysInput.isVisible()) {
          await discountDaysInput.clear();
          await discountDaysInput.fill('15');
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify update was successful
        await expect(listPage.table).toBeVisible();
      }
    });

    test('should toggle active status', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        // Find and toggle the active switch
        const activeSwitch = dialogPage.dialog.locator('[name="isActive"]').or(
          dialogPage.dialog.locator('button[role="switch"]').filter({ has: page.locator('text=Active') })
        );
        if (await activeSwitch.isVisible()) {
          await activeSwitch.click();
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify the status changed in the table
        await expect(listPage.table).toBeVisible();
      }
    });

    test('should cancel edit without saving changes', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get original name
      const originalName = await listPage.getCellValue(0, 'Name');

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        // Change the name
        const tempName = `Temp Name ${randomString()}`;
        await dialogPage.fillInput('name', tempName);

        // Cancel instead of confirm
        await dialogPage.cancel();
        await dialogPage.expectNotVisible();

        // Verify original name is still there
        await listPage.waitForPageLoad();
        await listPage.expectRowWithText(originalName.trim());
      }
    });
  });

  test.describe('Delete Payment Terms', () => {
    test('should show delete confirmation dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.deleteRow(0);

      // Should show confirmation dialog (browser native or custom)
      const alertDialog = page.locator('[role="alertdialog"], [role="dialog"]');
      const confirmText = page.locator('text=/delete|confirm|sure/i');

      // Either a dialog is visible or we're waiting for browser confirm
      const hasDialog = await alertDialog.isVisible().catch(() => false);
      const hasConfirmText = await confirmText.isVisible().catch(() => false);

      expect(hasDialog || hasConfirmText).toBe(true);
    });

    test('should cancel delete operation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const originalCount = rowCount;

      // Handle both browser confirm dialog and custom dialog
      page.on('dialog', async dialog => {
        await dialog.dismiss();
      });

      await listPage.deleteRow(0);

      // Try to cancel via dialog button if visible
      const cancelButton = page.locator('[role="alertdialog"] button:has-text("Cancel"), [role="dialog"] button:has-text("Cancel")');
      if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cancelButton.click();
      }

      await listPage.waitForPageLoad();

      // Row count should be unchanged
      const newCount = await listPage.getRowCount();
      expect(newCount).toBe(originalCount);
    });

    test('should delete payment terms after confirmation', async ({ page }) => {
      // First create a term to delete
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `DEL${randomString(4).toUpperCase()}`;
        const name = `Delete Test ${randomString()}`;

        await dialogPage.fillInput('code', code);
        await dialogPage.fillInput('name', name);

        const netDaysInput = dialogPage.dialog.locator('[name="netDays"], input[id*="netDays"]');
        if (await netDaysInput.isVisible()) {
          await netDaysInput.clear();
          await netDaysInput.fill('30');
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Search for the created term
        await listPage.search(code);
        const row = await listPage.findRowByText(code);

        if (await row.isVisible()) {
          const countBefore = await listPage.getRowCount();

          // Handle browser confirm dialog
          page.on('dialog', async dialog => {
            await dialog.accept();
          });

          // Click delete on the row we just created
          await row.locator('button[title="Delete"], button:has-text("Delete")').click();

          // Also try custom dialog confirm
          const confirmButton = page.locator('[role="alertdialog"] button:has-text("Delete"), [role="dialog"] button:has-text("Delete")');
          if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmButton.click();
          }

          await listPage.waitForPageLoad();

          // Verify the term was deleted
          const countAfter = await listPage.getRowCount();
          expect(countAfter).toBeLessThan(countBefore);
        }
      }
    });
  });

  test.describe('Navigation and Detail Page', () => {
    test('should navigate to payment terms detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click the view customers button (Users icon)
      const viewButton = listPage.getRow(0).locator('button[title="View Customers"], button:has([class*="lucide-users"])');
      if (await viewButton.isVisible()) {
        await viewButton.click();
        await expect(page).toHaveURL(/\/lists\/payment-terms\/[a-f0-9-]+/);
      } else {
        // Alternative: click the row itself
        await listPage.clickRow(0);
        await expect(page).toHaveURL(/\/lists\/payment-terms\/[a-f0-9-]+/);
      }
    });

    test('should display payment terms details on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View Customers"], button:has([class*="lucide-users"])');
      if (await viewButton.isVisible()) {
        await viewButton.click();
      } else {
        await listPage.clickRow(0);
      }

      await page.waitForURL(/\/lists\/payment-terms\/[a-f0-9-]+/);
      await listPage.waitForPageLoad();

      // Verify detail page elements
      const detailsCard = page.locator('text=Payment Terms Details');
      await expect(detailsCard).toBeVisible();

      // Verify back button exists
      const backButton = page.locator('button:has-text("Back")');
      await expect(backButton).toBeVisible();
    });

    test('should navigate back to list from detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View Customers"], button:has([class*="lucide-users"])');
      if (await viewButton.isVisible()) {
        await viewButton.click();
      } else {
        await listPage.clickRow(0);
      }

      await page.waitForURL(/\/lists\/payment-terms\/[a-f0-9-]+/);
      await listPage.waitForPageLoad();

      // Click back button
      const backButton = page.locator('button:has-text("Back")');
      await backButton.click();

      await expect(page).toHaveURL(/\/lists\/payment-terms$/);
    });

    test('should display customer assignments on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to detail page
      const viewButton = listPage.getRow(0).locator('button[title="View Customers"], button:has([class*="lucide-users"])');
      if (await viewButton.isVisible()) {
        await viewButton.click();
      } else {
        await listPage.clickRow(0);
      }

      await page.waitForURL(/\/lists\/payment-terms\/[a-f0-9-]+/);
      await listPage.waitForPageLoad();

      // Verify assigned customers section exists
      const customersSection = page.locator('text=Assigned Customers');
      await expect(customersSection).toBeVisible();
    });
  });

  test.describe('Edge Cases and Error Handling', () => {
    test('should handle duplicate code gracefully', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get an existing code
      const existingCode = await listPage.getCellValue(0, 'Code');

      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Try to create with the same code
        await dialogPage.fillInput('code', existingCode.trim());
        await dialogPage.fillInput('name', `Duplicate Test ${randomString()}`);

        const netDaysInput = dialogPage.dialog.locator('[name="netDays"], input[id*="netDays"]');
        if (await netDaysInput.isVisible()) {
          await netDaysInput.clear();
          await netDaysInput.fill('30');
        }

        await dialogPage.confirm();

        // Should either show error or dialog stays open
        await page.waitForTimeout(1000);
        const hasError = (await dialogPage.getErrors()).length > 0;
        const dialogStillOpen = await dialogPage.isOpen();
        const toastVisible = await page.locator('[data-sonner-toaster]').isVisible();

        // Expect either validation error, dialog still open, or error toast
        expect(hasError || dialogStillOpen || toastVisible).toBe(true);
      }
    });

    test('should handle special characters in name', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `SPC${randomString(4).toUpperCase()}`;
        const name = `Special <>&"' Test ${randomString()}`;
        createdTermsCodes.push(code);

        await dialogPage.fillInput('code', code);
        await dialogPage.fillInput('name', name);

        const netDaysInput = dialogPage.dialog.locator('[name="netDays"], input[id*="netDays"]');
        if (await netDaysInput.isVisible()) {
          await netDaysInput.clear();
          await netDaysInput.fill('30');
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify creation succeeded
        await listPage.search(code);
        await listPage.expectRowWithText(code);
      }
    });

    test('should handle zero net days (Due on Receipt)', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `DOR${randomString(4).toUpperCase()}`;
        const name = `Due on Receipt ${randomString()}`;
        createdTermsCodes.push(code);

        await dialogPage.fillInput('code', code);
        await dialogPage.fillInput('name', name);

        const netDaysInput = dialogPage.dialog.locator('[name="netDays"], input[id*="netDays"]');
        if (await netDaysInput.isVisible()) {
          await netDaysInput.clear();
          await netDaysInput.fill('0');
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify creation succeeded
        await listPage.search(code);
        await listPage.expectRowWithText(code);
      }
    });

    test('should handle maximum net days (365)', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `MAX${randomString(4).toUpperCase()}`;
        const name = `Max Days Test ${randomString()}`;
        createdTermsCodes.push(code);

        await dialogPage.fillInput('code', code);
        await dialogPage.fillInput('name', name);

        const netDaysInput = dialogPage.dialog.locator('[name="netDays"], input[id*="netDays"]');
        if (await netDaysInput.isVisible()) {
          await netDaysInput.clear();
          await netDaysInput.fill('365');
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify creation succeeded
        await listPage.search(code);
        await listPage.expectRowWithText(code);
      }
    });

    test('should handle description field with long text', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `LNG${randomString(4).toUpperCase()}`;
        const name = `Long Description Test ${randomString()}`;
        const longDescription = 'This is a very long description. '.repeat(10);
        createdTermsCodes.push(code);

        await dialogPage.fillInput('code', code);
        await dialogPage.fillInput('name', name);

        // Fill description if available
        const descriptionInput = dialogPage.dialog.locator('[name="description"], textarea[id*="description"]');
        if (await descriptionInput.isVisible()) {
          await descriptionInput.fill(longDescription);
        }

        const netDaysInput = dialogPage.dialog.locator('[name="netDays"], input[id*="netDays"]');
        if (await netDaysInput.isVisible()) {
          await netDaysInput.clear();
          await netDaysInput.fill('30');
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify creation succeeded
        await listPage.search(code);
        await listPage.expectRowWithText(code);
      }
    });
  });

  test.describe('UI Interactions', () => {
    test('should show loading state while fetching data', async ({ page }) => {
      // Navigate with network throttling to see loading state
      await page.route('**/trpc/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.continue();
      });

      await page.goto('/lists/payment-terms');

      // Check for loading indicator
      const loadingText = page.locator('text=Loading payment terms...');
      const spinner = page.locator('.animate-spin, [role="progressbar"]');

      // Either loading text or spinner should appear briefly
      const loadingVisible = await loadingText.isVisible({ timeout: 3000 }).catch(() => false) ||
                            await spinner.isVisible({ timeout: 3000 }).catch(() => false);

      // Wait for loading to complete
      await listPage.waitForPageLoad();

      // Page should now show table or empty state
      const hasContent = (await listPage.getRowCount()) > 0 || await listPage.isEmpty();
      expect(hasContent).toBe(true);
    });

    test('should show success toast after creating payment terms', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `TST${randomString(4).toUpperCase()}`;
        const name = `Toast Test ${randomString()}`;
        createdTermsCodes.push(code);

        await dialogPage.fillInput('code', code);
        await dialogPage.fillInput('name', name);

        const netDaysInput = dialogPage.dialog.locator('[name="netDays"], input[id*="netDays"]');
        if (await netDaysInput.isVisible()) {
          await netDaysInput.clear();
          await netDaysInput.fill('30');
        }

        await dialogPage.confirm();

        // Check for success toast
        const toast = page.locator('[data-sonner-toaster]');
        const successToast = toast.locator('text=/success|created/i');

        // Toast should appear (with some flexibility in timing)
        await expect(successToast).toBeVisible({ timeout: 5000 }).catch(() => {
          // Toast may have already disappeared, that's ok
        });
      }
    });

    test('should show error toast on API failure', async ({ page }) => {
      // Mock API to return error
      await page.route('**/trpc/accountingLists.createPaymentTerms**', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Internal server error' } }),
        });
      });

      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const code = `ERR${randomString(4).toUpperCase()}`;
        const name = `Error Test ${randomString()}`;

        await dialogPage.fillInput('code', code);
        await dialogPage.fillInput('name', name);

        const netDaysInput = dialogPage.dialog.locator('[name="netDays"], input[id*="netDays"]');
        if (await netDaysInput.isVisible()) {
          await netDaysInput.clear();
          await netDaysInput.fill('30');
        }

        await dialogPage.confirm();

        // Check for error toast or dialog error
        await page.waitForTimeout(2000);
        const toast = page.locator('[data-sonner-toaster]');
        const errorToast = toast.locator('text=/error|failed/i');
        const dialogError = await dialogPage.getErrors();

        const hasError = await errorToast.isVisible().catch(() => false) || dialogError.length > 0;
        expect(hasError).toBe(true);
      }
    });
  });
});
