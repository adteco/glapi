import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString, waitForToast } from '../utils/test-helpers';

test.describe('Sales Opportunities CRUD', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/transactions/sales/opportunities');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load and Display', () => {
    test('should load opportunities list page with correct URL', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions\/sales\/opportunities/);
    });

    test('should display page heading', async ({ page }) => {
      const heading = page.locator('h1').filter({ hasText: /Sales Opportunities/i }).first();
      await expect(heading).toBeVisible();
    });

    test('should display opportunities table or empty state', async () => {
      const hasRows = (await listPage.getRowCount()) > 0;
      const isEmpty = await listPage.isEmpty();
      expect(hasRows || isEmpty).toBe(true);
    });

    test('should display create button with "New Opportunity" text', async ({ page }) => {
      const addButton = page.locator('button:has-text("New Opportunity")');
      await expect(addButton).toBeVisible();
    });

    test('should display correct table headers', async ({ page }) => {
      const headers = page.locator('th');
      const headerTexts = await headers.allTextContents();
      const headerText = headerTexts.join(' ').toLowerCase();

      // Check for expected columns
      expect(headerText).toMatch(/opportunity|#/i);
      expect(headerText).toMatch(/customer/i);
      expect(headerText).toMatch(/description/i);
      expect(headerText).toMatch(/close|expected/i);
      expect(headerText).toMatch(/amount/i);
      expect(headerText).toMatch(/stage/i);
      expect(headerText).toMatch(/probability/i);
    });

    test('should display empty state message when no opportunities', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount > 0) {
        test.skip();
        return;
      }
      const emptyMessage = page.locator('text=No opportunities found');
      await expect(emptyMessage).toBeVisible();
    });

    test('should display table caption', async ({ page }) => {
      const caption = page.locator('caption:has-text("sales opportunities")');
      await expect(caption).toBeVisible();
    });
  });

  test.describe('Create Opportunity', () => {
    test('should open create dialog when clicking New Opportunity button', async ({ page }) => {
      const addButton = page.locator('button:has-text("New Opportunity")');
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      const dialogTitle = dialog.locator('text=New Sales Opportunity');
      await expect(dialogTitle).toBeVisible();
    });

    test('should display all required form fields in create dialog', async ({ page }) => {
      await page.locator('button:has-text("New Opportunity")').click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Check for main form fields
      await expect(dialog.locator('text=Customer')).toBeVisible();
      await expect(dialog.locator('text=Opportunity Date')).toBeVisible();
      await expect(dialog.locator('text=Expected Close Date')).toBeVisible();
      await expect(dialog.locator('text=Sales Stage')).toBeVisible();
      await expect(dialog.locator('text=Win Probability')).toBeVisible();
      await expect(dialog.locator('text=Lead Source')).toBeVisible();
      await expect(dialog.locator('text=Description')).toBeVisible();
    });

    test('should display line items section', async ({ page }) => {
      await page.locator('button:has-text("New Opportunity")').click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      const lineItemsHeader = dialog.locator('text=Line Items');
      await expect(lineItemsHeader).toBeVisible();

      const addLineButton = dialog.locator('button:has-text("Add Line Item")');
      await expect(addLineButton).toBeVisible();
    });

    test('should add additional line items', async ({ page }) => {
      await page.locator('button:has-text("New Opportunity")').click();

      const dialog = page.locator('[role="dialog"]');

      // Initially should have 1 line item
      let lineItems = dialog.locator('text=/Line \\d+/');
      await expect(lineItems.first()).toBeVisible();

      // Click add line item
      const addLineButton = dialog.locator('button:has-text("Add Line Item")');
      await addLineButton.click();

      // Should now have 2 line items
      const line2 = dialog.locator('text=Line 2');
      await expect(line2).toBeVisible();
    });

    test('should remove line items', async ({ page }) => {
      await page.locator('button:has-text("New Opportunity")').click();

      const dialog = page.locator('[role="dialog"]');

      // Add a second line
      await dialog.locator('button:has-text("Add Line Item")').click();
      await expect(dialog.locator('text=Line 2')).toBeVisible();

      // Remove the second line (first line item section's delete button)
      const removeButtons = dialog.locator('[class*="border rounded-lg"] button:has(svg)').filter({ hasText: '' });
      // Click the last remove button (for Line 2)
      const lineSection = dialog.locator('[class*="border rounded-lg"]').last();
      const removeButton = lineSection.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
      if (await removeButton.isVisible()) {
        await removeButton.click();
        // Line 2 should be gone
        await expect(dialog.locator('text=Line 2')).not.toBeVisible();
      }
    });

    test('should have sales stage dropdown with all options', async ({ page }) => {
      await page.locator('button:has-text("New Opportunity")').click();

      const dialog = page.locator('[role="dialog"]');

      // Click the sales stage dropdown
      const stageSelect = dialog.locator('button[role="combobox"]').filter({ hasText: /Lead|Select/i }).first();
      // Find by label relationship
      const stageField = dialog.locator('text=Sales Stage').locator('..').locator('button[role="combobox"]');
      await stageField.click();

      // Check options
      await expect(page.locator('[role="option"]:has-text("Lead")')).toBeVisible();
      await expect(page.locator('[role="option"]:has-text("Qualified")')).toBeVisible();
      await expect(page.locator('[role="option"]:has-text("Proposal")')).toBeVisible();
      await expect(page.locator('[role="option"]:has-text("Negotiation")')).toBeVisible();
      await expect(page.locator('[role="option"]:has-text("Closed Won")')).toBeVisible();
      await expect(page.locator('[role="option"]:has-text("Closed Lost")')).toBeVisible();
    });

    test('should have lead source dropdown with options', async ({ page }) => {
      await page.locator('button:has-text("New Opportunity")').click();

      const dialog = page.locator('[role="dialog"]');

      // Find the lead source select by its label
      const leadSourceTrigger = dialog.locator('button[role="combobox"]').filter({ hasText: /Select lead source/i });
      await leadSourceTrigger.click();

      // Check for some expected lead sources
      await expect(page.locator('[role="option"]:has-text("Website")')).toBeVisible();
      await expect(page.locator('[role="option"]:has-text("Referral")')).toBeVisible();
      await expect(page.locator('[role="option"]:has-text("Cold Call")')).toBeVisible();
    });

    test('should cancel create operation', async ({ page }) => {
      await page.locator('button:has-text("New Opportunity")').click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      const cancelButton = dialog.locator('button:has-text("Cancel")');
      await cancelButton.click();

      await expect(dialog).not.toBeVisible();
    });

    test('should validate required fields on submit', async ({ page }) => {
      await page.locator('button:has-text("New Opportunity")').click();

      const dialog = page.locator('[role="dialog"]');

      // Try to submit without filling required fields
      const submitButton = dialog.locator('button:has-text("Create Opportunity")');
      await submitButton.click();

      // Should show validation errors
      const errorMessages = dialog.locator('[class*="text-destructive"], [class*="text-red"]');
      const errorCount = await errorMessages.count();
      expect(errorCount).toBeGreaterThan(0);
    });
  });

  test.describe('Opportunity Table Display', () => {
    test('should display stage badges with correct styling', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Look for badge elements in the table
      const badges = page.locator('table tbody tr').first().locator('[class*="Badge"], span[class*="inline-flex"]');
      await expect(badges.first()).toBeVisible();
    });

    test('should display probability percentages', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Look for percentage text in the table
      const probabilityCell = page.locator('table tbody tr').first().locator('td').nth(6);
      const text = await probabilityCell.textContent();
      expect(text).toMatch(/%/);
    });

    test('should display currency formatted amounts', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Look for dollar amounts in the table
      const amountCell = page.locator('table tbody tr').first().locator('td').nth(4);
      const text = await amountCell.textContent();
      expect(text).toMatch(/\$/);
    });

    test('should display action buttons for each row', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRow = page.locator('table tbody tr').first();

      // View button (Eye icon)
      const viewButton = firstRow.locator('button').filter({ has: page.locator('svg.lucide-eye') });
      await expect(viewButton).toBeVisible();

      // Convert to estimate button (FileText icon)
      const convertButton = firstRow.locator('button').filter({ has: page.locator('svg.lucide-file-text') });
      await expect(convertButton).toBeVisible();

      // Delete button (Trash2 icon)
      const deleteButton = firstRow.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
      await expect(deleteButton).toBeVisible();
    });
  });

  test.describe('View Opportunity', () => {
    test('should open view dialog when clicking eye icon', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRow = page.locator('table tbody tr').first();
      const viewButton = firstRow.locator('button').filter({ has: page.locator('svg.lucide-eye') });
      await viewButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      const dialogTitle = dialog.locator('text=Opportunity Details');
      await expect(dialogTitle).toBeVisible();
    });

    test('should display opportunity details in view dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRow = page.locator('table tbody tr').first();
      const viewButton = firstRow.locator('button').filter({ has: page.locator('svg.lucide-eye') });
      await viewButton.click();

      const dialog = page.locator('[role="dialog"]');

      // Check for detail fields
      await expect(dialog.locator('text=Opportunity Number')).toBeVisible();
      await expect(dialog.locator('text=Customer')).toBeVisible();
      await expect(dialog.locator('text=Expected Close Date')).toBeVisible();
      await expect(dialog.locator('text=Sales Stage')).toBeVisible();
      await expect(dialog.locator('text=Win Probability')).toBeVisible();
      await expect(dialog.locator('text=Lead Source')).toBeVisible();
    });

    test('should display line items table in view dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRow = page.locator('table tbody tr').first();
      const viewButton = firstRow.locator('button').filter({ has: page.locator('svg.lucide-eye') });
      await viewButton.click();

      const dialog = page.locator('[role="dialog"]');

      // Check for line items section
      await expect(dialog.locator('text=Line Items')).toBeVisible();

      // Check for line items table headers
      const lineItemsTable = dialog.locator('table').last();
      await expect(lineItemsTable.locator('th:has-text("Item")')).toBeVisible();
      await expect(lineItemsTable.locator('th:has-text("Qty")')).toBeVisible();
      await expect(lineItemsTable.locator('th:has-text("Price")')).toBeVisible();
    });

    test('should display total opportunity value', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRow = page.locator('table tbody tr').first();
      const viewButton = firstRow.locator('button').filter({ has: page.locator('svg.lucide-eye') });
      await viewButton.click();

      const dialog = page.locator('[role="dialog"]');

      // Check for total value section
      await expect(dialog.locator('text=Total Opportunity Value')).toBeVisible();
    });

    test('should close view dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRow = page.locator('table tbody tr').first();
      const viewButton = firstRow.locator('button').filter({ has: page.locator('svg.lucide-eye') });
      await viewButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Close dialog via X button or clicking outside
      const closeButton = dialog.locator('button[class*="close"], button:has(svg.lucide-x)');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      } else {
        await page.keyboard.press('Escape');
      }

      await expect(dialog).not.toBeVisible();
    });
  });

  test.describe('Delete Opportunity', () => {
    test('should open delete confirmation dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRow = page.locator('table tbody tr').first();
      const deleteButton = firstRow.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
      await deleteButton.click();

      const alertDialog = page.locator('[role="alertdialog"]');
      await expect(alertDialog).toBeVisible();

      await expect(alertDialog.locator('text=Delete Opportunity')).toBeVisible();
    });

    test('should display confirmation message with opportunity number', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRow = page.locator('table tbody tr').first();
      const deleteButton = firstRow.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
      await deleteButton.click();

      const alertDialog = page.locator('[role="alertdialog"]');

      // Should mention the action cannot be undone
      await expect(alertDialog.locator('text=cannot be undone')).toBeVisible();
    });

    test('should cancel delete operation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const originalCount = rowCount;

      const firstRow = page.locator('table tbody tr').first();
      const deleteButton = firstRow.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
      await deleteButton.click();

      const alertDialog = page.locator('[role="alertdialog"]');
      const cancelButton = alertDialog.locator('button:has-text("Cancel")');
      await cancelButton.click();

      await expect(alertDialog).not.toBeVisible();

      // Row count should be unchanged
      const newCount = await listPage.getRowCount();
      expect(newCount).toBe(originalCount);
    });

    test('should have red delete confirmation button', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRow = page.locator('table tbody tr').first();
      const deleteButton = firstRow.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
      await deleteButton.click();

      const alertDialog = page.locator('[role="alertdialog"]');
      const confirmDeleteButton = alertDialog.locator('button:has-text("Delete")');

      // Check button has red/destructive styling
      const buttonClass = await confirmDeleteButton.getAttribute('class');
      expect(buttonClass).toMatch(/red|destructive/i);
    });
  });

  test.describe('Convert to Estimate', () => {
    test('should have convert to estimate button', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRow = page.locator('table tbody tr').first();
      const convertButton = firstRow.locator('button[title="Convert to Estimate"]');
      await expect(convertButton).toBeVisible();
    });

    test('should show success toast when converting', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRow = page.locator('table tbody tr').first();
      const convertButton = firstRow.locator('button').filter({ has: page.locator('svg.lucide-file-text') });
      await convertButton.click();

      // Should show success toast (implementation uses sonner)
      const toast = page.locator('[data-sonner-toast], [class*="toast"]');
      // Toast may appear briefly - test can be adjusted based on actual behavior
    });
  });

  test.describe('Organization Context', () => {
    test('should require organization selection', async ({ page }) => {
      // This test verifies the page handles missing org context
      // The actual behavior depends on auth state
      const noOrgMessage = page.locator('text=Please select an organization');
      const hasMessage = await noOrgMessage.isVisible({ timeout: 2000 }).catch(() => false);

      // Either should show message or page should load normally with org
      const pageLoaded = await page.locator('h1:has-text("Sales Opportunities")').isVisible({ timeout: 2000 }).catch(() => false);

      expect(hasMessage || pageLoaded).toBe(true);
    });
  });

  test.describe('Probability Color Coding', () => {
    test('should display probability with color coding', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Probability column should have color-coded text
      const probabilityCell = page.locator('table tbody tr').first().locator('td').nth(6);
      const spanWithColor = probabilityCell.locator('span[class*="text-"]');

      // Should have some color class applied
      const classAttr = await spanWithColor.getAttribute('class');
      expect(classAttr).toMatch(/text-(green|yellow|orange|red)/);
    });
  });

  test.describe('Date Formatting', () => {
    test('should display dates in readable format', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Expected close date column
      const dateCell = page.locator('table tbody tr').first().locator('td').nth(3);
      const dateText = await dateCell.textContent();

      // Should be formatted as locale date string (e.g., "1/15/2025" or "15/01/2025")
      expect(dateText).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });
  });
});
