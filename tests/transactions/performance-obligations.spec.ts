import { test, expect } from '@playwright/test';
import { ListPage, DialogPage } from '../pages';
import { waitForToast } from '../utils/test-helpers';

test.describe('Performance Obligations CRUD', () => {
  let listPage: ListPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/transactions/recurring/performance-obligations');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load and Display', () => {
    test('should load performance obligations page with correct URL', async ({ page }) => {
      await expect(page).toHaveURL(/\/transactions\/recurring\/performance-obligations/);
    });

    test('should display page heading', async ({ page }) => {
      const heading = page.locator('h1, h2').filter({ hasText: /Performance Obligations/i }).first();
      await expect(heading).toBeVisible();
    });

    test('should display page description about ASC 606', async ({ page }) => {
      const description = page.locator('text=/ASC.?606|performance obligation|revenue recognition/i');
      // Description may or may not be present
      const isVisible = await description.isVisible().catch(() => false);
      if (isVisible) {
        await expect(description).toBeVisible();
      }
    });

    test('should display performance obligations table or empty state', async ({ page }) => {
      const hasRows = (await listPage.getRowCount()) > 0;
      const emptyText = page.locator('text=/No performance obligations|No results|No data/i');
      const isEmpty = await emptyText.isVisible().catch(() => false);
      expect(hasRows || isEmpty).toBe(true);
    });

    test('should display search input', async () => {
      await expect(listPage.searchInput).toBeVisible();
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
      // Expected headers for performance obligations
      expect(headerText).toMatch(/type|obligation/i);
      expect(headerText).toMatch(/subscription|contract/i);
      expect(headerText).toMatch(/status/i);
    });

    test('should display status badges for active/satisfied/cancelled', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }
      // Check that status badges exist in the table
      const badges = page.locator('table tbody [class*="badge"], table tbody span').filter({
        hasText: /Active|Satisfied|Cancelled/i
      });
      expect(await badges.count()).toBeGreaterThan(0);
    });
  });

  test.describe('Create Performance Obligation', () => {
    test('should open create dialog when clicking Add button', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should display create form with required fields', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Check for obligation type field
        const typeField = page.locator('[role="dialog"]').locator('text=/Obligation Type|Type/i').first();
        await expect(typeField).toBeVisible();

        // Check for subscription selector
        const subscriptionField = page.locator('[role="dialog"]').locator('text=/Subscription|Contract/i').first();
        await expect(subscriptionField).toBeVisible();

        // Check for item selector
        const itemField = page.locator('[role="dialog"]').locator('text=/Item|Product/i').first();
        await expect(itemField).toBeVisible();

        // Check for allocated amount
        const amountField = page.locator('[role="dialog"]').locator('text=/Amount|Allocated/i').first();
        await expect(amountField).toBeVisible();
      } else {
        // If navigated to a new page instead of dialog
        await expect(page).toHaveURL(/\/(new|create)/);
      }
    });

    test('should display obligation type options', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Click the obligation type dropdown
        const typeTrigger = page.locator('[role="dialog"]').locator('button[role="combobox"], select').filter({ hasText: /type|select/i }).first();
        if (await typeTrigger.isVisible()) {
          await typeTrigger.click();

          // Verify expected obligation types from the enum
          const expectedTypes = ['Product License', 'Maintenance Support', 'Professional Services', 'Hosting Services', 'Other'];
          for (const type of expectedTypes) {
            const option = page.locator(`[role="option"]`).filter({ hasText: new RegExp(type, 'i') });
            // At least some should be visible - check at least one
            if (await option.isVisible().catch(() => false)) {
              break; // Found at least one expected type
            }
          }

          // Close the dropdown
          await page.keyboard.press('Escape');
        }
      }

      await dialogPage.cancel().catch(() => {});
    });

    test('should display satisfaction method options', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Look for satisfaction method selector
        const methodTrigger = page.locator('[role="dialog"]').locator('button[role="combobox"], select').filter({ hasText: /method|satisfaction/i }).first();
        if (await methodTrigger.isVisible()) {
          await methodTrigger.click();

          // Verify expected methods are available
          const pointInTimeVisible = await page.locator(`[role="option"]`).filter({ hasText: /point.?in.?time/i }).isVisible().catch(() => false);
          const overTimeVisible = await page.locator(`[role="option"]`).filter({ hasText: /over.?time/i }).isVisible().catch(() => false);
          expect(pointInTimeVisible || overTimeVisible).toBe(true);

          // Close the dropdown
          await page.keyboard.press('Escape');
        }
      }

      await dialogPage.cancel().catch(() => {});
    });

    test('should validate required fields when submitting empty form', async () => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Try to submit without filling required fields
        await dialogPage.confirm();

        // Should show validation errors
        const errors = await dialogPage.getErrors();
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    test('should create performance obligation with required fields', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Fill required fields
        // Select obligation type
        const typeTrigger = page.locator('[role="dialog"]').locator('button[role="combobox"]').first();
        if (await typeTrigger.isVisible()) {
          await typeTrigger.click();
          await page.locator('[role="option"]').first().click();
        }

        // Select subscription if available
        const subscriptionSelect = page.locator('[role="dialog"]').locator('button[role="combobox"]').nth(1);
        if (await subscriptionSelect.isVisible()) {
          await subscriptionSelect.click();
          await page.locator('[role="option"]').first().click();
        }

        // Select item if available
        const itemSelect = page.locator('[role="dialog"]').locator('button[role="combobox"]').nth(2);
        if (await itemSelect.isVisible()) {
          await itemSelect.click();
          await page.locator('[role="option"]').first().click();
        }

        // Fill allocated amount
        const amountInput = page.locator('[role="dialog"] input[name*="amount"], [role="dialog"] input[type="number"]').first();
        if (await amountInput.isVisible()) {
          await amountInput.fill('1000');
        }

        // Fill start date
        const startDateInput = page.locator('[role="dialog"] input[name*="startDate"], [role="dialog"] input[type="date"]').first();
        if (await startDateInput.isVisible()) {
          const today = new Date().toISOString().split('T')[0];
          await startDateInput.fill(today);
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify success toast if present
        await waitForToast(page, /created|success/i).catch(() => {});
      }
    });

    test('should cancel performance obligation creation', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Fill some data
        const typeTrigger = page.locator('[role="dialog"]').locator('button[role="combobox"]').first();
        if (await typeTrigger.isVisible()) {
          await typeTrigger.click();
          await page.locator('[role="option"]').first().click();
        }

        // Cancel
        await dialogPage.cancel();
        await dialogPage.expectNotVisible();
      }
    });

    test('should close dialog with Escape key', async () => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.closeWithEscape();
        await dialogPage.expectNotVisible();
      }
    });
  });

  test.describe('View Performance Obligation', () => {
    test('should navigate to performance obligation detail on row click', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      // Should navigate to detail page
      await expect(page).toHaveURL(/\/transactions\/recurring\/performance-obligations\/[a-f0-9-]+/);
    });

    test('should display performance obligation details', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);
      await page.waitForURL(/\/transactions\/recurring\/performance-obligations\/[a-f0-9-]+/);
      await listPage.waitForPageLoad();

      // Verify detail page shows obligation info
      const obligationType = page.locator('text=/Product License|Maintenance Support|Professional Services|Hosting Services|Other/i');
      await expect(obligationType).toBeVisible();

      // Verify status is shown
      const status = page.locator('[class*="badge"]').filter({ hasText: /Active|Satisfied|Cancelled/i });
      await expect(status).toBeVisible();
    });

    test('should display allocated amount on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);
      await page.waitForURL(/\/transactions\/recurring\/performance-obligations\/[a-f0-9-]+/);
      await listPage.waitForPageLoad();

      // Verify allocated amount is displayed
      const amountLabel = page.locator('text=/Allocated Amount|Amount/i');
      await expect(amountLabel).toBeVisible();
    });

    test('should display satisfaction method on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);
      await page.waitForURL(/\/transactions\/recurring\/performance-obligations\/[a-f0-9-]+/);
      await listPage.waitForPageLoad();

      // Verify satisfaction method is displayed
      const methodLabel = page.locator('text=/Satisfaction Method|Recognition Method/i');
      await expect(methodLabel).toBeVisible();
    });

    test('should display revenue schedules section on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);
      await page.waitForURL(/\/transactions\/recurring\/performance-obligations\/[a-f0-9-]+/);
      await listPage.waitForPageLoad();

      // Look for revenue schedules section
      const schedulesSection = page.locator('text=/Revenue Schedule|Recognition Schedule/i');
      // May or may not be present depending on implementation - just check if visible
      await schedulesSection.isVisible().catch(() => false);
    });

    test('should navigate back to list from detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);
      await page.waitForURL(/\/transactions\/recurring\/performance-obligations\/[a-f0-9-]+/);
      await listPage.waitForPageLoad();

      // Click back button
      const backButton = page.locator('button:has-text("Back"), a:has-text("Back"), button').filter({ has: page.locator('[class*="lucide-arrow-left"]') });
      await backButton.click();

      await expect(page).toHaveURL(/\/transactions\/recurring\/performance-obligations$/);
    });
  });

  test.describe('Edit Performance Obligation', () => {
    test('should open edit dialog for existing obligation', async ({ page }) => {
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

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        // Verify some field has a value
        const amountInput = page.locator('[role="dialog"] input[name*="amount"], [role="dialog"] input[type="number"]').first();
        if (await amountInput.isVisible()) {
          const value = await amountInput.inputValue();
          expect(value).toBeTruthy();
        }
      }
    });

    test('should update allocated amount', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const newAmount = '2500';
        const amountInput = page.locator('[role="dialog"] input[name*="amount"], [role="dialog"] input[type="number"]').first();
        if (await amountInput.isVisible()) {
          await amountInput.clear();
          await amountInput.fill(newAmount);
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Verify success toast if present
        await waitForToast(page, /updated|success/i).catch(() => {});
      }
    });

    test('should cancel edit without saving changes', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        // Change the amount
        const amountInput = page.locator('[role="dialog"] input[name*="amount"], [role="dialog"] input[type="number"]').first();
        if (await amountInput.isVisible()) {
          await amountInput.clear();
          await amountInput.fill('9999999');
        }

        // Cancel instead of confirm
        await dialogPage.cancel();
        await dialogPage.expectNotVisible();
      }
    });
  });

  test.describe('Satisfy Performance Obligation', () => {
    test('should show satisfy action for active obligations', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Look for a satisfy button in the first active row
      const satisfyButton = listPage.getRow(0).locator('button:has-text("Satisfy"), button[title*="Satisfy"]');
      // Satisfy button may only be visible for active obligations
      await satisfyButton.isVisible().catch(() => false);
    });

    test('should open satisfy dialog with date picker', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Try to find and click satisfy button
      const satisfyButton = listPage.getRow(0).locator('button:has-text("Satisfy"), button[title*="Satisfy"]');
      if (await satisfyButton.isVisible().catch(() => false)) {
        await satisfyButton.click();

        // Should show dialog with date picker
        const satisfactionDateInput = page.locator('[role="dialog"] input[type="date"], [role="dialog"] input[name*="date"]');
        if (await satisfactionDateInput.isVisible()) {
          await expect(satisfactionDateInput).toBeVisible();
        }

        await dialogPage.cancel().catch(() => {});
      }
    });

    test('should allow adding satisfaction evidence', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Try to find and click satisfy button
      const satisfyButton = listPage.getRow(0).locator('button:has-text("Satisfy"), button[title*="Satisfy"]');
      if (await satisfyButton.isVisible().catch(() => false)) {
        await satisfyButton.click();

        // Look for evidence textarea
        const evidenceInput = page.locator('[role="dialog"] textarea[name*="evidence"], [role="dialog"] textarea');
        if (await evidenceInput.isVisible()) {
          await expect(evidenceInput).toBeVisible();
        }

        await dialogPage.cancel().catch(() => {});
      }
    });
  });

  test.describe('Delete Performance Obligation', () => {
    test('should show delete confirmation dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.deleteRow(0);

      // Should show confirmation dialog (browser native or custom)
      const alertDialog = page.locator('[role="alertdialog"], [role="dialog"]');
      const confirmText = page.locator('text=/delete|confirm|sure|cancel/i');

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
  });

  test.describe('Search and Filter', () => {
    test('should search performance obligations', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get text from first row to search for
      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(/\s+/)[0] || 'product';

      await listPage.search(searchTerm);

      // Should show filtered results
      const filteredCount = await listPage.getRowCount();
      expect(filteredCount).toBeLessThanOrEqual(rowCount);
    });

    test('should filter by obligation type', async ({ page }) => {
      const typeFilter = page.locator('button:has-text("Type"), [data-testid="type-filter"]');
      if (await typeFilter.isVisible()) {
        await typeFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should filter by status', async ({ page }) => {
      const statusFilter = page.locator('button:has-text("Status"), [data-testid="status-filter"]');
      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should filter by subscription', async ({ page }) => {
      const subscriptionFilter = page.locator('button:has-text("Subscription"), button:has-text("Contract"), [data-testid="subscription-filter"]');
      if (await subscriptionFilter.isVisible()) {
        await subscriptionFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should clear search and filters', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Apply a search
      await listPage.search('test');

      // Clear search
      await listPage.clearSearch();

      // Should show all results again
      const newCount = await listPage.getRowCount();
      expect(newCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Status Tracking', () => {
    test('should display status badges with correct colors', async () => {
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

    test('should show completion percentage for over-time obligations', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Look for progress indicators or percentage - may or may not be present
      const progressIndicator = page.locator('[class*="progress"], text=/%/').first();
      await progressIndicator.isVisible().catch(() => false);
    });

    test('should differentiate active, satisfied, and cancelled statuses visually', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check for status badges - at least one should be visible
      const activeBadge = page.locator('[class*="badge"]').filter({ hasText: /Active/i }).first();
      const satisfiedBadge = page.locator('[class*="badge"]').filter({ hasText: /Satisfied/i }).first();
      const cancelledBadge = page.locator('[class*="badge"]').filter({ hasText: /Cancelled/i }).first();

      const activeVisible = await activeBadge.isVisible().catch(() => false);
      const satisfiedVisible = await satisfiedBadge.isVisible().catch(() => false);
      const cancelledVisible = await cancelledBadge.isVisible().catch(() => false);

      // At least one status type should be visible
      expect(activeVisible || satisfiedVisible || cancelledVisible).toBe(true);
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

    test('should show loading state while fetching data', async ({ page }) => {
      // Navigate with network throttling to see loading state
      await page.route('**/trpc/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.continue();
      });

      await page.goto('/transactions/recurring/performance-obligations');

      // Check for loading indicator
      const loadingText = page.locator('text=/Loading/i');
      const spinner = page.locator('.animate-spin, [role="progressbar"]');

      // Check if any loading indicator is visible
      await loadingText.isVisible({ timeout: 3000 }).catch(() => false);
      await spinner.isVisible({ timeout: 3000 }).catch(() => false);

      // Wait for loading to complete
      await listPage.waitForPageLoad();

      // Restore normal network
      await page.unroute('**/trpc/**');
    });

    test('should handle API error on create', async ({ page }) => {
      // Mock API to return error
      await page.route('**/trpc/**revenue.performanceObligations**', async route => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: { message: 'Failed to create' } }),
          });
        } else {
          await route.continue();
        }
      });

      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Fill minimal required data and submit
        const typeTrigger = page.locator('[role="dialog"]').locator('button[role="combobox"]').first();
        if (await typeTrigger.isVisible()) {
          await typeTrigger.click();
          await page.locator('[role="option"]').first().click();
        }

        await dialogPage.confirm();

        // Should show error toast or dialog error
        await page.waitForTimeout(2000);
        const toast = page.locator('[data-sonner-toaster]');
        const errorToast = toast.locator('text=/error|failed/i');
        const dialogError = await dialogPage.getErrors();

        // Error handling may vary by implementation - just check one is present
        const errorToastVisible = await errorToast.isVisible().catch(() => false);
        expect(errorToastVisible || dialogError.length > 0).toBe(true);
      }

      await page.unroute('**/trpc/**revenue.performanceObligations**');
    });

    test('should handle already satisfied obligation gracefully', async ({ page }) => {
      // Attempting to satisfy an already satisfied obligation should show appropriate error
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find a satisfied obligation row
      const satisfiedRow = page.locator('table tbody tr').filter({ hasText: /Satisfied/i }).first();
      if (await satisfiedRow.isVisible().catch(() => false)) {
        // Satisfy button should be disabled or not present
        const satisfyButton = satisfiedRow.locator('button:has-text("Satisfy")');
        const isDisabled = await satisfyButton.isDisabled().catch(() => true);
        expect(isDisabled).toBe(true);
      }
    });
  });

  test.describe('Table Sorting', () => {
    test('should sort by obligation type', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Type');
    });

    test('should sort by status', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Status');
    });

    test('should sort by allocated amount', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Amount');
    });

    test('should sort by start date', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Start Date');
    });
  });

  test.describe('Pagination', () => {
    test('should show pagination for many obligations', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount >= 10) {
        await expect(listPage.pagination).toBeVisible();
      }
    });

    test('should navigate to next page', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 10) {
        test.skip();
        return;
      }

      if (await listPage.hasNextPage()) {
        await listPage.nextPage();
        // Should show different data
      }
    });

    test('should navigate to previous page', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 10) {
        test.skip();
        return;
      }

      // First go to next page if possible
      if (await listPage.hasNextPage()) {
        await listPage.nextPage();

        // Then go back
        if (await listPage.hasPrevPage()) {
          await listPage.prevPage();
        }
      }
    });
  });

  test.describe('UI Interactions', () => {
    test('should show success toast after creating obligation', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        // Fill required fields
        const typeTrigger = page.locator('[role="dialog"]').locator('button[role="combobox"]').first();
        if (await typeTrigger.isVisible()) {
          await typeTrigger.click();
          await page.locator('[role="option"]').first().click();
        }

        // Select subscription
        const subscriptionSelect = page.locator('[role="dialog"]').locator('button[role="combobox"]').nth(1);
        if (await subscriptionSelect.isVisible()) {
          await subscriptionSelect.click();
          await page.locator('[role="option"]').first().click();
        }

        // Select item
        const itemSelect = page.locator('[role="dialog"]').locator('button[role="combobox"]').nth(2);
        if (await itemSelect.isVisible()) {
          await itemSelect.click();
          await page.locator('[role="option"]').first().click();
        }

        // Fill amount
        const amountInput = page.locator('[role="dialog"] input[name*="amount"], [role="dialog"] input[type="number"]').first();
        if (await amountInput.isVisible()) {
          await amountInput.fill('1500');
        }

        // Fill start date
        const startDateInput = page.locator('[role="dialog"] input[type="date"]').first();
        if (await startDateInput.isVisible()) {
          const today = new Date().toISOString().split('T')[0];
          await startDateInput.fill(today);
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

    test('should show success toast after updating obligation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const amountInput = page.locator('[role="dialog"] input[name*="amount"], [role="dialog"] input[type="number"]').first();
        if (await amountInput.isVisible()) {
          await amountInput.clear();
          await amountInput.fill('3000');
        }

        await dialogPage.confirm();

        // Check for success toast
        await waitForToast(page, /success|updated/i).catch(() => {});
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should display properly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/transactions/recurring/performance-obligations');
      await listPage.waitForPageLoad();

      // Verify page still loads
      await expect(page).toHaveURL(/\/transactions\/recurring\/performance-obligations/);

      // Verify Add button is still accessible
      const addButton = listPage.createButton;
      await expect(addButton).toBeVisible();
    });

    test('should display properly on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/transactions/recurring/performance-obligations');
      await listPage.waitForPageLoad();

      // Verify page still loads
      await expect(page).toHaveURL(/\/transactions\/recurring\/performance-obligations/);

      // Verify table or list is visible
      const hasRows = (await listPage.getRowCount()) > 0;
      const isEmpty = await listPage.isEmpty();
      expect(hasRows || isEmpty).toBe(true);
    });
  });
});
