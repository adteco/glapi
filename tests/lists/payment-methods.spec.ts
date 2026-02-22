import { test, expect } from '@playwright/test';
import { ListPage } from '../pages';
import { randomString } from '../utils/test-helpers';

/**
 * E2E Tests for Payment Methods CRUD operations
 *
 * Tests cover:
 * - Page load and display
 * - Create payment method (dialog flow)
 * - Edit payment method
 * - Delete payment method
 * - Form validation
 * - Navigation and detail pages
 * - Method type selection
 * - Active/Default toggles
 */
test.describe('Payment Methods', () => {
  let listPage: ListPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    await page.goto('/lists/payment-methods');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load payment methods page', async ({ page }) => {
      await expect(page).toHaveURL(/\/lists\/payment-methods/);
    });

    test('should display page title', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /Payment Methods/i });
      await expect(heading).toBeVisible();
    });

    test('should display payment methods table or empty state', async ({ page }) => {
      const hasRows = (await listPage.getRowCount()) > 0;
      const emptyMessage = page.getByText(/No payment methods found/i);
      const isEmpty = await emptyMessage.isVisible().catch(() => false);
      expect(hasRows || isEmpty).toBe(true);
    });

    test('should display create button with correct text', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /Add Payment Method/i });
      await expect(addButton).toBeVisible();
    });

    test('should display correct table headers', async () => {
      const headers = await listPage.tableHeaders.allTextContents();
      const headerText = headers.join(' ').toLowerCase();
      expect(headerText).toMatch(/code/i);
      expect(headerText).toMatch(/name/i);
      expect(headerText).toMatch(/type/i);
      expect(headerText).toMatch(/status/i);
    });

    test('should display description in page header', async ({ page }) => {
      const description = page.getByText(/Manage payment methods for your organization/i);
      await expect(description).toBeVisible();
    });
  });

  test.describe('Create Payment Method', () => {
    test('should open create dialog when clicking Add button', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /Add Payment Method/i });
      await addButton.click();

      // Dialog should be visible
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Should have correct title
      const dialogTitle = dialog.getByText(/Create Payment Method/i);
      await expect(dialogTitle).toBeVisible();
    });

    test('should display all form fields in create dialog', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /Add Payment Method/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');

      // Check for required fields
      await expect(dialog.locator('label:has-text("Code")')).toBeVisible();
      await expect(dialog.locator('label:has-text("Name")')).toBeVisible();
      await expect(dialog.locator('label:has-text("Method Type")')).toBeVisible();
      await expect(dialog.locator('label:has-text("Description")')).toBeVisible();
    });

    test('should create payment method with required fields only', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /Add Payment Method/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');
      const code = `PM${randomString(4).toUpperCase()}`;
      const name = `Test Payment Method ${randomString()}`;

      // Fill required fields
      await dialog.locator('#code').fill(code);
      await dialog.locator('#name').fill(name);

      // Method type should have a default value (check), but let's be explicit
      const methodTypeSelect = dialog.locator('button:has-text("Check")').or(
        dialog.locator('[data-testid="methodType"]')
      );
      if (await methodTypeSelect.isVisible()) {
        // Type is already selected
      }

      // Submit the form
      const createButton = dialog.getByRole('button', { name: /Create$/i });
      await createButton.click();

      // Wait for dialog to close and success
      await expect(dialog).not.toBeVisible({ timeout: 10000 });

      // Verify the payment method appears in the list
      await listPage.waitForPageLoad();
      await expect(page.getByText(code)).toBeVisible();
    });

    test('should create payment method with all fields', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /Add Payment Method/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');
      const code = `PM${randomString(4).toUpperCase()}`;
      const name = `Full Payment Method ${randomString()}`;
      const description = `Test description ${randomString()}`;

      // Fill all fields
      await dialog.locator('#code').fill(code);
      await dialog.locator('#name').fill(name);
      await dialog.locator('#description').fill(description);

      // Select method type - Credit Card
      const methodTypeTrigger = dialog.locator('button').filter({ hasText: /Check|Cash|Credit Card|Wire/i }).first();
      await methodTypeTrigger.click();
      await page.locator('[role="option"]').filter({ hasText: /Credit Card/i }).click();

      // Toggle Active checkbox (should already be checked by default)
      const activeCheckbox = dialog.locator('#isActive');
      const isActiveChecked = await activeCheckbox.isChecked();
      expect(isActiveChecked).toBe(true);

      // Submit
      const createButton = dialog.getByRole('button', { name: /Create$/i });
      await createButton.click();

      await expect(dialog).not.toBeVisible({ timeout: 10000 });

      // Verify
      await listPage.waitForPageLoad();
      await expect(page.getByText(code)).toBeVisible();
      await expect(page.getByText(/Credit Card/i)).toBeVisible();
    });

    test('should show validation error for missing code', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /Add Payment Method/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');

      // Fill only name, leave code empty
      await dialog.locator('#name').fill('Test Name');

      // Submit
      const createButton = dialog.getByRole('button', { name: /Create$/i });
      await createButton.click();

      // Should show validation error
      const error = dialog.locator('text=/Code is required/i').or(
        dialog.locator('.text-red-500')
      );
      await expect(error).toBeVisible();

      // Dialog should still be open
      await expect(dialog).toBeVisible();
    });

    test('should show validation error for missing name', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /Add Payment Method/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');

      // Fill only code, leave name empty
      await dialog.locator('#code').fill('TEST');

      // Submit
      const createButton = dialog.getByRole('button', { name: /Create$/i });
      await createButton.click();

      // Should show validation error
      const error = dialog.locator('text=/Name is required/i').or(
        dialog.locator('.text-red-500')
      );
      await expect(error).toBeVisible();
    });

    test('should cancel payment method creation', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /Add Payment Method/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');

      // Fill some data
      await dialog.locator('#code').fill('CANCELLED');
      await dialog.locator('#name').fill('Cancelled Method');

      // Click cancel
      const cancelButton = dialog.getByRole('button', { name: /Cancel/i });
      await cancelButton.click();

      // Dialog should close
      await expect(dialog).not.toBeVisible();

      // Data should not be saved
      await expect(page.getByText('CANCELLED')).not.toBeVisible();
    });

    test('should close dialog with escape key', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /Add Payment Method/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Dialog should close
      await expect(dialog).not.toBeVisible();
    });

    test('should create payment method as default', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /Add Payment Method/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');
      const code = `DEF${randomString(3).toUpperCase()}`;
      const name = `Default Method ${randomString()}`;

      await dialog.locator('#code').fill(code);
      await dialog.locator('#name').fill(name);

      // Check the Default checkbox
      const defaultCheckbox = dialog.locator('#isDefault');
      await defaultCheckbox.check();

      // Submit
      const createButton = dialog.getByRole('button', { name: /Create$/i });
      await createButton.click();

      await expect(dialog).not.toBeVisible({ timeout: 10000 });

      // Verify Default badge appears
      await listPage.waitForPageLoad();
      const row = page.locator('tr').filter({ hasText: code });
      await expect(row.getByText(/Default/i)).toBeVisible();
    });

    test('should select different method types', async ({ page }) => {
      const methodTypes = ['Cash', 'Check', 'Credit Card', 'Debit Card', 'ACH', 'Wire Transfer', 'Other'];

      const addButton = page.getByRole('button', { name: /Add Payment Method/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');

      // Click method type dropdown
      const methodTypeTrigger = dialog.locator('button').filter({ hasText: /Check|Select method type/i }).first();
      await methodTypeTrigger.click();

      // Verify all options are available
      for (const type of methodTypes) {
        const option = page.locator('[role="option"]').filter({ hasText: new RegExp(`^${type}$`, 'i') });
        await expect(option).toBeVisible();
      }

      // Close dropdown
      await page.keyboard.press('Escape');
      await dialog.getByRole('button', { name: /Cancel/i }).click();
    });
  });

  test.describe('Edit Payment Method', () => {
    test('should open edit dialog for existing payment method', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click the edit button on first row
      const firstRow = listPage.getRow(0);
      const editButton = firstRow.locator('button').filter({ has: page.locator('svg') }).first();
      await editButton.click();

      // Edit dialog should open
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      const dialogTitle = dialog.getByText(/Edit Payment Method/i);
      await expect(dialogTitle).toBeVisible();
    });

    test('should pre-populate form with existing data', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get the code from first row
      const firstRowCode = await listPage.getRow(0).locator('td').first().textContent();

      // Click edit
      const firstRow = listPage.getRow(0);
      const editButton = firstRow.locator('button').filter({ has: page.locator('svg') }).first();
      await editButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Check code field is populated
      const codeInput = dialog.locator('#edit-code').or(dialog.locator('input[name="code"]')).first();
      await expect(codeInput).toHaveValue(firstRowCode?.trim() || '');
    });

    test('should update payment method name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click edit on first row
      const firstRow = listPage.getRow(0);
      const editButton = firstRow.locator('button').filter({ has: page.locator('svg') }).first();
      await editButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Update the name
      const newName = `Updated Method ${randomString()}`;
      const nameInput = dialog.locator('#edit-name').or(dialog.locator('input[name="name"]')).first();
      await nameInput.clear();
      await nameInput.fill(newName);

      // Submit
      const updateButton = dialog.getByRole('button', { name: /Update/i });
      await updateButton.click();

      await expect(dialog).not.toBeVisible({ timeout: 10000 });

      // Verify update
      await listPage.waitForPageLoad();
      await expect(page.getByText(newName)).toBeVisible();
    });

    test('should cancel edit without saving changes', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get original name
      const originalName = await listPage.getRow(0).locator('td').nth(1).textContent();

      // Click edit
      const firstRow = listPage.getRow(0);
      const editButton = firstRow.locator('button').filter({ has: page.locator('svg') }).first();
      await editButton.click();

      const dialog = page.locator('[role="dialog"]');

      // Change name
      const nameInput = dialog.locator('#edit-name').or(dialog.locator('input[name="name"]')).first();
      await nameInput.clear();
      await nameInput.fill('Should Not Be Saved');

      // Cancel
      const cancelButton = dialog.getByRole('button', { name: /Cancel/i });
      await cancelButton.click();

      await expect(dialog).not.toBeVisible();

      // Verify original name is still there
      await expect(page.getByText(originalName?.trim() || '')).toBeVisible();
      await expect(page.getByText('Should Not Be Saved')).not.toBeVisible();
    });

    test('should toggle active status', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click edit
      const firstRow = listPage.getRow(0);
      const editButton = firstRow.locator('button').filter({ has: page.locator('svg') }).first();
      await editButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Toggle active checkbox
      const activeCheckbox = dialog.locator('#edit-isActive').or(dialog.locator('input[name="isActive"]')).first();
      const wasChecked = await activeCheckbox.isChecked();
      await activeCheckbox.click();

      // Submit
      const updateButton = dialog.getByRole('button', { name: /Update/i });
      await updateButton.click();

      await expect(dialog).not.toBeVisible({ timeout: 10000 });
      await listPage.waitForPageLoad();

      // Verify status badge changed
      const expectedStatus = wasChecked ? 'Inactive' : 'Active';
      const row = listPage.getRow(0);
      await expect(row.getByText(expectedStatus)).toBeVisible();
    });
  });

  test.describe('Delete Payment Method', () => {
    test('should show browser confirm dialog when clicking delete', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Set up dialog handler before clicking
      let dialogMessage = '';
      page.on('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });

      // Click delete button (second button in actions)
      const firstRow = listPage.getRow(0);
      const deleteButton = firstRow.locator('button').filter({ has: page.locator('svg') }).last();
      await deleteButton.click();

      // Verify confirm dialog was shown
      expect(dialogMessage).toContain('delete');
    });

    test('should cancel delete operation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const originalCount = rowCount;

      // Set up dialog to cancel
      page.on('dialog', async (dialog) => {
        await dialog.dismiss();
      });

      // Click delete
      const firstRow = listPage.getRow(0);
      const deleteButton = firstRow.locator('button').filter({ has: page.locator('svg') }).last();
      await deleteButton.click();

      // Wait a moment and verify count unchanged
      await page.waitForTimeout(500);
      const newCount = await listPage.getRowCount();
      expect(newCount).toBe(originalCount);
    });

    test('should delete payment method after confirmation', async ({ page }) => {
      // First create a payment method to delete
      const addButton = page.getByRole('button', { name: /Add Payment Method/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');
      const code = `DEL${randomString(3).toUpperCase()}`;
      const name = `To Delete ${randomString()}`;

      await dialog.locator('#code').fill(code);
      await dialog.locator('#name').fill(name);

      const createButton = dialog.getByRole('button', { name: /Create$/i });
      await createButton.click();

      await expect(dialog).not.toBeVisible({ timeout: 10000 });
      await listPage.waitForPageLoad();

      // Verify it was created
      await expect(page.getByText(code)).toBeVisible();

      // Now delete it
      page.on('dialog', async (d) => {
        await d.accept();
      });

      const row = page.locator('tr').filter({ hasText: code });
      const deleteButton = row.locator('button').filter({ has: page.locator('svg') }).last();
      await deleteButton.click();

      // Wait for deletion
      await page.waitForTimeout(1000);
      await listPage.waitForPageLoad();

      // Verify it's gone
      await expect(page.getByText(code)).not.toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to payment method detail page on row click', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click on the row (not on action buttons)
      const firstRow = listPage.getRow(0);
      const firstCell = firstRow.locator('td').first();
      await firstCell.click();

      // Should navigate to detail page
      await expect(page).toHaveURL(/\/lists\/payment-methods\/[a-f0-9-]+/);
    });

    test('should display detail page with payment method info', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get code before navigation
      const code = await listPage.getRow(0).locator('td').first().textContent();

      // Navigate to detail
      const firstRow = listPage.getRow(0);
      await firstRow.locator('td').first().click();

      // Verify detail page content
      await page.waitForURL(/\/lists\/payment-methods\/[a-f0-9-]+/);
      await listPage.waitForPageLoad();

      // Should show the payment method code
      await expect(page.getByText(code?.trim() || '')).toBeVisible();

      // Should have back button
      const backButton = page.getByRole('button', { name: /Back to Payment Methods/i });
      await expect(backButton).toBeVisible();
    });

    test('should navigate back from detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Navigate to detail
      await listPage.getRow(0).locator('td').first().click();
      await page.waitForURL(/\/lists\/payment-methods\/[a-f0-9-]+/);

      // Click back
      const backButton = page.getByRole('button', { name: /Back to Payment Methods/i });
      await backButton.click();

      // Should be back on list page
      await expect(page).toHaveURL(/\/lists\/payment-methods$/);
    });
  });

  test.describe('Detail Page', () => {
    test.beforeEach(async ({ page }) => {
      // Ensure we have a payment method to view
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        // Create one
        const addButton = page.getByRole('button', { name: /Add Payment Method/i });
        await addButton.click();

        const dialog = page.locator('[role="dialog"]');
        await dialog.locator('#code').fill(`VW${randomString(3).toUpperCase()}`);
        await dialog.locator('#name').fill(`View Test ${randomString()}`);

        await dialog.getByRole('button', { name: /Create$/i }).click();
        await expect(dialog).not.toBeVisible({ timeout: 10000 });
        await listPage.waitForPageLoad();
      }

      // Navigate to detail page
      await listPage.getRow(0).locator('td').first().click();
      await page.waitForURL(/\/lists\/payment-methods\/[a-f0-9-]+/);
      await listPage.waitForPageLoad();
    });

    test('should display payment method details card', async ({ page }) => {
      // Should show details card
      const detailsCard = page.getByText(/Payment Method Details/i);
      await expect(detailsCard).toBeVisible();
    });

    test('should display method type', async ({ page }) => {
      const methodType = page.getByText(/Method Type/i);
      await expect(methodType).toBeVisible();
    });

    test('should display status badge', async ({ page }) => {
      const statusBadge = page.locator('text=/Active|Inactive/i');
      await expect(statusBadge.first()).toBeVisible();
    });

    test('should display account configuration section', async ({ page }) => {
      const accountConfig = page.getByText(/Account Configuration/i);
      await expect(accountConfig).toBeVisible();
    });

    test('should display assigned customers section', async ({ page }) => {
      const customersSection = page.getByText(/Assigned Customers/i);
      await expect(customersSection).toBeVisible();
    });
  });

  test.describe('Table Display', () => {
    test('should display active badge correctly', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check for Active or Inactive badges
      const activeBadge = listPage.getRow(0).locator('text=/Active|Inactive/i');
      await expect(activeBadge.first()).toBeVisible();
    });

    test('should display method type in table', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check for method type cell
      const typeCell = listPage.getRow(0).locator('td').nth(2);
      const typeText = await typeCell.textContent();

      // Should be one of the valid types
      const validTypes = ['Cash', 'Check', 'Credit Card', 'Debit Card', 'ACH', 'Wire Transfer', 'Other'];
      const hasValidType = validTypes.some((t) => typeText?.includes(t));
      expect(hasValidType).toBe(true);
    });

    test('should display table caption', async ({ page }) => {
      const caption = page.getByText(/A list of your payment methods/i);
      await expect(caption).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle duplicate code error gracefully', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get existing code
      const existingCode = await listPage.getRow(0).locator('td').first().textContent();

      // Try to create with same code
      const addButton = page.getByRole('button', { name: /Add Payment Method/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');
      await dialog.locator('#code').fill(existingCode?.trim() || '');
      await dialog.locator('#name').fill('Duplicate Test');

      await dialog.getByRole('button', { name: /Create$/i }).click();

      // Should show error toast or error message
      await page.waitForTimeout(1000);

      // Dialog might still be open with error, or toast appeared
      const hasError =
        (await dialog.isVisible()) ||
        (await page.locator('[data-sonner-toaster]').isVisible());
      expect(hasError).toBe(true);
    });

    test('should handle code length validation', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /Add Payment Method/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');

      // Try very long code (max is 20)
      await dialog.locator('#code').fill('A'.repeat(25));
      await dialog.locator('#name').fill('Long Code Test');

      await dialog.getByRole('button', { name: /Create$/i }).click();

      // Should show validation error or truncate
      await page.waitForTimeout(500);
      const codeInput = dialog.locator('#code');
      const value = await codeInput.inputValue();

      // Either shows error or input was constrained
      if (await dialog.isVisible()) {
        expect(value.length <= 20 || (await dialog.locator('.text-red-500').isVisible())).toBe(true);
      }
    });
  });

  test.describe('Empty State', () => {
    test('should show helpful message when no payment methods exist', async ({ page }) => {
      // This test verifies the empty state message
      // If there are payment methods, we just verify the table shows them instead
      const rowCount = await listPage.getRowCount();

      if (rowCount === 0) {
        const emptyMessage = page.getByText(/No payment methods found/i);
        await expect(emptyMessage).toBeVisible();

        const createPrompt = page.getByText(/Create one to get started/i);
        await expect(createPrompt).toBeVisible();
      } else {
        // Table should have rows
        expect(rowCount).toBeGreaterThan(0);
      }
    });
  });
});
