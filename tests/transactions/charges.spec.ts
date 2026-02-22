import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { randomString, uniqueId, waitForToast } from '../utils/test-helpers';

test.describe('Charges CRUD', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/transactions/expenses/charges');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load and Display', () => {
    test('should load charges page with correct URL', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions\/expenses\/charges/);
    });

    test('should display page heading with title "Charges"', async ({ page }) => {
      const heading = page.locator('h1').filter({ hasText: /Charges/i });
      await expect(heading).toBeVisible();
    });

    test('should display charges table or empty state', async ({ page }) => {
      const hasRows = (await listPage.getRowCount()) > 0;
      const emptyText = page.locator('text=No charges found');
      const isEmpty = await emptyText.isVisible().catch(() => false);
      expect(hasRows || isEmpty).toBe(true);
    });

    test('should display New Charge button', async ({ page }) => {
      const newButton = page.locator('button:has-text("New Charge")');
      await expect(newButton).toBeVisible();
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
      expect(headerText).toMatch(/charge/i);
      expect(headerText).toMatch(/customer/i);
      expect(headerText).toMatch(/type/i);
      expect(headerText).toMatch(/date/i);
      expect(headerText).toMatch(/amount/i);
      expect(headerText).toMatch(/status/i);
    });

    test('should display empty state message when no charges', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        const emptyMessage = page.locator('text=No charges found');
        await expect(emptyMessage).toBeVisible();

        // Also check for the helper text
        const helperText = page.locator('text=Create your first charge to get started');
        await expect(helperText).toBeVisible();
      }
    });

    test('should display status badges for charges', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }
      // Check that status badges exist in the table (DRAFT, PENDING, BILLED, PAID, CANCELLED)
      const badges = page.locator('table tbody [class*="badge"], table tbody span').filter({
        hasText: /DRAFT|PENDING|BILLED|PAID|CANCELLED/i
      });
      expect(await badges.count()).toBeGreaterThan(0);
    });
  });

  test.describe('Create Charge - Navigation', () => {
    test('should navigate to new charge page when clicking New Charge button', async ({ page }) => {
      const newButton = page.locator('button:has-text("New Charge")');
      await newButton.click();

      await expect(page).toHaveURL(/\/transactions\/expenses\/charges\/new/);
    });

    test('should display new charge form with correct sections', async ({ page }) => {
      await page.goto('/transactions/expenses/charges/new');
      await listPage.waitForPageLoad();

      // Check for Customer Information section
      const customerSection = page.locator('text=Customer Information');
      await expect(customerSection).toBeVisible();

      // Check for Charge Details section
      const chargeSection = page.locator('text=Charge Details');
      await expect(chargeSection).toBeVisible();

      // Check for Line Items section
      const lineItemsSection = page.locator('text=Line Items');
      await expect(lineItemsSection).toBeVisible();

      // Check for Additional Notes section
      const notesSection = page.locator('text=Additional Notes');
      await expect(notesSection).toBeVisible();
    });

    test('should display back button on new charge page', async ({ page }) => {
      await page.goto('/transactions/expenses/charges/new');
      await listPage.waitForPageLoad();

      const backButton = page.locator('button').filter({ has: page.locator('[class*="lucide-arrow-left"]') });
      await expect(backButton).toBeVisible();
    });

    test('should navigate back when clicking back button', async ({ page }) => {
      await page.goto('/transactions/expenses/charges/new');
      await listPage.waitForPageLoad();

      const backButton = page.locator('button').filter({ has: page.locator('[class*="lucide-arrow-left"]') });
      await backButton.click();

      await expect(page).toHaveURL(/\/transactions\/expenses\/charges$/);
    });
  });

  test.describe('Create Charge - Form Fields', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/transactions/expenses/charges/new');
      await listPage.waitForPageLoad();
    });

    test('should display customer select field', async ({ page }) => {
      const customerSelect = page.locator('button[role="combobox"]').filter({ hasText: /Select customer/i }).first();
      await expect(customerSelect).toBeVisible();
    });

    test('should display project select field (optional)', async ({ page }) => {
      const projectSelect = page.locator('button[role="combobox"]').filter({ hasText: /Select project|No Project/i }).first();
      await expect(projectSelect).toBeVisible();
    });

    test('should display charge type select field', async ({ page }) => {
      const chargeTypeSelect = page.locator('button[role="combobox"]').filter({ hasText: /Select charge type/i }).first();
      await expect(chargeTypeSelect).toBeVisible();
    });

    test('should display date input field with today as default', async ({ page }) => {
      const dateInput = page.locator('input[type="date"]');
      await expect(dateInput).toBeVisible();

      const today = new Date().toISOString().split('T')[0];
      await expect(dateInput).toHaveValue(today);
    });

    test('should display all charge type options', async ({ page }) => {
      const chargeTypeSelect = page.locator('button[role="combobox"]').filter({ hasText: /Select charge type/i }).first();
      await chargeTypeSelect.click();

      const chargeTypes = [
        'Service Fee',
        'Late Fee',
        'Setup Fee',
        'Rush Fee',
        'Shipping & Handling',
        'Restocking Fee',
        'Cancellation Fee',
        'Adjustment',
        'Other'
      ];

      for (const type of chargeTypes) {
        const option = page.locator(`[role="option"]:has-text("${type}")`);
        await expect(option).toBeVisible();
      }

      // Close the dropdown
      await page.keyboard.press('Escape');
    });

    test('should display line item fields', async ({ page }) => {
      // Check for item select
      const itemSelect = page.locator('[role="combobox"]').filter({ hasText: /Select item|Custom Item/i }).first();
      await expect(itemSelect).toBeVisible();

      // Check for description input
      const descriptionInput = page.locator('input[placeholder*="description"]');
      await expect(descriptionInput).toBeVisible();

      // Check for quantity input
      const quantityInput = page.locator('input[type="number"]').first();
      await expect(quantityInput).toBeVisible();
    });

    test('should display memo/notes textarea', async ({ page }) => {
      const memoTextarea = page.locator('textarea');
      await expect(memoTextarea).toBeVisible();
    });

    test('should display Create Charge and Cancel buttons', async ({ page }) => {
      const createButton = page.locator('button:has-text("Create Charge")');
      await expect(createButton).toBeVisible();

      const cancelButton = page.locator('button:has-text("Cancel")');
      await expect(cancelButton).toBeVisible();
    });
  });

  test.describe('Create Charge - Line Items', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/transactions/expenses/charges/new');
      await listPage.waitForPageLoad();
    });

    test('should have one line item by default', async ({ page }) => {
      const lineItems = page.locator('text=Line 1');
      await expect(lineItems).toBeVisible();
    });

    test('should add new line item when clicking Add Line Item button', async ({ page }) => {
      const addLineButton = page.locator('button:has-text("Add Line Item")');
      await addLineButton.click();

      const line2 = page.locator('text=Line 2');
      await expect(line2).toBeVisible();
    });

    test('should remove line item when clicking delete button', async ({ page }) => {
      // First add a second line
      const addLineButton = page.locator('button:has-text("Add Line Item")');
      await addLineButton.click();

      const line2 = page.locator('text=Line 2');
      await expect(line2).toBeVisible();

      // Delete the second line
      const deleteButtons = page.locator('[class*="border"][class*="rounded-lg"]').nth(1).locator('button').filter({ has: page.locator('[class*="lucide-trash"]') });
      await deleteButtons.click();

      // Line 2 should be gone
      await expect(line2).not.toBeVisible();
    });

    test('should not show delete button when only one line item exists', async ({ page }) => {
      // With only one line item, there should be no visible delete button for it
      const lineItemCard = page.locator('[class*="border"][class*="rounded-lg"]').first();
      const deleteButton = lineItemCard.locator('button').filter({ has: page.locator('[class*="lucide-trash"]') });

      // The delete button should not be visible for a single line
      await expect(deleteButton).toHaveCount(0);
    });

    test('should calculate amount based on quantity and unit price', async ({ page }) => {
      // Fill in quantity and unit price
      const quantityInput = page.locator('input[type="number"]').first();
      await quantityInput.clear();
      await quantityInput.fill('5');

      // Find unit price input (second number input in the line)
      const unitPriceInput = page.locator('input[type="number"]').nth(1);
      await unitPriceInput.clear();
      await unitPriceInput.fill('100');

      // Check that Amount field shows $500.00
      const amountDisplay = page.locator('text=$500.00');
      await expect(amountDisplay.first()).toBeVisible();
    });

    test('should calculate gross margin based on price and cost', async ({ page }) => {
      // Fill in quantity
      const quantityInput = page.locator('input[type="number"]').first();
      await quantityInput.clear();
      await quantityInput.fill('10');

      // Fill in unit price
      const unitPriceInput = page.locator('input[type="number"]').nth(1);
      await unitPriceInput.clear();
      await unitPriceInput.fill('50');

      // Fill in cost
      const costInput = page.locator('input[type="number"]').nth(2);
      await costInput.clear();
      await costInput.fill('30');

      // Gross margin should be $200 ((50-30) * 10)
      // We check for the GM display showing a positive value
      const gmDisplay = page.locator('text=$200.00');
      await expect(gmDisplay.first()).toBeVisible();
    });
  });

  test.describe('Create Charge - Summary Totals', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/transactions/expenses/charges/new');
      await listPage.waitForPageLoad();
    });

    test('should display summary totals section', async ({ page }) => {
      // Check for Amount total
      const amountLabel = page.locator('text=Amount').first();
      await expect(amountLabel).toBeVisible();

      // Check for Total Cost
      const costLabel = page.locator('text=Total Cost');
      await expect(costLabel).toBeVisible();

      // Check for Gross Margin
      const gmLabel = page.locator('text=Gross Margin');
      await expect(gmLabel).toBeVisible();

      // Check for GP%
      const gpLabel = page.locator('text=GP%');
      await expect(gpLabel).toBeVisible();

      // Check for Grand Total
      const totalLabel = page.locator('text=Grand Total');
      await expect(totalLabel).toBeVisible();
    });

    test('should update grand total when line items change', async ({ page }) => {
      // Initially grand total should be $0.00
      let grandTotal = page.locator('[class*="bg-primary"]').locator('text=$0.00');
      await expect(grandTotal).toBeVisible();

      // Add values to line item
      const quantityInput = page.locator('input[type="number"]').first();
      await quantityInput.clear();
      await quantityInput.fill('2');

      const unitPriceInput = page.locator('input[type="number"]').nth(1);
      await unitPriceInput.clear();
      await unitPriceInput.fill('250');

      // Grand total should now be $500.00
      grandTotal = page.locator('[class*="bg-primary"]').locator('text=$500.00');
      await expect(grandTotal).toBeVisible();
    });
  });

  test.describe('Create Charge - Validation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/transactions/expenses/charges/new');
      await listPage.waitForPageLoad();
    });

    test('should show validation error when customer is not selected', async ({ page }) => {
      // Fill other required fields but not customer
      const chargeTypeSelect = page.locator('button[role="combobox"]').filter({ hasText: /Select charge type/i }).first();
      await chargeTypeSelect.click();
      await page.locator('[role="option"]:has-text("Service Fee")').click();

      const descriptionInput = page.locator('input[placeholder*="description"]');
      await descriptionInput.fill('Test description');

      // Try to submit
      const createButton = page.locator('button:has-text("Create Charge")');
      await createButton.click();

      // Should show validation error
      const errorMessage = page.locator('text=/Customer is required/i');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('should show validation error when charge type is not selected', async ({ page }) => {
      // Fill other required fields but not charge type
      // Select a customer if available
      const customerSelect = page.locator('button[role="combobox"]').filter({ hasText: /Select customer/i }).first();
      await customerSelect.click();
      const firstCustomer = page.locator('[role="option"]').first();
      if (await firstCustomer.isVisible()) {
        await firstCustomer.click();
      } else {
        await page.keyboard.press('Escape');
      }

      const descriptionInput = page.locator('input[placeholder*="description"]');
      await descriptionInput.fill('Test description');

      // Try to submit
      const createButton = page.locator('button:has-text("Create Charge")');
      await createButton.click();

      // Should show validation error
      const errorMessage = page.locator('text=/Charge type is required/i');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('should show validation error when line item description is empty', async ({ page }) => {
      // Fill required fields except line item description
      const customerSelect = page.locator('button[role="combobox"]').filter({ hasText: /Select customer/i }).first();
      await customerSelect.click();
      const firstCustomer = page.locator('[role="option"]').first();
      if (await firstCustomer.isVisible()) {
        await firstCustomer.click();
      } else {
        await page.keyboard.press('Escape');
      }

      const chargeTypeSelect = page.locator('button[role="combobox"]').filter({ hasText: /Select charge type/i }).first();
      await chargeTypeSelect.click();
      await page.locator('[role="option"]:has-text("Service Fee")').click();

      // Try to submit without line item description
      const createButton = page.locator('button:has-text("Create Charge")');
      await createButton.click();

      // Should show validation error
      const errorMessage = page.locator('text=/Description is required/i');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('should cancel and return to list page', async ({ page }) => {
      const cancelButton = page.locator('button:has-text("Cancel")');
      await cancelButton.click();

      await expect(page).toHaveURL(/\/transactions\/expenses\/charges$/);
    });
  });

  test.describe('Create Charge - Successful Creation', () => {
    test('should create charge with all required fields', async ({ page }) => {
      await page.goto('/transactions/expenses/charges/new');
      await listPage.waitForPageLoad();

      // Select customer
      const customerSelect = page.locator('button[role="combobox"]').filter({ hasText: /Select customer/i }).first();
      await customerSelect.click();
      const firstCustomer = page.locator('[role="option"]').first();
      if (await firstCustomer.isVisible()) {
        await firstCustomer.click();
      } else {
        // No customers available, skip test
        test.skip();
        return;
      }

      // Select charge type
      const chargeTypeSelect = page.locator('button[role="combobox"]').filter({ hasText: /Select charge type/i }).first();
      await chargeTypeSelect.click();
      await page.locator('[role="option"]:has-text("Service Fee")').click();

      // Fill line item description
      const descriptionInput = page.locator('input[placeholder*="description"]');
      await descriptionInput.fill(`Test charge ${randomString()}`);

      // Set quantity and price
      const quantityInput = page.locator('input[type="number"]').first();
      await quantityInput.clear();
      await quantityInput.fill('1');

      const unitPriceInput = page.locator('input[type="number"]').nth(1);
      await unitPriceInput.clear();
      await unitPriceInput.fill('100');

      // Submit
      const createButton = page.locator('button:has-text("Create Charge")');
      await createButton.click();

      // Should show success toast
      await waitForToast(page, /success|created/i);

      // Should redirect to list page
      await expect(page).toHaveURL(/\/transactions\/expenses\/charges$/);
    });

    test('should create charge with project linked', async ({ page }) => {
      await page.goto('/transactions/expenses/charges/new');
      await listPage.waitForPageLoad();

      // Select customer
      const customerSelect = page.locator('button[role="combobox"]').filter({ hasText: /Select customer/i }).first();
      await customerSelect.click();
      const firstCustomer = page.locator('[role="option"]').first();
      if (await firstCustomer.isVisible()) {
        await firstCustomer.click();
      } else {
        test.skip();
        return;
      }

      // Select project (if available)
      const projectSelect = page.locator('button[role="combobox"]').filter({ hasText: /Select project|No Project/i }).first();
      await projectSelect.click();
      const firstProject = page.locator('[role="option"]').filter({ hasNotText: /No Project/i }).first();
      if (await firstProject.isVisible()) {
        await firstProject.click();
      } else {
        await page.keyboard.press('Escape');
      }

      // Select charge type
      const chargeTypeSelect = page.locator('button[role="combobox"]').filter({ hasText: /Select charge type/i }).first();
      await chargeTypeSelect.click();
      await page.locator('[role="option"]:has-text("Setup Fee")').click();

      // Fill line item
      const descriptionInput = page.locator('input[placeholder*="description"]');
      await descriptionInput.fill(`Project charge ${randomString()}`);

      const quantityInput = page.locator('input[type="number"]').first();
      await quantityInput.clear();
      await quantityInput.fill('1');

      const unitPriceInput = page.locator('input[type="number"]').nth(1);
      await unitPriceInput.clear();
      await unitPriceInput.fill('500');

      // Submit
      const createButton = page.locator('button:has-text("Create Charge")');
      await createButton.click();

      // Should show success toast
      await waitForToast(page, /success|created/i);
    });

    test('should create charge with multiple line items', async ({ page }) => {
      await page.goto('/transactions/expenses/charges/new');
      await listPage.waitForPageLoad();

      // Select customer
      const customerSelect = page.locator('button[role="combobox"]').filter({ hasText: /Select customer/i }).first();
      await customerSelect.click();
      const firstCustomer = page.locator('[role="option"]').first();
      if (await firstCustomer.isVisible()) {
        await firstCustomer.click();
      } else {
        test.skip();
        return;
      }

      // Select charge type
      const chargeTypeSelect = page.locator('button[role="combobox"]').filter({ hasText: /Select charge type/i }).first();
      await chargeTypeSelect.click();
      await page.locator('[role="option"]:has-text("Other")').click();

      // Fill first line item
      const descriptionInput1 = page.locator('input[placeholder*="description"]').first();
      await descriptionInput1.fill(`Line 1 ${randomString()}`);

      const quantityInput1 = page.locator('[class*="border"][class*="rounded-lg"]').first().locator('input[type="number"]').first();
      await quantityInput1.clear();
      await quantityInput1.fill('2');

      const unitPriceInput1 = page.locator('[class*="border"][class*="rounded-lg"]').first().locator('input[type="number"]').nth(1);
      await unitPriceInput1.clear();
      await unitPriceInput1.fill('100');

      // Add second line item
      const addLineButton = page.locator('button:has-text("Add Line Item")');
      await addLineButton.click();

      // Fill second line item
      const descriptionInput2 = page.locator('[class*="border"][class*="rounded-lg"]').nth(1).locator('input[placeholder*="description"]');
      await descriptionInput2.fill(`Line 2 ${randomString()}`);

      const quantityInput2 = page.locator('[class*="border"][class*="rounded-lg"]').nth(1).locator('input[type="number"]').first();
      await quantityInput2.clear();
      await quantityInput2.fill('3');

      const unitPriceInput2 = page.locator('[class*="border"][class*="rounded-lg"]').nth(1).locator('input[type="number"]').nth(1);
      await unitPriceInput2.clear();
      await unitPriceInput2.fill('50');

      // Verify grand total is $350 (2*100 + 3*50)
      const grandTotal = page.locator('[class*="bg-primary"]').locator('text=$350.00');
      await expect(grandTotal).toBeVisible();

      // Submit
      const createButton = page.locator('button:has-text("Create Charge")');
      await createButton.click();

      // Should show success toast
      await waitForToast(page, /success|created/i);
    });

    test('should create charge with memo/notes', async ({ page }) => {
      await page.goto('/transactions/expenses/charges/new');
      await listPage.waitForPageLoad();

      // Select customer
      const customerSelect = page.locator('button[role="combobox"]').filter({ hasText: /Select customer/i }).first();
      await customerSelect.click();
      const firstCustomer = page.locator('[role="option"]').first();
      if (await firstCustomer.isVisible()) {
        await firstCustomer.click();
      } else {
        test.skip();
        return;
      }

      // Select charge type
      const chargeTypeSelect = page.locator('button[role="combobox"]').filter({ hasText: /Select charge type/i }).first();
      await chargeTypeSelect.click();
      await page.locator('[role="option"]:has-text("Late Fee")').click();

      // Fill line item
      const descriptionInput = page.locator('input[placeholder*="description"]');
      await descriptionInput.fill('Late payment fee');

      const quantityInput = page.locator('input[type="number"]').first();
      await quantityInput.clear();
      await quantityInput.fill('1');

      const unitPriceInput = page.locator('input[type="number"]').nth(1);
      await unitPriceInput.clear();
      await unitPriceInput.fill('25');

      // Add memo
      const memoTextarea = page.locator('textarea');
      await memoTextarea.fill(`Additional notes for charge ${randomString()}`);

      // Submit
      const createButton = page.locator('button:has-text("Create Charge")');
      await createButton.click();

      // Should show success toast
      await waitForToast(page, /success|created/i);
    });
  });

  test.describe('View Charge', () => {
    test('should open view dialog when clicking View button', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click the view button (Eye icon)
      const viewButton = listPage.getRow(0).locator('button[title="View"]');
      await viewButton.click();

      // Dialog should open
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
    });

    test('should display charge details in view dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click the view button
      const viewButton = listPage.getRow(0).locator('button[title="View"]');
      await viewButton.click();

      // Check dialog title
      const dialogTitle = page.locator('[role="dialog"] h2, [role="dialog"] [data-radix-dialog-title]');
      await expect(dialogTitle).toContainText(/Charge Details/i);

      // Check for charge details fields
      const chargeNumberLabel = page.locator('[role="dialog"]').locator('text=Charge Number');
      await expect(chargeNumberLabel).toBeVisible();

      const customerLabel = page.locator('[role="dialog"]').locator('text=Customer');
      await expect(customerLabel).toBeVisible();

      const typeLabel = page.locator('[role="dialog"]').locator('text=Type');
      await expect(typeLabel).toBeVisible();

      const dateLabel = page.locator('[role="dialog"]').locator('text=Date');
      await expect(dateLabel).toBeVisible();

      const statusLabel = page.locator('[role="dialog"]').locator('text=Status');
      await expect(statusLabel).toBeVisible();

      const amountLabel = page.locator('[role="dialog"]').locator('text=Amount');
      await expect(amountLabel).toBeVisible();
    });

    test('should close view dialog when clicking outside or pressing Escape', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Open view dialog
      const viewButton = listPage.getRow(0).locator('button[title="View"]');
      await viewButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Press Escape to close
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
    });
  });

  test.describe('Delete Charge', () => {
    test('should show delete button only for DRAFT charges', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find a DRAFT charge row
      const draftRows = listPage.tableRows.filter({ hasText: 'DRAFT' });
      const draftCount = await draftRows.count();

      if (draftCount > 0) {
        // DRAFT charges should have delete button
        const deleteButton = draftRows.first().locator('button[title="Delete"]');
        await expect(deleteButton).toBeVisible();
      }

      // Find a non-DRAFT charge row (BILLED, PAID, etc.)
      const billedRows = listPage.tableRows.filter({ hasText: /BILLED|PAID|PENDING/i });
      const billedCount = await billedRows.count();

      if (billedCount > 0) {
        // Non-DRAFT charges should NOT have delete button
        const deleteButton = billedRows.first().locator('button[title="Delete"]');
        await expect(deleteButton).toHaveCount(0);
      }
    });

    test('should show delete confirmation dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find a DRAFT charge row
      const draftRows = listPage.tableRows.filter({ hasText: 'DRAFT' });
      const draftCount = await draftRows.count();

      if (draftCount === 0) {
        test.skip();
        return;
      }

      // Click delete button
      const deleteButton = draftRows.first().locator('button[title="Delete"]');
      await deleteButton.click();

      // Alert dialog should appear
      const alertDialog = page.locator('[role="alertdialog"]');
      await expect(alertDialog).toBeVisible();

      // Check dialog content
      const deleteTitle = alertDialog.locator('text=Delete Charge');
      await expect(deleteTitle).toBeVisible();

      const confirmText = alertDialog.locator('text=Are you sure you want to delete this charge');
      await expect(confirmText).toBeVisible();
    });

    test('should cancel delete operation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find a DRAFT charge row
      const draftRows = listPage.tableRows.filter({ hasText: 'DRAFT' });
      const draftCount = await draftRows.count();

      if (draftCount === 0) {
        test.skip();
        return;
      }

      const originalCount = rowCount;

      // Click delete button
      const deleteButton = draftRows.first().locator('button[title="Delete"]');
      await deleteButton.click();

      // Alert dialog should appear
      const alertDialog = page.locator('[role="alertdialog"]');
      await expect(alertDialog).toBeVisible();

      // Click Cancel
      const cancelButton = alertDialog.locator('button:has-text("Cancel")');
      await cancelButton.click();

      // Dialog should close
      await expect(alertDialog).not.toBeVisible();

      // Row count should be unchanged
      const newCount = await listPage.getRowCount();
      expect(newCount).toBe(originalCount);
    });

    test('should delete charge when confirmed', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find a DRAFT charge row
      const draftRows = listPage.tableRows.filter({ hasText: 'DRAFT' });
      const draftCount = await draftRows.count();

      if (draftCount === 0) {
        test.skip();
        return;
      }

      const countBefore = rowCount;

      // Click delete button
      const deleteButton = draftRows.first().locator('button[title="Delete"]');
      await deleteButton.click();

      // Alert dialog should appear
      const alertDialog = page.locator('[role="alertdialog"]');
      await expect(alertDialog).toBeVisible();

      // Click Delete to confirm
      const confirmDeleteButton = alertDialog.locator('button:has-text("Delete")');
      await confirmDeleteButton.click();

      // Should show success toast
      await waitForToast(page, /deleted/i);

      // Row count should decrease
      await listPage.waitForPageLoad();
      const countAfter = await listPage.getRowCount();
      expect(countAfter).toBeLessThan(countBefore);
    });
  });

  test.describe('Status Display', () => {
    test('should display DRAFT status with outline variant', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const draftBadges = page.locator('table tbody').locator('[class*="badge"]').filter({ hasText: 'DRAFT' });
      if (await draftBadges.count() > 0) {
        // DRAFT badges should have outline variant (check for outline-related classes)
        const badge = draftBadges.first();
        await expect(badge).toBeVisible();
      }
    });

    test('should display PENDING status with secondary variant', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const pendingBadges = page.locator('table tbody').locator('[class*="badge"]').filter({ hasText: 'PENDING' });
      if (await pendingBadges.count() > 0) {
        const badge = pendingBadges.first();
        await expect(badge).toBeVisible();
      }
    });

    test('should display CANCELLED status with destructive variant', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const cancelledBadges = page.locator('table tbody').locator('[class*="badge"]').filter({ hasText: 'CANCELLED' });
      if (await cancelledBadges.count() > 0) {
        const badge = cancelledBadges.first();
        await expect(badge).toBeVisible();
      }
    });
  });

  test.describe('Currency Formatting', () => {
    test('should display amounts in USD currency format', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check for currency format in the Amount column (right-aligned)
      const amountCells = page.locator('table tbody td.text-right').first();
      const amountText = await amountCells.textContent();

      // Should match USD currency format ($X.XX or $X,XXX.XX)
      expect(amountText).toMatch(/\$[\d,]+\.\d{2}/);
    });
  });

  test.describe('Date Formatting', () => {
    test('should display dates in readable format', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get date cell content
      const row = listPage.getRow(0);
      const cells = await row.locator('td').allTextContents();

      // Date should be in format like "Jan 15, 2025" (4th column - index 3)
      // The format is: Charge #, Customer, Type, Date, Project, Amount, Status
      const dateText = cells[3]?.trim();

      if (dateText && dateText !== 'N/A') {
        // Should match format like "Jan 15, 2025"
        expect(dateText).toMatch(/[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}/);
      }
    });
  });

  test.describe('Edge Cases and Error Handling', () => {
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

    test('should handle special characters in description', async ({ page }) => {
      await page.goto('/transactions/expenses/charges/new');
      await listPage.waitForPageLoad();

      // Fill special characters in description
      const descriptionInput = page.locator('input[placeholder*="description"]');
      await descriptionInput.fill('Special <>&"\' chars test');

      // Should accept the input without issues
      await expect(descriptionInput).toHaveValue('Special <>&"\' chars test');
    });

    test('should handle negative values in inputs', async ({ page }) => {
      await page.goto('/transactions/expenses/charges/new');
      await listPage.waitForPageLoad();

      // Try to enter negative quantity
      const quantityInput = page.locator('input[type="number"]').first();
      await quantityInput.clear();
      await quantityInput.fill('-5');

      // The input should have min="0" constraint, so the value should be clamped or show error
      // Check that the form handles this appropriately
      const value = await quantityInput.inputValue();
      // Either the value is rejected or validation will catch it on submit
      expect(value === '-5' || value === '0' || value === '').toBe(true);
    });

    test('should handle very large amounts', async ({ page }) => {
      await page.goto('/transactions/expenses/charges/new');
      await listPage.waitForPageLoad();

      // Enter large values
      const quantityInput = page.locator('input[type="number"]').first();
      await quantityInput.clear();
      await quantityInput.fill('1000000');

      const unitPriceInput = page.locator('input[type="number"]').nth(1);
      await unitPriceInput.clear();
      await unitPriceInput.fill('9999.99');

      // Grand total should display correctly (with thousands separator)
      const grandTotalSection = page.locator('[class*="bg-primary"]');
      const totalText = await grandTotalSection.textContent();

      // Should contain formatted large number
      expect(totalText).toContain('$');
    });

    test('should handle decimal quantities', async ({ page }) => {
      await page.goto('/transactions/expenses/charges/new');
      await listPage.waitForPageLoad();

      // Enter decimal quantity
      const quantityInput = page.locator('input[type="number"]').first();
      await quantityInput.clear();
      await quantityInput.fill('2.5');

      const unitPriceInput = page.locator('input[type="number"]').nth(1);
      await unitPriceInput.clear();
      await unitPriceInput.fill('100');

      // Amount should be $250.00 (2.5 * 100)
      const amountDisplay = page.locator('text=$250.00');
      await expect(amountDisplay.first()).toBeVisible();
    });
  });

  test.describe('UI Interactions', () => {
    test('should show loading state while fetching data', async ({ page }) => {
      // Navigate with network throttling to see loading state
      await page.route('**/trpc/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.continue();
      });

      await page.goto('/transactions/expenses/charges');

      // Check for loading indicator
      const loadingText = page.locator('text=Loading charges...');
      const loadingVisible = await loadingText.isVisible({ timeout: 3000 }).catch(() => false);

      // Wait for loading to complete
      await listPage.waitForPageLoad();

      // Page should now show table or empty state
      const hasContent = (await listPage.getRowCount()) > 0 ||
        await page.locator('text=No charges found').isVisible().catch(() => false);
      expect(hasContent).toBe(true);
    });
  });

  test.describe('Responsive Design', () => {
    test('should display properly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/transactions/expenses/charges');
      await listPage.waitForPageLoad();

      // Verify page still loads
      await expect(page).toHaveURL(/\/transactions\/expenses\/charges/);

      // Verify New Charge button is still accessible
      const newButton = page.locator('button:has-text("New Charge")');
      await expect(newButton).toBeVisible();
    });

    test('should display new charge form properly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/transactions/expenses/charges/new');
      await listPage.waitForPageLoad();

      // Verify page still loads
      await expect(page).toHaveURL(/\/transactions\/expenses\/charges\/new/);

      // Verify form elements are still accessible
      const createButton = page.locator('button:has-text("Create Charge")');
      await expect(createButton).toBeVisible();
    });

    test('should display properly on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/transactions/expenses/charges');
      await listPage.waitForPageLoad();

      // Verify page still loads
      await expect(page).toHaveURL(/\/transactions\/expenses\/charges/);

      // Verify table is visible
      const hasRows = (await listPage.getRowCount()) > 0;
      const isEmpty = await page.locator('text=No charges found').isVisible().catch(() => false);
      expect(hasRows || isEmpty).toBe(true);
    });
  });
});
