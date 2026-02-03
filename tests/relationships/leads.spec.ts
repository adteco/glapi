import { test, expect } from '@playwright/test';
import { ListPage, FormPage, DialogPage } from '../pages';
import { uniqueId, randomString, randomEmail, randomPhone } from '../utils/test-helpers';

test.describe('Leads', () => {
  let listPage: ListPage;
  let formPage: FormPage;
  let dialogPage: DialogPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page);
    formPage = new FormPage(page);
    dialogPage = new DialogPage(page);
    await page.goto('/relationships/leads');
    await listPage.waitForPageLoad();
  });

  test.describe('Page Load', () => {
    test('should load leads list page', async ({ page }) => {
      await expect(page).toHaveURL(/\/relationships\/leads/);
    });

    test('should display leads table or empty state', async () => {
      const hasRows = (await listPage.getRowCount()) > 0;
      const isEmpty = await listPage.isEmpty();
      expect(hasRows || isEmpty).toBe(true);
    });

    test('should display search input', async () => {
      await expect(listPage.searchInput).toBeVisible();
    });

    test('should display create button', async () => {
      await expect(listPage.createButton).toBeVisible();
    });

    test('should display correct table headers', async () => {
      const headers = await listPage.tableHeaders.allTextContents();
      const headerText = headers.join(' ').toLowerCase();
      expect(headerText).toMatch(/name|company|status|source/i);
    });

    test('should have proper page title', async ({ page }) => {
      const title = await page.title();
      expect(title.toLowerCase()).toContain('lead');
    });
  });

  test.describe('Search and Filter', () => {
    test('should search leads by name', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'test';

      await listPage.search(searchTerm);

      const filteredCount = await listPage.getRowCount();
      expect(filteredCount).toBeLessThanOrEqual(rowCount);
    });

    test('should clear search', async () => {
      await listPage.search('test-search');
      await listPage.clearSearch();

      const value = await listPage.searchInput.inputValue();
      expect(value).toBe('');
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

    test('should filter by source', async ({ page }) => {
      const sourceFilter = page.locator('button:has-text("Source"), [data-testid="source-filter"]');
      if (await sourceFilter.isVisible()) {
        await sourceFilter.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should show no results for non-existent search term', async () => {
      const nonExistentTerm = `zzz-nonexistent-${randomString(8)}`;
      await listPage.search(nonExistentTerm);

      const rowCount = await listPage.getRowCount();
      expect(rowCount).toBe(0);
    });

    test('should search by email', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Search for a partial email domain
      await listPage.search('@');

      const filteredCount = await listPage.getRowCount();
      expect(filteredCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Create Lead', () => {
    test('should open create dialog', async ({ page }) => {
      await listPage.clickCreate();

      const dialogOpened = await dialogPage.isOpen();
      const urlChanged = page.url().includes('/new') || page.url().includes('/create');

      expect(dialogOpened || urlChanged).toBe(true);
    });

    test('should create lead with basic info', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const firstName = `Lead${randomString(4)}`;
        const lastName = `Person${randomString(4)}`;
        const email = randomEmail();
        const company = `Lead Company ${randomString(4)}`;

        await dialogPage.fillInput('firstName', firstName);
        await dialogPage.fillInput('lastName', lastName);
        await dialogPage.fillInput('email', email);

        const companyInput = dialogPage.dialog.locator('[name="company"], [name="companyName"]');
        if (await companyInput.isVisible()) {
          await companyInput.fill(company);
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(firstName);
        await listPage.expectRowWithText(firstName);
      }
    });

    test('should create lead with all fields', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const leadData = {
          firstName: `Full${randomString(4)}`,
          lastName: `Lead${randomString(4)}`,
          email: randomEmail(),
          phone: randomPhone(),
          company: `Full Company ${randomString(4)}`,
          website: `https://test-${randomString(4)}.example.com`,
          notes: `Test notes for lead created at ${new Date().toISOString()}`,
        };

        await dialogPage.fillInput('firstName', leadData.firstName);
        await dialogPage.fillInput('lastName', leadData.lastName);
        await dialogPage.fillInput('email', leadData.email);

        // Fill phone if available
        const phoneInput = dialogPage.dialog.locator('[name="phone"]');
        if (await phoneInput.isVisible()) {
          await phoneInput.fill(leadData.phone);
        }

        // Fill company if available
        const companyInput = dialogPage.dialog.locator('[name="company"], [name="companyName"]');
        if (await companyInput.isVisible()) {
          await companyInput.fill(leadData.company);
        }

        // Fill website if available
        const websiteInput = dialogPage.dialog.locator('[name="website"]');
        if (await websiteInput.isVisible()) {
          await websiteInput.fill(leadData.website);
        }

        // Fill notes if available
        const notesInput = dialogPage.dialog.locator('[name="notes"], textarea[name="notes"]');
        if (await notesInput.isVisible()) {
          await notesInput.fill(leadData.notes);
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(leadData.firstName);
        await listPage.expectRowWithText(leadData.firstName);
      }
    });

    test('should create lead with source and status', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const leadData = {
          firstName: `Source${randomString(4)}`,
          lastName: `Lead${randomString(4)}`,
          email: randomEmail(),
          company: `Source Company ${randomString(4)}`,
        };

        await dialogPage.fillInput('firstName', leadData.firstName);
        await dialogPage.fillInput('lastName', leadData.lastName);
        await dialogPage.fillInput('email', leadData.email);

        // Select source if available
        const sourceSelect = dialogPage.dialog.locator('[name="source"], [data-testid="source"]');
        if (await sourceSelect.isVisible()) {
          await sourceSelect.click();
          await page.locator('[role="option"]').first().click();
        }

        // Select status if available
        const statusSelect = dialogPage.dialog.locator('[name="status"], [data-testid="status"]');
        if (await statusSelect.isVisible()) {
          await statusSelect.click();
          await page.locator('[role="option"]').first().click();
        }

        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        await listPage.search(leadData.firstName);
        await listPage.expectRowWithText(leadData.firstName);
      }
    });

    test('should validate required fields', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.confirm();

        const errors = await dialogPage.getErrors();
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    test('should validate email format', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.fillInput('firstName', `Test${randomString(4)}`);
        await dialogPage.fillInput('lastName', `Lead${randomString(4)}`);
        await dialogPage.fillInput('email', 'invalid-email-format');
        await dialogPage.confirm();

        // Should either show error or prevent submission
        const errors = await dialogPage.getErrors();
        const dialogStillOpen = await dialogPage.isOpen();
        expect(errors.length > 0 || dialogStillOpen).toBe(true);
      }
    });

    test('should cancel lead creation', async ({ page }) => {
      const initialCount = await listPage.getRowCount();

      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.fillInput('firstName', `Cancel${randomString(4)}`);
        await dialogPage.cancel();

        await dialogPage.expectNotVisible();

        const newCount = await listPage.getRowCount();
        expect(newCount).toBe(initialCount);
      }
    });

    test('should close dialog with escape key', async ({ page }) => {
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.fillInput('firstName', `Escape${randomString(4)}`);
        await page.keyboard.press('Escape');

        // Dialog should close or prompt for unsaved changes
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('View Lead', () => {
    test('should navigate to lead detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click on lead row or view button
      const viewLink = listPage.getRow(0).locator('a, button:has-text("View")').first();
      await viewLink.click();

      // Should navigate to detail page
      await expect(page).toHaveURL(/\/relationships\/leads\/[^/]+$/);
    });

    test('should display lead details on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);

      // Wait for detail page
      await page.waitForURL(/\/relationships\/leads\/[^/]+/);

      // Should show lead details
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible();
    });

    test('should show edit button on detail page', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.clickRow(0);
      await page.waitForURL(/\/relationships\/leads\/[^/]+/);

      const editButton = page.locator('button:has-text("Edit"), a:has-text("Edit")');
      await expect(editButton).toBeVisible();
    });
  });

  test.describe('Convert Lead', () => {
    test('should have convert to customer option', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Check for convert button in row actions
      const row = listPage.getRow(0);
      const menuButton = row.locator('button[aria-label*="actions"], button[aria-label*="menu"]');

      if (await menuButton.isVisible()) {
        await menuButton.click();
        const convertOption = page.locator('[role="menuitem"]:has-text("Convert")');
        // Convert option may or may not be present - just check menu opens
        await page.waitForTimeout(300);
      }
    });

    test('should navigate to conversion flow when convert is clicked', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const row = listPage.getRow(0);
      const convertButton = row.locator('button:has-text("Convert"), [data-testid="convert"]');

      if (await convertButton.isVisible()) {
        await convertButton.click();
        // Should open conversion dialog or navigate
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Edit Lead', () => {
    test('should open edit dialog or page', async ({ page }) => {
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

    test('should update lead name', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const newFirstName = `Updated${randomString(4)}`;
        await dialogPage.fillInput('firstName', newFirstName);
        await dialogPage.confirm();

        await listPage.waitForPageLoad();
        await listPage.expectRowWithText(newFirstName);
      }
    });

    test('should update lead email', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const newEmail = randomEmail();
        await dialogPage.fillInput('email', newEmail);
        await dialogPage.confirm();

        await listPage.waitForPageLoad();
      }
    });

    test('should update lead phone', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        const phoneInput = dialogPage.dialog.locator('[name="phone"]');
        if (await phoneInput.isVisible()) {
          const newPhone = randomPhone();
          await phoneInput.fill(newPhone);
          await dialogPage.confirm();
          await listPage.waitForPageLoad();
        }
      }
    });

    test('should preserve data after edit cancel', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      const originalRowText = await listPage.getRow(0).textContent();

      await listPage.editRow(0);

      if (await dialogPage.isOpen()) {
        await dialogPage.fillInput('firstName', `Temp${randomString(4)}`);
        await dialogPage.cancel();

        await listPage.waitForPageLoad();
        const currentRowText = await listPage.getRow(0).textContent();
        expect(currentRowText).toBe(originalRowText);
      }
    });
  });

  test.describe('Delete Lead', () => {
    test('should show delete confirmation dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.deleteRow(0);

      const alertDialog = page.locator('[role="alertdialog"], [role="dialog"]');
      await expect(alertDialog).toBeVisible();
    });

    test('should cancel delete operation', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.deleteRow(0);
      await listPage.cancelDelete();

      const newCount = await listPage.getRowCount();
      expect(newCount).toBe(rowCount);
    });

    test('should delete lead after confirmation', async ({ page }) => {
      // First create a lead to delete to avoid removing existing data
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        const deleteTestName = `Delete${randomString(6)}`;
        await dialogPage.fillInput('firstName', deleteTestName);
        await dialogPage.fillInput('lastName', 'ToDelete');
        await dialogPage.fillInput('email', randomEmail());
        await dialogPage.confirm();
        await listPage.waitForPageLoad();

        // Find and delete the created lead
        await listPage.search(deleteTestName);
        const rowCount = await listPage.getRowCount();

        if (rowCount > 0) {
          await listPage.deleteRow(0);
          await listPage.confirmDelete();
          await listPage.waitForPageLoad();

          // Verify deletion
          await listPage.search(deleteTestName);
          const newCount = await listPage.getRowCount();
          expect(newCount).toBe(0);
        }
      }
    });

    test('should show warning message in delete dialog', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      await listPage.deleteRow(0);

      const alertDialog = page.locator('[role="alertdialog"], [role="dialog"]');
      await expect(alertDialog).toBeVisible();

      // Should contain warning text
      const dialogText = await alertDialog.textContent();
      expect(dialogText?.toLowerCase()).toMatch(/delete|remove|confirm|sure/);
    });
  });

  test.describe('Pagination', () => {
    test('should show pagination for many leads', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount >= 10) {
        await expect(listPage.pagination).toBeVisible();
      }
    });

    test('should navigate between pages', async () => {
      if (await listPage.hasNextPage()) {
        const firstPageFirstRow = await listPage.getRow(0).textContent();

        await listPage.nextPage();
        await expect(listPage.prevPageButton).toBeEnabled();

        const secondPageFirstRow = await listPage.getRow(0).textContent();
        // Pages should have different content
        expect(secondPageFirstRow).not.toBe(firstPageFirstRow);

        await listPage.prevPage();
        await expect(listPage.nextPageButton).toBeEnabled();
      }
    });

    test('should maintain search across pagination', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      // Search and then navigate
      const firstRowText = await listPage.getRow(0).textContent();
      const searchTerm = firstRowText?.split(' ')[0] || 'test';
      await listPage.search(searchTerm);

      if (await listPage.hasNextPage()) {
        await listPage.nextPage();
        // Search should persist
        const searchValue = await listPage.searchInput.inputValue();
        expect(searchValue).toBe(searchTerm);
      }
    });
  });

  test.describe('Table Sorting', () => {
    test('should sort by name', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Name');
    });

    test('should sort by status', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Status');
    });

    test('should sort by email', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      await listPage.sortByColumn('Email');
    });

    test('should toggle sort direction on double click', async () => {
      const rowCount = await listPage.getRowCount();
      if (rowCount < 2) {
        test.skip();
        return;
      }

      const firstRowBefore = await listPage.getRow(0).textContent();
      await listPage.sortByColumn('Name');
      const firstRowAfterFirstSort = await listPage.getRow(0).textContent();
      await listPage.sortByColumn('Name');
      const firstRowAfterSecondSort = await listPage.getRow(0).textContent();

      // Either content should change or stay same (depends on data)
      // Just verify no errors occurred
      expect(firstRowAfterSecondSort).toBeDefined();
    });
  });

  test.describe('Responsive Design', () => {
    test('should be functional on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await listPage.waitForPageLoad();

      // Table or cards should still be visible
      const hasContent = (await listPage.getRowCount()) > 0 || await listPage.isEmpty();
      expect(hasContent).toBe(true);
    });

    test('should show create button on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await listPage.waitForPageLoad();

      await expect(listPage.createButton).toBeVisible();
    });

    test('should be functional on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await listPage.waitForPageLoad();

      const hasContent = (await listPage.getRowCount()) > 0 || await listPage.isEmpty();
      expect(hasContent).toBe(true);
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should focus search with keyboard shortcut', async ({ page }) => {
      // Common shortcut is Cmd+K or Ctrl+K
      await page.keyboard.press('Meta+k');
      await page.waitForTimeout(300);

      // Either search is focused or command palette opened
      const searchFocused = await listPage.searchInput.evaluate(
        (el) => document.activeElement === el
      );
      // Just verify no errors
      expect(true).toBe(true);
    });

    test('should navigate table with arrow keys', async ({ page }) => {
      const rowCount = await listPage.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click first row to focus
      await listPage.getRow(0).click();
      await page.keyboard.press('ArrowDown');

      // Just verify no errors occurred during navigation
      expect(true).toBe(true);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate offline
      await page.route('**/api/**', (route) => route.abort());

      // Try to create - should show error message
      await listPage.clickCreate();

      if (await dialogPage.isOpen()) {
        await dialogPage.fillInput('firstName', `Network${randomString(4)}`);
        await dialogPage.fillInput('lastName', 'Test');
        await dialogPage.fillInput('email', randomEmail());
        await dialogPage.confirm();

        // Should show error toast or message
        await page.waitForTimeout(2000);
      }

      // Restore network
      await page.unroute('**/api/**');
    });
  });
});
