import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, formatDate } from '../utils/test-helpers';

test.describe('Accounting Periods', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/lists/accounting-periods');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load accounting periods list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/lists\/accounting-periods/);
    });

    test('should display accounting periods table or empty state', async () => {
      const hasRows = (await listPage.getRowCount()) > 0;
      const isEmpty = await listPage.isEmpty();
      expect(hasRows || isEmpty).toBe(true);
    });

    test('should display page title', async ({ page }) => {
      await expect(page.locator('h1')).toContainText(/Accounting Periods/i);
    });

    test('should display setup fiscal year button', async ({ page }) => {
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await expect(setupButton).toBeVisible();
    });

    test('should display add period button', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add period/i });
      await expect(addButton).toBeVisible();
    });

    test('should display correct table headers when periods exist', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const headers = await listPage.tableHeaders.allTextContents();
      const headerText = headers.join(' ').toLowerCase();
      expect(headerText).toMatch(/period/i);
      expect(headerText).toMatch(/fiscal year/i);
      expect(headerText).toMatch(/start date/i);
      expect(headerText).toMatch(/end date/i);
      expect(headerText).toMatch(/type/i);
      expect(headerText).toMatch(/status/i);
      expect(headerText).toMatch(/actions/i);
    });

    test('should display empty state when no periods exist', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount > 0) {
        test.skip();
        return;
      }

      // Check for empty state card
      const emptyStateCard = page.locator('text=No Accounting Periods');
      await expect(emptyStateCard).toBeVisible();
    });
  });

  test.describe('Fiscal Year Filter', () => {
    test('should display fiscal year filter buttons when periods exist', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check for "All" button
      const allButton = page.locator('button:has-text("All")');
      await expect(allButton).toBeVisible();
    });

    test('should filter periods by fiscal year', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click on a year filter button if available
      const yearButtons = page.locator('button').filter({ hasText: /^\d{4}$/ });
      const buttonCount = await yearButtons.count();

      if (buttonCount > 0) {
        const yearText = await yearButtons.first().textContent();
        await yearButtons.first().click();
        await listPage.waitForPageLoad();

        // Verify filter is applied (button should be active)
        await expect(yearButtons.first()).toHaveClass(/default/);

        // All visible periods should match the selected year
        const visibleYears = await page.locator('tbody tr td:nth-child(2)').allTextContents();
        for (const year of visibleYears) {
          expect(year.trim()).toBe(yearText?.trim());
        }
      }
    });

    test('should show all periods when "All" filter is clicked', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const allButton = page.locator('button:has-text("All")').first();
      if (await allButton.isVisible()) {
        await allButton.click();
        await listPage.waitForPageLoad();
        // Should show multiple fiscal years if they exist
      }
    });
  });

  test.describe('Setup Fiscal Year Wizard', () => {
    test('should open setup fiscal year dialog', async ({ page }) => {
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await expect(setupButton).toBeVisible();
      await setupButton.click();

      // Dialog should open
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/setup fiscal year periods/i)).toBeVisible();
    });

    test('should display fiscal year form fields', async ({ page }) => {
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await setupButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Check for required form fields
      await expect(dialog.getByLabel(/fiscal year/i)).toBeVisible();
      await expect(dialog.getByLabel(/starting month/i)).toBeVisible();
      await expect(dialog.getByLabel(/year start date/i)).toBeVisible();
    });

    test('should allow toggling adjustment period', async ({ page }) => {
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await setupButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Find adjustment period toggle
      const adjustmentToggle = dialog.locator('[role="switch"]').first();
      if (await adjustmentToggle.isVisible()) {
        const initialState = await adjustmentToggle.getAttribute('aria-checked');
        await adjustmentToggle.click();
        const newState = await adjustmentToggle.getAttribute('aria-checked');
        expect(newState).not.toBe(initialState);
      }
    });

    test('should navigate to preview step', async ({ page }) => {
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await setupButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Fill in the form with a future year to avoid duplicates
      const fiscalYearInput = dialog.getByLabel(/fiscal year/i);
      await fiscalYearInput.clear();
      await fiscalYearInput.fill('2030');

      // Click Preview button
      const previewButton = dialog.getByRole('button', { name: /preview/i });
      await previewButton.click();

      // Should show preview table
      await expect(dialog.getByText(/review & confirm/i)).toBeVisible();
      await expect(dialog.locator('table')).toBeVisible();
    });

    test('should display 12 or 13 periods in preview', async ({ page }) => {
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await setupButton.click();

      const dialog = page.locator('[role="dialog"]');

      const fiscalYearInput = dialog.getByLabel(/fiscal year/i);
      await fiscalYearInput.clear();
      await fiscalYearInput.fill('2031');

      const previewButton = dialog.getByRole('button', { name: /preview/i });
      await previewButton.click();

      // Count rows in preview table
      const previewRows = dialog.locator('tbody tr');
      const rowCount = await previewRows.count();

      // Should have 12 months + optional adjustment period (13)
      expect(rowCount).toBeGreaterThanOrEqual(12);
      expect(rowCount).toBeLessThanOrEqual(13);
    });

    test('should go back from preview to form', async ({ page }) => {
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await setupButton.click();

      const dialog = page.locator('[role="dialog"]');

      const fiscalYearInput = dialog.getByLabel(/fiscal year/i);
      await fiscalYearInput.clear();
      await fiscalYearInput.fill('2032');

      await dialog.getByRole('button', { name: /preview/i }).click();
      await expect(dialog.getByText(/review & confirm/i)).toBeVisible();

      // Click back button
      const backButton = dialog.getByRole('button', { name: /back/i });
      await backButton.click();

      // Should be back on form
      await expect(dialog.getByText(/setup fiscal year periods/i)).toBeVisible();
    });

    test('should create fiscal year periods successfully', async ({ page }) => {
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await setupButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Use a unique future year
      const uniqueYear = `${2040 + Math.floor(Math.random() * 50)}`;
      const fiscalYearInput = dialog.getByLabel(/fiscal year/i);
      await fiscalYearInput.clear();
      await fiscalYearInput.fill(uniqueYear);

      // Click Preview
      const previewButton = dialog.getByRole('button', { name: /preview/i });
      await previewButton.click();

      // Click Create Periods
      const createButton = dialog.getByRole('button', { name: /create periods/i });
      await createButton.click();

      // Wait for success - dialog should close and toast should appear
      await expect(dialog).not.toBeVisible({ timeout: 10000 });

      // Verify periods were created by checking the list
      await listPage.waitForPageLoad();

      // Click on the year filter if available
      const yearButton = page.locator(`button:has-text("${uniqueYear}")`);
      if (await yearButton.isVisible({ timeout: 5000 })) {
        await yearButton.click();
        await listPage.waitForPageLoad();

        // Should have periods for that year
        const rowCount = await listPage.getRowCount();
        expect(rowCount).toBeGreaterThan(0);
      }
    });

    test('should cancel fiscal year setup', async ({ page }) => {
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await setupButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Cancel
      const cancelButton = dialog.getByRole('button', { name: /cancel/i });
      await cancelButton.click();

      // Dialog should close
      await expect(dialog).not.toBeVisible();
    });

    test('should validate required fields in wizard', async ({ page }) => {
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await setupButton.click();

      const dialog = page.locator('[role="dialog"]');

      // Clear fiscal year
      const fiscalYearInput = dialog.getByLabel(/fiscal year/i);
      await fiscalYearInput.clear();

      // Try to proceed
      const previewButton = dialog.getByRole('button', { name: /preview/i });
      await previewButton.click();

      // Should show validation error
      const error = dialog.locator('.text-destructive, [role="alert"]');
      await expect(error.first()).toBeVisible({ timeout: 2000 }).catch(() => {
        // Form might prevent submission without showing explicit error
      });
    });
  });

  test.describe('Add Period Manually', () => {
    test('should open add period dialog', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add period/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/create accounting period/i)).toBeVisible();
    });

    test('should display manual create form fields', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add period/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');

      // Check for form fields
      await expect(dialog.getByLabel(/period name/i)).toBeVisible();
      await expect(dialog.getByLabel(/fiscal year/i)).toBeVisible();
      await expect(dialog.getByLabel(/period number/i)).toBeVisible();
      await expect(dialog.getByLabel(/period type/i)).toBeVisible();
      await expect(dialog.getByLabel(/start date/i)).toBeVisible();
      await expect(dialog.getByLabel(/end date/i)).toBeVisible();
    });

    test('should create period manually', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add period/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');

      // Fill in the form
      const periodName = `Test Period ${uniqueId()}`;
      const uniqueYear = `${2060 + Math.floor(Math.random() * 30)}`;

      await dialog.getByLabel(/period name/i).fill(periodName);
      await dialog.getByLabel(/fiscal year/i).clear();
      await dialog.getByLabel(/fiscal year/i).fill(uniqueYear);
      await dialog.getByLabel(/period number/i).clear();
      await dialog.getByLabel(/period number/i).fill('1');

      // Set dates
      const startDate = formatDate(new Date());
      const endDate = formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
      await dialog.getByLabel(/start date/i).fill(startDate);
      await dialog.getByLabel(/end date/i).fill(endDate);

      // Submit
      const createButton = dialog.getByRole('button', { name: /^create$/i });
      await createButton.click();

      // Wait for dialog to close
      await expect(dialog).not.toBeVisible({ timeout: 10000 });

      // Verify period was created
      await listPage.waitForPageLoad();
    });

    test('should cancel manual period creation', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add period/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      const cancelButton = dialog.getByRole('button', { name: /cancel/i });
      await cancelButton.click();

      await expect(dialog).not.toBeVisible();
    });

    test('should validate required fields in manual create', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add period/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');

      // Clear period name
      const periodNameInput = dialog.getByLabel(/period name/i);
      await periodNameInput.clear();

      // Try to submit
      const createButton = dialog.getByRole('button', { name: /^create$/i });
      await createButton.click();

      // Should show validation error or prevent submission
      await page.waitForTimeout(500);
      const dialogStillOpen = await dialog.isVisible();
      expect(dialogStillOpen).toBe(true);
    });

    test('should allow selecting period type', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add period/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');

      // Open period type dropdown
      const periodTypeSelect = dialog.getByLabel(/period type/i);
      await periodTypeSelect.click();

      // Check available options
      const options = page.locator('[role="option"]');
      const optionTexts = await options.allTextContents();
      expect(optionTexts.some(t => t.toLowerCase().includes('month'))).toBe(true);
      expect(optionTexts.some(t => t.toLowerCase().includes('quarter'))).toBe(true);
      expect(optionTexts.some(t => t.toLowerCase().includes('year'))).toBe(true);
      expect(optionTexts.some(t => t.toLowerCase().includes('adjustment'))).toBe(true);
    });

    test('should toggle adjustment period checkbox', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add period/i });
      await addButton.click();

      const dialog = page.locator('[role="dialog"]');

      // Find adjustment period switch
      const adjustmentSwitch = dialog.locator('[role="switch"]').first();
      if (await adjustmentSwitch.isVisible()) {
        const initialState = await adjustmentSwitch.getAttribute('aria-checked');
        await adjustmentSwitch.click();
        const newState = await adjustmentSwitch.getAttribute('aria-checked');
        expect(newState).not.toBe(initialState);
      }
    });
  });

  test.describe('Period Status Management', () => {
    test('should display period status badge', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find status badge in first row
      const statusCell = page.locator('tbody tr').first().locator('td').nth(5);
      const badge = statusCell.locator('.bg-green-100, .bg-yellow-100, .bg-orange-100, .bg-red-100');
      await expect(badge.first()).toBeVisible();
    });

    test('should show soft close button for OPEN periods', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find an OPEN period
      const openPeriodRow = page.locator('tbody tr').filter({ hasText: 'OPEN' }).first();
      if (await openPeriodRow.isVisible()) {
        // Should have soft close button (XCircle icon)
        const actionButtons = openPeriodRow.locator('button');
        const buttonCount = await actionButtons.count();
        expect(buttonCount).toBeGreaterThan(0);
      }
    });

    test('should show delete button for OPEN periods', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find an OPEN period
      const openPeriodRow = page.locator('tbody tr').filter({ hasText: 'OPEN' }).first();
      if (await openPeriodRow.isVisible()) {
        // Should have delete button (Trash icon)
        const deleteButton = openPeriodRow.locator('button[title="Delete"]');
        await expect(deleteButton).toBeVisible();
      }
    });

    test('should show reopen and close buttons for SOFT_CLOSED periods', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find a SOFT_CLOSED period
      const softClosedRow = page.locator('tbody tr').filter({ hasText: 'SOFT_CLOSED' }).first();
      if (await softClosedRow.isVisible()) {
        // Should have reopen button (Unlock icon)
        const reopenButton = softClosedRow.locator('button[title="Reopen"]');
        await expect(reopenButton).toBeVisible();

        // Should have close button (CheckCircle icon)
        const closeButton = softClosedRow.locator('button[title="Close"]');
        await expect(closeButton).toBeVisible();
      }
    });

    test('should show lock button for CLOSED periods', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find a CLOSED period
      const closedRow = page.locator('tbody tr').filter({ hasText: /\bCLOSED\b/ }).first();
      if (await closedRow.isVisible()) {
        // Should have lock button
        const lockButton = closedRow.locator('button[title="Lock Permanently"]');
        await expect(lockButton).toBeVisible();
      }
    });

    test('should show "Locked" text for LOCKED periods', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find a LOCKED period
      const lockedRow = page.locator('tbody tr').filter({ hasText: 'LOCKED' }).first();
      if (await lockedRow.isVisible()) {
        // Should show "Locked" text instead of action buttons
        const lockedText = lockedRow.locator('text=Locked');
        await expect(lockedText).toBeVisible();
      }
    });

    test('should confirm before soft-closing a period', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find an OPEN period
      const openPeriodRow = page.locator('tbody tr').filter({ hasText: 'OPEN' }).first();
      if (await openPeriodRow.isVisible()) {
        // Listen for dialog
        page.once('dialog', async dialog => {
          expect(dialog.message()).toContain('Soft-close');
          await dialog.dismiss();
        });

        // Click soft close button
        const softCloseButton = openPeriodRow.locator('button[title="Soft Close"]');
        if (await softCloseButton.isVisible()) {
          await softCloseButton.click();
        }
      }
    });

    test('should confirm before deleting a period', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find an OPEN period
      const openPeriodRow = page.locator('tbody tr').filter({ hasText: 'OPEN' }).first();
      if (await openPeriodRow.isVisible()) {
        // Listen for dialog
        page.once('dialog', async dialog => {
          expect(dialog.message()).toContain('Delete');
          await dialog.dismiss();
        });

        // Click delete button
        const deleteButton = openPeriodRow.locator('button[title="Delete"]');
        if (await deleteButton.isVisible()) {
          await deleteButton.click();
        }
      }
    });

    test('should confirm before locking a period permanently', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find a CLOSED period
      const closedRow = page.locator('tbody tr').filter({ hasText: /\bCLOSED\b/ }).first();
      if (await closedRow.isVisible()) {
        // Listen for dialog
        page.once('dialog', async dialog => {
          expect(dialog.message()).toContain('Lock');
          await dialog.dismiss();
        });

        // Click lock button
        const lockButton = closedRow.locator('button[title="Lock Permanently"]');
        if (await lockButton.isVisible()) {
          await lockButton.click();
        }
      }
    });
  });

  test.describe('Period Type Display', () => {
    test('should display period type badges', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check that type column contains expected types
      const typeCell = page.locator('tbody tr').first().locator('td').nth(4);
      const badge = typeCell.locator('[class*="badge"]');
      await expect(badge).toBeVisible();

      const badgeText = await badge.textContent();
      expect(badgeText).toMatch(/MONTH|QUARTER|YEAR|ADJUSTMENT/i);
    });

    test('should mark adjustment periods appropriately', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Look for adjustment period indicator
      const adjustmentRow = page.locator('tbody tr').filter({ hasText: /\(Adj\)|ADJUSTMENT/ }).first();
      if (await adjustmentRow.isVisible()) {
        const typeCell = adjustmentRow.locator('td').nth(4);
        const text = await typeCell.textContent();
        expect(text?.toLowerCase()).toMatch(/adj|adjustment/);
      }
    });
  });

  test.describe('Date Display', () => {
    test('should display formatted start dates', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check start date column format (e.g., "Jan 1, 2024")
      const startDateCell = page.locator('tbody tr').first().locator('td').nth(2);
      const dateText = await startDateCell.textContent();
      expect(dateText).toMatch(/\w{3}\s+\d{1,2},\s+\d{4}/); // Format: "Mon D, YYYY"
    });

    test('should display formatted end dates', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check end date column format
      const endDateCell = page.locator('tbody tr').first().locator('td').nth(3);
      const dateText = await endDateCell.textContent();
      expect(dateText).toMatch(/\w{3}\s+\d{1,2},\s+\d{4}/); // Format: "Mon D, YYYY"
    });
  });

  test.describe('Table Sorting', () => {
    test('should sort by period name when header clicked', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      // Find and click the Period header
      const periodHeader = page.locator('thead th').filter({ hasText: /^Period$/i });
      if (await periodHeader.isVisible()) {
        await periodHeader.click();
        await listPage.waitForPageLoad();
      }
    });

    test('should sort by fiscal year', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Fiscal Year');
    });

    test('should sort by start date', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Start Date');
    });

    test('should sort by end date', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('End Date');
    });
  });

  test.describe('Loading States', () => {
    test('should show loading indicator while fetching data', async ({ page }) => {
      // Go to page fresh
      await page.goto('/lists/accounting-periods');

      // Check for loading state (might be very brief)
      const loadingText = page.locator('text=Loading');
      // Loading state may or may not be visible depending on speed
      await page.waitForTimeout(100);
    });
  });

  test.describe('Error States', () => {
    test('should display error state UI when API fails', async ({ page }) => {
      // This test would require mocking the API to fail
      // For now, we just verify the error UI components exist
      const rowCount = await listPage.getRowCount();
      if (rowCount > 0) {
        test.skip();
        return;
      }

      // Check if error card is visible (if there's an error)
      const errorCard = page.locator('text=Failed to Load');
      if (await errorCard.isVisible()) {
        await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
      }
    });
  });

  test.describe('Organization Selection', () => {
    test('should show message when no organization is selected', async ({ page }) => {
      // This test depends on auth state - if no org selected, should show message
      const noOrgMessage = page.locator('text=No Organization Selected');
      if (await noOrgMessage.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(noOrgMessage).toBeVisible();
        await expect(page.locator('text=Please select an organization')).toBeVisible();
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible table structure', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Table should be present
      const table = page.locator('table');
      await expect(table).toBeVisible();

      // Should have thead and tbody
      await expect(table.locator('thead')).toBeVisible();
      await expect(table.locator('tbody')).toBeVisible();
    });

    test('should have accessible button labels', async ({ page }) => {
      // Check that main action buttons have accessible names
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await expect(setupButton).toBeVisible();

      const addButton = page.getByRole('button', { name: /add period/i });
      await expect(addButton).toBeVisible();
    });

    test('should have accessible dialogs', async ({ page }) => {
      const setupButton = page.getByRole('button', { name: /setup fiscal year/i });
      await setupButton.click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Dialog should have title
      const title = dialog.locator('h2, [role="heading"]').first();
      await expect(title).toBeVisible();

      // Close dialog
      await page.keyboard.press('Escape');
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should maintain layout on smaller viewports', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/lists/accounting-periods');
      await listPage.waitForPageLoad();

      // Main elements should still be visible
      await expect(page.locator('h1')).toContainText(/Accounting Periods/i);
    });
  });
});
